import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "attendance_db")
DB_PORT = os.environ.get("DB_PORT", "3306")

import urllib.parse
DB_PASSWORD_ENCODED = urllib.parse.quote_plus(DB_PASSWORD)

# Use aiomysql driver for async support
DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD_ENCODED}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db():
    """FastAPI dependency for async database connection"""
    async with AsyncSessionLocal() as session:
        yield session

# For non-FastAPI async use cases
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db_context():
    """Async context manager for DB connections"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
