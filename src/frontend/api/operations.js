import { deleteJson, getJson, postJson, putJson } from './client';

export async function listSchedules() {
  const data = await getJson('/api/schedules');
  return data.items || [];
}

export async function saveSchedule(schedule) {
  return putJson(`/api/schedules/${encodeURIComponent(schedule.id)}`, schedule);
}

export async function deleteSchedule(id) {
  return deleteJson(`/api/schedules/${encodeURIComponent(id)}`);
}

export async function listCustomPorts() {
  const data = await getJson('/api/ports');
  return data.items || [];
}

export async function saveCustomPort(port) {
  return putJson(`/api/ports/${encodeURIComponent(port.code)}`, port);
}

export async function listBunkerReports() {
  const data = await getJson('/api/bunker-reports');
  return (data.items || []).map(fromBunkerRow);
}

export async function saveBunkerReport(report) {
  return fromBunkerRow(await putJson(`/api/bunker-reports/${encodeURIComponent(report.id)}`, toBunkerRow(report)));
}

export async function deleteBunkerReport(id) {
  return deleteJson(`/api/bunker-reports/${encodeURIComponent(id)}`);
}

export async function listNoonReports() {
  const data = await getJson('/api/noon-reports');
  return data.items || [];
}

export async function saveNoonReport(report) {
  return postJson('/api/noon-reports', report);
}

export async function listVoyagePlans() {
  const data = await getJson('/api/voyage-plans');
  return data.items || [];
}

export async function saveVoyagePlan(plan) {
  const vessel = encodeURIComponent(plan.vessel || plan.vesselName || '');
  const voyage = encodeURIComponent(plan.voyageNumber || plan.voyage_number || 'TBC');
  return putJson(`/api/voyage-plans/${vessel}/${voyage}`, toVoyagePlanRow(plan));
}

export async function listPortMeetings() {
  const data = await getJson('/api/port-meetings');
  return data.items || [];
}

export async function savePortMeeting(meeting) {
  return putJson(`/api/port-meetings/${encodeURIComponent(meeting.id)}`, toPortMeetingRow(meeting));
}

function fromBunkerRow(row) {
  if (!row) return row;
  return {
    ...row,
    voyageNumber: row.voyage_number ?? row.voyageNumber,
    pricePerMT: row.price_per_mt ?? row.pricePerMT,
    totalCost: row.total_cost ?? row.totalCost,
    robBefore: row.rob_before ?? row.robBefore,
    robAfter: row.rob_after ?? row.robAfter,
    deliveryDate: row.delivery_date ?? row.deliveryDate,
  };
}

function toBunkerRow(report) {
  return {
    id: report.id,
    vessel_id: report.vesselId || report.vessel_id || null,
    vessel: report.vessel,
    voyage_number: report.voyageNumber || report.voyage_number || null,
    port: report.port || null,
    berth: report.berth || null,
    grade: report.grade || null,
    quantity: report.quantity || null,
    price_per_mt: report.pricePerMT || report.price_per_mt || null,
    total_cost: report.totalCost || report.total_cost || null,
    rob_before: report.robBefore || report.rob_before || null,
    rob_after: report.robAfter || report.rob_after || null,
    fuels: report.fuels || [],
    supplier: report.supplier || null,
    delivery_date: report.deliveryDate || report.delivery_date || null,
    notes: report.notes || null,
    expected_updated_at: report.updated_at || report.updatedAt || null,
  };
}

function toVoyagePlanRow(plan) {
  return {
    vessel_id: plan.vesselId || plan.vessel_id || null,
    vessel: plan.vessel || plan.vesselName,
    voyage_number: plan.voyageNumber || plan.voyage_number || 'TBC',
    schedule_id: plan.scheduleId || plan.schedule_id || null,
    operator: plan.operator || null,
    vessel_email: plan.vesselEmail || plan.vessel_email || null,
    departure_port: plan.departurePort || plan.departure_port || null,
    departure_date: plan.departureDate || plan.departure_date || null,
    departure_time: plan.departureTime || plan.departure_time || null,
    schedule_rows: plan.scheduleRows || plan.schedule_rows || [],
    bunker_reports: plan.bunkerReports || plan.bunker_reports || [],
    instructions: plan.instructions || null,
    discharge_instructions: plan.dischargeInstructions || plan.discharge_instructions || null,
    sailing_instructions: plan.sailingInstructions || plan.sailing_instructions || null,
    expected_updated_at: plan.expectedUpdatedAt || plan.updated_at || null,
    phase: plan.phase || null,
  };
}

function toPortMeetingRow(meeting) {
  return {
    id: meeting.id,
    port_code: meeting.portCode || meeting.port_code || null,
    port_name: meeting.portName || meeting.port_name || null,
    meeting_date: meeting.meetingDate || meeting.meeting_date || null,
    terminal: meeting.terminal || null,
    calls: meeting.calls || [],
    notes: meeting.notes || null,
    expected_updated_at: meeting.expectedUpdatedAt || meeting.updated_at || null,
  };
}
