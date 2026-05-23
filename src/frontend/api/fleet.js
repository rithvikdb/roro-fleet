import { deleteJson, getJson, patchJson, postJson, putJson } from './client';

export async function getFleetStats() {
  return getJson('/api/fleet/stats');
}

export async function listVessels() {
  const data = await getJson('/api/vessels');
  return data.items || [];
}

export async function createVessel(vessel) {
  return postJson('/api/vessels', vessel);
}

export async function updateVessel(id, vessel) {
  return patchJson(`/api/vessels/${encodeURIComponent(id)}`, vessel);
}

export async function deleteVessel(id) {
  return deleteJson(`/api/vessels/${encodeURIComponent(id)}`);
}

export async function listMyVessels() {
  const data = await getJson('/api/my-vessels');
  return data.items || [];
}

export async function saveMyVessels(vesselIds) {
  return putJson('/api/my-vessels', { vesselIds });
}

export async function createSeaRoute(origin, destination) {
  return postJson('/api/sea-routes', { origin, destination });
}

export async function getVesselPerformanceProfile(id) {
  return getJson(`/api/vessels/${encodeURIComponent(id)}/performance-profile`);
}

export async function saveVesselPerformanceProfile(id, profile) {
  return putJson(`/api/vessels/${encodeURIComponent(id)}/performance-profile`, profile);
}
