from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel

from backend.app.dependencies import clear_session_cookie, current_user, set_session_cookie
from backend.app.repositories.auth import authenticate, create_session, create_user, delete_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginPayload(BaseModel):
    email: str
    password: str


class RegisterPayload(BaseModel):
    email: str
    password: str
    full_name: str | None = None


@router.post("/login")
def login(payload: LoginPayload, response: Response):
    user = authenticate(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": user}


@router.post("/register")
def register(payload: RegisterPayload, response: Response):
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

    try:
        user = create_user(payload.email, payload.password, payload.full_name, "viewer")
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account already exists or could not be created")

    token = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": user}


@router.post("/logout")
def logout(response: Response, roro_session: str | None = Cookie(default=None)):
    if roro_session:
        delete_session(roro_session)
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(user=Depends(current_user)):
    return {"user": user}
