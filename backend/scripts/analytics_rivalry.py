#!/usr/bin/env python3
"""
Analytics and Rivalry Features Migration Script
Adds new tables and columns for analytics, rivalries, and bonus points
Run this to add analytics and rivalry features to the database
"""

import os
import sys
import logging
from datetime import datetime
from sqlalchemy import text, func

# Add backend to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.db.database import SessionLocal, engine
from app.db.models import Base

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def create_analytics_tables():
    """Create new analytics and rivalry tables"""
    db = SessionLocal()
    
    try:
        logger.info("Creating analytics and rivalry tables...")
        
        # 1. Create user_analytics table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS user_analytics (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                analysis_type VARCHAR(50) NOT NULL,
                period VARCHAR(20) NOT NULL,
                data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Create indexes for user_analytics
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_analytics_user_type ON user_analytics (user_id, analysis_type)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_analytics_period ON user_analytics (period)"))
        db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS _analytics_period_uc ON user_analytics (user_id, analysis_type, period)"))
        
        # 2. Create rivalry_pairs table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS rivalry_pairs (
                id SERIAL PRIMARY KEY,
                user1_id INTEGER NOT NULL REFERENCES users(id),
                user2_id INTEGER NOT NULL REFERENCES users(id),
                group_id INTEGER NOT NULL REFERENCES groups(id),
                assigned_week INTEGER NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                is_champion_challenge BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ended_at TIMESTAMP WITH TIME ZONE,
                CONSTRAINT check_different_users CHECK (user1_id != user2_id)
            )
        """))
        
        # Create indexes for rivalry_pairs
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_rivalry_group_active ON rivalry_pairs (group_id, is_active)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_rivalry_week ON rivalry_pairs (assigned_week)"))
        
        # 3. Create rivalry_weeks table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS rivalry_weeks (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES groups(id),
                week INTEGER NOT NULL,
                season VARCHAR(20) NOT NULL,
                bonus_points INTEGER NOT NULL DEFAULT 3,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(group_id, week, season)
            )
        """))
        
        # Create indexes for rivalry_weeks
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_rivalry_weeks_group_season ON rivalry_weeks (group_id, season)"))
        
        # 4. Create user_streaks table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS user_streaks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                streak_type VARCHAR(20) NOT NULL,
                current_count INTEGER NOT NULL DEFAULT 0,
                max_count INTEGER NOT NULL DEFAULT 0,
                last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                season VARCHAR(20) NOT NULL,
                UNIQUE(user_id, streak_type, season)
            )
        """))
        
        # Create indexes for user_streaks
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_streaks_user_season ON user_streaks (user_id, season)"))
        
        # 5. Create group_heatmaps table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS group_heatmaps (
                id SERIAL PRIMARY KEY,
                group_id INTEGER NOT NULL REFERENCES groups(id),
                week INTEGER NOT NULL,
                season VARCHAR(20) NOT NULL,
                match_data JSONB,
                consensus_accuracy FLOAT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(group_id, week, season)
            )
        """))
        
        # Create indexes for group_heatmaps
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_heatmaps_group_week ON group_heatmaps (group_id, week, season)"))
        
        db.commit()
        logger.info("✅ Analytics and rivalry tables created successfully")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error creating analytics tables: {e}")
        raise
    finally:
        db.close()

def add_new_columns():
    """Add new columns to existing tables"""
    db = SessionLocal()
    
    try:
        logger.info("Adding new columns to existing tables...")
        
        # Add columns to user_predictions table
        db.execute(text("ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS bonus_type VARCHAR(20)"))
        db.execute(text("ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0"))
        db.execute(text("ALTER TABLE user_predictions ADD COLUMN IF NOT EXISTS is_rivalry_week BOOLEAN DEFAULT FALSE"))
        
        # Add columns to groups table
        db.execute(text("ALTER TABLE groups ADD COLUMN IF NOT EXISTS analytics_enabled BOOLEAN DEFAULT FALSE"))
        db.execute(text("ALTER TABLE groups ADD COLUMN IF NOT EXISTS analytics_activation_week INTEGER"))
        db.execute(text("ALTER TABLE groups ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 1"))
        
        # Create indexes for new columns
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_predictions_bonus ON user_predictions (bonus_type)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_predictions_rivalry ON user_predictions (is_rivalry_week)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_predictions_week_season ON user_predictions (week, season)"))
        
        db.commit()
        logger.info("✅ New columns added successfully")
        
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Error adding new columns: {e}")
        raise
    finally:
        db.close()

def verify_migration():
    """Verify that all tables and columns were created successfully"""
    db = SessionLocal()
    
    try:
        logger.info("Verifying migration...")
        
        # Check if new tables exist
        tables_to_check = [
            'user_analytics',
            'rivalry_pairs', 
            'rivalry_weeks',
            'user_streaks',
            'group_heatmaps'
        ]
        
        for table in tables_to_check:
            result = db.execute(text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')"))
            exists = result.scalar()
            if exists:
                logger.info(f"✅ Table {table} exists")
            else:
                logger.error(f"❌ Table {table} does not exist")
        
        # Check if new columns exist
        columns_to_check = [
            ('user_predictions', 'bonus_type'),
            ('user_predictions', 'bonus_points'),
            ('user_predictions', 'is_rivalry_week'),
            ('groups', 'analytics_enabled'),
            ('groups', 'analytics_activation_week'),
            ('groups', 'current_week')
        ]
        
        for table, column in columns_to_check:
            result = db.execute(text(f"SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '{table}' AND column_name = '{column}')"))
            exists = result.scalar()
            if exists:
                logger.info(f"✅ Column {table}.{column} exists")
            else:
                logger.error(f"❌ Column {table}.{column} does not exist")
        
        logger.info("✅ Migration verification complete")
        
    except Exception as e:
        logger.error(f"❌ Error verifying migration: {e}")
        raise
    finally:
        db.close()

def main():
    """Run the complete analytics and rivalry migration process"""
    logger.info("🚀 Starting Analytics and Rivalry Features Migration")
    
    try:
        # Step 1: Create new tables
        create_analytics_tables()
        
        # Step 2: Add new columns to existing tables
        add_new_columns()
        
        # Step 3: Verify migration
        verify_migration()
        
        logger.info("🎉 Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"💥 Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()