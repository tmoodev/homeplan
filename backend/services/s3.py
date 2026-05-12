import os
import uuid

import boto3

BUCKET = os.environ.get("S3_MEDIA_BUCKET", "datatrav-homeplan-media")
REGION = os.environ.get("AWS_REGION", "us-east-1")

_client = None


def _s3():
    global _client
    if _client is None:
        _client = boto3.client("s3", region_name=REGION)
    return _client


def upload_bytes(data: bytes, s3_key: str, content_type: str = "application/octet-stream") -> None:
    """Upload raw bytes to S3 at the given key."""
    _s3().put_object(Bucket=BUCKET, Key=s3_key, Body=data, ContentType=content_type)


def download_bytes(s3_key: str) -> bytes:
    """Download object bytes from S3."""
    resp = _s3().get_object(Bucket=BUCKET, Key=s3_key)
    return resp["Body"].read()


def delete_object(s3_key: str) -> None:
    _s3().delete_object(Bucket=BUCKET, Key=s3_key)


def generate_download_presigned(s3_key: str, expires: int = 3600) -> str:
    """Returns a presigned GET URL."""
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": s3_key},
        ExpiresIn=expires,
    )
