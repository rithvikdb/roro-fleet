from backend.app.core.config import get_settings
from backend.app.db import execute, fetch_one
from backend.app.security import hash_password, new_session_token, session_expiry, verify_password


def get_user_by_email(email: str) -> dict | None:
    return fetch_one(
        """
        select id, email, full_name, role, password_salt, password_hash, active
        from app_users
        where lower(email) = lower(%s)
        """,
        (email,),
    )


def get_user_by_session(token: str) -> dict | None:
    return fetch_one(
        """
        select u.id, u.email, u.full_name, u.role, u.active
        from app_sessions s
        join app_users u on u.id = s.user_id
        where s.token = %s and s.expires_at > now() and u.active = true
        """,
        (token,),
    )


def create_user(email: str, password: str, full_name: str | None = None, role: str = "viewer") -> dict:
    salt, password_hash = hash_password(password)
    return fetch_one(
        """
        insert into app_users (email, full_name, role, password_salt, password_hash)
        values (%s, %s, %s, %s, %s)
        returning id, email, full_name, role, active
        """,
        (email, full_name, role, salt, password_hash),
    )


def create_session(user_id: str) -> str:
    token = new_session_token()
    execute(
        "insert into app_sessions (token, user_id, expires_at) values (%s, %s, %s)",
        (token, user_id, session_expiry(get_settings().session_days)),
    )
    return token


def delete_session(token: str) -> None:
    execute("delete from app_sessions where token = %s", (token,))


def authenticate(email: str, password: str) -> dict | None:
    user = get_user_by_email(email)
    if not user or not user["active"]:
        return None
    if not verify_password(password, user["password_salt"], user["password_hash"]):
        return None
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "active": user["active"],
    }
