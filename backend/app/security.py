import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 260000)
    return salt, digest.hex()


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    _, candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def new_session_token() -> str:
    return secrets.token_urlsafe(48)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def session_expiry(days: int) -> datetime:
    return utc_now() + timedelta(days=days)
