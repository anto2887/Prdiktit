# app/db/session.py
import logging
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, ProgrammingError
from .models import Base
from .database import engine, SessionLocal

# Import all models to ensure they're registered with Base.metadata
from . import (
    User, Group, Fixture, Team, UserPrediction, TeamTracker,
    PendingMembership, UserResults, GroupAuditLog, GroupAnalytics,
    UserAnalytics, RivalryPair, RivalryWeek, UserStreak, GroupHeatmap
)

logger = logging.getLogger(__name__)

def create_tables():
    """
    Create database tables with robust error handling for Railway deployment
    """
    try:
        logger.info("Creating database tables if they don't exist...")
        
        # Use checkfirst=True to avoid conflicts
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        logger.info("Database tables created successfully.")
        
    except (IntegrityError, ProgrammingError) as e:
        error_msg = str(e).lower()
        
        # Handle common deployment scenarios
        if "already exists" in error_msg or "duplicate" in error_msg:
            logger.warning(f"Some database objects already exist (this is normal): {e}")
            logger.info("Continuing with existing database schema...")
        else:
            logger.error(f"Database schema error: {e}")
            raise
            
    except Exception as e:
        logger.error(f"Unexpected error creating database tables: {e}")
        raise

def verify_tables():
    """
    Verify that essential tables exist
    """
    db = SessionLocal()
    try:
        essential_tables = [
            'users', 'teams', 'fixtures', 'user_predictions', 'groups'
        ]
        
        for table in essential_tables:
            result = db.execute(text(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')"))
            exists = result.scalar()
            if exists:
                logger.info(f"✅ Table {table} verified")
            else:
                logger.error(f"❌ Essential table {table} missing!")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error verifying tables: {e}")
        return False
    finally:
        db.close()

def create_tables_with_verification():
    """
    Create tables and verify they were created successfully
    """
    try:
        # Attempt to create tables
        create_tables()
        
        # Verify essential tables exist
        if verify_tables():
            logger.info("✅ All essential database tables verified successfully")
            return True
        else:
            logger.error("❌ Table verification failed")
            return False
            
    except Exception as e:
        logger.error(f"Failed to create and verify database tables: {e}")
        return False