const { execFile } = require('node:child_process');
const fs = require('node:fs');
const plist = require('plist');

const toolDirectories = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/usr/sbin', '/bin', '/sbin'];

function pick(source, ...keys) {
  for (const key of keys) {
    if (source?.[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

function number(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ratio(part, whole) {
  const numerator = number(part);
  const denominator = number(whole);
  return numerator !== null && denominator !== null && denominator > 0
    ? Math.round(numerator / denominator * 100) : null;
}

function powerStatus(charging, connected, full) {
  if (charging === true) return 'charging';
  if (full === true) return 'full';
  if (connected === true) return 'plugged_in';
  if (connected === false) return 'on_battery';
  return 'unknown';
}

function parseSystemHealth(document) {
  const info = document?.SPPowerDataType?.find((item) => item.sppower_battery_health_info)?.sppower_battery_health_info || {};
  const maximum = info.sppower_battery_health_maximum_capacity;
  const match = String(maximum ?? '').match(/\d+(?:[.,]\d+)?/);
  return {
    percent: match ? Math.round(Number(match[0].replace(',', '.'))) : null,
    condition: info.sppower_battery_health || null
  };
}

function macSnapshot(raw, systemHealth = {}) {
  const battery = raw?.BatteryData || {};
  const remaining = pick(battery, 'RemainingCapacity');
  const full = pick(battery, 'FullChargeCapacity', 'NominalChargeCapacity');
  const design = pick(battery, 'DesignCapacity');
  const rawPercent = number(raw?.CurrentCapacity);
  const voltage = number(pick(raw, 'Voltage', 'AppleRawBatteryVoltage'));
  return {
    name: 'Этот Mac',
    percent: rawPercent !== null ? Math.round(rawPercent) : ratio(remaining, full),
    voltage_v: voltage === null ? null : Math.round(voltage) / 1000,
    remaining_mah: remaining,
    full_charge_mah: full,
    design_mah: design,
    health_percent: systemHealth.percent ?? null,
    health_condition: systemHealth.condition ?? null,
    raw_health_percent: ratio(full, design),
    cycle_count: pick(raw, 'CycleCount'),
    status: powerStatus(raw?.IsCharging, raw?.ExternalConnected, raw?.FullyCharged),
    external_connected: raw?.ExternalConnected ?? null,
    adapter_watts: number(raw?.AdapterDetails?.Watts)
  };
}

function normalizeGauge(raw) {
  const gauge = { ...(raw || {}) };
  const full = number(gauge.FullChargeCapacity);
  if (full !== null && full <= 100) {
    gauge.ReportedHealthPercent = Math.round(full);
    delete gauge.FullChargeCapacity;
  }
  return gauge;
}

function deviceSnapshot(id, connection, info = {}, battery = {}, gauge = {}, ioreg = {}) {
  const batteryData = ioreg.BatteryData || {};
  let percent = number(pick(battery, 'BatteryCurrentCapacity', 'CurrentCapacity'));
  if (percent === null || percent < 0 || percent > 100) percent = number(ioreg.CurrentCapacity);
  if (percent !== null && (percent < 0 || percent > 100)) percent = null;

  const voltage = number(pick(ioreg, 'Voltage', 'AppleRawBatteryVoltage'))
    ?? number(pick(gauge, 'Voltage', 'AppleRawBatteryVoltage'))
    ?? number(pick(battery, 'Voltage', 'BatteryVoltage'));
  const remaining = pick(batteryData, 'RemainingCapacity', 'AppleRawCurrentCapacity')
    ?? pick(ioreg, 'RemainingCapacity', 'AppleRawCurrentCapacity')
    ?? pick(gauge, 'RemainingCapacity', 'AppleRawCurrentCapacity');
  let full = pick(batteryData, 'FullChargeCapacity', 'NominalChargeCapacity')
    ?? pick(ioreg, 'AppleRawMaxCapacity', 'NominalChargeCapacity', 'FullChargeCapacity')
    ?? pick(gauge, 'FullChargeCapacity', 'AppleRawMaxCapacity', 'NominalChargeCapacity');
  const design = pick(batteryData, 'DesignCapacity')
    ?? pick(ioreg, 'DesignCapacity')
    ?? pick(gauge, 'DesignCapacity');
  if (number(full) !== null && number(full) <= 100) full = null;

  const charging = pick(battery, 'BatteryIsCharging', 'IsCharging') ?? pick(ioreg, 'IsCharging');
  const connected = pick(battery, 'ExternalConnected') ?? pick(ioreg, 'ExternalConnected');
  const fullFlag = pick(battery, 'FullyCharged', 'BatteryIsFullyCharged') ?? pick(ioreg, 'FullyCharged');
  return {
    id,
    name: pick(info, 'DeviceName', 'Name') || 'iPhone / iPad',
    model: pick(info, 'ProductType', 'Model') || '',
    connection,
    percent: percent === null ? null : Math.round(percent),
    voltage_v: voltage === null ? null : Math.round(voltage) / 1000,
    remaining_mah: remaining,
    full_charge_mah: full,
    design_mah: design,
    health_percent: ratio(full, design) ?? pick(gauge, 'ReportedHealthPercent'),
    cycle_count: pick(ioreg, 'CycleCount') ?? pick(gauge, 'CycleCount'),
    status: powerStatus(charging, connected, fullFlag)
  };
}

function mergeDevices(usbIds, wifiIds) {
  const seen = new Set();
  const results = [];
  for (const [ids, connection] of [[usbIds, 'usb'], [wifiIds, 'wifi']]) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      results.push([id, connection]);
    }
  }
  return results;
}

function parseCoreDevices(document) {
  const result = [];
  for (const item of document?.result?.devices || []) {
    const properties = item.properties || {};
    const hardware = properties.hardware || item.hardwareProperties || {};
    const state = properties.state || item.deviceProperties || {};
    const link = properties.connection || item.connectionProperties || {};
    if (hardware.reality && hardware.reality !== 'physical') continue;
    if (!['iPhone', 'iPad'].includes(hardware.deviceType)) continue;
    if (link.pairingState !== 'paired' || !hardware.udid) continue;
    result.push({
      id: hardware.udid,
      name: state.name || 'iPhone / iPad',
      model: hardware.marketingName || hardware.productType || '',
      connection: link.transportType === 'localNetwork' ? 'wifi' : 'usb',
      connected: link.state === 'connected' || link.tunnelState === 'connected'
    });
  }
  return result;
}

function unwrapBatteryData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  for (const key of ['GasGauge', 'IORegistry', 'IOPMPowerSource', 'Diagnostics']) {
    if (raw[key] && typeof raw[key] === 'object') return unwrapBatteryData(raw[key]);
  }
  return raw;
}

function resolveExecutable(name) {
  return toolDirectories.map((directory) => `${directory}/${name}`).find((candidate) => fs.existsSync(candidate)) || null;
}

function run(name, args, timeout = 5000) {
  const executable = resolveExecutable(name);
  if (!executable) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(executable, args, {
      timeout, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PATH: `${toolDirectories.join(':')}:${process.env.PATH || ''}` }
    }, (error, stdout) => resolve(error ? null : stdout));
  });
}

function parsePlist(text) {
  if (!text) return {};
  try { return plist.parse(text); } catch { return {}; }
}

async function readMac() {
  const [ioregText, profilerText] = await Promise.all([
    run('ioreg', ['-a', '-r', '-c', 'AppleSmartBattery'], 4000),
    run('system_profiler', ['SPPowerDataType', '-json'], 5000)
  ]);
  const raw = parsePlist(ioregText);
  let health = {};
  if (profilerText) {
    try { health = parseSystemHealth(JSON.parse(profilerText)); } catch { health = {}; }
  }
  return Array.isArray(raw) && raw.length ? macSnapshot(raw[0], health) : null;
}

async function listIds(flag) {
  const text = await run('idevice_id', [flag], 3000);
  return text ? text.split(/\r?\n/).map((id) => id.trim()).filter(Boolean) : [];
}

async function coreDevices() {
  const raw = await run('xcrun', ['devicectl', 'list', 'devices', '--json-output', '-'], 8000);
  if (!raw) return [];
  try { return parseCoreDevices(JSON.parse(raw)); } catch { return []; }
}

async function readDevice(item, accessibleIds) {
  const { id, connection } = item;
  if (!accessibleIds.has(id)) {
    return { ...deviceSnapshot(id, connection, { DeviceName: item.name, Model: item.model }), connected: false };
  }
  const target = [...(connection === 'wifi' ? ['-n'] : []), '-u', id];
  const info = parsePlist(await run('ideviceinfo', [...target, '-x'], 3000));
  const battery = parsePlist(await run('ideviceinfo', [...target, '-q', 'com.apple.mobile.battery', '-x'], 3000));
  const gauge = normalizeGauge(unwrapBatteryData(parsePlist(
    await run('idevicediagnostics', [...target, 'diagnostics', 'GasGauge'], 3000)
  )));
  let ioreg = unwrapBatteryData(parsePlist(
    await run('idevicediagnostics', [...target, 'ioregentry', 'AppleSmartBattery'], 3000)
  ));
  if (!Object.keys(ioreg).length) {
    ioreg = unwrapBatteryData(parsePlist(
      await run('idevicediagnostics', [...target, 'ioregentry', 'IOPMPowerSource'], 3000)
    ));
  }
  const snapshot = deviceSnapshot(id, connection, info, battery, gauge, ioreg);
  snapshot.name = info.DeviceName || item.name;
  snapshot.model = item.model || snapshot.model;
  snapshot.connected = true;
  return snapshot;
}

async function readDevices() {
  const [core, usb, wifi] = await Promise.all([coreDevices(), listIds('-l'), listIds('-n')]);
  const known = new Map(core.map((item) => [item.id, item]));
  const accessible = mergeDevices(usb, wifi);
  for (const [id, connection] of accessible) {
    known.set(id, { ...(known.get(id) || { id, name: 'iPhone / iPad', model: '' }), connection, connected: true });
  }
  const accessibleIds = new Set(accessible.map(([id]) => id));
  return Promise.all([...known.values()].map((item) => readDevice(item, accessibleIds)));
}

async function snapshot(kind) {
  const result = {};
  if (kind === 'mac' || kind === 'all') result.mac = await readMac();
  if (kind === 'devices' || kind === 'all') {
    result.devices = await readDevices();
    result.ios_tools_available = !!resolveExecutable('idevice_id');
  }
  result.updated_at = new Date().toISOString();
  return result;
}

module.exports = {
  macSnapshot, parseSystemHealth, deviceSnapshot, normalizeGauge, mergeDevices, parseCoreDevices,
  readMac, readDevices, snapshot
};
