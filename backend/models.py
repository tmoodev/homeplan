from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


# --- Projects ---

class ProjectCreate(BaseModel):
    client_name: str
    address: str
    total_sqft: Optional[float] = None
    num_floors: Optional[int] = None
    construction_type: Optional[str] = None  # new_build | renovation
    wall_material: Optional[str] = None      # drywall | brick | concrete | log | mixed
    ceiling_material: Optional[str] = None
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    client_name: Optional[str] = None
    address: Optional[str] = None
    total_sqft: Optional[float] = None
    num_floors: Optional[int] = None
    construction_type: Optional[str] = None
    wall_material: Optional[str] = None
    ceiling_material: Optional[str] = None
    status: Optional[str] = None            # draft | in_review | finalized
    notes: Optional[str] = None


# --- Plans ---

class PlanUpdate(BaseModel):
    plan_type: Optional[str] = None         # floor | elevation
    floor_number: Optional[str] = None      # basement | 1 | 2 | 3
    scale_ppf: Optional[float] = None       # pixels per foot, null until calibrated


# --- Access Points ---

class APCreate(BaseModel):
    plan_id: str
    x: float
    y: float
    mount_type: Optional[str] = "ceiling"   # ceiling | wall_high | wall_low
    recommended_model: Optional[str] = None
    coverage_radius_ft: Optional[float] = 21.8
    connected_to_rack_id: Optional[str] = None
    notes: Optional[str] = None


class APUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    mount_type: Optional[str] = None
    recommended_model: Optional[str] = None
    coverage_radius_ft: Optional[float] = None
    planner_confirmed: Optional[bool] = None
    connected_to_rack_id: Optional[str] = None
    notes: Optional[str] = None


# --- Racks ---

class RackCreate(BaseModel):
    plan_id: str
    x: float
    y: float
    label: Optional[str] = "IDF-1"
    is_primary: Optional[bool] = False


class RackUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    label: Optional[str] = None
    is_primary: Optional[bool] = None
