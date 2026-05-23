# PostgreSQL And FastAPI Data Architecture

## Goal

Application data must live in PostgreSQL behind FastAPI, not browser `localStorage`. Browser storage is tied to a single browser profile and exact origin such as `localhost:3000` or `127.0.0.1:5181`, which caused saved vessel data to appear missing when the app opened under a different URL.

The target architecture is:

1. Use one app-owned PostgreSQL database as the source of truth.
2. Use FastAPI as the only backend boundary.
3. Keep database credentials on the server only.
4. Use `localStorage` only as a one-time legacy migration source.
5. Load from PostgreSQL through `/api/*` on login and on focus.
6. Save user edits to PostgreSQL first.

## Ecosystem Boundary

The frontend tabs are not separate products. They are different working views over the same operational records:

- `Fleet` owns vessel identity, current operational vessel fields, and per-user `My Vessels` selection.
- `Vessel Detail` extends the same vessel record with performance profile data.
- `Schedule Planner` owns port rotation timing rows for a vessel and voyage.
- `Voyage Plan` composes schedule, performance, bunkering, and instruction documents for that vessel and voyage.
- `Bunkering` owns bunker report records that Voyage Plan links by vessel, voyage, and port.
- `Port Meetings` owns terminal-call meeting logs and can generate shared schedule records from logged calls.

Do not create a second copy of a vessel, voyage, schedule, bunker report, port, or instruction document just to support a screen. Add a FastAPI route and PostgreSQL field/table when a screen needs a new shared domain fact.

## Data Ownership

Shared operational data should be visible to all authenticated fleet users:

- Vessels
- Vessel trade/status/position fields
- Schedules
- Planner ports
- Bunker reports
- Port meetings
- Noon reports

Per-user data should be scoped to one user:

- My vessels selection
- UI preferences

## Tables

The proposed schema is in:

```text
deploy/postgresql-core-schema.sql
```

Core tables:

- `app_users`: application-owned users and roles.
- `app_sessions`: secure session tokens stored in HTTP-only cookies.
- `vessels`: master vessel records and current operational fields.
- `user_vessels`: each user's nominated vessels.
- `fleet_trade_overrides`: trade override per vessel.
- `schedule_planner_schedules`: saved schedule planner records.
- `schedule_planner_ports`: user-added planner ports.
- `bunker_reports`: shared bunker records linked by vessel/voyage/port.
- `voyage_plans`: shared instruction documents and linked schedules/bunkers.
- `noon_reports`: parsed noon reports and raw text.
- `port_meetings`: meeting/call data.
- `integration_connections`: configured external system connections without embedded secrets.
- `integration_sync_runs`: queued and historical import/export jobs for a connection.
- `integration_events`: inbound/outbound event envelopes with idempotency keys.
- `external_record_links`: mappings between app records and provider record IDs.

## Browser Storage Mapping

Current browser keys and their Postgres destination:

| Browser key | Destination |
| --- | --- |
| `fleetOverviewVessels` | `vessels` |
| `fleetOverviewMyVessels` | `user_vessels` |
| `fleetOverviewMyVesselNames` | `user_vessels` joined through `vessels.name` |
| `fleetTradeByVessel` | Legacy migration input only; active trade state belongs on shared vessel/schedule records |
| `schedulePlannerSchedules` | `schedule_planner_schedules` |
| `schedulePlannerPorts` | `schedule_planner_ports` |
| `bunkerReports` | `bunker_reports` |
| `voyagePlan:<vessel>:<voyage>` | `voyage_plans` |

## Migration Plan

1. Create the PostgreSQL schema with `deploy/postgresql-core-schema.sql`.
2. Add repository functions for each table under `backend/app/repositories`.
3. On app startup, read existing localStorage keys once.
4. Upsert those records into PostgreSQL for the logged-in user.
5. Mark migration complete with a version key such as `postgresMigration:v1`.
6. Do not reintroduce localStorage as an operational save target.
7. Remove URL-origin redirects that change storage buckets.

## Write Policy

For each feature screen:

1. Save to PostgreSQL through FastAPI.
2. Update React state from the saved backend record.
3. If save fails, show a visible error and keep the shared record unchanged.

Silent fallback to localStorage should be avoided because it hides data loss.

## Concurrent Operators

Shared operational writes carry the last loaded `updated_at` value as `expected_updated_at`.
FastAPI rejects stale schedule, voyage-plan, bunker-report, and port-meeting updates with HTTP `409` when another operator saved a newer version first. The user must refresh/reload the shared record and review the newer data before saving again.

`My Vessels` remains per-user. Trade belongs on shared vessel and schedule records; do not reintroduce browser-only trade overrides.

## Integration Boundary

Future cargo planning, weather, AIS, reporting, and document systems must integrate through FastAPI adapters under `backend/app/integrations`. The frontend should call our `/api/*` boundary and should not hold third-party database credentials or service keys.

Core PostgreSQL tables remain canonical. Provider IDs, cursors, raw event envelopes, sync state, and connection settings belong in the integration tables instead of being scattered across `vessels`, `voyage_plans`, or browser state.

The first connector catalog is exposed by `/api/integrations/connectors`. A connection is configured through `/api/integrations/connections`, and a future worker can execute queued jobs from `/api/integrations/connections/{id}/runs`.

Adapter rules:

1. Translate external payloads into canonical app commands or records.
2. Link imported/exported records through `external_record_links`.
3. Use `integration_events.idempotency_key` for webhook/file replay protection.
4. Store secret material outside PostgreSQL; `credentials_ref` points to a server-side secret source.
5. Record run results and errors in `integration_sync_runs`.
6. Add provider-specific data to integration payload/settings first; add a core column only when it becomes a real app domain fact.

## Auth And Security

Use backend-side authorization:

- FastAPI authenticates requests with HTTP-only session cookies.
- Authenticated users can read shared operational tables.
- Authenticated users can create/update shared operational records according to role checks.
- `user_vessels` rows are private to the owning user.
- Audit fields should record `created_by`, `updated_by`, `created_at`, and `updated_at`.

This keeps fleet operations shared while preserving user-specific selections.
