from fastapi import Cookie, HTTPException, Response, status

from backend.app.core.config import get_settings
from backend.app.repositories.auth import get_user_by_session


def current_user(roro_session: str | None = Cookie(default=None)):
    if roro_session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = get_user_by_session(roro_session)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user


def set_session_cookie(response: Response, token: str):
    settings = get_settings()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.session_days * 24 * 60 * 60,
    )


def clear_session_cookie(response: Response):
    response.delete_cookie(get_settings().session_cookie_name)
