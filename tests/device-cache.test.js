const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeDeviceReadings } = require('../electron/device-cache');

test('brief iOS telemetry dropout keeps a clearly marked last reading', () => {
  const first = mergeDeviceReadings(new Map(), [
    { id: 'phone', name: 'iPhone', connection: 'wifi', connected: true, percent: 75, voltage_v: 4.1 }
  ], 1000);
  const second = mergeDeviceReadings(first.cache, [
    { id: 'phone', name: 'iPhone', connection: 'wifi', connected: false, percent: null, voltage_v: null }
  ], 2000);
  assert.equal(second.devices[0].percent, 75);
  assert.equal(second.devices[0].connected, false);
  assert.equal(second.devices[0].stale, true);
  assert.equal(second.devices[0].observedAt, 1000);
});

test('old device readings expire instead of appearing current', () => {
  const first = mergeDeviceReadings(new Map(), [
    { id: 'phone', connection: 'wifi', connected: true, percent: 75 }
  ], 1000);
  const second = mergeDeviceReadings(first.cache, [
    { id: 'phone', connection: 'wifi', connected: false, percent: null }
  ], 302000);
  assert.equal(second.devices[0].percent, null);
  assert.equal(second.devices[0].stale, undefined);
});

test('a device missing from discovery remains offline briefly', () => {
  const first = mergeDeviceReadings(new Map(), [
    { id: 'phone', name: 'iPhone', connection: 'usb', connected: true, percent: 48 }
  ], 1000);
  const second = mergeDeviceReadings(first.cache, [], 2000);
  assert.equal(second.devices[0].name, 'iPhone');
  assert.equal(second.devices[0].percent, 48);
  assert.equal(second.devices[0].connected, false);
  assert.equal(second.devices[0].stale, true);
});
