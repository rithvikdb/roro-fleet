from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.dependencies import current_user
from backend.app.integrations.registry import get_connector, list_connectors
from backend.app.repositories import integrations

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/connectors")
def connector_catalog(_user=Depends(current_user)):
    return {"items": list_connectors()}


@router.get("/connections")
def list_connections(_user=Depends(current_user)):
    return {"items": integrations.list_connections()}


@router.post("/connections")
def create_connection(payload: dict, user=Depends(current_user)):
    validate_connection(payload)
    return integrations.create_connection(payload, user["id"])


@router.patch("/connections/{connection_id}")
def update_connection(connection_id: str, payload: dict, user=Depends(current_user)):
    current = require_connection(connection_id)
    validate_connection(payload, current)
    row = integrations.update_connection(connection_id, payload, user["id"])
    return row


@router.get("/connections/{connection_id}/runs")
def list_connection_runs(connection_id: str, _user=Depends(current_user)):
    require_connection(connection_id)
    return {"items": integrations.list_sync_runs(connection_id)}


@router.post("/connections/{connection_id}/runs")
def queue_connection_run(connection_id: str, payload: dict, user=Depends(current_user)):
    require_connection(connection_id)
    return integrations.queue_sync_run(connection_id, payload, user["id"])


def require_connection(connection_id: str) -> dict:
    row = integrations.get_connection(connection_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration connection not found")
    return row


def validate_connection(payload: dict, current: dict | None = None) -> None:
    connector_key = payload.get("connector_key") or (current or {}).get("connector_key")
    connector = get_connector(connector_key)
    if not connector:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown connector")
    mode = payload.get("mode")
    if mode and mode not in connector["modes"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported connector mode")
