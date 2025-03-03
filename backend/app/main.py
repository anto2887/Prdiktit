# app/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, matches, predictions, groups, users
from .core.config import settings
from .core import security
from .db.session import create_tables, engine

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Football Prediction API",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    auth.router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["auth"]
)
app.include_router(
    matches.router,
    prefix=f"{settings.API_V1_STR}/matches",
    tags=["matches"]
)
app.include_router(
    predictions.router,
    prefix=f"{settings.API_V1_STR}/predictions",
    tags=["predictions"]
)
app.include_router(
    groups.router,
    prefix=f"{settings.API_V1_STR}/groups",
    tags=["groups"]
)
app.include_router(
    users.router,
    prefix=f"{settings.API_V1_STR}/users",
    tags=["users"]
)

@app.on_event("startup")
async def startup_event():
    # Create database tables if they don't exist
    if settings.CREATE_TABLES_ON_STARTUP:
        create_tables()
    
    # Initialize API services
    from .services.init_services import init_services
    await init_services(app)

@app.get("/health")
def health_check():
    """Health check endpoint for AWS infrastructure."""
    return {"status": "ok"}