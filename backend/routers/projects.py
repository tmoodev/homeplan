import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from backend.auth import get_current_user
from backend.models import ProjectCreate, ProjectUpdate
from backend.services import dynamo, bedrock as bedrock_svc
from backend.services.cable import calculate_cable_run_ft

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/projects", tags=["projects"])


def _pk():
    return f"TENANT#{TENANT_ID}"


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_projects(user: dict = Depends(get_current_user)):
    items = dynamo.query_sk_prefix(_pk(), "PROJECT#")
    # Exclude sub-entities (plans, aps, racks, packages)
    projects = [i for i in items if i["sk"].count("#") == 1]
    return sorted(projects, key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("")
async def create_project(body: ProjectCreate, user: dict = Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    now = _now()
    item = {
        "pk": _pk(),
        "sk": f"PROJECT#{project_id}",
        "project_id": project_id,
        "tenant_id": TENANT_ID,
        "client_name": body.client_name,
        "address": body.address,
        "total_sqft": body.total_sqft,
        "num_floors": body.num_floors,
        "construction_type": body.construction_type or "new_build",
        "wall_material": body.wall_material or "drywall",
        "ceiling_material": body.ceiling_material,
        "status": "draft",
        "created_by": user["sub"],
        "created_at": now,
        "updated_at": now,
        "notes": body.notes,
    }
    dynamo.put_item(item)
    return item


@router.get("/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    item = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return item


@router.patch("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate, user: dict = Depends(get_current_user)):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    return dynamo.update_item(_pk(), f"PROJECT#{project_id}", updates)


@router.post("/{project_id}/propose-aps")
async def propose_aps(project_id: str, user: dict = Depends(get_current_user)):
    """Send all floor plan PNGs to Bedrock vision and create draft AP records."""
    project = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Get all floor plans for this project
    all_plans = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#PLAN#")
    floor_plans = [p for p in all_plans if p.get("plan_type") == "floor" and p.get("rendered_png_s3_key")]

    if not floor_plans:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="No floor plans with rendered PNGs found. Upload and render plans first.")

    # Get racks for context
    all_racks = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#RACK#")

    # Call Bedrock vision
    result = bedrock_svc.propose_access_points(project, floor_plans, all_racks)

    # Delete existing AI-generated unconfirmed APs
    existing_aps = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#AP#")
    for ap in existing_aps:
        if ap.get("ai_generated") and not ap.get("planner_confirmed"):
            dynamo.delete_item(_pk(), ap["sk"])

    # Create new AP records
    created_aps = []
    now = _now()

    plans_by_floor = {p["floor_number"]: p for p in floor_plans}

    for floor_result in result.get("floors", []):
        floor_number = str(floor_result["floor_number"])
        plan = plans_by_floor.get(floor_number)
        if not plan:
            continue

        scale_ppf = plan.get("scale_ppf")

        for ap_data in floor_result.get("aps", []):
            ap_id = str(uuid.uuid4())

            # Find nearest rack for cable run estimate
            connected_rack_id = None
            cable_run_ft = None
            if all_racks and scale_ppf:
                nearest_rack = min(
                    all_racks,
                    key=lambda r: (ap_data["x"] - r["x"]) ** 2 + (ap_data["y"] - r["y"]) ** 2,
                )
                connected_rack_id = nearest_rack["rack_id"]
                plans_by_id = {p["plan_id"]: p for p in floor_plans}
                cable_run_ft = calculate_cable_run_ft(
                    ap_data["x"], ap_data["y"], plan["plan_id"],
                    nearest_rack["x"], nearest_rack["y"], nearest_rack["plan_id"],
                    scale_ppf, plans_by_id,
                )

            ap_item = {
                "pk": _pk(),
                "sk": f"PROJECT#{project_id}#AP#{ap_id}",
                "ap_id": ap_id,
                "project_id": project_id,
                "plan_id": plan["plan_id"],
                "tenant_id": TENANT_ID,
                "x": ap_data["x"],
                "y": ap_data["y"],
                "mount_type": ap_data.get("mount_type", "ceiling"),
                "recommended_model": ap_data.get("recommended_model", "Ruckus R650"),
                "coverage_radius_ft": ap_data.get("coverage_radius_ft", 21.8),
                "ai_generated": True,
                "ai_rationale": ap_data.get("rationale", ""),
                "planner_confirmed": False,
                "connected_to_rack_id": connected_rack_id,
                "estimated_cable_run_ft": cable_run_ft,
                "notes": None,
                "created_at": now,
                "updated_at": now,
            }
            dynamo.put_item(ap_item)
            created_aps.append(ap_item)

    return {"created": len(created_aps), "aps": created_aps}
