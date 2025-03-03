# Export router objects for easier imports
from .auth import router as auth_router
from .users import router as users_router
from .matches import router as matches_router
from .predictions import router as predictions_router

# This allows other modules to import directly from app.routers
# Example: from app.routers import auth_router, users_router
