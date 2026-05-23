-- Core PostgreSQL data model for RORO Fleet.
-- This schema is for a single app-owned PostgreSQL database behind FastAPI.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text not null default 'viewer',
  password_salt text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  imo text unique,
  mmsi text,
  type text not null default 'PCTC',
  flag text,
  status text not null default 'sea',
  route text,
  trade text,
  speed numeric,
  fuel_rate numeric,
  cargo_util numeric,
  cii_rating text,
  lat numeric,
  lon numeric,
  eta text,
  next_port text,
  last_port text,
  lane_meters numeric,
  voyage_progress numeric,
  dwt numeric,
  built integer,
  gt numeric,
  propulsion text,
  call_sign text,
  voyage_number text,
  ceu numeric,
  eexi numeric,
  aer numeric,
  co2_ytd numeric,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_vessels (
  user_id uuid not null references public.app_users(id) on delete cascade,
  vessel_id uuid not null references public.vessels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vessel_id)
);

create table if not exists public.vessel_performance_profiles (
  vessel_id uuid primary key references public.vessels(id) on delete cascade,
  abbreviation text,
  piracy_area_18kt text,
  load_nor text,
  emergency_max_rpm numeric,
  emergency_max_speed_kt numeric,
  emergency_max_foc numeric,
  emergency_5_less_rpm numeric,
  emergency_5_less_speed_kt numeric,
  emergency_5_less_foc numeric,
  emergency_10_less_rpm numeric,
  emergency_10_less_speed_kt numeric,
  emergency_10_less_foc numeric,
  osr_min_load text,
  osr_min_rpm numeric,
  osr_speed_kt numeric,
  osr_foc numeric,
  target text,
  not_available_rpm numeric,
  at_sea_fo_mt_day numeric,
  at_sea_do_mt_day numeric,
  in_port_fo_mt_day numeric,
  in_port_do_mt_day numeric,
  management text,
  gross_tonnage numeric,
  owner text,
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_trade_overrides (
  vessel_id uuid primary key references public.vessels(id) on delete cascade,
  trade text not null,
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_planner_schedules (
  id text primary key,
  name text not null,
  vessel_id uuid references public.vessels(id) on delete set null,
  vessel text not null,
  voyage_number text,
  trade text,
  operator text,
  start_date timestamptz,
  rows jsonb not null default '[]'::jsonb,
  fuel jsonb not null default '{}'::jsonb,
  instructions text,
  vessel_email text,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_planner_ports (
  code text primary key,
  name text not null,
  country text not null default '--',
  utc numeric not null default 0,
  terminal text,
  lat numeric,
  lon numeric,
  custom boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bunker_reports (
  id text primary key,
  vessel_id uuid references public.vessels(id) on delete set null,
  vessel text not null,
  voyage_number text,
  port text,
  berth text,
  grade text,
  quantity numeric,
  price_per_mt numeric,
  total_cost numeric,
  rob_before numeric,
  rob_after numeric,
  fuels jsonb not null default '[]'::jsonb,
  supplier text,
  delivery_date date,
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voyage_plans (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references public.vessels(id) on delete set null,
  vessel text not null,
  voyage_number text not null default 'TBC',
  schedule_id text references public.schedule_planner_schedules(id) on delete set null,
  operator text,
  vessel_email text,
  departure_port text,
  departure_date date,
  departure_time text,
  schedule_rows jsonb not null default '[]'::jsonb,
  bunker_reports jsonb not null default '[]'::jsonb,
  instructions text,
  discharge_instructions text,
  sailing_instructions text,
  phase text,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vessel, voyage_number)
);

create table if not exists public.noon_reports (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid references public.vessels(id) on delete set null,
  report_text text,
  parsed_data jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.port_meetings (
  id text primary key,
  port_code text,
  port_name text,
  meeting_date date,
  terminal text,
  calls jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- External systems integrate through these tables. Core vessel/voyage tables
-- remain the canonical app records and do not store provider-specific fields.
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  connector_key text not null,
  display_name text not null,
  mode text not null default 'pull',
  status text not null default 'draft',
  settings jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  credentials_ref text,
  last_sync_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  trigger_type text not null default 'manual',
  direction text not null default 'inbound',
  status text not null default 'queued',
  cursor jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error text,
  requested_by uuid references public.app_users(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.integration_connections(id) on delete set null,
  connector_key text not null,
  direction text not null,
  event_type text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.external_record_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  entity_type text not null,
  entity_key text not null,
  external_record_type text not null,
  external_record_id text not null,
  external_version text,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (connection_id, external_record_type, external_record_id)
);

drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists vessels_updated_at on public.vessels;
create trigger vessels_updated_at before update on public.vessels
for each row execute function public.set_updated_at();

drop trigger if exists fleet_trade_overrides_updated_at on public.fleet_trade_overrides;
create trigger fleet_trade_overrides_updated_at before update on public.fleet_trade_overrides
for each row execute function public.set_updated_at();

drop trigger if exists schedule_planner_schedules_updated_at on public.schedule_planner_schedules;
create trigger schedule_planner_schedules_updated_at before update on public.schedule_planner_schedules
for each row execute function public.set_updated_at();

drop trigger if exists schedule_planner_ports_updated_at on public.schedule_planner_ports;
create trigger schedule_planner_ports_updated_at before update on public.schedule_planner_ports
for each row execute function public.set_updated_at();

drop trigger if exists bunker_reports_updated_at on public.bunker_reports;
create trigger bunker_reports_updated_at before update on public.bunker_reports
for each row execute function public.set_updated_at();

drop trigger if exists voyage_plans_updated_at on public.voyage_plans;
create trigger voyage_plans_updated_at before update on public.voyage_plans
for each row execute function public.set_updated_at();

drop trigger if exists port_meetings_updated_at on public.port_meetings;
create trigger port_meetings_updated_at before update on public.port_meetings
for each row execute function public.set_updated_at();

drop trigger if exists integration_connections_updated_at on public.integration_connections;
create trigger integration_connections_updated_at before update on public.integration_connections
for each row execute function public.set_updated_at();

create index if not exists app_sessions_user_expires_idx on public.app_sessions (user_id, expires_at);
create index if not exists vessels_name_idx on public.vessels (name);
create index if not exists vessels_trade_idx on public.vessels (trade);
create index if not exists vessels_status_idx on public.vessels (status);
create index if not exists schedule_planner_schedules_updated_at_idx on public.schedule_planner_schedules (updated_at desc);
create index if not exists schedule_planner_schedules_vessel_idx on public.schedule_planner_schedules (vessel);
create index if not exists bunker_reports_vessel_idx on public.bunker_reports (vessel);
create index if not exists bunker_reports_delivery_date_idx on public.bunker_reports (delivery_date desc);
create index if not exists voyage_plans_vessel_voyage_idx on public.voyage_plans (vessel, voyage_number);
create index if not exists noon_reports_created_at_idx on public.noon_reports (created_at desc);
create index if not exists port_meetings_port_date_idx on public.port_meetings (port_code, meeting_date desc);
create index if not exists integration_connections_connector_idx on public.integration_connections (connector_key, status);
create index if not exists integration_sync_runs_connection_requested_idx on public.integration_sync_runs (connection_id, requested_at desc);
create index if not exists integration_events_connection_created_idx on public.integration_events (connection_id, created_at desc);
create unique index if not exists integration_events_idempotency_idx
on public.integration_events (connector_key, idempotency_key)
where idempotency_key is not null;
create index if not exists external_record_links_entity_idx on public.external_record_links (entity_type, entity_key);
