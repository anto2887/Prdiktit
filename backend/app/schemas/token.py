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

class UserData(BaseModel):
    id: int
    username: str
    email: Optional[str] = None

class LoginResponseData(BaseModel):
    access_token: str
    token_type: str
    user: UserData

class LoginResponse(BaseModel):
    status: str
    data: LoginResponseData

class RegistrationResponse(BaseModel):
    status: str
    message: str
    
    class Config:
        orm_mode = True