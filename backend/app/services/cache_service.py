# app/services/cache_service.py - Fixed Redis Connection
import json
import redis
import logging
from datetime import datetime, timedelta
from typing import Any, Optional, Union
from enum import Enum
from ..core.config import settings

logger = logging.getLogger(__name__)

class SQLAlchemyEncoder(json.JSONEncoder):
    """Custom JSON encoder for SQLAlchemy models, enums, and datetime objects"""
    
    def default(self, obj):
        if hasattr(obj, '__dict__'):
            # Handle SQLAlchemy models
            result = {}
            for key, value in obj.__dict__.items():
                if not key.startswith('_'):
                    result[key] = value
            return result
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, timedelta):
            return obj.total_seconds()
        elif hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
            # Convert iterables (except strings) to list
            return list(obj)
        elif isinstance(obj, set):
            return list(obj)
        
        return super().default(obj)

class RedisCache:
    def __init__(self):
        try:
            # Build Redis connection parameters
            redis_params = {
                'host': settings.REDIS_HOST,
                'port': settings.REDIS_PORT,
                'db': getattr(settings, 'REDIS_DB', 0),
                'decode_responses': True,
                'socket_timeout': 5,
                'socket_connect_timeout': 5,
                'retry_on_timeout': True,
            }
            
            # Add password if provided
            if hasattr(settings, 'REDIS_PASSWORD') and settings.REDIS_PASSWORD:
                redis_params['password'] = settings.REDIS_PASSWORD
                logger.info(f"Redis connecting with authentication to {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            else:
                logger.info(f"Redis connecting without authentication to {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            
            self.redis_client = redis.Redis(**redis_params)
            self.default_expiry = timedelta(hours=1)
            
            # Test the connection
            self.redis_client.ping()
            logger.info(f"✅ Redis cache connected successfully to {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Redis cache: {str(e)}")
            logger.error(f"Redis settings: host={settings.REDIS_HOST}, port={settings.REDIS_PORT}")
            self.redis_client = None

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
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
        """Set value in cache with expiry"""
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
        """Delete value from cache"""
        if not self.redis_client:
            return False
            
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Error deleting from cache: {str(e)}")
            return False

    async def clear_pattern(self, pattern: str) -> bool:
        """Clear all keys matching pattern"""
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
        """Get from cache, or fetch and set if not found"""
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
        """Check if Redis is available"""
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
    """Dependency to get cache instance"""
    return cache_instance

async def setup_redis_cache():
    """Initialize Redis cache connection (compatibility function for init_services)"""
    global cache_instance
    try:
        # Test the connection
        is_connected = cache_instance.ping()
        if is_connected:
            logger.info("✅ Connected to Redis successfully")
        else:
            logger.error("❌ Failed to connect to Redis")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Redis: {e}")
    
    return cache_instance