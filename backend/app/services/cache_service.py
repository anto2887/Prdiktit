# app/services/cache_service.py
import json
import logging
import enum
import datetime  # Added import for datetime
from datetime import timedelta
from typing import Any, Optional, Union

import redis
from fastapi import Depends, FastAPI

from ..core.config import settings

logger = logging.getLogger(__name__)

# Updated encoder class to handle datetime objects
class EnumEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, enum.Enum):
            return obj.value
        elif isinstance(obj, datetime.datetime):
            return obj.isoformat()  # Convert datetime to ISO format string
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
                
            # Use the enhanced encoder that handles both Enum and datetime
            return self.redis_client.setex(
                key,
                expiry,
                json.dumps(value, cls=EnumEncoder)
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
        fetch_func, 
        expiry: Optional[Union[int, timedelta]] = None
    ) -> Any:
        """
        Get from cache or set if not exists
        """
        # Try to get from cache first
        cached_data = await self.get(key)
        if cached_data is not None:
            return cached_data
            
        # If not in cache, fetch and store
        data = await fetch_func()
        if data is not None:
            await self.set(key, data, expiry)
            
        return data

# Global cache instance
redis_cache = RedisCache()

# Dependency
async def get_cache():
    """
    Get cache client as dependency
    """
    return redis_cache

# Redis client instance
redis_client = None

async def setup_redis_cache():
    """
    Initialize Redis cache connection
    """
    # Fix the variable name conflict - don't use 'redis' as both module and variable
    # Change this:
    # redis = redis.Redis(...)
    
    # To this:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
    
    # If you need to check the connection, use a try/except block
    try:
        # Use ping() without await
        redis_client.ping()
        logger.info("Connected to Redis successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        
    return redis_client

def get_redis_client():
    """Get Redis client instance"""
    global redis_client
    if redis_client is None:
        redis_client = setup_redis_cache()
    return redis_client

def close_redis_connection():
    """Close Redis connection"""
    global redis_client
    if redis_client is not None:
        redis_client.close()
        redis_client = None