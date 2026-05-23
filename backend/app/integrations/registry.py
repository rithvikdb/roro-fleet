CONNECTORS = {
    "cargo_planning": {
        "key": "cargo_planning",
        "name": "Cargo Planning",
        "description": "Import load lists, stowage summaries, and cargo planning outputs.",
        "domains": ["voyage_plan", "schedule", "cargo"],
        "directions": ["inbound", "outbound"],
        "modes": ["file", "pull", "push"],
    },
    "weather": {
        "key": "weather",
        "name": "Weather And Routing",
        "description": "Bring forecasts, warnings, and voyage weather overlays into planning.",
        "domains": ["voyage_plan", "route", "weather"],
        "directions": ["inbound"],
        "modes": ["pull", "webhook"],
    },
    "ais_tracking": {
        "key": "ais_tracking",
        "name": "AIS Tracking",
        "description": "Refresh vessel position and ETA signals from external fleet feeds.",
        "domains": ["vessel", "position"],
        "directions": ["inbound"],
        "modes": ["pull", "webhook"],
    },
    "document_exchange": {
        "key": "document_exchange",
        "name": "Document Exchange",
        "description": "Exchange voyage instructions, reports, and operator documents.",
        "domains": ["voyage_plan", "document"],
        "directions": ["inbound", "outbound"],
        "modes": ["push", "webhook"],
    },
}


def list_connectors() -> list[dict]:
    return list(CONNECTORS.values())


def get_connector(key: str | None) -> dict | None:
    return CONNECTORS.get(key or "")
