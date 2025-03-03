# app/schemas/token.py
from typing import Optional
from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None

class TokenData(BaseModel):
    username: str

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str = "success"
    data: Token
    
    class Config:
        orm_mode = True

class RegistrationResponse(BaseModel):
    status: str = "success"
    message: str = "Registration successful"
    
    class Config:
        orm_mode = True