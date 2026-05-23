import {
  deleteSchedule,
  listCustomPorts as listPortsFromApi,
  listSchedules as listSchedulesFromApi,
  saveCustomPort,
  saveSchedule,
} from '../../frontend/api/operations';

export async function listSchedules() {
  const data = await listSchedulesFromApi();
  return (data || []).map(fromScheduleRow);
}

export async function saveScheduleRecord(schedule) {
  const row = {
    id: schedule.id,
    name: schedule.name,
    vessel_id: schedule.vesselId || null,
    vessel: schedule.vessel,
    voyage_number: schedule.voyageNumber || null,
    trade: schedule.trade || null,
    operator: schedule.operator || null,
    start_date: schedule.startDate || null,
    rows: schedule.rows,
    fuel: schedule.fuel,
    instructions: schedule.instructions || null,
    vessel_email: schedule.vesselEmail || null,
    expected_updated_at: schedule.expectedUpdatedAt || schedule.updated_at || null,
  };

  const data = await saveSchedule(row);
  return fromScheduleRow(data);
}

export async function deleteScheduleRecord(id) {
  await deleteSchedule(id);
}

export async function listCustomPorts() {
  const data = await listPortsFromApi();
  return (data || []).map(fromPortRow);
}

export async function saveCustomPortRecord(port) {
  const row = {
    code: port.code,
    name: port.name,
    country: port.country,
    utc: port.utc,
    terminal: port.terminal || null,
    lat: port.lat || null,
    lon: port.lon || null,
    custom: true,
  };

  const data = await saveCustomPort(row);
  return fromPortRow(data);
}

export function isMissingScheduleTable(error) {
  return /not found|relation|schedule_planner_(schedules|ports)/i.test(error?.message || '');
}

function fromScheduleRow(row) {
  return {
    id: row.id,
    name: row.name,
    vessel: row.vessel,
    startDate: row.start_date,
    voyageNumber: row.voyage_number,
    trade: row.trade,
    operator: row.operator,
    rows: Array.isArray(row.rows) ? row.rows : [],
    fuel: row.fuel || null,
    instructions: row.instructions || '',
    vesselEmail: row.vessel_email || '',
    updatedAt: row.updated_at,
    expectedUpdatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

function fromPortRow(row) {
  return {
    code: row.code,
    name: row.name,
    country: row.country,
    utc: row.utc,
    custom: row.custom !== false,
  };
}
