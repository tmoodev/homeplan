"""Bedrock vision calls for AP proposal and contractor summary generation."""
from __future__ import annotations

import base64
import json
import os
import re
from pathlib import Path
from typing import Any

import boto3

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

_client = None

# Load AI prompt config once at module level
_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "ai_prompt.json"
_config: dict | None = None


def _bedrock():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=REGION)
    return _client


def _get_config() -> dict:
    global _config
    if _config is None:
        with open(_CONFIG_PATH) as f:
            _config = json.load(f)
    return _config


def _strip_json_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"\s*```$", "", text.strip())
    return text.strip()


def propose_access_points(project: dict, floor_plans: list[dict], racks: list[dict]) -> dict[str, Any]:
    """
    Send all floor plan PNGs to Bedrock vision and return proposed AP placements.

    Returns: {"floors": [{"floor_number": "1", "aps": [{x, y, mount_type, coverage_radius_ft,
              recommended_model, rationale}]}]}
    """
    from backend.services import s3 as s3_svc

    config = _get_config()
    content = []

    for plan in floor_plans:
        png_bytes = s3_svc.download_bytes(plan["rendered_png_s3_key"])
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": base64.b64encode(png_bytes).decode(),
            },
        })

    # Build context payload
    context = {
        "project": {
            "total_sqft": project.get("total_sqft"),
            "wall_material": project.get("wall_material", "drywall"),
            "ceiling_material": project.get("ceiling_material"),
            "construction_type": project.get("construction_type", "new_build"),
        },
        "floors": [
            {
                "floor_number": p["floor_number"],
                "plan_id": p["plan_id"],
                "scale_ppf": p.get("scale_ppf"),
                "image_index": i,
            }
            for i, p in enumerate(floor_plans)
        ],
        "racks": [
            {
                "rack_id": r["rack_id"],
                "plan_id": r["plan_id"],
                "x": r["x"],
                "y": r["y"],
                "label": r.get("label", "IDF"),
                "is_primary": r.get("is_primary", False),
            }
            for r in racks
        ],
        "rules_of_thumb": config.get("rules_of_thumb", []),
        "output_schema": config.get("output_schema", {}),
        "instructions": (
            "Analyze each floor plan image and propose WiFi access point placements. "
            "Return ONLY valid JSON matching the output_schema. "
            "Use pixel coordinates that match positions on the rendered PNG images. "
            "The image_index field in floors tells you which image corresponds to which floor."
        ),
    }

    content.append({"type": "text", "text": json.dumps(context)})

    response = _bedrock().invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "system": config["system_prompt"],
            "messages": [{"role": "user", "content": content}],
        }),
    )

    body = json.loads(response["body"].read())
    text = body["content"][0]["text"]
    text = _strip_json_fences(text)
    return json.loads(text)


def generate_contractor_summary(project: dict, aps: list[dict], racks: list[dict],
                                 plans: list[dict]) -> str:
    """
    Generate a 2-page contractor narrative using a text-only Bedrock call.
    Returns HTML string for WeasyPrint rendering.
    """
    confirmed_aps = [ap for ap in aps if ap.get("planner_confirmed")]

    total_cable_ft = sum(
        ap.get("estimated_cable_run_ft") or 0 for ap in confirmed_aps
    )

    summary_lines = [
        f"Project: {project.get('client_name')} — {project.get('address')}",
        f"Construction: {project.get('construction_type', 'N/A')}, "
        f"Wall material: {project.get('wall_material', 'N/A')}",
        f"Total sq ft: {project.get('total_sqft', 'N/A')}",
        f"Total APs (confirmed): {len(confirmed_aps)}",
        f"Total estimated CAT6: {round(total_cable_ft)} ft",
        "",
        "AP Summary by floor:",
    ]

    floor_map: dict[str, list] = {}
    plans_by_id = {p["plan_id"]: p for p in plans}
    for ap in confirmed_aps:
        plan = plans_by_id.get(ap.get("plan_id", ""), {})
        floor = plan.get("floor_number", "unknown")
        floor_map.setdefault(floor, []).append(ap)

    for floor, floor_aps in sorted(floor_map.items()):
        summary_lines.append(f"\n  Floor {floor}: {len(floor_aps)} APs")
        for ap in floor_aps:
            cable = ap.get("estimated_cable_run_ft") or 0
            summary_lines.append(
                f"    - {ap.get('recommended_model', 'Unknown')} "
                f"[{ap.get('mount_type', 'ceiling')}] — "
                f"~{cable} ft CAT6 to {ap.get('connected_to_rack_id', 'unassigned')}"
            )

    prompt = "\n".join(summary_lines) + (
        "\n\nBased on this WiFi access point deployment plan, write a professional contractor "
        "installation guide. Include:\n"
        "1. Installation intent and overview (1 paragraph)\n"
        "2. Mounting standards (ceiling vs wall, backing requirements, plenum considerations)\n"
        "3. Cable termination standards (T568B wiring, CAT6 vs CAT6A recommendation, bend radius)\n"
        "4. Head-end / IDF requirements (rack space, patch panel, PoE switch sizing)\n"
        "5. Testing and commissioning checklist\n\n"
        "Write in a professional tone suitable for a licensed low-voltage contractor. "
        "Format as clean HTML sections with <h2> headings and <p>/<ul> content. "
        "No markdown, no code fences — return only valid HTML fragment (no <html>/<body> wrapper)."
    )

    response = _bedrock().invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 3000,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )

    body = json.loads(response["body"].read())
    return body["content"][0]["text"]
