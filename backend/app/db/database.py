from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging
import os
from ..core.config import settings

logger = logging.getLogger(__name__)

# Use Railway's DATABASE_URI if available, otherwise fall back to individual components
def get_database_url():
    # First try to use the full DATABASE_URI from Railway
    if hasattr(settings, 'DATABASE_URI') and settings.DATABASE_URI:
        logger.info("Using DATABASE_URI from environment (Railway)")
        return str(settings.DATABASE_URI)
    
    # Fallback to individual components (for local development)
    DB_HOST = os.getenv("DB_HOST", "db")  # defaults to "db" for Docker
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_NAME = os.getenv("DB_NAME", "football_predictions")
    
    database_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    logger.info(f"Using constructed DATABASE_URL for local development: postgresql://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    return database_url

# Get the database URL
DATABASE_URL = get_database_url()

# Create engine
engine = create_engine(DATABASE_URL, echo=False)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 