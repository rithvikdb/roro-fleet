import { postJson } from './client';

const MIGRATION_KEY = 'postgresMigration:v3';

const LOCAL_STORAGE_KEYS = [
  'fleetOverviewVessels',
  'fleetOverviewMyVessels',
  'fleetOverviewMyVesselNames',
  'fleetTradeByVessel',
  'schedulePlannerSchedules',
  'schedulePlannerPorts',
  'bunkerReports',
];

export async function migrateLocalStorageOnce() {
  if (localStorage.getItem(MIGRATION_KEY) === 'complete') return null;

  const payload = {};
  LOCAL_STORAGE_KEYS.forEach((key) => {
    try {
      payload[key] = JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      payload[key] = null;
    }
  });

  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith('voyagePlan:')) return;
    try {
      if (!payload.voyagePlans) payload.voyagePlans = [];
      payload.voyagePlans.push(JSON.parse(localStorage.getItem(key) || 'null'));
    } catch {}
  });

  const result = await postJson('/api/migration/local-storage', payload);
  localStorage.setItem(MIGRATION_KEY, 'complete');
  return result;
}
