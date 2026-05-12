"""WeasyPrint-based PDF generation for annotated plans and contractor summary."""
from __future__ import annotations

import base64
import csv
import io
import math
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _b64_png(png_bytes: bytes) -> str:
    return base64.b64encode(png_bytes).decode()


def render_annotated_plan_pdf(
    project: dict,
    plans: list[dict],
    aps: list[dict],
    racks: list[dict],
    plan_images: dict[str, bytes],  # plan_id -> PNG bytes
) -> bytes:
    """Render all floor plans with markers into a single annotated PDF."""
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("annotated_plan.html")

    # Build per-plan data
    plans_sorted = sorted(plans, key=lambda p: p.get("floor_number", "0"))
    aps_by_plan: dict[str, list] = {}
    racks_by_plan: dict[str, list] = {}

    for ap in aps:
        pid = ap.get("plan_id", "")
        aps_by_plan.setdefault(pid, []).append(ap)

    for rack in racks:
        pid = rack.get("plan_id", "")
        racks_by_plan.setdefault(pid, []).append(rack)

    floors = []
    for plan in plans_sorted:
        pid = plan["plan_id"]
        png_bytes = plan_images.get(pid, b"")
        floors.append({
            "plan": plan,
            "image_b64": _b64_png(png_bytes) if png_bytes else "",
            "aps": aps_by_plan.get(pid, []),
            "racks": racks_by_plan.get(pid, []),
        })

    html_content = template.render(project=project, floors=floors)
    return HTML(string=html_content).write_pdf()


def render_contractor_summary_pdf(
    project: dict,
    narrative_html: str,
    total_aps: int,
    total_cable_ft: float,
) -> bytes:
    """Render contractor summary PDF."""
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template("contractor_summary.html")
    html_content = template.render(
        project=project,
        narrative_html=narrative_html,
        total_aps=total_aps,
        total_cable_ft=round(total_cable_ft),
        cable_boxes=math.ceil(total_cable_ft / 1000),
    )
    return HTML(string=html_content).write_pdf()


def generate_bom_csv(project: dict, aps: list[dict], plans: list[dict], racks: list[dict]) -> bytes:
    """Generate CAT6 BOM CSV as bytes."""
    confirmed_aps = [ap for ap in aps if ap.get("planner_confirmed")]
    plans_by_id = {p["plan_id"]: p for p in plans}
    racks_by_id = {r["rack_id"]: r for r in racks}

    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow(["AP_ID", "Floor", "Model", "Mount_Type", "Cable_Run_Ft", "Connected_Rack", "Notes"])

    total_cable = 0.0
    for ap in confirmed_aps:
        plan = plans_by_id.get(ap.get("plan_id", ""), {})
        rack = racks_by_id.get(ap.get("connected_to_rack_id", ""), {})
        cable_ft = ap.get("estimated_cable_run_ft") or 0
        total_cable += cable_ft

        writer.writerow([
            ap["ap_id"][:8],
            plan.get("floor_number", "?"),
            ap.get("recommended_model", "Unknown"),
            ap.get("mount_type", "ceiling"),
            round(cable_ft, 1),
            rack.get("label", "Unassigned"),
            ap.get("notes", ""),
        ])

    writer.writerow([])
    writer.writerow(["--- Summary ---"])
    writer.writerow(["Total APs", len(confirmed_aps)])
    writer.writerow(["Total CAT6 Ft", round(total_cable, 1)])
    writer.writerow(["Cable Boxes (1000ft)", math.ceil(total_cable / 1000) if total_cable else 0])
    writer.writerow(["Keystones", len(confirmed_aps) * 2])  # 2 per run (AP end + patch panel)

    return buf.getvalue().encode("utf-8")
