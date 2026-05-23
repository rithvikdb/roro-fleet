from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.dependencies import current_user
from backend.app.repositories import operations

router = APIRouter(prefix="/api", tags=["operations"])


@router.get("/schedules")
def list_schedules(_user=Depends(current_user)):
    return {"items": operations.list_schedules()}


@router.put("/schedules/{schedule_id}")
def save_schedule(schedule_id: str, payload: dict, user=Depends(current_user)):
    payload["id"] = schedule_id
    try:
        return operations.upsert_schedule(payload, user["id"])
    except operations.StaleWriteError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, _user=Depends(current_user)):
    operations.delete_schedule(schedule_id)
    return {"ok": True}


@router.get("/ports")
def list_ports(_user=Depends(current_user)):
    return {"items": operations.list_ports()}


@router.put("/ports/{code}")
def save_port(code: str, payload: dict, user=Depends(current_user)):
    payload["code"] = code
    return operations.upsert_port(payload, user["id"])


@router.get("/bunker-reports")
def list_bunker_reports(_user=Depends(current_user)):
    return {"items": operations.list_bunker_reports()}


@router.put("/bunker-reports/{report_id}")
def save_bunker_report(report_id: str, payload: dict, user=Depends(current_user)):
    payload["id"] = report_id
    try:
        return operations.upsert_bunker_report(payload, user["id"])
    except operations.StaleWriteError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))


@router.delete("/bunker-reports/{report_id}")
def delete_bunker_report(report_id: str, _user=Depends(current_user)):
    operations.delete_bunker_report(report_id)
    return {"ok": True}


@router.get("/noon-reports")
def list_noon_reports(_user=Depends(current_user)):
    return {"items": operations.list_noon_reports()}


@router.post("/noon-reports")
def create_noon_report(payload: dict, user=Depends(current_user)):
    return operations.create_noon_report(payload, user["id"])


@router.get("/voyage-plans")
def list_voyage_plans(_user=Depends(current_user)):
    return {"items": operations.list_voyage_plans()}


@router.put("/voyage-plans/{vessel}/{voyage_number}")
def save_voyage_plan(vessel: str, voyage_number: str, payload: dict, user=Depends(current_user)):
    payload["vessel"] = vessel
    payload["voyage_number"] = voyage_number
    try:
        return operations.upsert_voyage_plan(payload, user["id"])
    except operations.StaleWriteError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))


@router.get("/port-meetings")
def list_port_meetings(_user=Depends(current_user)):
    return {"items": operations.list_port_meetings()}


@router.put("/port-meetings/{meeting_id}")
def save_port_meeting(meeting_id: str, payload: dict, user=Depends(current_user)):
    payload["id"] = meeting_id
    try:
        return operations.upsert_port_meeting(payload, user["id"])
    except operations.StaleWriteError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
