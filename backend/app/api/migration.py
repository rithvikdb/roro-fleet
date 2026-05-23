from fastapi import APIRouter, Depends

from backend.app.dependencies import current_user
from backend.app.repositories.fleet import create_vessel, set_user_vessels, vessel_id_for_legacy_selection
from backend.app.repositories.operations import upsert_bunker_report, upsert_port, upsert_schedule

router = APIRouter(prefix="/api/migration", tags=["migration"])


@router.post("/local-storage")
def migrate_local_storage(payload: dict, user=Depends(current_user)):
    counts = {"vessels": 0, "myVessels": 0, "schedules": 0, "ports": 0, "bunkerReports": 0}

    for vessel in payload.get("fleetOverviewVessels") or []:
      try:
          create_vessel(vessel, user["id"])
          counts["vessels"] += 1
      except Exception:
          pass

    selected_vessel_ids = local_my_vessel_ids(payload)
    if selected_vessel_ids:
      try:
          set_user_vessels(user["id"], selected_vessel_ids)
          counts["myVessels"] = len(selected_vessel_ids)
      except Exception:
          pass

    for schedule in payload.get("schedulePlannerSchedules") or []:
      try:
          upsert_schedule(to_schedule_row(schedule), user["id"])
          counts["schedules"] += 1
      except Exception:
          pass

    for port in payload.get("schedulePlannerPorts") or []:
      try:
          upsert_port(to_port_row(port), user["id"])
          counts["ports"] += 1
      except Exception:
          pass

    for report in payload.get("bunkerReports") or []:
      try:
          upsert_bunker_report(to_bunker_row(report), user["id"])
          counts["bunkerReports"] += 1
      except Exception:
          pass

    return {"ok": True, "counts": counts}


def local_my_vessel_ids(payload: dict) -> list[str]:
    selected_ids = {str(value) for value in payload.get("fleetOverviewMyVessels") or []}
    selected_names = {
        str(value).strip().lower()
        for value in payload.get("fleetOverviewMyVesselNames") or []
        if str(value).strip()
    }
    ids = []
    for vessel in payload.get("fleetOverviewVessels") or []:
        is_selected_id = str(vessel.get("id")) in selected_ids
        is_selected_name = str(vessel.get("name") or "").strip().lower() in selected_names
        if not is_selected_id and not is_selected_name:
            continue
        vessel_id = vessel_id_for_legacy_selection(vessel)
        if vessel_id and vessel_id not in ids:
            ids.append(vessel_id)
    for name in selected_names:
        vessel_id = vessel_id_for_legacy_selection({"name": name})
        if vessel_id and vessel_id not in ids:
            ids.append(vessel_id)
    return ids


def to_schedule_row(schedule: dict) -> dict:
    return {
        "id": schedule.get("id"),
        "name": schedule.get("name") or "Imported schedule",
        "vessel_id": schedule.get("vesselId") or schedule.get("vessel_id"),
        "vessel": schedule.get("vessel") or "Unknown vessel",
        "voyage_number": schedule.get("voyageNumber") or schedule.get("voyage_number"),
        "trade": schedule.get("trade"),
        "operator": schedule.get("operator"),
        "start_date": schedule.get("startDate") or schedule.get("start_date"),
        "rows": schedule.get("rows") or [],
        "fuel": schedule.get("fuel") or {},
        "instructions": schedule.get("instructions"),
        "vessel_email": schedule.get("vesselEmail") or schedule.get("vessel_email"),
    }


def to_port_row(port: dict) -> dict:
    return {
        "code": port.get("code"),
        "name": port.get("name"),
        "country": port.get("country") or "--",
        "utc": port.get("utc") or 0,
        "terminal": port.get("terminal"),
        "lat": port.get("lat"),
        "lon": port.get("lon"),
        "custom": port.get("custom") is not False,
    }


def to_bunker_row(report: dict) -> dict:
    return {
        "id": report.get("id"),
        "vessel_id": report.get("vesselId") or report.get("vessel_id"),
        "vessel": report.get("vessel") or "Unknown vessel",
        "voyage_number": report.get("voyageNumber") or report.get("voyage_number"),
        "port": report.get("port"),
        "berth": report.get("berth"),
        "grade": report.get("grade"),
        "quantity": report.get("quantity"),
        "price_per_mt": report.get("pricePerMT") or report.get("price_per_mt"),
        "total_cost": report.get("totalCost") or report.get("total_cost"),
        "rob_before": report.get("robBefore") or report.get("rob_before"),
        "rob_after": report.get("robAfter") or report.get("rob_after"),
        "fuels": report.get("fuels") or [],
        "supplier": report.get("supplier"),
        "delivery_date": report.get("deliveryDate") or report.get("delivery_date"),
        "notes": report.get("notes"),
    }
