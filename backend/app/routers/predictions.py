# app/routers/predictions.py
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from sqlalchemy.orm import Session

from ..core.security import get_current_active_user
from ..db.session import get_db
from ..services.cache_service import get_cache, RedisCache
from ..db.repositories.matches import get_fixture_by_id
from ..db.repositories.predictions import (
    get_user_prediction,
    create_prediction,
    update_prediction,
    reset_prediction,
    get_prediction_by_id,
    get_user_predictions
)
from ..schemas.prediction import (
    PredictionCreate, PredictionUpdate, PredictionResponse,
    PredictionList, PredictionStatus, MatchStatus,
    BatchPredictionCreate, BatchPredictionResponse
)
from ..schemas.user import UserInDB

router = APIRouter()

@router.post("", response_model=PredictionResponse)
async def submit_prediction(
    prediction_data: PredictionCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Submit a new prediction
    """
    # Get the fixture
    fixture = await get_fixture_by_id(db, prediction_data.fixture_id)
    
    if not fixture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fixture not found"
        )
    
    # Check if match has already started
    if fixture.status != MatchStatus.NOT_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot predict after match has started"
        )
    
    # Check if user already has a prediction for this fixture
    existing_prediction = await get_user_prediction(
        db, 
        current_user.id, 
        prediction_data.fixture_id
    )
    
    if existing_prediction:
        # Update existing prediction
        updated_prediction = await update_prediction(
            db,
            existing_prediction.id,
            score1=prediction_data.score1,
            score2=prediction_data.score2
        )
        
        if not updated_prediction:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update prediction"
            )
            
        # Clear cache
        await cache.delete(f"user_predictions:{current_user.id}")
        
        return {
            "status": "success",
            "data": updated_prediction
        }
    
    # Create new prediction
    week = int(fixture.round.split(' ')[-1]) if 'round' in fixture.round.lower() else 0
    
    new_prediction = await create_prediction(
        db,
        current_user.id,
        prediction_data.fixture_id,
        prediction_data.score1,
        prediction_data.score2,
        fixture.season,
        week
    )
    
    # Clear cache
    await cache.delete(f"user_predictions:{current_user.id}")
    
    return {
        "status": "success",
        "data": new_prediction
    }

@router.get("/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(
    prediction_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get prediction by ID
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Check if prediction belongs to current user
    if prediction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return {
        "status": "success",
        "data": prediction
    }

@router.post("/reset/{prediction_id}", response_model=dict)
async def reset_prediction_endpoint(
    prediction_id: int = Path(...),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Reset a prediction to editable state
    """
    prediction = await get_prediction_by_id(db, prediction_id)
    
    if not prediction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prediction not found"
        )
    
    # Check if prediction belongs to current user
    if prediction.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if match has already started
    if prediction.fixture.status != MatchStatus.NOT_STARTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset prediction after match has started"
        )
    
    reset_pred = await reset_prediction(db, prediction_id)
    
    if not reset_pred:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reset prediction"
        )
    
    # Clear cache
    await cache.delete(f"user_predictions:{current_user.id}")
    
    return {
        "status": "success",
        "message": "Prediction reset successfully"
    }

@router.get("/user", response_model=PredictionList)
async def get_user_predictions_endpoint(
    fixture_id: int = Query(None),
    status: PredictionStatus = Query(None),
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Get user's predictions
    """
    # If no filters are applied, try to get from cache
    if not fixture_id and not status:
        cache_key = f"user_predictions:{current_user.id}"
        cached_predictions = await cache.get(cache_key)
        
        if cached_predictions:
            return {
                "status": "success",
                "data": cached_predictions
            }
    
    # Get predictions from database
    predictions = await get_user_predictions(
        db,
        current_user.id,
        fixture_id=fixture_id,
        status=status
    )
    
    # Cache only if no filters are applied
    if not fixture_id and not status:
        await cache.set(f"user_predictions:{current_user.id}", predictions, 300)
    
    return {
        "status": "success",
        "data": predictions
    }

@router.post("/batch", response_model=BatchPredictionResponse)
async def create_batch_predictions(
    predictions_data: BatchPredictionCreate,
    current_user: UserInDB = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    cache: RedisCache = Depends(get_cache)
):
    """
    Create multiple predictions at once
    """
    results = []
    
    for fixture_id, scores in predictions_data.predictions.items():
        try:
            # Get the fixture
            fixture = await get_fixture_by_id(db, int(fixture_id))
            
            if not fixture or fixture.status != MatchStatus.NOT_STARTED:
                continue
            
            # Check if user already has a prediction
            existing_prediction = await get_user_prediction(
                db, 
                current_user.id, 
                int(fixture_id)
            )
            
            # Extract scores
            score1 = scores.home
            score2 = scores.away
            
            if existing_prediction:
                # Update existing prediction
                prediction = await update_prediction(
                    db,
                    existing_prediction.id,
                    score1=score1,
                    score2=score2
                )
            else:
                # Create new prediction
                week = int(fixture.round.split(' ')[-1]) if 'round' in fixture.round.lower() else 0
                
                prediction = await create_prediction(
                    db,
                    current_user.id,
                    int(fixture_id),
                    score1,
                    score2,
                    fixture.season,
                    week
                )
            
            results.append({
                "prediction_id": prediction.id,
                "fixture_id": prediction.fixture_id,
                "score1": prediction.score1,
                "score2": prediction.score2,
                "status": prediction.prediction_status.value
            })
            
        except Exception as e:
            # Skip any fixtures with errors
            continue
    
    # Clear cache
    await cache.delete(f"user_predictions:{current_user.id}")
    
    return {
        "status": "success",
        "message": "Predictions saved successfully",
        "data": results
    }