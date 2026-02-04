"""Initialize database and create default user."""

from app.db.database import engine, SessionLocal, Base
from app.db.models import User
from app.core.security import get_password_hash


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
    print("✅ Tables created")


def create_admin_user(username: str = "admin", password: str = "sleepadmin"):
    """Create admin user if not exists."""
    db = SessionLocal()
    try:
        # Check if user exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"⚠️  User '{username}' already exists")
            return

        # Create new user
        hashed_password = get_password_hash(password)
        new_user = User(
            username=username,
            hashed_password=hashed_password,
            full_name="Administrator",
            is_active=True,
        )
        db.add(new_user)
        db.commit()
        print(f"✅ User '{username}' created successfully")
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Initializing database...")
    init_db()
    create_admin_user()
    print("✅ Done!")
