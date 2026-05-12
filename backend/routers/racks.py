import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.models import RackCreate, RackUpdate
from backend.services import dynamo

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/projects/{project_id}/racks", tags=["racks"])


def _pk():
    return f"TENANT#{TENANT_ID}"


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_racks(project_id: str, user: dict = Depends(get_current_user)):
    return dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#RACK#")


@router.post("")
async def create_rack(project_id: str, body: RackCreate, user: dict = Depends(get_current_user)):
    project = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    rack_id = str(uuid.uuid4())
    now = _now()
    item = {
        "pk": _pk(),
        "sk": f"PROJECT#{project_id}#RACK#{rack_id}",
        "rack_id": rack_id,
        "project_id": project_id,
        "plan_id": body.plan_id,
        "tenant_id": TENANT_ID,
        "x": body.x,
        "y": body.y,
        "label": body.label or "IDF-1",
        "is_primary": body.is_primary or False,
        "created_at": now,
        "updated_at": now,
    }
    dynamo.put_item(item)
    return item


@router.patch("/{rack_id}")
async def update_rack(
    project_id: str,
    rack_id: str,
    body: RackUpdate,
    user: dict = Depends(get_current_user),
):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#RACK#{rack_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rack not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    return dynamo.update_item(_pk(), f"PROJECT#{project_id}#RACK#{rack_id}", updates)


@router.delete("/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rack(project_id: str, rack_id: str, user: dict = Depends(get_current_user)):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#RACK#{rack_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rack not found")
    dynamo.delete_item(_pk(), f"PROJECT#{project_id}#RACK#{rack_id}")
