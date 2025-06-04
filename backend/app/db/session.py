# app/db/session.py
import logging
from .models import Base
from .database import engine

logger = logging.getLogger(__name__)

def create_tables():
    """
    Create database tables
    """
    try:
        logger.info("Creating database tables if they don't exist...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise