const MAX_AGE_MS = 5 * 60 * 1000;
const metrics = ['percent', 'voltage_v', 'remaining_mah', 'full_charge_mah', 'design_mah', 'cycle_count'];

function mergeDeviceReadings(cache, readings, now) {
  const next = new Map(cache);
  const devices = [];
  const seen = new Set();

  for (const device of readings) {
    seen.add(device.id);
    const previous = next.get(device.id);
    const hasReading = metrics.some((key) => device[key] !== null && device[key] !== undefined);
    if (hasReading) {
      const fresh = { ...device, observedAt: now };
      next.set(device.id, { snapshot: fresh, observedAt: now });
      devices.push(fresh);
    } else if (previous && now - previous.observedAt <= MAX_AGE_MS) {
      devices.push({
        ...previous.snapshot,
        name: device.name || previous.snapshot.name,
        model: device.model || previous.snapshot.model,
        connection: device.connection,
        connected: device.connected,
        stale: true,
        observedAt: previous.observedAt
      });
    } else {
      next.delete(device.id);
      devices.push(device);
    }
  }

  for (const [id, previous] of next) {
    if (seen.has(id)) continue;
    if (now - previous.observedAt > MAX_AGE_MS) {
      next.delete(id);
      continue;
    }
    devices.push({ ...previous.snapshot, connected: false, stale: true, observedAt: previous.observedAt });
  }
  return { cache: next, devices };
}

module.exports = { mergeDeviceReadings };
