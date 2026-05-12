from fastapi import APIRouter, Depends

from backend.auth import get_current_user
from backend.services import s3

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/presigned/{s3_key:path}")
async def get_presigned_url(s3_key: str, user: dict = Depends(get_current_user)):
    """Return a short-lived presigned GET URL for any S3 object."""
    url = s3.generate_download_presigned(s3_key, expires=3600)
    return {"url": url}
