import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.models import APCreate, APUpdate
from backend.services import dynamo
from backend.services.cable import calculate_cable_run_ft

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/projects/{project_id}/aps", tags=["aps"])


def _pk():
    return f"TENANT#{TENANT_ID}"


def _now():
    return datetime.now(timezone.utc).isoformat()


def _recalculate_cable(ap_item: dict, project_id: str) -> float | None:
    """Recalculate cable run for an AP if it has a connected rack and the plan has scale_ppf."""
    rack_id = ap_item.get("connected_to_rack_id")
    if not rack_id:
        return None

    rack = dynamo.get_item(_pk(), f"PROJECT#{project_id}#RACK#{rack_id}")
    if not rack:
        return None

    plan = dynamo.get_item(_pk(), f"PROJECT#{project_id}#PLAN#{ap_item['plan_id']}")
    rack_plan = dynamo.get_item(_pk(), f"PROJECT#{project_id}#PLAN#{rack['plan_id']}")

    if not plan or not plan.get("scale_ppf"):
        return None

    plans_by_id = {
        ap_item["plan_id"]: plan,
        rack["plan_id"]: rack_plan or plan,
    }

    return calculate_cable_run_ft(
        ap_item["x"], ap_item["y"], ap_item["plan_id"],
        rack["x"], rack["y"], rack["plan_id"],
        plan["scale_ppf"], plans_by_id,
    )


@router.get("")
async def list_aps(project_id: str, user: dict = Depends(get_current_user)):
    return dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#AP#")


@router.post("")
async def create_ap(project_id: str, body: APCreate, user: dict = Depends(get_current_user)):
    project = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    ap_id = str(uuid.uuid4())
    now = _now()
    item = {
        "pk": _pk(),
        "sk": f"PROJECT#{project_id}#AP#{ap_id}",
        "ap_id": ap_id,
        "project_id": project_id,
        "plan_id": body.plan_id,
        "tenant_id": TENANT_ID,
        "x": body.x,
        "y": body.y,
        "mount_type": body.mount_type or "ceiling",
        "recommended_model": body.recommended_model,
        "coverage_radius_ft": body.coverage_radius_ft or 21.8,
        "ai_generated": False,
        "ai_rationale": None,
        "planner_confirmed": True,
        "connected_to_rack_id": body.connected_to_rack_id,
        "estimated_cable_run_ft": None,
        "notes": body.notes,
        "created_at": now,
        "updated_at": now,
    }

    # Calculate cable run if rack is specified
    cable_run = _recalculate_cable(item, project_id)
    item["estimated_cable_run_ft"] = cable_run

    dynamo.put_item(item)
    return item


@router.patch("/{ap_id}")
async def update_ap(
    project_id: str,
    ap_id: str,
    body: APUpdate,
    user: dict = Depends(get_current_user),
):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#AP#{ap_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AP not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()

    # Recalculate cable run when position or rack changes
    merged = {**existing, **updates}
    cable_run = _recalculate_cable(merged, project_id)
    if cable_run is not None:
        updates["estimated_cable_run_ft"] = cable_run

    return dynamo.update_item(_pk(), f"PROJECT#{project_id}#AP#{ap_id}", updates)


@router.delete("/{ap_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ap(project_id: str, ap_id: str, user: dict = Depends(get_current_user)):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#AP#{ap_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AP not found")
    dynamo.delete_item(_pk(), f"PROJECT#{project_id}#AP#{ap_id}")
