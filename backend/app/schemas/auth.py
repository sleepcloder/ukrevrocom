from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    is_active: bool = True

    class Config:
        from_attributes = True
