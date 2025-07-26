# app/services/cache_service.py
import json
import logging
import enum
import datetime
from datetime import timedelta
from typing import Any, Optional, Union
from sqlalchemy.ext.declarative import DeclarativeMeta

import redis
from fastapi import Depends, FastAPI

from ..core.config import settings

logger = logging.getLogger(__name__)

# Enhanced encoder class to handle SQLAlchemy models, datetime objects, and enums
class SQLAlchemyEncoder(json.JSONEncoder):
    def default(self, obj):
        # Handle SQLAlchemy model instances
        if isinstance(obj.__class__, DeclarativeMeta):
            # Get all columns from the SQLAlchemy model
            fields = {}
            for column in obj.__table__.columns:
                value = getattr(obj, column.name)
                # Recursively handle datetime and enum values
                if isinstance(value, datetime.datetime):
                    fields[column.name] = value.isoformat()
                elif isinstance(value, enum.Enum):
                    fields[column.name] = value.value
                else:
                    fields[column.name] = value
            return fields
        
        # Handle enum values
        elif isinstance(obj, enum.Enum):
            return obj.value
        
        # Handle datetime objects
        elif isinstance(obj, datetime.datetime):
            return obj.isoformat()
        
        # Handle datetime.date objects
        elif isinstance(obj, datetime.date):
            return obj.isoformat()
        
        # Handle sets (convert to list)
        elif isinstance(obj, set):
            return list(obj)
        
        return super().default(obj)

class RedisCache:
    def __init__(self):
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=0,
                decode_responses=True,
                socket_timeout=5,
            )
            self.default_expiry = timedelta(hours=1)
            logger.info(f"Redis cache initialized with host={settings.REDIS_HOST}, port={settings.REDIS_PORT}")
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {str(e)}")
            self.redis_client = None

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        """
        if not self.redis_client:
            return None
            
        try:
            data = self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting from cache: {str(e)}")
            return None

    async def set(
        self, 
        key: str, 
        value: Any, 
        expiry: Optional[Union[int, timedelta]] = None
    ) -> bool:
        """
        Set value in cache with expiry
        """
        if not self.redis_client:
            return False
            
        try:
            # Handle expiry
            if expiry is None:
                expiry = self.default_expiry
                
            if isinstance(expiry, timedelta):
                expiry = int(expiry.total_seconds())
                
            # Use the enhanced encoder that handles SQLAlchemy models, enums, and datetime
            return self.redis_client.setex(
                key,
                expiry,
                json.dumps(value, cls=SQLAlchemyEncoder)
            )
        except Exception as e:
            logger.error(f"Error setting cache: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete value from cache
        """
        if not self.redis_client:
            return False
            
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Error deleting from cache: {str(e)}")
            return False

    async def clear_pattern(self, pattern: str) -> bool:
        """
        Clear all keys matching pattern
        """
        if not self.redis_client:
            return False
            
        try:
            cursor = 0
            while True:
                cursor, keys = self.redis_client.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    self.redis_client.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.error(f"Error clearing cache pattern: {str(e)}")
            return False

    async def get_or_set(
        self, 
        key: str, 
        fetch_function,
        expiry: Optional[Union[int, timedelta]] = None
    ) -> Any:
        """
        Get from cache, or fetch and set if not found
        """
        # Try to get from cache first
        cached_value = await self.get(key)
        if cached_value is not None:
            return cached_value
        
        # Fetch the value
        value = await fetch_function() if callable(fetch_function) else fetch_function
        
        # Set in cache
        await self.set(key, value, expiry)
        
        return value

    def ping(self) -> bool:
        """
        Check if Redis is available
        """
        if not self.redis_client:
            return False
        try:
            return self.redis_client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {str(e)}")
            return False

# Cache instance
cache_instance = RedisCache()

async def get_cache() -> RedisCache:
    """
    Dependency to get cache instance
    """
    return cache_instance

async def setup_redis_cache():
    """
    Initialize Redis cache connection (compatibility function for init_services)
    """
    global cache_instance
    try:
        # Test the connection
        is_connected = cache_instance.ping()
        if is_connected:
            logger.info("Connected to Redis successfully")
        else:
            logger.error("Failed to connect to Redis")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
    
    return cache_instance