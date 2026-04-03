import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


def load_env() -> None:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[2] / ".env",
        current.parents[1] / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=False)


load_env()

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parent / "local.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"


def resolve_database_url():
    explicit = os.getenv("PY_DATABASE_URL")
    if explicit:
        return explicit

    inherited = os.getenv("DATABASE_URL")
    if inherited and inherited.split(":", 1)[0].lower() in {"sqlite", "postgresql", "postgresql+psycopg2", "postgresql+psycopg"}:
        return inherited

    return DEFAULT_SQLITE_URL


DATABASE_URL = resolve_database_url()

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()
