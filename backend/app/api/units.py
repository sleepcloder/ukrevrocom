from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..services.wialon import get_wialon_service
from ..core.config import settings
from .auth import get_current_user
from ..db.models import User


router = APIRouter()


class UnitResponse(BaseModel):
    id: int
    name: str
    latitude: Optional[float]
    longitude: Optional[float]
    speed: float
    course: float
    altitude: float
    satellites: int = 0
    last_time: Optional[str]
    is_online: bool
    mileage: float = 0
    engine_hours: float = 0
    custom_fields: Dict[str, Any] = {}
    unit_type: str = ""
    tracker_type: str = ""
    navigation_system: str = ""
    inputs_expander_status: int = 0
    is_activated: bool = True


class SensorData(BaseModel):
    fuel_level: float = 0
    fuel_level_2: float = 0
    fuel_consumption: float = 0
    engine_rpm: float = 0
    coolant_temp: float = 0
    engine_hours_lmsg: float = 0
    ignition: float = 0
    pwr_ext: float = 0
    pwr_int: float = 0
    gsm_signal: float = 0
    adc1: float = 0
    adc2: float = 0
    adc3: float = 0
    adc4: float = 0
    hdop: float = 0
    mileage_lmsg: float = 0


class UnitDetailResponse(UnitResponse):
    device_type: str = ""
    phone: str = ""
    phone2: str = ""
    uid: str = ""
    uid2: str = ""
    sensors: Dict[str, Any] = {}
    sensor_data: SensorData = SensorData()
    icon: str = ""


class UnitsListResponse(BaseModel):
    items: List[UnitResponse]
    total: int


@router.get("/units", response_model=UnitsListResponse)
async def get_units(current_user: User = Depends(get_current_user)):
    """Get list of all units from Wialon."""
    token = settings.WIALON_TOKEN
    if not token:
        raise HTTPException(status_code=500, detail="Wialon token not configured")

    wialon = get_wialon_service(token)
    units = await wialon.get_units_list()

    return UnitsListResponse(
        items=[UnitResponse(**u) for u in units],
        total=len(units)
    )


@router.get("/units/{unit_id}", response_model=UnitDetailResponse)
async def get_unit(unit_id: int, current_user: User = Depends(get_current_user)):
    """Get detailed info about a specific unit."""
    token = settings.WIALON_TOKEN
    if not token:
        raise HTTPException(status_code=500, detail="Wialon token not configured")

    wialon = get_wialon_service(token)
    unit = await wialon.get_unit_by_id(unit_id)

    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    return UnitDetailResponse(**unit)
