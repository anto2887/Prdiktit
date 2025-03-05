# app/services/cache_service.py
import json
import logging
from datetime import timedelta
from typing import Any, Optional, Union

import redis
from fastapi import Depends, FastAPI

from ..core.config import settings

logger = logging.getLogger(__name__)

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
                
            return self.redis_client.setex(
                key,
                expiry,
                json.dumps(value)
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
    # Remove any await statements when creating the Redis client
    # Change this:
    # redis = await Redis(...)
    
    # To this:
    redis = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        password=settings.REDIS_PASSWORD,
        decode_responses=True
    )
    
    # If you need to check the connection, use a try/except block
    try:
        # Use ping() without await
        redis.ping()
        logger.info("Connected to Redis successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        
    return redis

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