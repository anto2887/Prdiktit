"""
Rivalry Service - Manages dynamic rivalry assignment and Champion Challenge system
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..db.models import (
    RivalryPair, RivalryWeek, User, Group, UserPrediction, 
    group_members, PredictionStatus
)
from ..db.repository import get_group_members, check_group_membership

logger = logging.getLogger(__name__)

class RivalryService:
    """Handles all rivalry-related operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.max_point_gap = 8  # Maximum allowed gap between rivals
    
    def _get_rivalry_weeks(self, league: str, season: str) -> List[int]:
        """Calculate rivalry weeks based on league season length"""
        
        # Get season length for different leagues
        season_lengths = {
            'Premier League': 38,
            'La Liga': 38, 
            'Serie A': 38,
            'Bundesliga': 34,
            'Ligue 1': 38,
            'MLS': 34,
            'Champions League': 13,  # Group + Knockout phases
            'Europa League': 15,
            'World Cup': 7,  # Group + Knockout
            'FA Cup': 8,
            'League Cup': 7,
            'Championship': 46,  # English Championship
        }
        
        total_weeks = season_lengths.get(league, 38)  # Default to 38
        
        # Calculate evenly spaced rivalry weeks throughout season
        if total_weeks <= 8:
            # Very short tournaments - 2 rivalry weeks
            return [total_weeks // 2, total_weeks - 1]
        elif total_weeks <= 15:
            # Short tournaments - 3 rivalry weeks  
            return [total_weeks // 3, (total_weeks * 2) // 3, total_weeks - 1]
        else:
            # Full seasons - 4 rivalry weeks evenly distributed
            interval = total_weeks // 5
            return [
                interval,           # ~Week 7-8 for Premier League
                interval * 2,       # ~Week 15-16
                interval * 3,       # ~Week 23-24
                interval * 4        # ~Week 30-31
            ]
    
    def _is_rivalry_week_for_group(self, group_id: int, week: int, season: str) -> bool:
        """Check if this is a rivalry week for a specific group using group-relative activation"""
        try:
            logger.info(f"🔍 Checking if week {week} is rivalry week for group {group_id}")
            
            # Get group's activation and rivalry schedule
            group = self.db.query(Group).filter(Group.id == group_id).first()
            if not group:
                logger.warning(f"Group {group_id} not found")
                return False
            
            # Check if group has activation data
            if not group.activation_week or not group.next_rivalry_week:
                logger.warning(f"Group {group_id} missing activation data: activation_week={group.activation_week}, next_rivalry_week={group.next_rivalry_week}")
                return False
            
            # Check if features are activated for this group
            if week < group.activation_week:
                logger.info(f"Group {group_id} features not yet activated (week {week} < {group.activation_week})")
                return False
            
            # Check if this is a rivalry week
            if week == group.next_rivalry_week:
                logger.info(f"✅ Week {week} is rivalry week for group {group_id}")
                return True
            
            # Check if this is a subsequent rivalry week (every 4 weeks after first activation)
            weeks_since_activation = week - group.activation_week
            if weeks_since_activation >= 4 and (weeks_since_activation % 4 == 0):
                logger.info(f"✅ Week {week} is subsequent rivalry week for group {group_id} (every 4 weeks)")
                return True
            
            logger.info(f"❌ Week {week} is not a rivalry week for group {group_id}")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error checking rivalry week for group {group_id}: {e}")
            return False
    
    async def _update_next_rivalry_week(self, group_id: int, current_week: int) -> None:
        """Update the next rivalry week for a group (every 4 weeks after activation)"""
        try:
            logger.info(f"🔄 Updating next rivalry week for group {group_id}")
            
            group = self.db.query(Group).filter(Group.id == group_id).first()
            if not group or not group.activation_week:
                logger.warning(f"Cannot update rivalry week for group {group_id} - missing activation data")
                return
            
            # Calculate next rivalry week (4 weeks from current week)
            next_rivalry_week = current_week + 4
            
            # Update the group
            group.next_rivalry_week = next_rivalry_week
            self.db.commit()
            
            logger.info(f"✅ Updated group {group_id} next rivalry week to {next_rivalry_week}")
            
        except Exception as e:
            logger.error(f"❌ Error updating next rivalry week for group {group_id}: {e}")
            self.db.rollback()
    
    async def assign_rivalries(self, group_id: int, week: int, season: str, league: str) -> List[Dict]:
        """
        Auto-assign rivals based on performance proximity
        Uses Champion Challenge system for odd-numbered groups
        """
        logger.info(f"🥊 Assigning rivalries for group {group_id}, week {week}, league {league}")
        
        # Check if this is a rivalry week for this specific group using group-relative activation
        if not self._is_rivalry_week_for_group(group_id, week, season):
            logger.info(f"Week {week} is not a rivalry week for group {group_id}")
            return []
        
        try:
            # Get current group standings
            standings = await self._get_group_standings(group_id, season)
            
            if len(standings) < 2:
                logger.warning(f"Group {group_id} has fewer than 2 members, skipping rivalry assignment")
                return []
            
            # Deactivate old rivalries for this group
            await self._deactivate_old_rivalries(group_id)
            
            # Create rivalry pairs
            rivalries = await self._create_rivalry_pairs(group_id, standings, week, season)
            
            # Update next rivalry week for this group (every 4 weeks after activation)
            await self._update_next_rivalry_week(group_id, week)
            
            logger.info(f"✅ Created {len(rivalries)} rivalry pairs for group {group_id}")
            return rivalries
            
        except Exception as e:
            logger.error(f"❌ Error assigning rivalries for group {group_id}: {e}")
            raise
    
    async def _get_group_standings(self, group_id: int, season: str) -> List[Dict]:
        """Get group standings for a specific season"""
        try:
            # Get all group members with their total points
            standings_query = self.db.query(
                User.id.label('user_id'),
                User.username,
                func.coalesce(func.sum(UserPrediction.points), 0).label('total_points')
            ).join(
                group_members, User.id == group_members.c.user_id
            ).outerjoin(
                UserPrediction, and_(
                    User.id == UserPrediction.user_id,
                    UserPrediction.group_id == group_id,
                    UserPrediction.season == season,
                    UserPrediction.prediction_status == PredictionStatus.PROCESSED
                )
            ).filter(
                group_members.c.group_id == group_id,
                group_members.c.status == 'APPROVED'
            ).group_by(
                User.id, User.username
            ).order_by(
                func.coalesce(func.sum(UserPrediction.points), 0).desc()
            )
            
            standings = standings_query.all()
            
            # Convert to list of dictionaries
            standings_list = []
            for standing in standings:
                standings_list.append({
                    'user_id': standing.user_id,
                    'username': standing.username,
                    'total_points': int(standing.total_points or 0)
                })
            
            logger.info(f"📊 Retrieved standings for group {group_id}: {len(standings_list)} users")
            return standings_list
            
        except Exception as e:
            logger.error(f"❌ Error getting group standings: {e}")
            return []
    
    async def _create_rivalry_pairs(self, group_id: int, standings: List[Dict], week: int, season: str) -> List[Dict]:
        """Create rivalry pairs using Comeback Challenge for odd groups"""
        
        total_players = len(standings)
        rivalries = []
        
        if total_players == 1:
            logger.info(f"Only 1 player in group {group_id}, no rivalries possible")
            return []
        
        if total_players % 2 == 0:
            # Even number - create standard pairs
            logger.info(f"Group {group_id} has even number of players ({total_players}), creating standard rivalries")
            rivalries = await self._create_standard_pairs(group_id, standings, week, season)
        else:
            # Odd number - use Comeback Challenge
            logger.info(f"Group {group_id} has odd number of players ({total_players}), creating Comeback Challenge rivalries")
            rivalries = await self._assign_comeback_challenge(group_id, standings, week, season)
        
        return rivalries
    
    async def _create_standard_pairs(self, group_id: int, standings: List[Dict], week: int, season: str) -> List[Dict]:
        """Create standard 1v1 rivalry pairs"""
        
        rivalries = []
        used_players = set()
        
        # Pair adjacent players in standings where possible
        for i in range(0, len(standings) - 1, 2):
            user1 = standings[i]
            user2 = standings[i + 1]
            
            # Check if point gap is reasonable
            point_gap = abs(user1['total_points'] - user2['total_points'])
            
            if point_gap <= self.max_point_gap:
                rivalry = await self._create_rivalry_pair(
                    group_id, user1['user_id'], user2['user_id'], 
                    week, season, is_champion_challenge=False
                )
                rivalries.append({
                    'type': 'standard',
                    'user1': user1,
                    'user2': user2,
                    'point_gap': point_gap,
                    'rivalry_id': rivalry.id
                })
                
                used_players.add(user1['user_id'])
                used_players.add(user2['user_id'])
                
                logger.info(f"🥊 Standard rivalry: {user1['username']} vs {user2['username']} (gap: {point_gap})")
        
        # Handle any remaining unpaired players
        unpaired = [s for s in standings if s['user_id'] not in used_players]
        if len(unpaired) >= 2:
            # Pair remaining players
            for i in range(0, len(unpaired) - 1, 2):
                user1 = unpaired[i]
                user2 = unpaired[i + 1]
                
                rivalry = await self._create_rivalry_pair(
                    group_id, user1['user_id'], user2['user_id'], 
                    week, season, is_champion_challenge=False
                )
                rivalries.append({
                    'type': 'standard',
                    'user1': user1,
                    'user2': user2,
                    'point_gap': abs(user1['total_points'] - user2['total_points']),
                    'rivalry_id': rivalry.id
                })
                
                logger.info(f"🥊 Remaining rivalry: {user1['username']} vs {user2['username']}")
        
        return rivalries
    
    async def _create_champion_challenge_pairs(self, group_id: int, standings: List[Dict], week: int, season: str) -> List[Dict]:
        """Create Champion Challenge pairs for odd-numbered groups"""
        
        rivalries = []
        
        if len(standings) < 3:
            # Not enough players for Champion Challenge, create single pair
            user1, user2 = standings[0], standings[1]
            rivalry = await self._create_rivalry_pair(
                group_id, user1['user_id'], user2['user_id'], 
                week, season, is_champion_challenge=False
            )
            rivalries.append({
                'type': 'standard',
                'user1': user1,
                'user2': user2,
                'point_gap': abs(user1['total_points'] - user2['total_points']),
                'rivalry_id': rivalry.id
            })
            return rivalries
        
        # Champion Challenge: Top player vs #2 and #3
        champion = standings[0]
        challenger1 = standings[1]
        challenger2 = standings[2]
        
        # Create champion vs challenger1 rivalry
        rivalry1 = await self._create_rivalry_pair(
            group_id, champion['user_id'], challenger1['user_id'], 
            week, season, is_champion_challenge=True
        )
        
        # Create champion vs challenger2 rivalry
        rivalry2 = await self._create_rivalry_pair(
            group_id, champion['user_id'], challenger2['user_id'], 
            week, season, is_champion_challenge=True
        )
        
        rivalries.append({
            'type': 'champion_challenge',
            'champion': champion,
            'challengers': [challenger1, challenger2],
            'rivalry_ids': [rivalry1.id, rivalry2.id]
        })
        
        logger.info(f"🏆 Champion Challenge: {champion['username']} vs ({challenger1['username']} + {challenger2['username']})")
        
        # Pair remaining players (if any) in standard rivalries
        remaining = standings[3:]
        for i in range(0, len(remaining) - 1, 2):
            user1 = remaining[i]
            user2 = remaining[i + 1]
            
            rivalry = await self._create_rivalry_pair(
                group_id, user1['user_id'], user2['user_id'], 
                week, season, is_champion_challenge=False
            )
            rivalries.append({
                'type': 'standard',
                'user1': user1,
                'user2': user2,
                'point_gap': abs(user1['total_points'] - user2['total_points']),
                'rivalry_id': rivalry.id
            })
            
            logger.info(f"🥊 Remaining rivalry: {user1['username']} vs {user2['username']}")
        
        return rivalries
    
    async def _create_rivalry_pair(self, group_id: int, user1_id: int, user2_id: int, 
                                 week: int, season: str, is_champion_challenge: bool = False) -> RivalryPair:
        """Create a new rivalry pair in the database"""
        
        rivalry = RivalryPair(
            user1_id=user1_id,
            user2_id=user2_id,
            group_id=group_id,
            assigned_week=week,
            is_active=True,
            is_champion_challenge=is_champion_challenge,
            created_at=datetime.now(timezone.utc)
        )
        
        self.db.add(rivalry)
        self.db.commit()
        self.db.refresh(rivalry)
        
        return rivalry
    
    async def _deactivate_old_rivalries(self, group_id: int):
        """Deactivate old rivalries for a group"""
        
        self.db.query(RivalryPair).filter(
            RivalryPair.group_id == group_id,
            RivalryPair.is_active == True
        ).update({
            'is_active': False,
            'ended_at': datetime.now(timezone.utc)
        })
        
        self.db.commit()
    
    async def check_rivalry_outcomes(self, group_id: int, week: int, season: str, league: str) -> Dict:
        """Check rivalry week results and award bonus points"""
        
        logger.info(f"🏁 Checking rivalry outcomes for group {group_id}, week {week}, league {league}")
        
        # Check if this is a rivalry week for this league
        rivalry_weeks = self._get_rivalry_weeks(league, season)
        if week not in rivalry_weeks:
            logger.info(f"Week {week} is not a rivalry week for {league}")
            return {'rivalries_processed': 0, 'bonuses_awarded': 0}
        
        try:
            # Get active rivalries for this group and week
            active_rivalries = self.db.query(RivalryPair).filter(
                RivalryPair.group_id == group_id,
                RivalryPair.assigned_week == week,
                RivalryPair.is_active == True
            ).all()
            
            bonuses_awarded = 0
            rivalries_processed = 0
            
            # Process each rivalry
            for rivalry in active_rivalries:
                outcome = await self._process_rivalry_outcome(rivalry, week, season)
                if outcome['bonus_awarded']:
                    bonuses_awarded += 1
                rivalries_processed += 1
            
            logger.info(f"✅ Processed {rivalries_processed} rivalries, awarded {bonuses_awarded} bonuses")
            
            return {
                'rivalries_processed': rivalries_processed,
                'bonuses_awarded': bonuses_awarded
            }
            
        except Exception as e:
            logger.error(f"❌ Error checking rivalry outcomes: {e}")
            raise
    
    async def _process_rivalry_outcome(self, rivalry: RivalryPair, week: int, season: str) -> Dict:
        """Process outcome for a single rivalry"""
        
        # Get week points for both users
        user1_points = await self._get_user_week_points(rivalry.user1_id, week, season)
        user2_points = await self._get_user_week_points(rivalry.user2_id, week, season)
        
        bonus_awarded = False
        winner_id = None
        
        # Check if this is a Comeback Challenge rivalry
        if rivalry.comeback_challenge_benchmark is not None:
            # Process as Comeback Challenge rivalry
            comeback_outcome = await self._process_comeback_challenge_outcome(rivalry, week, season)
            return comeback_outcome
        elif rivalry.is_champion_challenge:
            # Legacy Champion Challenge: Champion must beat ALL challengers
            # This is handled at a higher level by checking all champion rivalries together
            logger.info(f"Processing legacy Champion Challenge rivalry {rivalry.id}")
            pass
        else:
            # Standard rivalry: Higher score wins
            if user1_points > user2_points:
                winner_id = rivalry.user1_id
                await self._award_rivalry_bonus(rivalry.user1_id, week, season)
                bonus_awarded = True
            elif user2_points > user1_points:
                winner_id = rivalry.user2_id
                await self._award_rivalry_bonus(rivalry.user2_id, week, season)
                bonus_awarded = True
            # Tie = no bonus
        
        return {
            'rivalry_id': rivalry.id,
            'user1_points': user1_points,
            'user2_points': user2_points,
            'winner_id': winner_id,
            'bonus_awarded': bonus_awarded
        }
    
    async def _get_user_week_points(self, user_id: int, week: int, season: str) -> int:
        """Get user's total points for a specific week"""
        
        result = self.db.query(
            func.coalesce(func.sum(UserPrediction.points), 0)
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.week == week,
            UserPrediction.season == season,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).scalar()
        
        return int(result or 0)
    
    async def _award_rivalry_bonus(self, user_id: int, week: int, season: str):
        """Award rivalry bonus points to a user"""
        
        # Update all user's predictions for this week to mark rivalry bonus
        self.db.query(UserPrediction).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.week == week,
            UserPrediction.season == season
        ).update({
            'is_rivalry_week': True,
            'bonus_points': 3
        })
        
        self.db.commit()
        
        logger.info(f"🏆 Awarded 3 rivalry bonus points to user {user_id} for week {week}")
    
    async def get_group_rivalries(self, group_id: int) -> List[Dict]:
        """Get current rivalries for a group"""
        
        active_rivalries = self.db.query(RivalryPair).filter(
            RivalryPair.group_id == group_id,
            RivalryPair.is_active == True
        ).all()
        
        # Convert to flat array format expected by frontend
        rivalries_list = []
        
        for rivalry in active_rivalries:
            user1 = self.db.query(User).filter(User.id == rivalry.user1_id).first()
            user2 = self.db.query(User).filter(User.id == rivalry.user2_id).first()
            
            rivalry_data = {
                'id': rivalry.id,
                'user1_id': rivalry.user1_id,
                'user2_id': rivalry.user2_id,
                'user1_name': user1.username if user1 else 'Unknown',
                'user2_name': user2.username if user2 else 'Unknown',
                'rivalry_week': rivalry.assigned_week,
                'is_active': rivalry.is_active,
                'is_champion_challenge': rivalry.is_champion_challenge,
                'created_at': rivalry.created_at.isoformat() if rivalry.created_at else None,
                'ended_at': rivalry.ended_at.isoformat() if rivalry.ended_at else None,
                # Comeback Challenge fields
                'comeback_challenge_benchmark': float(rivalry.comeback_challenge_benchmark) if rivalry.comeback_challenge_benchmark else None,
                'comeback_challenge_status': rivalry.comeback_challenge_status,
                'is_comeback_challenge': rivalry.comeback_challenge_benchmark is not None
            }
            
            rivalries_list.append(rivalry_data)
        
        return rivalries_list

    # Comeback Challenge Methods
    async def _calculate_comeback_challenge_benchmark(self, group_id: int, user_id: int, season: str) -> float:
        """Calculate the benchmark score for Comeback Challenge (average of 2 users above)"""
        try:
            logger.info(f"📊 Calculating Comeback Challenge benchmark for user {user_id} in group {group_id}")
            
            # Get group standings
            standings = await self._get_group_standings(group_id, season)
            if not standings:
                logger.warning(f"No standings found for group {group_id}")
                return 0.0
            
            # Find user's position
            user_position = None
            for i, user in enumerate(standings):
                if user['user_id'] == user_id:
                    user_position = i
                    break
            
            if user_position is None:
                logger.warning(f"User {user_id} not found in group {group_id} standings")
                return 0.0
            
            # Get 2 users above this user
            users_above = []
            for i in range(max(0, user_position - 2), user_position):
                if i < len(standings):
                    users_above.append(standings[i])
            
            if len(users_above) == 0:
                logger.info(f"User {user_id} is at the top, no benchmark needed")
                return 0.0
            
            # Calculate average points of users above
            total_points = sum(user['total_points'] for user in users_above)
            benchmark = total_points / len(users_above)
            
            logger.info(f"📊 Comeback Challenge benchmark for user {user_id}: {benchmark} (average of {len(users_above)} users above)")
            return round(benchmark, 2)
            
        except Exception as e:
            logger.error(f"❌ Error calculating Comeback Challenge benchmark: {e}")
            return 0.0

    async def _assign_comeback_challenge(self, group_id: int, standings: List[Dict], week: int, season: str) -> List[Dict]:
        """Assign Comeback Challenge to users who need it (odd-numbered groups)"""
        try:
            logger.info(f"🎯 Assigning Comeback Challenge for group {group_id} with {len(standings)} users")
            
            rivalries = []
            
            if len(standings) < 3:
                logger.info(f"Group {group_id} has only {len(standings)} users, no Comeback Challenge possible")
                return await self._create_standard_pairs(group_id, standings, week, season)
            
            # Check if group has odd number of users (Comeback Challenge only for odd groups)
            if len(standings) % 2 == 0:
                logger.info(f"Group {group_id} has even number of users ({len(standings)}), no Comeback Challenge")
                return await self._create_standard_pairs(group_id, standings, week, season)
            
            # Comeback Challenge: Middle user gets special treatment
            comeback_user_position = len(standings) // 2
            comeback_user = standings[comeback_user_position]
            
            logger.info(f"🎯 User {comeback_user['username']} (position {comeback_user_position + 1}) gets Comeback Challenge")
            
            # Calculate benchmark for Comeback Challenge user
            benchmark = await self._calculate_comeback_challenge_benchmark(group_id, comeback_user['user_id'], season)
            
            # Create Comeback Challenge rivalry with user above
            if comeback_user_position > 0:
                user_above = standings[comeback_user_position - 1]
                
                rivalry = await self._create_rivalry_pair(
                    group_id, comeback_user['user_id'], user_above['user_id'], 
                    week, season, is_champion_challenge=True
                )
                
                # Set Comeback Challenge specific fields
                rivalry.comeback_challenge_benchmark = benchmark
                rivalry.comeback_challenge_status = 'active'
                self.db.commit()
                
                rivalries.append({
                    'type': 'comeback_challenge',
                    'comeback_user': comeback_user,
                    'challenger': user_above,
                    'benchmark': benchmark,
                    'rivalry_id': rivalry.id
                })
                
                logger.info(f"🥊 Comeback Challenge: {comeback_user['username']} vs {user_above['username']} (benchmark: {benchmark})")
            
            # Create standard rivalries for remaining users
            remaining_users = [user for i, user in enumerate(standings) if i != comeback_user_position]
            standard_rivalries = await self._create_standard_pairs(group_id, remaining_users, week, season)
            rivalries.extend(standard_rivalries)
            
            # Activate Comeback Challenge for this group
            group = self.db.query(Group).filter(Group.id == group_id).first()
            if group:
                group.comeback_challenge_activated = True
                self.db.commit()
                logger.info(f"✅ Activated Comeback Challenge for group {group_id}")
            
            return rivalries
            
        except Exception as e:
            logger.error(f"❌ Error assigning Comeback Challenge: {e}")
            # Fallback to standard pairs
            return await self._create_standard_pairs(group_id, standings, week, season)

    async def _process_comeback_challenge_outcome(self, rivalry: RivalryPair, week: int, season: str) -> Dict:
        """Process outcome for a Comeback Challenge rivalry"""
        try:
            logger.info(f"🎯 Processing Comeback Challenge outcome for rivalry {rivalry.id}")
            
            # Get week points for both users
            user1_points = await self._get_user_week_points(rivalry.user1_id, week, season)
            user2_points = await self._get_user_week_points(rivalry.user2_id, week, season)
            
            # Determine which user is the Comeback Challenge user
            comeback_user_id = None
            challenger_user_id = None
            
            if rivalry.comeback_challenge_benchmark is not None:
                # This is a Comeback Challenge rivalry
                comeback_user_id = rivalry.user1_id
                challenger_user_id = rivalry.user2_id
                comeback_points = user1_points
                challenger_points = user2_points
            else:
                # This is a regular rivalry
                comeback_user_id = rivalry.user2_id
                challenger_user_id = rivalry.user1_id
                comeback_points = user2_points
                challenger_points = user1_points
            
            # Check if Comeback Challenge user beat the benchmark
            benchmark = rivalry.comeback_challenge_benchmark or 0
            comeback_success = comeback_points >= benchmark
            
            bonus_awarded = False
            winner_id = None
            
            if comeback_success:
                # Comeback Challenge user succeeded - they get bonus points
                await self._award_rivalry_bonus(comeback_user_id, week, season)
                bonus_awarded = True
                winner_id = comeback_user_id
                
                # Update rivalry status
                rivalry.comeback_challenge_status = 'completed'
                self.db.commit()
                
                logger.info(f"🏆 Comeback Challenge user {comeback_user_id} succeeded! Beat benchmark {benchmark} with {comeback_points} points")
            else:
                # Comeback Challenge user failed
                rivalry.comeback_challenge_status = 'failed'
                self.db.commit()
                
                logger.info(f"❌ Comeback Challenge user {comeback_user_id} failed. Got {comeback_points} points, needed {benchmark}")
            
            return {
                'rivalry_id': rivalry.id,
                'comeback_user_id': comeback_user_id,
                'challenger_user_id': challenger_user_id,
                'comeback_points': comeback_points,
                'challenger_points': challenger_points,
                'benchmark': benchmark,
                'comeback_success': comeback_success,
                'bonus_awarded': bonus_awarded,
                'winner_id': winner_id
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing Comeback Challenge outcome: {e}")
            return {
                'rivalry_id': rivalry.id,
                'error': str(e),
                'bonus_awarded': False
            }