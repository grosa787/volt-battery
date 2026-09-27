const test = require('node:test');
const assert = require('node:assert/strict');
const { macSnapshot, deviceSnapshot, normalizeGauge, mergeDevices, parseCoreDevices, parseSystemHealth } = require('../electron/telemetry');

test('Mac snapshot preserves mAh, volts, health, charging and cycles', () => {
  const result = macSnapshot({
    Voltage: 12094, CurrentCapacity: 62, ExternalConnected: true, IsCharging: true, CycleCount: 46,
    BatteryData: { RemainingCapacity: 3660, FullChargeCapacity: 5999, DesignCapacity: 6249 }
  });
  assert.equal(result.voltage_v, 12.094);
  assert.equal(result.remaining_mah, 3660);
  assert.equal(result.full_charge_mah, 5999);
  assert.equal(result.design_mah, 6249);
  assert.equal(result.health_percent, null);
  assert.equal(result.raw_health_percent, 96);
  assert.equal(result.percent, 62);
  assert.equal(result.status, 'charging');
  assert.equal(result.cycle_count, 46);
});

test('macOS maximum capacity is kept distinct from raw design ratio', () => {
  const health = parseSystemHealth({ SPPowerDataType: [{ sppower_battery_health_info: {
    sppower_battery_health: 'Good',
    sppower_battery_health_maximum_capacity: '100\u00a0%'
  } }] });
  const result = macSnapshot({ BatteryData: { FullChargeCapacity: 5971, DesignCapacity: 6249 } }, health);
  assert.equal(result.health_percent, 100);
  assert.equal(result.health_condition, 'Good');
  assert.equal(result.raw_health_percent, 96);
});

test('power adapter without charging has its own state', () => {
  assert.equal(macSnapshot({ ExternalConnected: true, IsCharging: false }).status, 'plugged_in');
});

test('USB sighting wins over Wi-Fi sighting of the same device', () => {
  assert.deepEqual(mergeDevices(['abc', 'def'], ['abc', 'ghi']), [
    ['abc', 'usb'], ['def', 'usb'], ['ghi', 'wifi']
  ]);
});

test('missing iOS battery fields remain unknown', () => {
  const result = deviceSnapshot('abc', 'wifi', { DeviceName: 'iPhone' }, {}, {}, {});
  assert.equal(result.percent, null);
  assert.equal(result.voltage_v, null);
  assert.equal(result.status, 'unknown');
});

test('AppleSmartBattery details supply iOS capacity and voltage', () => {
  const result = deviceSnapshot('abc', 'wifi', { DeviceName: 'iPhone' },
    { BatteryCurrentCapacity: 100, BatteryIsCharging: false, ExternalConnected: false },
    normalizeGauge({ CycleCount: 73, FullChargeCapacity: 100 }),
    { Voltage: 4391, CurrentCapacity: 100, CycleCount: 73,
      BatteryData: { RemainingCapacity: 3990, FullChargeCapacity: 4297, DesignCapacity: 4297 } });
  assert.equal(result.percent, 100);
  assert.equal(result.voltage_v, 4.391);
  assert.equal(result.remaining_mah, 3990);
  assert.equal(result.full_charge_mah, 4297);
  assert.equal(result.health_percent, 100);
  assert.equal(result.cycle_count, 73);
});

test('health percentage is not mislabeled as mAh', () => {
  const result = deviceSnapshot('abc', 'usb', {}, {},
    normalizeGauge({ FullChargeCapacity: 89, DesignCapacity: 4000 }), {});
  assert.equal(result.full_charge_mah, null);
  assert.equal(result.health_percent, 89);
});

test('flat IORegistry mAh fields are accepted', () => {
  const result = deviceSnapshot('abc', 'usb', {}, {}, {},
    { AppleRawCurrentCapacity: 3800, AppleRawMaxCapacity: 4100, DesignCapacity: 4500 });
  assert.equal(result.remaining_mah, 3800);
  assert.equal(result.full_charge_mah, 4100);
  assert.equal(result.health_percent, 91);
});

test('out of range BatteryCurrentCapacity falls back to IORegistry percent', () => {
  const result = deviceSnapshot('abc', 'usb', {}, { CurrentCapacity: 3800 }, {}, { CurrentCapacity: 52 });
  assert.equal(result.percent, 52);
});

test('CoreDevice discovery excludes simulators and identifies Wi-Fi', () => {
  const devices = parseCoreDevices({ result: { devices: [
    { properties: { hardware: { udid: 'real', deviceType: 'iPhone', reality: 'physical' },
      state: { name: 'My iPhone' }, connection: { pairingState: 'paired', transportType: 'localNetwork', state: 'connected' } } },
    { properties: { hardware: { udid: 'sim', deviceType: 'iPhone', reality: 'simulated' },
      connection: { pairingState: 'paired' } } }
  ] } });
  assert.deepEqual(devices.map((device) => [device.id, device.connection, device.connected]), [['real', 'wifi', true]]);
});
