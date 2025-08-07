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
    
    async def assign_rivalries(self, group_id: int, week: int, season: str, league: str) -> List[Dict]:
        """
        Auto-assign rivals based on performance proximity
        Uses Champion Challenge system for odd-numbered groups
        """
        logger.info(f"🥊 Assigning rivalries for group {group_id}, week {week}, league {league}")
        
        # Check if this is a rivalry week for this league
        rivalry_weeks = self._get_rivalry_weeks(league, season)
        if week not in rivalry_weeks:
            logger.info(f"Week {week} is not a rivalry week for {league}. Rivalry weeks: {rivalry_weeks}")
            return []
        
        try:
            # Get current group standings
            standings = await self._get_group_standings(group_id, season, week)
            
            if len(standings) < 2:
                logger.warning(f"Group {group_id} has fewer than 2 members, skipping rivalry assignment")
                return []
            
            # Deactivate old rivalries for this group
            await self._deactivate_old_rivalries(group_id)
            
            # Create rivalry pairs
            rivalries = await self._create_rivalry_pairs(group_id, standings, week, season)
            
            logger.info(f"✅ Created {len(rivalries)} rivalry pairs for group {group_id}")
            return rivalries
            
        except Exception as e:
            logger.error(f"❌ Error assigning rivalries for group {group_id}: {e}")
            raise
    
    async def _get_group_standings(self, group_id: int, season: str, current_week: int) -> List[Dict]:
        """Get current group standings for rivalry assignment"""
        
        # Get group members
        members = await get_group_members(self.db, group_id)
        
        standings = []
        
        for member in members:
            if member.get('status') != 'APPROVED':
                continue
                
            user_id = member['user_id']
            
            # Calculate user's total points up to current week
            points_result = self.db.query(
                func.coalesce(func.sum(UserPrediction.points), 0).label('total_points'),
                func.count(UserPrediction.id).label('prediction_count')
            ).filter(
                UserPrediction.user_id == user_id,
                UserPrediction.season == season,
                UserPrediction.week < current_week,  # Up to but not including current week
                UserPrediction.prediction_status == PredictionStatus.PROCESSED
            ).first()
            
            total_points = int(points_result.total_points or 0)
            prediction_count = int(points_result.prediction_count or 0)
            
            # Calculate average points per prediction
            avg_points = total_points / prediction_count if prediction_count > 0 else 0
            
            standings.append({
                'user_id': user_id,
                'username': member['username'],
                'total_points': total_points,
                'prediction_count': prediction_count,
                'avg_points': round(avg_points, 2)
            })
        
        # Sort by total points (descending), then by avg points, then by username
        standings.sort(key=lambda x: (-x['total_points'], -x['avg_points'], x['username']))
        
        # Add ranking
        for i, standing in enumerate(standings):
            standing['rank'] = i + 1
        
        logger.info(f"📊 Group {group_id} standings: {[(s['rank'], s['username'], s['total_points']) for s in standings]}")
        
        return standings
    
    async def _create_rivalry_pairs(self, group_id: int, standings: List[Dict], week: int, season: str) -> List[Dict]:
        """Create rivalry pairs using Champion Challenge for odd groups"""
        
        total_players = len(standings)
        rivalries = []
        
        if total_players == 1:
            logger.info(f"Only 1 player in group {group_id}, no rivalries possible")
            return []
        
        if total_players % 2 == 0:
            # Even number - create standard pairs
            rivalries = await self._create_standard_pairs(group_id, standings, week, season)
        else:
            # Odd number - use Champion Challenge
            rivalries = await self._create_champion_challenge_pairs(group_id, standings, week, season)
        
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
        
        if rivalry.is_champion_challenge:
            # Champion Challenge: Champion must beat ALL challengers
            # This is handled at a higher level by checking all champion rivalries together
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
                'ended_at': rivalry.ended_at.isoformat() if rivalry.ended_at else None
            }
            
            rivalries_list.append(rivalry_data)
        
        return rivalries_list