#!/usr/bin/env python3
"""
Database migration script to update season formats for different leagues
Run this after implementing the season management system
"""

import os
import sys
import logging
from datetime import datetime
from sqlalchemy import text, func

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.database import SessionLocal, engine
from app.db.models import Base, UserPrediction, Fixture, Group
from app.utils.season_manager import SeasonManager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def migrate_prediction_seasons():
    """Update prediction seasons to use proper league-based formats"""
    db = SessionLocal()
    
    try:
        logger.info("Starting season migration for predictions...")
        
        # Get all groups with their leagues
        groups = db.query(Group).all()
        group_leagues = {group.id: group.league for group in groups}
        
        # Get all unique seasons in predictions
        existing_seasons = db.query(UserPrediction.season).distinct().all()
        existing_seasons = [season[0] for season in existing_seasons]
        
        logger.info(f"Found existing seasons: {existing_seasons}")
        
        migration_mapping = {}
        
        # For each existing season, determine what it should be
        for season in existing_seasons:
            if season == "2025":
                # Current data - determine correct format based on usage
                
                # Check which leagues have predictions with this season
                sample_predictions = db.query(UserPrediction).filter(
                    UserPrediction.season == season
                ).limit(10).all()
                
                # Get group info for these predictions to determine leagues
                for pred in sample_predictions:
                    fixture = db.query(Fixture).filter(
                        Fixture.fixture_id == pred.fixture_id
                    ).first()
                    
                    if fixture and fixture.league:
                        league_name = fixture.league
                        
                        # Determine correct season format for this league
                        if league_name in ["Premier League", "La Liga", "UEFA Champions League"]:
                            # European leagues - should be 2024-2025 for current season
                            correct_season = "2024-2025"
                        else:
                            # MLS, tournaments - should remain 2025
                            correct_season = "2025"
                        
                        migration_mapping[season] = correct_season
                        break
        
        logger.info(f"Migration mapping: {migration_mapping}")
        
        # Perform the migration
        for old_season, new_season in migration_mapping.items():
            if old_season != new_season:
                logger.info(f"Updating season '{old_season}' to '{new_season}'")
                
                # Update predictions
                result = db.execute(
                    text("UPDATE user_predictions SET season = :new_season WHERE season = :old_season"),
                    {"new_season": new_season, "old_season": old_season}
                )
                
                logger.info(f"Updated {result.rowcount} prediction records")
                
                # Update fixtures if they exist with the old season
                fixture_result = db.execute(
                    text("UPDATE fixtures SET season = :new_season WHERE season = :old_season"),
                    {"new_season": new_season, "old_season": old_season}
                )
                
                logger.info(f"Updated {fixture_result.rowcount} fixture records")
        
        db.commit()
        logger.info("Season migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def migrate_fixture_seasons():
    """Update fixture seasons to use proper league-based formats"""
    db = SessionLocal()
    
    try:
        logger.info("Starting season migration for fixtures...")
        
        # Get all fixtures with their current seasons
        fixtures = db.query(Fixture.league, Fixture.season).distinct().all()
        
        for league, season in fixtures:
            if not league or not season:
                continue
                
            # Determine correct season format for this league
            correct_season = SeasonManager.convert_to_db_format(league, season)
            
            if season != correct_season:
                logger.info(f"Updating {league} fixtures: '{season}' -> '{correct_season}'")
                
                result = db.execute(
                    text("""
                        UPDATE fixtures 
                        SET season = :new_season 
                        WHERE league = :league AND season = :old_season
                    """),
                    {
                        "new_season": correct_season,
                        "league": league,
                        "old_season": season
                    }
                )
                
                logger.info(f"Updated {result.rowcount} fixture records for {league}")
        
        db.commit()
        logger.info("Fixture season migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during fixture migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def verify_migration():
    """Verify that the migration was successful"""
    db = SessionLocal()
    
    try:
        logger.info("Verifying migration results...")
        
        # Check prediction seasons
        pred_seasons = db.query(
            UserPrediction.season,
            func.count(UserPrediction.id).label('count')
        ).group_by(UserPrediction.season).all()
        
        logger.info("Prediction seasons after migration:")
        for season, count in pred_seasons:
            logger.info(f"  {season}: {count} predictions")
        
        # Check fixture seasons by league
        fixture_seasons = db.query(
            Fixture.league,
            Fixture.season,
            func.count(Fixture.fixture_id).label('count')
        ).group_by(Fixture.league, Fixture.season).all()
        
        logger.info("Fixture seasons after migration:")
        for league, season, count in fixture_seasons:
            logger.info(f"  {league} {season}: {count} fixtures")
            
        # Validate season formats
        logger.info("Validating season formats...")
        for league, season, count in fixture_seasons:
            if league and season:
                is_valid = SeasonManager.is_valid_season_format(league, season)
                if not is_valid:
                    logger.warning(f"Invalid season format: {league} - {season}")
                else:
                    logger.info(f"Valid: {league} - {season}")
        
    except Exception as e:
        logger.error(f"Error during verification: {e}")
    finally:
        db.close()

def main():
    """Run the complete migration process"""
    logger.info("Starting season format migration...")
    
    try:
        # Step 1: Migrate prediction seasons
        migrate_prediction_seasons()
        
        # Step 2: Migrate fixture seasons
        migrate_fixture_seasons()
        
        # Step 3: Verify results
        verify_migration()
        
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()