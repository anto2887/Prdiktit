import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Tuple, Optional
import asyncio
import json
import logging

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(
        self, 
        app, 
        requests_per_minute: int = 600,
        exclude_paths: Optional[list] = None
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.exclude_paths = exclude_paths or []
        self.request_records: Dict[str, Tuple[int, float]] = {}
        self.lock = asyncio.Lock()
    
    def get_cors_headers(self, request: Request = None) -> Dict[str, str]:
        """Get CORS headers that match your frontend origin"""
        origin = "http://localhost:3000"  # Your frontend URL
        
        if request and request.headers.get("origin"):
            request_origin = request.headers.get("origin")
            allowed_origins = [
                "http://localhost:3000",
                "http://127.0.0.1:3000", 
                "http://0.0.0.0:3000"
            ]
            if request_origin in allowed_origins:
                origin = request_origin
        
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Accept, Accept-Language, Content-Language, Content-Type, Authorization, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset",
            "Access-Control-Max-Age": "86400"
        }
    
    async def dispatch(self, request: Request, call_next):
        # CRITICAL: Handle OPTIONS (preflight) requests immediately
        if request.method == "OPTIONS":
            logger.info(f"Handling OPTIONS preflight for {request.url.path}")
            return Response(
                status_code=200,
                headers=self.get_cors_headers(request),
                content=""
            )
        
        path = request.url.path
        
        # Skip rate limiting for auth and static content
        skip_paths = [
            "/docs", "/redoc", "/openapi.json", "/static", "/favicon.ico",
            "/api/v1/auth"
        ]
        
        if any(path.startswith(skip) for skip in skip_paths):
            response = await call_next(request)
            # Add CORS headers even to skipped paths
            for key, value in self.get_cors_headers(request).items():
                response.headers[key] = value
            return response
        
        # Very generous rate limiting for development
        client_ip = request.client.host or "127.0.0.1"
        effective_limit = self.requests_per_minute * 5  # Very high limit for dev
        
        # Simple rate limiting (minimal to avoid blocking during dev)
        async with self.lock:
            current_time = time.time()
            count, timestamp = self.request_records.get(client_ip, (0, current_time))
            
            if current_time - timestamp >= 60:
                count = 0
                timestamp = current_time
            
            count += 1
            self.request_records[client_ip] = (count, timestamp)
            
            # Only block if extremely high usage
            if count > effective_limit:
                logger.warning(f"Rate limit exceeded: {count}/{effective_limit}")
                
                cors_headers = self.get_cors_headers(request)
                cors_headers.update({
                    "Content-Type": "application/json",
                    "X-RateLimit-Limit": str(effective_limit),
                    "X-RateLimit-Remaining": "0"
                })
                
                return Response(
                    content=json.dumps({"detail": "Rate limit exceeded"}),
                    status_code=429,
                    headers=cors_headers
                )
        
        # Process the actual request
        try:
            response = await call_next(request)
            
            # Add CORS headers to all successful responses
            cors_headers = self.get_cors_headers(request)
            cors_headers.update({
                "X-RateLimit-Limit": str(effective_limit),
                "X-RateLimit-Remaining": str(max(0, effective_limit - count))
            })
            
            for key, value in cors_headers.items():
                response.headers[key] = value
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing request: {e}")
            
            # CRITICAL: Return errors with CORS headers
            error_headers = self.get_cors_headers(request)
            error_headers["Content-Type"] = "application/json"
            
            return Response(
                content=json.dumps({
                    "detail": "Internal server error",
                    "error": str(e)
                }),
                status_code=500,
                headers=error_headers
            )