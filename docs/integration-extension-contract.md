# Integration Extension Contract

## Purpose

External systems should extend RORO Fleet without fragmenting the PostgreSQL model.
Cargo planning tools, weather providers, AIS feeds, and document systems enter through
FastAPI adapters and map into the same operational records used by the app.

## Backend Shape

```text
external provider
  -> backend/app/integrations/<adapter>
  -> FastAPI command/query boundary
  -> PostgreSQL canonical tables
```

The registry in `backend/app/integrations/registry.py` declares connector families
and allowed connection modes. Provider implementations can be added below that
package without putting provider logic into React components.

## Stored Integration State

- `integration_connections` stores non-secret connector configuration.
- `integration_sync_runs` stores import/export job status and cursors.
- `integration_events` stores event envelopes and replay/idempotency state.
- `external_record_links` maps provider record IDs to app entity keys.

`credentials_ref` is only a pointer to server-side secret material. Passwords,
API keys, refresh tokens, and certificates should not be stored in React state or
in connector settings JSON.

## Canonical Entities

Adapters should map into these app concepts before creating new domain tables:

- vessel
- port
- schedule
- voyage plan
- bunker report
- noon report
- port meeting

Examples:

- A cargo planning import can link an external voyage/load-plan ID to a voyage plan.
- A weather adapter can write weather event envelopes and later attach normalized
  warnings or route risk outputs to a voyage planning workflow.
- An AIS adapter can update canonical vessel position fields while keeping provider
  message IDs in `external_record_links` and `integration_events`.

## Rules For New Connectors

1. Add connector metadata to the registry.
2. Add the adapter under `backend/app/integrations`.
3. Use an integration connection for provider configuration and secret references.
4. Create sync runs or event envelopes before mutating canonical records.
5. Make imports idempotent and auditable.
6. Keep provider fields at the integration edge unless the field becomes part of the
   product domain across providers.
