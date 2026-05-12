import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Cookie, HTTPException, Response, status
from jose import JWTError, jwt

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "12"))
COOKIE_NAME = "homeplan_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(username: str, tenant_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {
        "sub": username,
        "tenant_id": tenant_id,
        "role": role,
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=JWT_EXPIRY_HOURS * 3600,
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, httponly=True, secure=True, samesite="lax")


def get_current_user(homeplan_token: Optional[str] = Cookie(default=None)) -> dict:
    if not homeplan_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return decode_token(homeplan_token)
