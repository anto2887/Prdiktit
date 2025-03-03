# app/schemas/user.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

# Base User Schema
class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = True

# User Create Schema
class UserCreate(UserBase):
    password: str

# User Update Schema
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

# User in Database Schema
class UserInDB(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# User Response Schema (public information)
class User(UserBase):
    id: int
    
    class Config:
        orm_mode = True

# User Profile Schema
class UserProfile(User):
    class Config:
        orm_mode = True

class UserStats(BaseModel):
    total_points: int = 0
    total_predictions: int = 0
    perfect_predictions: int = 0
    average_points: float = 0.0
    
    class Config:
        orm_mode = True

class UserProfileResponse(BaseModel):
    user: UserProfile
    stats: UserStats
    
    class Config:
        orm_mode = True