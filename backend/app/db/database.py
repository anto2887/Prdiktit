from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import logging
import os

logger = logging.getLogger(__name__)

# Create engine
# Use localhost when running locally, db service name when in Docker
DB_HOST = os.getenv("DB_HOST", "db")  # defaults to "db" for Docker
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "football_predictions")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(str(DATABASE_URL))

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """
    Get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 