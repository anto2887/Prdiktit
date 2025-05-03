# app/middleware/rate_limiter.py
import time
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Tuple, Optional
import asyncio
import json
import logging

# Configure logger
logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self, 
        app, 
        requests_per_minute: int = 240,  # Increased from default of 120
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.exclude_paths = exclude_paths or []
        self.request_records: Dict[str, Tuple[int, float]] = {}
        self.lock = asyncio.Lock()
    
    async def dispatch(self, request: Request, call_next):
        # Extract path for better logging
        path = request.url.path
        
        # Skip rate limiting for excluded paths
        if any(path.startswith(excluded) for excluded in self.exclude_paths):
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host
        
        # Check if rate limit is exceeded
        async with self.lock:
            current_time = time.time()
            
            # Clean up old records (older than 1 minute)
            self.request_records = {
                ip: (count, timestamp) 
                for ip, (count, timestamp) in self.request_records.items() 
                if current_time - timestamp < 60
            }
            
            # Get current count and timestamp for this IP
            count, timestamp = self.request_records.get(client_ip, (0, current_time))
            
            # If it's a new minute, reset the count
            if current_time - timestamp >= 60:
                count = 0
                timestamp = current_time
            
            # Increment the count
            count += 1
            
            # Update the record
            self.request_records[client_ip] = (count, timestamp)
            
            # Check if rate limit is exceeded
            if count > self.requests_per_minute:
                # Calculate time until reset
                reset_time = 60 - (current_time - timestamp)
                
                # Log rate limit hit for debugging
                logger.warning(f"Rate limit exceeded for {client_ip} on {path}. Count: {count}/{self.requests_per_minute}")
                
                # Return 429 Too Many Requests
                return Response(
                    content=json.dumps({
                        "detail": "Rate limit exceeded. Try again later.",
                        "path": path,
                        "count": count,
                        "limit": self.requests_per_minute,
                        "reset_in": int(reset_time)
                    }),
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    headers={
                        "Retry-After": str(int(reset_time)), 
                        "Content-Type": "application/json",
                        "X-RateLimit-Limit": str(self.requests_per_minute),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(timestamp + 60))
                    }
                )
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to response
        remaining = self.requests_per_minute - count
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(timestamp + 60))
        
        return response