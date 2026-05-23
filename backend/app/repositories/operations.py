from psycopg.types.json import Jsonb

from backend.app.db import execute, fetch_all, fetch_one


class StaleWriteError(RuntimeError):
    pass


def assert_current_version(table: str, where: str, params: tuple, expected_updated_at: str | None) -> None:
    if not expected_updated_at:
        return
    row = fetch_one(f"select updated_at from {table} where {where}", params)
    current = fetch_one(f"select updated_at from {table} where {where} and updated_at = %s::timestamptz", params + (expected_updated_at,))
    if row and not current:
        raise StaleWriteError("This record changed since it was loaded. Refresh and review before saving.")


def list_schedules() -> list[dict]:
    return fetch_all("select * from schedule_planner_schedules order by updated_at desc")


def upsert_schedule(payload: dict, user_id: str | None = None) -> dict:
    assert_current_version("schedule_planner_schedules", "id = %s", (payload.get("id"),), payload.get("expected_updated_at"))
    return fetch_one(
        """
        insert into schedule_planner_schedules (
          id, name, vessel_id, vessel, voyage_number, trade, operator, start_date,
          rows, fuel, instructions, vessel_email, created_by, updated_by
        )
        values (
          %(id)s, %(name)s, %(vessel_id)s, %(vessel)s, %(voyage_number)s, %(trade)s, %(operator)s, %(start_date)s,
          %(rows)s, %(fuel)s, %(instructions)s, %(vessel_email)s, %(created_by)s, %(updated_by)s
        )
        on conflict (id) do update set
          name = excluded.name,
          vessel_id = excluded.vessel_id,
          vessel = excluded.vessel,
          voyage_number = excluded.voyage_number,
          trade = excluded.trade,
          operator = excluded.operator,
          start_date = excluded.start_date,
          rows = excluded.rows,
          fuel = excluded.fuel,
          instructions = excluded.instructions,
          vessel_email = excluded.vessel_email,
          updated_by = excluded.updated_by
        returning *
        """,
        {
            **payload,
            "rows": Jsonb(payload.get("rows") or []),
            "fuel": Jsonb(payload.get("fuel") or {}),
            "created_by": user_id,
            "updated_by": user_id,
        },
    )


def delete_schedule(schedule_id: str) -> None:
    execute("delete from schedule_planner_schedules where id = %s", (schedule_id,))


def list_ports() -> list[dict]:
    return fetch_all("select * from schedule_planner_ports order by name")


def upsert_port(payload: dict, user_id: str | None = None) -> dict:
    return fetch_one(
        """
        insert into schedule_planner_ports (code, name, country, utc, terminal, lat, lon, custom, created_by, updated_by)
        values (%(code)s, %(name)s, %(country)s, %(utc)s, %(terminal)s, %(lat)s, %(lon)s, %(custom)s, %(created_by)s, %(updated_by)s)
        on conflict (code) do update set
          name = excluded.name,
          country = excluded.country,
          utc = excluded.utc,
          terminal = excluded.terminal,
          lat = excluded.lat,
          lon = excluded.lon,
          custom = excluded.custom,
          updated_by = excluded.updated_by
        returning *
        """,
        {**payload, "created_by": user_id, "updated_by": user_id},
    )


def list_bunker_reports() -> list[dict]:
    return fetch_all("select * from bunker_reports order by delivery_date desc nulls last, updated_at desc")


def upsert_bunker_report(payload: dict, user_id: str | None = None) -> dict:
    assert_current_version("bunker_reports", "id = %s", (payload.get("id"),), payload.get("expected_updated_at"))
    return fetch_one(
        """
        insert into bunker_reports (
          id, vessel_id, vessel, voyage_number, port, berth, grade, quantity, price_per_mt,
          total_cost, rob_before, rob_after, fuels, supplier, delivery_date, notes, created_by, updated_by
        )
        values (
          %(id)s, %(vessel_id)s, %(vessel)s, %(voyage_number)s, %(port)s, %(berth)s, %(grade)s, %(quantity)s, %(price_per_mt)s,
          %(total_cost)s, %(rob_before)s, %(rob_after)s, %(fuels)s, %(supplier)s, %(delivery_date)s, %(notes)s, %(created_by)s, %(updated_by)s
        )
        on conflict (id) do update set
          vessel_id = excluded.vessel_id,
          vessel = excluded.vessel,
          voyage_number = excluded.voyage_number,
          port = excluded.port,
          berth = excluded.berth,
          grade = excluded.grade,
          quantity = excluded.quantity,
          price_per_mt = excluded.price_per_mt,
          total_cost = excluded.total_cost,
          rob_before = excluded.rob_before,
          rob_after = excluded.rob_after,
          fuels = excluded.fuels,
          supplier = excluded.supplier,
          delivery_date = excluded.delivery_date,
          notes = excluded.notes,
          updated_by = excluded.updated_by
        returning *
        """,
        {
            **payload,
            "fuels": Jsonb(payload.get("fuels") or []),
            "created_by": user_id,
            "updated_by": user_id,
        },
    )


def delete_bunker_report(report_id: str) -> None:
    execute("delete from bunker_reports where id = %s", (report_id,))


def list_noon_reports() -> list[dict]:
    return fetch_all(
        """
        select nr.*, v.name as vessel_name
        from noon_reports nr
        left join vessels v on v.id = nr.vessel_id
        order by nr.created_at desc
        limit 50
        """
    )


def create_noon_report(payload: dict, user_id: str | None = None) -> dict:
    return fetch_one(
        """
        insert into noon_reports (vessel_id, report_text, parsed_data, created_by)
        values (%(vessel_id)s, %(report_text)s, %(parsed_data)s, %(created_by)s)
        returning *
        """,
        {**payload, "parsed_data": Jsonb(payload.get("parsed_data") or {}), "created_by": user_id},
    )


def list_voyage_plans() -> list[dict]:
    return fetch_all("select * from voyage_plans order by updated_at desc")


def upsert_voyage_plan(payload: dict, user_id: str | None = None) -> dict:
    assert_current_version(
        "voyage_plans",
        "vessel = %s and voyage_number = %s",
        (payload.get("vessel"), payload.get("voyage_number")),
        payload.get("expected_updated_at"),
    )
    return fetch_one(
        """
        insert into voyage_plans (
          vessel_id, vessel, voyage_number, schedule_id, operator, vessel_email,
          departure_port, departure_date, departure_time, schedule_rows, bunker_reports,
          instructions, discharge_instructions, sailing_instructions, phase, created_by, updated_by
        )
        values (
          %(vessel_id)s, %(vessel)s, %(voyage_number)s, %(schedule_id)s, %(operator)s, %(vessel_email)s,
          %(departure_port)s, %(departure_date)s, %(departure_time)s, %(schedule_rows)s, %(bunker_reports)s,
          %(instructions)s, %(discharge_instructions)s, %(sailing_instructions)s, %(phase)s, %(created_by)s, %(updated_by)s
        )
        on conflict (vessel, voyage_number) do update set
          vessel_id = excluded.vessel_id,
          schedule_id = excluded.schedule_id,
          operator = excluded.operator,
          vessel_email = excluded.vessel_email,
          departure_port = excluded.departure_port,
          departure_date = excluded.departure_date,
          departure_time = excluded.departure_time,
          schedule_rows = excluded.schedule_rows,
          bunker_reports = excluded.bunker_reports,
          instructions = excluded.instructions,
          discharge_instructions = excluded.discharge_instructions,
          sailing_instructions = excluded.sailing_instructions,
          phase = excluded.phase,
          updated_by = excluded.updated_by
        returning *
        """,
        {
            **payload,
            "discharge_instructions": payload.get("discharge_instructions"),
            "sailing_instructions": payload.get("sailing_instructions"),
            "schedule_rows": Jsonb(payload.get("schedule_rows") or payload.get("scheduleRows") or []),
            "bunker_reports": Jsonb(payload.get("bunker_reports") or payload.get("bunkerReports") or []),
            "created_by": user_id,
            "updated_by": user_id,
        },
    )


def list_port_meetings() -> list[dict]:
    return fetch_all("select * from port_meetings order by meeting_date desc nulls last, updated_at desc")


def upsert_port_meeting(payload: dict, user_id: str | None = None) -> dict:
    assert_current_version("port_meetings", "id = %s", (payload.get("id"),), payload.get("expected_updated_at"))
    return fetch_one(
        """
        insert into port_meetings (
          id, port_code, port_name, meeting_date, terminal, calls, notes, created_by, updated_by
        )
        values (
          %(id)s, %(port_code)s, %(port_name)s, %(meeting_date)s, %(terminal)s, %(calls)s, %(notes)s, %(created_by)s, %(updated_by)s
        )
        on conflict (id) do update set
          port_code = excluded.port_code,
          port_name = excluded.port_name,
          meeting_date = excluded.meeting_date,
          terminal = excluded.terminal,
          calls = excluded.calls,
          notes = excluded.notes,
          updated_by = excluded.updated_by
        returning *
        """,
        {**payload, "calls": Jsonb(payload.get("calls") or []), "created_by": user_id, "updated_by": user_id},
    )
