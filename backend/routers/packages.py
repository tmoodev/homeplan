import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status

from backend.auth import get_current_user
from backend.services import dynamo, s3 as s3_svc, bedrock as bedrock_svc
from backend.services.pdf import generate_bom_csv, render_annotated_plan_pdf, render_contractor_summary_pdf

TENANT_ID = os.environ.get("TENANT_ID", "fulton")

router = APIRouter(prefix="/projects/{project_id}/package", tags=["packages"])


def _pk():
    return f"TENANT#{TENANT_ID}"


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("")
async def generate_package(project_id: str, user: dict = Depends(get_current_user)):
    """Generate all 3 handoff artifacts and store S3 keys in DynamoDB."""
    project = dynamo.get_item(_pk(), f"PROJECT#{project_id}")
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    plans = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#PLAN#")
    aps = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#AP#")
    racks = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#RACK#")

    confirmed_aps = [ap for ap in aps if ap.get("planner_confirmed")]
    if not confirmed_aps:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No confirmed APs found. Confirm at least one AP before generating package.",
        )

    # Download plan images for annotated PDF
    plan_images: dict[str, bytes] = {}
    for plan in plans:
        key = plan.get("rendered_png_s3_key")
        if key:
            try:
                plan_images[plan["plan_id"]] = s3_svc.download_bytes(key)
            except Exception:
                pass

    package_id = str(uuid.uuid4())
    base_key = f"{TENANT_ID}/{project_id}/packages/{package_id}"

    # 1. Annotated PDF
    annotated_pdf_bytes = render_annotated_plan_pdf(project, plans, confirmed_aps, racks, plan_images)
    annotated_key = f"{base_key}/annotated_plan.pdf"
    s3_svc.upload_bytes(annotated_pdf_bytes, annotated_key, "application/pdf")

    # 2. BOM CSV
    bom_csv_bytes = generate_bom_csv(project, aps, plans, racks)
    bom_key = f"{base_key}/bom.csv"
    s3_svc.upload_bytes(bom_csv_bytes, bom_key, "text/csv")

    # 3. Contractor summary PDF (Bedrock text call + WeasyPrint)
    total_cable_ft = sum(ap.get("estimated_cable_run_ft") or 0 for ap in confirmed_aps)
    narrative_html = bedrock_svc.generate_contractor_summary(project, confirmed_aps, racks, plans)
    contractor_pdf_bytes = render_contractor_summary_pdf(
        project, narrative_html, len(confirmed_aps), total_cable_ft
    )
    contractor_key = f"{base_key}/contractor_summary.pdf"
    s3_svc.upload_bytes(contractor_pdf_bytes, contractor_key, "application/pdf")

    # Store package record
    item = {
        "pk": _pk(),
        "sk": f"PROJECT#{project_id}#PACKAGE#{package_id}",
        "package_id": package_id,
        "project_id": project_id,
        "tenant_id": TENANT_ID,
        "generated_at": _now(),
        "annotated_pdf_s3_key": annotated_key,
        "bom_csv_s3_key": bom_key,
        "contractor_summary_pdf_s3_key": contractor_key,
        "ai_narrative": narrative_html[:500],  # Truncated preview for metadata
    }
    dynamo.put_item(item)

    return item


@router.get("/latest")
async def get_latest_package(project_id: str, user: dict = Depends(get_current_user)):
    packages = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#PACKAGE#")
    if not packages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No package generated yet")
    latest = max(packages, key=lambda p: p.get("generated_at", ""))
    return latest


def _stream_s3(s3_key: str, content_type: str, filename: str):
    data = s3_svc.download_bytes(s3_key)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _latest_package(project_id: str) -> dict:
    packages = dynamo.query_sk_prefix(_pk(), f"PROJECT#{project_id}#PACKAGE#")
    if not packages:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No package generated yet")
    return max(packages, key=lambda p: p.get("generated_at", ""))


@router.get("/annotated-pdf")
async def download_annotated_pdf(project_id: str, user: dict = Depends(get_current_user)):
    pkg = _latest_package(project_id)
    return _stream_s3(pkg["annotated_pdf_s3_key"], "application/pdf", "annotated_plan.pdf")


@router.get("/bom-csv")
async def download_bom_csv(project_id: str, user: dict = Depends(get_current_user)):
    pkg = _latest_package(project_id)
    return _stream_s3(pkg["bom_csv_s3_key"], "text/csv", "bom.csv")


@router.get("/contractor-pdf")
async def download_contractor_pdf(project_id: str, user: dict = Depends(get_current_user)):
    pkg = _latest_package(project_id)
    return _stream_s3(pkg["contractor_summary_pdf_s3_key"], "application/pdf", "contractor_summary.pdf")
