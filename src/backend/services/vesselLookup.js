export async function lookupVesselDetails(query) {
  const value = String(query || '').trim();
  if (!value) throw new Error('Enter a vessel name or IMO number');

  const response = await fetch(`/api/vessel-lookup?q=${encodeURIComponent(value)}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Vessel lookup failed');
  }

  if (!data.found) {
    throw new Error(data.error || 'Vessel not found on public AIS sources');
  }

  return data;
}
