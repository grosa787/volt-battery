const $ = (id) => document.getElementById(id);
const labels = { charging: 'Заряжается', plugged_in: 'Подключён к сети', full: 'Заряжен', on_battery: 'От батареи', unknown: 'Нет данных' };
const value = (number, unit = '') => number === null || number === undefined ? '—' : `${number}${unit}`;
const capacity = (number) => number === null || number === undefined ? '—' : `${Math.round(number).toLocaleString('ru-RU')} мА·ч`;
let lastDevices = [];

function paintMac(mac) {
  if (!mac) {
    $('mac-percent').textContent = '—';
    $('mac-caption').textContent = 'Нет актуальных показаний батареи Mac';
    $('mac-status').textContent = 'Нет данных';
    $('mac-status').className = 'status-pill';
    $('mac-fill').style.width = '0%';
    document.querySelector('.battery-track').setAttribute('aria-valuenow', 0);
    for (const id of ['mac-voltage', 'mac-remaining', 'mac-full', 'mac-design', 'mac-health', 'mac-raw-health', 'mac-cycles']) {
      $(id).textContent = '—';
    }
    return;
  }
  $('mac-percent').textContent = value(mac.percent);
  $('mac-caption').textContent = labels[mac.status] || labels.unknown;
  $('mac-status').textContent = labels[mac.status] || labels.unknown;
  $('mac-status').className = `status-pill ${mac.status}`;
  $('mac-fill').style.width = `${Math.min(100, Math.max(0, mac.percent || 0))}%`;
  document.querySelector('.battery-track').setAttribute('aria-valuenow', mac.percent ?? 0);
  $('mac-voltage').textContent = value(mac.voltage_v, ' В');
  $('mac-remaining').textContent = capacity(mac.remaining_mah);
  $('mac-full').textContent = capacity(mac.full_charge_mah);
  $('mac-design').textContent = capacity(mac.design_mah);
  const condition = mac.health_condition === 'Good' ? 'норма' :
    mac.health_condition === 'Service Recommended' ? 'нужен сервис' : '';
  $('mac-health').textContent = mac.health_percent === null
    ? (condition || '—') : `${mac.health_percent}%${condition ? ` · ${condition}` : ''}`;
  $('mac-raw-health').textContent = value(mac.raw_health_percent, '%');
  $('mac-cycles').textContent = value(mac.cycle_count);
  if (mac.external_connected && mac.adapter_watts) {
    $('mac-caption').textContent += ` · адаптер ${mac.adapter_watts} Вт`;
  }
}

function deviceCard(device) {
  const card = document.createElement('article');
  card.className = 'ios-card';
  const top = document.createElement('div');
  top.className = 'ios-top';
  const title = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'ios-name';
  name.textContent = device.name;
  const model = document.createElement('div');
  model.className = 'ios-model';
  model.textContent = device.model || 'iPhone / iPad';
  title.append(name, model);
  const connection = document.createElement('span');
  connection.className = 'connection';
  connection.textContent = !device.connected ? 'Не в сети' : device.connection === 'wifi' ? '◉ Wi‑Fi' : '↳ USB';
  top.append(title, connection);
  const percent = document.createElement('div');
  percent.className = 'ios-percent';
  percent.textContent = value(device.percent, '%');
  const caption = document.createElement('div');
  caption.className = 'ios-caption';
  const lastSeen = device.observedAt ? new Date(device.observedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';
  caption.textContent = device.stale ? `Последние данные ${lastSeen} · ${device.connected ? 'ожидаем ответ iOS' : 'нет связи'}` :
    !device.connected ? 'Проверьте Wi‑Fi или подключите по USB' :
    device.percent === null ? 'iOS не предоставила данные батареи' : labels[device.status] || labels.unknown;
  const meter = document.createElement('div');
  meter.className = 'ios-meter';
  const fill = document.createElement('div');
  fill.style.width = `${Math.min(100, Math.max(0, device.percent || 0))}%`;
  meter.append(fill);
  const details = document.createElement('div');
  details.className = 'ios-details';
  for (const [label, displayed] of [
    ['Напряжение', value(device.voltage_v, ' В')],
    ['Заряжено', capacity(device.remaining_mah)],
    ['Полная ёмкость', capacity(device.full_charge_mah)],
    ['Состояние', value(device.health_percent, '%')],
    ['Проектная ёмкость', capacity(device.design_mah)],
    ['Циклов', value(device.cycle_count)],
  ]) {
    const item = document.createElement('div');
    item.textContent = `${label} · `;
    const strong = document.createElement('strong');
    strong.textContent = displayed;
    item.append(strong);
    details.append(item);
  }
  card.append(top, percent, caption, meter, details);
  return card;
}

function paintDevices(devices, toolsAvailable) {
  lastDevices = devices;
  $('device-count').textContent = devices.length;
  const container = $('devices');
  container.replaceChildren();
  if (devices.length) {
    for (const device of devices) container.append(deviceCard(device));
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div class="empty-icon">⌁</div><strong>Устройства не найдены</strong><p>Подключите iPhone или iPad по USB и подтвердите доверие. Для Wi‑Fi включите синхронизацию через Finder.</p>';
    container.append(empty);
  }
  $('help-note').textContent = toolsAvailable
    ? 'Некоторые показатели iPhone и iPad скрыты самой iOS и отображаются только когда доступны.'
    : 'Для чтения iPhone и iPad установите libimobiledevice: brew install libimobiledevice';
}

window.batteryAPI.onTelemetry((data) => {
  if ('mac' in data) {
    paintMac(data.mac);
    $('updated').textContent = `MAC · ${new Date(data.updated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if ('devices' in data) paintDevices(data.devices || [], data.ios_tools_available);
});
window.batteryAPI.onError((error) => {
  if (error.kind === 'mac') {
    paintMac(null);
    $('updated').textContent = 'MAC · НЕТ ДАННЫХ';
  } else {
    paintDevices(lastDevices.map((device) => ({ ...device, stale: true, connected: false })), true);
    $('help-note').textContent = 'Не удалось обновить устройства. Показаны последние данные.';
  }
});
$('refresh').addEventListener('click', () => window.batteryAPI.refresh());
