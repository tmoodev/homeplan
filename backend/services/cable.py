"""Cable run length estimation between AP and rack."""
from __future__ import annotations

from math import sqrt


def floor_to_int(floor_number: str) -> int:
    """Convert floor string to integer for vertical distance calculation."""
    if floor_number == "basement":
        return -1
    try:
        return int(floor_number)
    except (ValueError, TypeError):
        return 0


def calculate_cable_run_ft(
    ap_x: float,
    ap_y: float,
    ap_plan_id: str,
    rack_x: float,
    rack_y: float,
    rack_plan_id: str,
    scale_ppf: float,
    plans_by_id: dict,
) -> float:
    """
    Estimate CAT6 cable run in feet.

    Formula:
      horizontal_ft = pixel_distance / scale_ppf
      vertical_ft   = floor_difference * 12 ft per floor
      total_ft      = sqrt(horizontal² + vertical²) * 1.4 (slack factor) + 15 (termination/patch)
    """
    if not scale_ppf or scale_ppf <= 0:
        return 0.0

    pixel_dist = sqrt((ap_x - rack_x) ** 2 + (ap_y - rack_y) ** 2)
    horizontal_ft = pixel_dist / scale_ppf

    ap_plan = plans_by_id.get(ap_plan_id)
    rack_plan = plans_by_id.get(rack_plan_id)

    ap_floor = floor_to_int(ap_plan["floor_number"]) if ap_plan else 0
    rack_floor = floor_to_int(rack_plan["floor_number"]) if rack_plan else 0
    vertical_ft = abs(ap_floor - rack_floor) * 12

    total_ft = sqrt(horizontal_ft ** 2 + vertical_ft ** 2) * 1.4 + 15
    return round(total_ft, 1)
