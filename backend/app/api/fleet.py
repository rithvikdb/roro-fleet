from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.dependencies import current_user
from backend.app.repositories import fleet
from backend.app.routing import sea_route

router = APIRouter(prefix="/api", tags=["fleet"])


@router.get("/fleet/stats")
def get_fleet_stats(_user=Depends(current_user)):
    return fleet.fleet_stats()


@router.get("/vessels")
def list_vessels(_user=Depends(current_user)):
    return {"items": fleet.list_vessels()}


@router.post("/vessels")
def create_vessel(payload: dict, user=Depends(current_user)):
    return fleet.create_vessel(payload, user["id"])


@router.patch("/vessels/{vessel_id}")
def update_vessel(vessel_id: str, payload: dict, user=Depends(current_user)):
    row = fleet.update_vessel(vessel_id, payload, user["id"])
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vessel not found")
    return row


@router.delete("/vessels/{vessel_id}")
def delete_vessel(vessel_id: str, _user=Depends(current_user)):
    fleet.delete_vessel(vessel_id)
    return {"ok": True}


@router.get("/vessels/{vessel_id}/performance-profile")
def get_vessel_performance_profile(vessel_id: str, _user=Depends(current_user)):
    profile = fleet.get_performance_profile(vessel_id)
    return profile or {"vessel_id": vessel_id}


@router.put("/vessels/{vessel_id}/performance-profile")
def save_vessel_performance_profile(vessel_id: str, payload: dict, user=Depends(current_user)):
    return fleet.save_performance_profile(vessel_id, payload, user["id"])


@router.get("/my-vessels")
def list_my_vessels(user=Depends(current_user)):
    return {"items": fleet.list_user_vessels(user["id"])}


@router.put("/my-vessels")
def set_my_vessels(payload: dict, user=Depends(current_user)):
    try:
        fleet.set_user_vessels(user["id"], payload.get("vesselIds") or [])
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    return {"ok": True}


@router.post("/sea-routes")
def create_sea_route(payload: dict, _user=Depends(current_user)):
    origin = payload.get("origin") or []
    destination = payload.get("destination") or []
    if len(origin) != 2 or len(destination) != 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Origin and destination coordinates are required")
    try:
        return sea_route(origin, destination)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid route coordinates")
