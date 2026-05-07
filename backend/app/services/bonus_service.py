# backend/app/services/bonus_service.py
"""
Bonus Points Service - Handles perfect week and flawless week bonuses
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from ..db.models import UserPrediction, User, PredictionStatus, Group
from ..db.repository import get_group_members

logger = logging.getLogger(__name__)

class BonusPointsService:
    """Handles all bonus point calculations and awards"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def calculate_weekly_bonuses(self, week: int, season: str, group_id: Optional[int] = None) -> Dict:
        """
        Calculate perfect/flawless week bonuses for users
        
        Perfect Week (3x): All predictions correct with exact scores
        Flawless Week (2x): No wrong predictions (all 1 or 3 points)
        """
        
        logger.info(f"🎁 Calculating weekly bonuses for week {week}, season {season}")
        
        try:
            # Check if bonuses are available for this group (group-relative activation)
            if group_id:
                bonus_available = await self._check_bonus_activation(group_id, week)
                if not bonus_available:
                    logger.info(f"🎁 Bonuses not yet available for group {group_id} at week {week}")
                    return {
                        'bonuses_available': False,
                        'reason': 'Group features not yet activated',
                        'perfect_weeks': 0,
                        'flawless_weeks': 0,
                        'users_processed': 0
                    }
            
            # Get all users to check (group-specific or all users)
            if group_id:
                group_members = await get_group_members(self.db, group_id)
                user_ids = [m['user_id'] for m in group_members if m.get('status') == 'APPROVED']
            else:
                # Get all users with predictions in this week
                user_ids_result = self.db.query(UserPrediction.user_id).filter(
                    UserPrediction.week == week,
                    UserPrediction.season == season,
                    UserPrediction.prediction_status == PredictionStatus.PROCESSED
                ).distinct().all()
                user_ids = [row[0] for row in user_ids_result]
            
            if not user_ids:
                logger.info(f"No users found for bonus calculation")
                return {'perfect_weeks': 0, 'flawless_weeks': 0, 'users_processed': 0}
            
            perfect_week_users = []
            flawless_week_users = []
            users_processed = 0
            
            # Check each user's performance for the week
            for user_id in user_ids:
                bonus_result = await self._check_user_weekly_bonus(user_id, week, season)
                
                if bonus_result['bonus_type']:
                    if bonus_result['bonus_type'] == 'perfect_week':
                        perfect_week_users.append(bonus_result)
                    elif bonus_result['bonus_type'] == 'flawless_week':
                        flawless_week_users.append(bonus_result)
                
                users_processed += 1
            
            # Apply bonuses
            perfect_bonuses_applied = 0
            flawless_bonuses_applied = 0
            
            for user_bonus in perfect_week_users:
                await self._apply_perfect_week_bonus(user_bonus['user_id'], week, season, user_bonus['original_points'])
                perfect_bonuses_applied += 1
            
            for user_bonus in flawless_week_users:
                await self._apply_flawless_week_bonus(user_bonus['user_id'], week, season, user_bonus['original_points'])
                flawless_bonuses_applied += 1
            
            logger.info(f"✅ Bonuses applied - Perfect: {perfect_bonuses_applied}, Flawless: {flawless_bonuses_applied}")
            
            return {
                'perfect_weeks': perfect_bonuses_applied,
                'flawless_weeks': flawless_bonuses_applied,
                'users_processed': users_processed,
                'perfect_week_users': [u['username'] for u in perfect_week_users],
                'flawless_week_users': [u['username'] for u in flawless_week_users]
            }
            
        except Exception as e:
            logger.error(f"❌ Error calculating weekly bonuses: {e}")
            raise
    
    async def _check_user_weekly_bonus(self, user_id: int, week: int, season: str) -> Dict:
        """Check if a user qualifies for weekly bonuses"""
        
        # Get all user's predictions for the week
        user_predictions = self.db.query(
            UserPrediction.points,
            UserPrediction.id
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.week == week,
            UserPrediction.season == season,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).all()
        
        if not user_predictions:
            return {'bonus_type': None, 'user_id': user_id}
        
        # Get user info
        user = self.db.query(User).filter(User.id == user_id).first()
        username = user.username if user else f"User{user_id}"
        
        # Analyze predictions
        prediction_points = [pred.points for pred in user_predictions]
        total_predictions = len(prediction_points)
        original_points = sum(prediction_points)
        
        # Check for perfect week (all 3 points)
        all_perfect = all(points == 3 for points in prediction_points)
        
        # Check for flawless week (no 0 points)
        no_wrong_predictions = all(points > 0 for points in prediction_points)
        
        bonus_type = None
        if all_perfect and total_predictions > 0:
            bonus_type = 'perfect_week'
            logger.info(f"🏆 Perfect week detected: {username} - {total_predictions} perfect predictions")
        elif no_wrong_predictions and total_predictions > 0 and not all_perfect:
            bonus_type = 'flawless_week'
            logger.info(f"💎 Flawless week detected: {username} - {total_predictions} predictions, no wrong ones")
        
        return {
            'bonus_type': bonus_type,
            'user_id': user_id,
            'username': username,
            'original_points': original_points,
            'prediction_count': total_predictions,
            'prediction_breakdown': {
                'perfect_predictions': sum(1 for p in prediction_points if p == 3),
                'correct_predictions': sum(1 for p in prediction_points if p == 1),
                'wrong_predictions': sum(1 for p in prediction_points if p == 0)
            }
        }
    
    async def _apply_perfect_week_bonus(self, user_id: int, week: int, season: str, original_points: int):
        """Apply 3x multiplier for perfect week"""
        
        # Calculate bonus (3x total - original = 2x original as bonus)
        bonus_points = original_points * 2  # 3x total - 1x original
        
        # Ensure minimum bonus for edge case where user had 0 points
        if original_points == 0:
            bonus_points = 3  # Give minimum bonus
        
        # Update all user's predictions for this week
        updated = self.db.query(UserPrediction).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.week == week,
            UserPrediction.season == season,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).update({
            'bonus_type': 'perfect_week',
            'bonus_points': bonus_points
        })
        
        self.db.commit()
        
        logger.info(f"🏆 Applied perfect week bonus: User {user_id}, original {original_points} -> bonus {bonus_points} (3x total)")
    
    async def _apply_flawless_week_bonus(self, user_id: int, week: int, season: str, original_points: int):
        """Apply 2x multiplier for flawless week"""
        
        # Calculate bonus (2x total - original = 1x original as bonus)
        bonus_points = original_points
        
        # Ensure minimum bonus for edge case where user had 0 points
        if original_points == 0:
            bonus_points = 2  # Give minimum bonus
        
        # Update all user's predictions for this week
        updated = self.db.query(UserPrediction).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.week == week,
            UserPrediction.season == season,
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).update({
            'bonus_type': 'flawless_week',
            'bonus_points': bonus_points
        })
        
        self.db.commit()
        
        logger.info(f"💎 Applied flawless week bonus: User {user_id}, original {original_points} -> bonus {bonus_points} (2x total)")
    
    async def get_user_bonus_history(self, user_id: int, season: str) -> List[Dict]:
        """Get user's bonus week history"""
        
        bonus_weeks = self.db.query(
            UserPrediction.week,
            UserPrediction.bonus_type,
            func.sum(UserPrediction.points).label('original_points'),
            func.sum(UserPrediction.bonus_points).label('bonus_points'),
            func.count(UserPrediction.id).label('prediction_count')
        ).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.season == season,
            UserPrediction.bonus_type.isnot(None),
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).group_by(
            UserPrediction.week,
            UserPrediction.bonus_type
        ).order_by(UserPrediction.week).all()
        
        bonus_history = []
        for week_data in bonus_weeks:
            total_points = week_data.original_points + week_data.bonus_points
            multiplier = "3x" if week_data.bonus_type == 'perfect_week' else "2x"
            
            bonus_history.append({
                'week': week_data.week,
                'bonus_type': week_data.bonus_type,
                'original_points': week_data.original_points,
                'bonus_points': week_data.bonus_points,
                'total_points': total_points,
                'multiplier': multiplier,
                'prediction_count': week_data.prediction_count
            })
        
        return bonus_history
    
    async def get_group_bonus_summary(self, group_id: int, season: str) -> Dict:
        """Get summary of bonus weeks for a group"""
        
        # Get group members
        group_members = await get_group_members(self.db, group_id)
        member_ids = [m['user_id'] for m in group_members if m.get('status') == 'APPROVED']
        
        if not member_ids:
            return {'error': 'No group members found'}
        
        # Get all bonus weeks for group members
        bonus_data = self.db.query(
            UserPrediction.user_id,
            UserPrediction.week,
            UserPrediction.bonus_type,
            func.sum(UserPrediction.points).label('original_points'),
            func.sum(UserPrediction.bonus_points).label('bonus_points')
        ).filter(
            UserPrediction.user_id.in_(member_ids),
            UserPrediction.season == season,
            UserPrediction.bonus_type.isnot(None),
            UserPrediction.prediction_status == PredictionStatus.PROCESSED
        ).group_by(
            UserPrediction.user_id,
            UserPrediction.week,
            UserPrediction.bonus_type
        ).all()
        
        # Organize by user
        user_bonuses = defaultdict(list)
        total_perfect_weeks = 0
        total_flawless_weeks = 0
        
        for bonus in bonus_data:
            user = next((m for m in group_members if m['user_id'] == bonus.user_id), None)
            username = user['username'] if user else f"User{bonus.user_id}"
            
            user_bonuses[username].append({
                'week': bonus.week,
                'bonus_type': bonus.bonus_type,
                'original_points': bonus.original_points,
                'bonus_points': bonus.bonus_points,
                'total_points': bonus.original_points + bonus.bonus_points
            })
            
            if bonus.bonus_type == 'perfect_week':
                total_perfect_weeks += 1
            elif bonus.bonus_type == 'flawless_week':
                total_flawless_weeks += 1
        
        # Find user with most bonus weeks
        bonus_leader = None
        max_bonuses = 0
        for username, bonuses in user_bonuses.items():
            if len(bonuses) > max_bonuses:
                max_bonuses = len(bonuses)
                bonus_leader = username
        
        return {
            'group_id': group_id,
            'season': season,
            'total_perfect_weeks': total_perfect_weeks,
            'total_flawless_weeks': total_flawless_weeks,
            'total_bonus_weeks': total_perfect_weeks + total_flawless_weeks,
            'bonus_leader': bonus_leader,
            'bonus_leader_count': max_bonuses,
            'user_bonuses': dict(user_bonuses),
            'members_with_bonuses': len(user_bonuses)
        }
    
    async def check_and_apply_weekly_bonuses(self, week: int, season: str, league: str = None) -> Dict:
        """
        Main method to check and apply weekly bonuses across all groups
        This should be called after all predictions for a week are processed
        """
        
        logger.info(f"🎁 Checking weekly bonuses for week {week}, season {season}, league {league}")
        
        try:
            # Get all groups (filter by league if specified)
            if league:
                from ..db.models import Group
                groups = self.db.query(Group).filter(Group.league == league).all()
            else:
                from ..db.models import Group
                groups = self.db.query(Group).all()
            
            total_perfect = 0
            total_flawless = 0
            total_users = 0
            group_results = []
            
            for group in groups:
                group_result = await self.calculate_weekly_bonuses(week, season, group.id)
                
                total_perfect += group_result['perfect_weeks']
                total_flawless += group_result['flawless_weeks']
                total_users += group_result['users_processed']
                
                if group_result['perfect_weeks'] > 0 or group_result['flawless_weeks'] > 0:
                    group_results.append({
                        'group_id': group.id,
                        'group_name': group.name,
                        'league': group.league,
                        **group_result
                    })
            
            logger.info(f"✅ Weekly bonus processing complete - Perfect: {total_perfect}, Flawless: {total_flawless}, Users: {total_users}")
            
            return {
                'week': week,
                'season': season,
                'league': league,
                'total_perfect_weeks': total_perfect,
                'total_flawless_weeks': total_flawless,
                'total_users_processed': total_users,
                'groups_with_bonuses': len(group_results),
                'group_results': group_results
            }
            
        except Exception as e:
            logger.error(f"❌ Error in weekly bonus processing: {e}")
            raise
    
    async def _check_bonus_activation(self, group_id: int, current_week: int) -> bool:
        """Check if bonuses are activated for a group using group-relative activation"""
        try:
            logger.info(f"🔍 Checking bonus activation for group {group_id} at week {current_week}")
            
            from ..db.models import Group
            group = self.db.query(Group).filter(Group.id == group_id).first()
            if not group:
                logger.warning(f"Group {group_id} not found for bonus activation check")
                return False
            
            # Check if group has activation data
            if not group.activation_week:
                logger.warning(f"Group {group_id} missing activation data")
                return False
            
            # Check if features are activated for this group
            if current_week < group.activation_week:
                logger.info(f"Group {group_id} features not yet activated (week {current_week} < {group.activation_week})")
                return False
            
            logger.info(f"✅ Group {group_id} bonuses activated at week {current_week}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error checking bonus activation for group {group_id}: {e}")
            return False