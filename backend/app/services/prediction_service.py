# backend/app/services/prediction_service.py
from ..utils.season_manager import SeasonManager
from ..db.models import UserPrediction, Fixture, Group
from sqlalchemy.orm import Session
from typing import Dict, List, Optional

class PredictionService:
    """Service for handling prediction operations with proper season management"""
    
    @staticmethod
    def create_prediction(
        db: Session,
        user_id: int,
        fixture_id: int,
        home_score: int,
        away_score: int,
        week: int
    ) -> UserPrediction:
        """Create a new prediction with proper season formatting"""
        
        # Get fixture to determine league and season
        fixture = db.query(Fixture).filter(Fixture.fixture_id == fixture_id).first()
        if not fixture:
            raise ValueError("Fixture not found")
        
        # Normalize season format for database storage
        normalized_season = SeasonManager.convert_to_db_format(fixture.league, fixture.season)
        
        prediction = UserPrediction(
            user_id=user_id,
            fixture_id=fixture_id,
            week=week,
            season=normalized_season,  # Use normalized season
            score1=home_score,
            score2=away_score,
            points=0  # Will be calculated when match is finished
        )
        
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        
        return prediction
    
    @staticmethod
    def get_user_predictions_for_season(
        db: Session,
        user_id: int,
        league_name: str,
        season_input: str
    ) -> List[UserPrediction]:
        """Get user predictions for a specific season with proper formatting"""
        
        normalized_season = SeasonManager.normalize_season_for_query(league_name, season_input)
        
        return db.query(UserPrediction).filter(
            UserPrediction.user_id == user_id,
            UserPrediction.season == normalized_season
        ).all() 