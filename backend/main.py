import os
from datetime import datetime, timezone

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.auth import COOKIE_NAME, JWT_EXPIRY_HOURS, create_token, decode_token
from backend.routers import auth, projects, plans, racks, aps, media, packages

app = FastAPI(title="HomePlan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3902",
        "https://homeplan.datatrav.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def refresh_jwt_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    token = request.cookies.get(COOKIE_NAME)
    if token:
        try:
            payload = decode_token(token)
            exp = payload["exp"]
            now = int(datetime.now(timezone.utc).timestamp())
            remaining_seconds = exp - now
            if remaining_seconds < (6 * 3600):
                new_token = create_token(payload["sub"], payload["tenant_id"], payload["role"])
                response.set_cookie(
                    key=COOKIE_NAME,
                    value=new_token,
                    httponly=True,
                    secure=True,
                    samesite="lax",
                    max_age=JWT_EXPIRY_HOURS * 3600,
                )
        except Exception:
            pass
    return response


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(plans.router)
app.include_router(racks.router)
app.include_router(aps.router)
app.include_router(media.router)
app.include_router(packages.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
