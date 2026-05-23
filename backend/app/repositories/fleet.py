from uuid import UUID

from backend.app.db import execute, fetch_all, fetch_one, get_conn


VESSEL_COLUMNS = """
id, name, imo, mmsi, type, flag, status, route, trade, speed, fuel_rate,
cargo_util, cii_rating, lat, lon, eta, next_port, last_port, lane_meters,
voyage_progress, dwt, built, gt, propulsion, call_sign, voyage_number, ceu,
eexi, aer, co2_ytd, created_at, updated_at
"""

PERFORMANCE_PROFILE_COLUMNS = """
vessel_id, abbreviation, piracy_area_18kt, load_nor,
emergency_max_rpm, emergency_max_speed_kt, emergency_max_foc,
emergency_5_less_rpm, emergency_5_less_speed_kt, emergency_5_less_foc,
emergency_10_less_rpm, emergency_10_less_speed_kt, emergency_10_less_foc,
osr_min_load, osr_min_rpm, osr_speed_kt, osr_foc, target, not_available_rpm,
at_sea_fo_mt_day, at_sea_do_mt_day, in_port_fo_mt_day, in_port_do_mt_day,
management, gross_tonnage, owner, updated_at
"""

PERFORMANCE_PROFILE_FIELDS = [
    "abbreviation", "piracy_area_18kt", "load_nor",
    "emergency_max_rpm", "emergency_max_speed_kt", "emergency_max_foc",
    "emergency_5_less_rpm", "emergency_5_less_speed_kt", "emergency_5_less_foc",
    "emergency_10_less_rpm", "emergency_10_less_speed_kt", "emergency_10_less_foc",
    "osr_min_load", "osr_min_rpm", "osr_speed_kt", "osr_foc", "target", "not_available_rpm",
    "at_sea_fo_mt_day", "at_sea_do_mt_day", "in_port_fo_mt_day", "in_port_do_mt_day",
    "management", "gross_tonnage", "owner",
]


def list_vessels() -> list[dict]:
    return fetch_all(f"select {VESSEL_COLUMNS} from vessels order by name")


def fleet_stats() -> dict:
    rows = fetch_all("select status, cargo_util, cii_rating, speed from vessels")
    if not rows:
        return {"total": 0, "atSea": 0, "avgUtil": 0, "ciiA": 0, "atRisk": 0, "noonUpdates": 0, "avgSpeed": 0}
    at_sea = [row for row in rows if row.get("status") == "sea"]
    return {
        "total": len(rows),
        "atSea": len(at_sea),
        "avgUtil": round(sum(float(row.get("cargo_util") or 0) for row in rows) / len(rows)),
        "ciiA": len([row for row in rows if row.get("cii_rating") == "A"]),
        "atRisk": 0,
        "noonUpdates": 0,
        "avgSpeed": round(sum(float(row.get("speed") or 0) for row in at_sea) / len(at_sea), 1) if at_sea else 0,
    }


def create_vessel(payload: dict, user_id: str | None = None) -> dict:
    row_payload = normalize_vessel_payload(payload)
    row = fetch_one(
        """
        insert into vessels (
          name, imo, mmsi, type, flag, status, route, trade, speed, fuel_rate,
          cargo_util, cii_rating, lat, lon, eta, next_port, last_port, lane_meters,
          voyage_progress, dwt, built, gt, propulsion, call_sign, voyage_number,
          ceu, eexi, aer, co2_ytd, created_by, updated_by
        )
        values (
          %(name)s, %(imo)s, %(mmsi)s, %(type)s, %(flag)s, %(status)s, %(route)s, %(trade)s, %(speed)s, %(fuel_rate)s,
          %(cargo_util)s, %(cii_rating)s, %(lat)s, %(lon)s, %(eta)s, %(next_port)s, %(last_port)s, %(lane_meters)s,
          %(voyage_progress)s, %(dwt)s, %(built)s, %(gt)s, %(propulsion)s, %(call_sign)s, %(voyage_number)s,
          %(ceu)s, %(eexi)s, %(aer)s, %(co2_ytd)s, %(created_by)s, %(updated_by)s
        )
        returning *
        """,
        {**row_payload, "created_by": user_id, "updated_by": user_id},
    )
    return row


def update_vessel(vessel_id: str, payload: dict, user_id: str | None = None) -> dict | None:
    allowed = [
        "name", "imo", "mmsi", "type", "flag", "status", "route", "trade", "speed", "fuel_rate",
        "cargo_util", "cii_rating", "lat", "lon", "eta", "next_port", "last_port", "lane_meters",
        "voyage_progress", "dwt", "built", "gt", "propulsion", "call_sign", "voyage_number",
        "ceu", "eexi", "aer", "co2_ytd",
    ]
    values = {key: payload[key] for key in allowed if key in payload}
    if not values:
        return fetch_one(f"select {VESSEL_COLUMNS} from vessels where id = %s", (vessel_id,))
    values["updated_by"] = user_id
    values["id"] = vessel_id
    sets = ", ".join([f"{key} = %({key})s" for key in values if key != "id"])
    return fetch_one(f"update vessels set {sets} where id = %(id)s returning *", values)


def delete_vessel(vessel_id: str) -> None:
    execute("delete from vessels where id = %s", (vessel_id,))


def list_user_vessels(user_id: str) -> list[dict]:
    return fetch_all(
        """
        select v.*
        from user_vessels uv
        join vessels v on v.id = uv.vessel_id
        where uv.user_id = %s
        order by v.name
        """,
        (user_id,),
    )


def set_user_vessels(user_id: str, vessel_ids: list[str]) -> None:
    requested_ids = unique_uuid_strings(vessel_ids)
    if vessel_ids and not requested_ids:
        raise ValueError("My Vessels must use database vessel IDs.")

    with get_conn() as conn:
        with conn.cursor() as cur:
            persisted_ids = []
            if requested_ids:
                cur.execute("select id from vessels where id = any(%s::uuid[])", (requested_ids,))
                persisted_ids = [str(row["id"]) for row in cur.fetchall()]
            if requested_ids and not persisted_ids:
                raise ValueError("No saved vessels matched the selected vessel IDs.")

            cur.execute("delete from user_vessels where user_id = %s", (user_id,))
            for vessel_id in persisted_ids:
                cur.execute(
                    "insert into user_vessels (user_id, vessel_id) values (%s, %s) on conflict do nothing",
                    (user_id, vessel_id),
                )


def vessel_id_for_legacy_selection(vessel: dict) -> str | None:
    imo = blank_to_none(vessel.get("imo"))
    if imo:
        row = fetch_one("select id from vessels where imo = %s", (imo,))
        if row:
            return str(row["id"])

    name = blank_to_none(vessel.get("name"))
    if name:
        row = fetch_one("select id from vessels where lower(name) = lower(%s) order by created_at limit 1", (name,))
        if row:
            return str(row["id"])
    return None


def get_performance_profile(vessel_id: str) -> dict | None:
    return fetch_one(
        f"select {PERFORMANCE_PROFILE_COLUMNS} from vessel_performance_profiles where vessel_id = %s",
        (vessel_id,),
    )


def save_performance_profile(vessel_id: str, payload: dict, user_id: str | None = None) -> dict:
    values = {field: blank_to_none(payload.get(field)) for field in PERFORMANCE_PROFILE_FIELDS}
    values["vessel_id"] = vessel_id
    values["updated_by"] = user_id
    columns = ", ".join(["vessel_id"] + PERFORMANCE_PROFILE_FIELDS + ["updated_by"])
    placeholders = ", ".join([f"%({field})s" for field in ["vessel_id"] + PERFORMANCE_PROFILE_FIELDS + ["updated_by"]])
    updates = ", ".join([f"{field} = excluded.{field}" for field in PERFORMANCE_PROFILE_FIELDS] + [
        "updated_by = excluded.updated_by",
        "updated_at = now()",
    ])
    return fetch_one(
        f"""
        insert into vessel_performance_profiles ({columns})
        values ({placeholders})
        on conflict (vessel_id) do update set {updates}
        returning {PERFORMANCE_PROFILE_COLUMNS}
        """,
        values,
    )


def blank_to_none(value):
    return None if value == "" else value


def unique_uuid_strings(values: list[str]) -> list[str]:
    unique = []
    seen = set()
    for value in values or []:
        try:
            normalized = str(UUID(str(value)))
        except (TypeError, ValueError, AttributeError):
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def normalize_vessel_payload(payload: dict) -> dict:
    fields = [
        "name", "imo", "mmsi", "type", "flag", "status", "route", "trade", "speed", "fuel_rate",
        "cargo_util", "cii_rating", "lat", "lon", "eta", "next_port", "last_port", "lane_meters",
        "voyage_progress", "dwt", "built", "gt", "propulsion", "call_sign", "voyage_number",
        "ceu", "eexi", "aer", "co2_ytd",
    ]
    normalized = {field: payload.get(field) for field in fields}
    normalized["name"] = normalized["name"] or "Unknown vessel"
    normalized["type"] = normalized["type"] or "PCTC"
    normalized["status"] = normalized["status"] or "sea"
    normalized["voyage_number"] = normalized["voyage_number"] or payload.get("voyageNumber")
    return normalized
