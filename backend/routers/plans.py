import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from backend.auth import get_current_user
from backend.models import PlanUpdate
from backend.services import dynamo, s3 as s3_svc
from backend.services.rasterize import image_to_png, is_pdf, pdf_to_pages

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/projects/{project_id}/plans", tags=["plans"])


def _pk():
    return f"TENANT#{TENANT_ID}"


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("")
async def upload_plan(
    project_id: str,
    file: UploadFile = File(...),
    plan_type: str = Form("floor"),
    floor_number: str = Form("1"),
    user: dict = Depends(get_current_user),
):
    project = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    data = await file.read()
    filename = file.filename or "upload"
    now = _now()
    created_plans = []

    if is_pdf(filename, data):
        pages = list(pdf_to_pages(data))
        for page_index, png_bytes in enumerate(pages):
            plan_id = str(uuid.uuid4())
            # Auto-increment floor number for multi-page PDFs
            this_floor = str(int(floor_number) + page_index) if floor_number.isdigit() else floor_number

            original_key = f"{TENANT_ID}/{project_id}/plans/{plan_id}_original.pdf"
            rendered_key = f"{TENANT_ID}/{project_id}/plans/{plan_id}_rendered.png"

            if page_index == 0:
                # Only upload original once (full PDF)
                s3_svc.upload_bytes(data, original_key, "application/pdf")
            s3_svc.upload_bytes(png_bytes, rendered_key, "image/png")

            item = {
                "pk": _pk(),
                "sk": f"PROJECT#{project_id}#PLAN#{plan_id}",
                "plan_id": plan_id,
                "project_id": project_id,
                "tenant_id": TENANT_ID,
                "plan_type": plan_type,
                "floor_number": this_floor,
                "original_file_s3_key": original_key,
                "original_file_type": "pdf",
                "rendered_png_s3_key": rendered_key,
                "scale_ppf": None,
                "uploaded_at": now,
                "updated_at": now,
            }
            dynamo.put_item(item)
            created_plans.append(item)
    else:
        # Image file
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        plan_id = str(uuid.uuid4())
        png_bytes = image_to_png(data)

        original_key = f"{TENANT_ID}/{project_id}/plans/{plan_id}_original.{ext}"
        rendered_key = f"{TENANT_ID}/{project_id}/plans/{plan_id}_rendered.png"

        s3_svc.upload_bytes(data, original_key, f"image/{ext}")
        s3_svc.upload_bytes(png_bytes, rendered_key, "image/png")

        item = {
            "pk": _pk(),
            "sk": f"PROJECT#{project_id}#PLAN#{plan_id}",
            "plan_id": plan_id,
            "project_id": project_id,
            "tenant_id": TENANT_ID,
            "plan_type": plan_type,
            "floor_number": floor_number,
            "original_file_s3_key": original_key,
            "original_file_type": "image",
            "rendered_png_s3_key": rendered_key,
            "scale_ppf": None,
            "uploaded_at": now,
            "updated_at": now,
        }
        dynamo.put_item(item)
        created_plans.append(item)

    return {"plans": created_plans}


@router.get("")
async def list_plans(project_id: str, user: dict = Depends(get_current_user)):
    items = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#PLAN#")
    return sorted(items, key=lambda x: x.get("floor_number", "0"))


@router.patch("/{plan_id}")
async def update_plan(
    project_id: str,
    plan_id: str,
    body: PlanUpdate,
    user: dict = Depends(get_current_user),
):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#PLAN#{plan_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    return dynamo.update_item(_pk(), f"PROJECT#{project_id}#PLAN#{plan_id}", updates)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(project_id: str, plan_id: str, user: dict = Depends(get_current_user)):
    existing = dynamo.get_item(_pk(), f"PROJECT#{project_id}#PLAN#{plan_id}")
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    dynamo.delete_item(_pk(), f"PROJECT#{project_id}#PLAN#{plan_id}")
