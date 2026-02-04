from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App settings
    APP_NAME: str = "UkrEvrocom API"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database
    DATABASE_URL: str = "postgresql://admin@localhost:5432/ukrevrocom"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3333",
    ]

    # Wialon API
    WIALON_TOKEN: str = "1f2770c21eab663fa29c1a7fe0a079d8E2CE46469EA1B67B7BCBDD64FCBD016C7EAF2DCE"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
