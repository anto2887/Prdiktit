# backend/app/services/prediction_visibility.py
"""
Prediction Visibility Service - Handles post-kickoff prediction visibility
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..db.models import (
    UserPrediction, Fixture, User, Group, MatchStatus, 
    PredictionStatus, group_members
)
from ..db.repository import check_group_membership, get_group_members

logger = logging.getLogger(__name__)

class PredictionVisibilityService:
    """Handles prediction visibility logic based on kickoff times"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def get_group_predictions_for_week(self, group_id: int, week: int, season: str, current_user_id: int) -> List[Dict]:
        """
        Return all group predictions for a week, but only for matches where kickoff has passed
        """
        logger.info(f"👀 Getting group predictions for group {group_id}, week {week}, user {current_user_id}")
        
        try:
            # Verify user is a member of the group
            is_member = await check_group_membership(self.db, group_id, current_user_id)
            if not is_member:
                raise PermissionError(f"User {current_user_id} is not a member of group {group_id}")
            
            # Get group details to determine league and normalize season
            group = self.db.query(Group).filter(Group.id == group_id).first()
            if not group:
                raise ValueError(f"Group {group_id} not found")
            
            # Normalize season format for database query (same as leaderboard)
            from ..utils.season_manager import SeasonManager
            normalized_season = SeasonManager.normalize_season_for_query(group.league, season)
            logger.info(f"👀 Original season: {season}, normalized season: {normalized_season}")
            
            # Get all group members
            group_members_list = await get_group_members(self.db, group_id)
            member_ids = [m['user_id'] for m in group_members_list if m.get('status') == 'APPROVED']
            
            if not member_ids:
                logger.info(f"No approved members found for group {group_id}")
                return []
            
            logger.info(f"Found {len(member_ids)} approved members: {member_ids}")
            
            # Get all fixtures for this week with prediction data
            current_time = datetime.now(timezone.utc)
            
            # Build query step by step to catch any issues
            try:
                # Start with basic query
                base_query = self.db.query(
                    UserPrediction.user_id,
                    UserPrediction.score1,
                    UserPrediction.score2,
                    UserPrediction.points,
                    UserPrediction.prediction_status,
                    UserPrediction.created,
                    Fixture.fixture_id,
                    Fixture.home_team,
                    Fixture.away_team,
                    Fixture.date,
                    Fixture.status,
                    Fixture.home_score,
                    Fixture.away_score,
                    User.username
                )
                
                logger.info("Base query created successfully")
                
                # Add joins
                query_with_joins = base_query.join(
                    Fixture, UserPrediction.fixture_id == Fixture.fixture_id
                ).join(
                    User, UserPrediction.user_id == User.id
                )
                
                logger.info("Joins added successfully")
                
                # Add filters
                filtered_query = query_with_joins.filter(
                    UserPrediction.user_id.in_(member_ids),
                    UserPrediction.week == week,
                    UserPrediction.season == normalized_season,  # Use normalized season
                    UserPrediction.prediction_status.in_([
                        PredictionStatus.SUBMITTED, 
                        PredictionStatus.LOCKED, 
                        PredictionStatus.PROCESSED
                    ])
                )
                
                logger.info("Filters added successfully")
                logger.info(f"Filter details: member_ids={member_ids}, week={week}, season={normalized_season}")
                logger.info(f"Prediction statuses: {[PredictionStatus.SUBMITTED, PredictionStatus.LOCKED, PredictionStatus.PROCESSED]}")
                
                # Let's check what predictions exist without filters first
                all_predictions = self.db.query(UserPrediction).all()
                logger.info(f"Total predictions in database: {len(all_predictions)}")
                
                if all_predictions:
                    sample_pred = all_predictions[0]
                    logger.info(f"Sample prediction: user_id={sample_pred.user_id}, week={sample_pred.week}, season={sample_pred.season}, status={sample_pred.prediction_status}")
                
                # Check predictions for this group members
                group_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.user_id.in_(member_ids)
                ).all()
                logger.info(f"Predictions for group members: {len(group_predictions)}")
                
                if group_predictions:
                    for pred in group_predictions[:3]:  # Show first 3
                        logger.info(f"Group prediction: user_id={pred.user_id}, week={pred.week}, season={pred.season}, status={pred.prediction_status}")
                
                # Check predictions for this week
                week_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.week == week
                ).all()
                logger.info(f"Predictions for week {week}: {len(week_predictions)}")
                
                # Check predictions for this season (both original and normalized)
                season_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.season == season
                ).all()
                logger.info(f"Predictions for original season {season}: {len(season_predictions)}")
                
                normalized_season_predictions = self.db.query(UserPrediction).filter(
                    UserPrediction.season == normalized_season
                ).all()
                logger.info(f"Predictions for normalized season {normalized_season}: {len(normalized_season_predictions)}")
                
                # Add ordering
                final_query = filtered_query.order_by(Fixture.date, User.username)
                
                logger.info("Ordering added successfully")
                
                # Execute query
                predictions_query = final_query.all()
                
                logger.info(f"Query executed successfully, found {len(predictions_query)} predictions")
                
            except Exception as query_error:
                logger.error(f"Database query error: {query_error}")
                logger.error(f"Query error type: {type(query_error).__name__}")
                import traceback
                logger.error(f"Query traceback: {traceback.format_exc()}")
                raise
            
            # Convert to simple array format expected by frontend
            predictions_list = []
            
            for pred in predictions_query:
                try:
                    # Check if predictions should be visible for this fixture
                    is_visible, reason = self._check_prediction_visibility(pred.date, pred.status, current_time)
                    
                    if is_visible:
                        prediction_data = {
                            "id": pred.user_id,  # Use user_id as id for group context
                            "match_id": pred.fixture_id,
                            "user_id": pred.user_id,
                            
                            # Include BOTH field naming conventions for compatibility (same as /predictions/user)
                            "home_score": pred.score1,  # New naming (for API consistency)
                            "away_score": pred.score2,  # New naming (for API consistency)
                            "score1": pred.score1,      # Old naming (for frontend compatibility)
                            "score2": pred.score2,      # Old naming (for frontend compatibility)
                            
                            "points": pred.points or 0,
                            "prediction_status": pred.prediction_status.value,
                            "created": pred.created.isoformat() if pred.created else None,
                            "season": normalized_season,
                            "week": week,
                            
                            # User data for group context
                            "user": {
                                "id": pred.user_id,
                                "username": pred.username
                            },
                            
                            # Complete fixture data (same structure as /predictions/user)
                            "fixture": {
                                "fixture_id": pred.fixture_id,
                                "home_team": pred.home_team,
                                "away_team": pred.away_team,
                                "home_team_logo": None,  # Add if available in your fixture data
                                "away_team_logo": None,  # Add if available in your fixture data
                                "date": pred.date.isoformat() if pred.date else None,
                                "league": group.league,  # Use group league
                                "status": pred.status.value if hasattr(pred.status, 'value') else str(pred.status),
                                "home_score": pred.home_score,
                                "away_score": pred.away_score,
                                "season": normalized_season,
                                "round": None,  # Add if available
                                "venue": None,  # Add if available
                                "venue_city": None
                            }
                        }
                        predictions_list.append(prediction_data)
                except Exception as pred_error:
                    logger.error(f"Error processing prediction: {pred_error}")
                    continue
            
            logger.info(f"Returning {len(predictions_list)} visible predictions")
            return predictions_list
            
        except PermissionError:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting group predictions: {e}")
            logger.error(f"Error details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def _check_prediction_visibility(self, kickoff_time: Optional[datetime], match_status: MatchStatus, current_time: datetime) -> tuple[bool, str]:
        """
        Check if predictions should be visible based on kickoff time and match status
        """
        
        # If match has started or finished, predictions are always visible
        if match_status in [
            MatchStatus.LIVE, 
            MatchStatus.HALFTIME,
            MatchStatus.FINISHED, 
            MatchStatus.FINISHED_AET, 
            MatchStatus.FINISHED_PEN,
            MatchStatus.SUSPENDED,
            MatchStatus.CANCELLED
        ]:
            return True, f"Match status: {match_status.value}"
        
        # If no kickoff time available, hide predictions
        if not kickoff_time:
            return False, "No kickoff time available"
        
        # Ensure kickoff time is timezone-aware
        if kickoff_time.tzinfo is None:
            kickoff_utc = kickoff_time.replace(tzinfo=timezone.utc)
        else:
            kickoff_utc = kickoff_time.astimezone(timezone.utc)
        
        # Check if kickoff time has passed
        if current_time >= kickoff_utc:
            return True, f"Kickoff time passed: {kickoff_utc.isoformat()}"
        else:
            time_until_kickoff = kickoff_utc - current_time
            return False, f"Kickoff in {time_until_kickoff}"
    
    async def get_match_prediction_summary(self, fixture_id: int, current_user_id: int) -> Dict:
        """
        Get prediction summary for a specific match (if visible)
        """
        logger.info(f"📊 Getting prediction summary for fixture {fixture_id}")
        
        try:
            # Get fixture information
            fixture = self.db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
            if not fixture:
                raise ValueError(f"Fixture {fixture_id} not found")
            
            # Check if predictions are visible for this match
            current_time = datetime.now(timezone.utc)
            is_visible, reason = self._check_prediction_visibility(fixture.date, fixture.status, current_time)
            
            if not is_visible:
                return {
                    'fixture_id': fixture_id,
                    'is_visible': False,
                    'reason': reason,
                    'fixture_info': {
                        'home_team': fixture.home_team,
                        'away_team': fixture.away_team,
                        'kickoff_time': fixture.date.isoformat() if fixture.date else None,
                        'status': fixture.status.value if fixture.status else 'NOT_STARTED'
                    }
                }
            
            # Get all predictions for this match
            predictions = self.db.query(
                UserPrediction.score1,
                UserPrediction.score2,
                UserPrediction.points,
                User.username,
                UserPrediction.user_id
            ).join(
                User, UserPrediction.user_id == User.id
            ).filter(
                UserPrediction.fixture_id == fixture_id,
                UserPrediction.prediction_status.in_([
                    PredictionStatus.SUBMITTED, 
                    PredictionStatus.LOCKED, 
                    PredictionStatus.PROCESSED
                ])
            ).all()
            
            # Calculate prediction statistics
            if predictions:
                prediction_counts = {}
                total_predictions = len(predictions)
                
                for pred in predictions:
                    score_key = f"{pred.score1}-{pred.score2}"
                    if score_key not in prediction_counts:
                        prediction_counts[score_key] = {
                            'count': 0,
                            'usernames': [],
                            'percentage': 0
                        }
                    prediction_counts[score_key]['count'] += 1
                    prediction_counts[score_key]['usernames'].append(pred.username)
                
                # Calculate percentages
                for score, data in prediction_counts.items():
                    data['percentage'] = round((data['count'] / total_predictions) * 100, 1)
                
                # Sort by popularity
                popular_predictions = sorted(
                    prediction_counts.items(), 
                    key=lambda x: x[1]['count'], 
                    reverse=True
                )
                
                # Check if there's a consensus (most popular prediction has >40%)
                consensus = None
                if popular_predictions and popular_predictions[0][1]['percentage'] >= 40:
                    consensus = {
                        'score': popular_predictions[0][0],
                        'percentage': popular_predictions[0][1]['percentage'],
                        'count': popular_predictions[0][1]['count']
                    }
            else:
                popular_predictions = []
                consensus = None
                total_predictions = 0
            
            return {
                'fixture_id': fixture_id,
                'is_visible': True,
                'fixture_info': {
                    'home_team': fixture.home_team,
                    'away_team': fixture.away_team,
                    'kickoff_time': fixture.date.isoformat() if fixture.date else None,
                    'status': fixture.status.value if fixture.status else 'NOT_STARTED',
                    'actual_score': {
                        'home': fixture.home_score,
                        'away': fixture.away_score
                    } if fixture.home_score is not None else None
                },
                'prediction_summary': {
                    'total_predictions': total_predictions,
                    'popular_predictions': popular_predictions[:5],  # Top 5
                    'consensus': consensus,
                    'all_predictions': [
                        {
                            'username': pred.username,
                            'predicted_score': f"{pred.score1}-{pred.score2}",
                            'points': pred.points
                        } for pred in predictions
                    ]
                },
                'generated_at': current_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting match prediction summary: {e}")
            raise
    
    async def get_upcoming_visibility_schedule(self, group_id: int, week: int, season: str, current_user_id: int) -> List[Dict]:
        """
        Get schedule of when predictions will become visible for upcoming matches
        """
        logger.info(f"📅 Getting visibility schedule for group {group_id}, week {week}")
        
        try:
            # Verify user is a member of the group
            is_member = await check_group_membership(self.db, group_id, current_user_id)
            if not is_member:
                raise PermissionError(f"User {current_user_id} is not a member of group {group_id}")
            
            # Get all fixtures for this week that have predictions
            current_time = datetime.now(timezone.utc)
            
            fixtures_with_predictions = self.db.query(
                Fixture.fixture_id,
                Fixture.home_team,
                Fixture.away_team,
                Fixture.date,
                Fixture.status,
                func.count(UserPrediction.id).label('prediction_count')
            ).join(
                UserPrediction, Fixture.fixture_id == UserPrediction.fixture_id
            ).filter(
                UserPrediction.week == week,
                UserPrediction.season == season,
                UserPrediction.prediction_status.in_([
                    PredictionStatus.SUBMITTED, 
                    PredictionStatus.LOCKED, 
                    PredictionStatus.PROCESSED
                ])
            ).group_by(
                Fixture.fixture_id,
                Fixture.home_team,
                Fixture.away_team,
                Fixture.date,
                Fixture.status
            ).all()
            
            schedule = []
            
            for fixture in fixtures_with_predictions:
                # Check if predictions are currently visible
                is_visible, reason = self._check_prediction_visibility(fixture.date, fixture.status, current_time)
                
                if not is_visible:
                    # Calculate time until visibility
                    if fixture.date:
                        if fixture.date.tzinfo is None:
                            kickoff_utc = fixture.date.replace(tzinfo=timezone.utc)
                        else:
                            kickoff_utc = fixture.date.astimezone(timezone.utc)
                        
                        time_until_kickoff = kickoff_utc - current_time
                        hours_until_kickoff = time_until_kickoff.total_seconds() / 3600
                        
                        schedule.append({
                            'fixture_id': fixture.fixture_id,
                            'home_team': fixture.home_team,
                            'away_team': fixture.away_team,
                            'kickoff_time': fixture.date.isoformat() if fixture.date else None,
                            'prediction_count': fixture.prediction_count,
                            'hours_until_visible': round(hours_until_kickoff, 1),
                            'visibility_reason': reason
                        })
            
            # Sort by kickoff time
            schedule.sort(key=lambda x: x['kickoff_time'] if x['kickoff_time'] else '')
            
            return schedule
            
        except PermissionError:
            raise
        except Exception as e:
            logger.error(f"❌ Error getting visibility schedule: {e}")
            raise