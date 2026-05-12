import os

from fastapi import APIRouter, Depends, HTTPException, Response, status

from backend.auth import clear_auth_cookie, create_token, get_current_user, set_auth_cookie, verify_password
from backend.models import LoginRequest
from backend.services import dynamo

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    # Reads from homeaudit-data via get_item_auth
    item = dynamo.get_item_auth(f"TENANT#{TENANT_ID}", f"USER#{body.username}")
    if not item or not verify_password(body.password, item["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_token(body.username, TENANT_ID, item.get("role", "planner"))
    set_auth_cookie(response, token)
    return {"ok": True, "username": body.username, "role": item.get("role", "planner")}


@router.post("/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"username": user["sub"], "tenant_id": user["tenant_id"], "role": user["role"]}
