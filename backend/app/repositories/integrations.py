from psycopg.types.json import Jsonb

from backend.app.db import fetch_all, fetch_one


CONNECTION_FIELDS = {
    "connector_key",
    "display_name",
    "mode",
    "status",
    "settings",
    "schedule",
    "credentials_ref",
}


def list_connections() -> list[dict]:
    return fetch_all("select * from integration_connections order by updated_at desc")


def get_connection(connection_id: str) -> dict | None:
    return fetch_one("select * from integration_connections where id = %s", (connection_id,))


def create_connection(payload: dict, user_id: str | None = None) -> dict:
    values = connection_values(payload, user_id)
    return fetch_one(
        """
        insert into integration_connections (
          connector_key, display_name, mode, status, settings, schedule,
          credentials_ref, created_by, updated_by
        )
        values (
          %(connector_key)s, %(display_name)s, %(mode)s, %(status)s, %(settings)s, %(schedule)s,
          %(credentials_ref)s, %(created_by)s, %(updated_by)s
        )
        returning *
        """,
        values,
    )


def update_connection(connection_id: str, payload: dict, user_id: str | None = None) -> dict | None:
    values = {key: payload[key] for key in CONNECTION_FIELDS if key in payload}
    if "settings" in values:
        values["settings"] = Jsonb(values.get("settings") or {})
    if "schedule" in values:
        values["schedule"] = Jsonb(values.get("schedule") or {})
    if not values:
        return get_connection(connection_id)
    values["id"] = connection_id
    values["updated_by"] = user_id
    sets = ", ".join([f"{key} = %({key})s" for key in values if key != "id"])
    return fetch_one(f"update integration_connections set {sets} where id = %(id)s returning *", values)


def list_sync_runs(connection_id: str) -> list[dict]:
    return fetch_all(
        """
        select *
        from integration_sync_runs
        where connection_id = %s
        order by requested_at desc
        limit 100
        """,
        (connection_id,),
    )


def queue_sync_run(connection_id: str, payload: dict, user_id: str | None = None) -> dict:
    return fetch_one(
        """
        insert into integration_sync_runs (
          connection_id, trigger_type, direction, status, cursor, requested_by
        )
        values (
          %(connection_id)s, %(trigger_type)s, %(direction)s, 'queued', %(cursor)s, %(requested_by)s
        )
        returning *
        """,
        {
            "connection_id": connection_id,
            "trigger_type": payload.get("trigger_type") or "manual",
            "direction": payload.get("direction") or "inbound",
            "cursor": Jsonb(payload.get("cursor") or {}),
            "requested_by": user_id,
        },
    )


def record_event(payload: dict) -> dict:
    return fetch_one(
        """
        insert into integration_events (
          connection_id, connector_key, direction, event_type, idempotency_key,
          payload, status, error
        )
        values (
          %(connection_id)s, %(connector_key)s, %(direction)s, %(event_type)s, %(idempotency_key)s,
          %(payload)s, %(status)s, %(error)s
        )
        on conflict (connector_key, idempotency_key) where idempotency_key is not null
        do update set
          payload = excluded.payload,
          status = excluded.status,
          error = excluded.error
        returning *
        """,
        {
            "connection_id": payload.get("connection_id"),
            "connector_key": payload.get("connector_key"),
            "direction": payload.get("direction") or "inbound",
            "event_type": payload.get("event_type"),
            "idempotency_key": payload.get("idempotency_key"),
            "payload": Jsonb(payload.get("payload") or {}),
            "status": payload.get("status") or "received",
            "error": payload.get("error"),
        },
    )


def link_external_record(payload: dict) -> dict:
    return fetch_one(
        """
        insert into external_record_links (
          connection_id, entity_type, entity_key, external_record_type,
          external_record_id, external_version, metadata
        )
        values (
          %(connection_id)s, %(entity_type)s, %(entity_key)s, %(external_record_type)s,
          %(external_record_id)s, %(external_version)s, %(metadata)s
        )
        on conflict (connection_id, external_record_type, external_record_id)
        do update set
          entity_type = excluded.entity_type,
          entity_key = excluded.entity_key,
          external_version = excluded.external_version,
          metadata = excluded.metadata,
          last_seen_at = now()
        returning *
        """,
        {
            **payload,
            "metadata": Jsonb(payload.get("metadata") or {}),
        },
    )


def find_external_record_link(connection_id: str, external_record_type: str, external_record_id: str) -> dict | None:
    return fetch_one(
        """
        select *
        from external_record_links
        where connection_id = %s
          and external_record_type = %s
          and external_record_id = %s
        """,
        (connection_id, external_record_type, external_record_id),
    )


def connection_values(payload: dict, user_id: str | None) -> dict:
    return {
        "connector_key": payload.get("connector_key"),
        "display_name": payload.get("display_name") or payload.get("connector_key") or "Integration",
        "mode": payload.get("mode") or "pull",
        "status": payload.get("status") or "draft",
        "settings": Jsonb(payload.get("settings") or {}),
        "schedule": Jsonb(payload.get("schedule") or {}),
        "credentials_ref": payload.get("credentials_ref"),
        "created_by": user_id,
        "updated_by": user_id,
    }
