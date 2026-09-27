const $ = (id) => document.getElementById(id);
const i18nApi = window.batteryI18n;
const savedLanguage = i18nApi.initialLanguage(localStorage.getItem('volt-battery-language'));
let language = savedLanguage || 'ru';
let lastMac = undefined;
let lastMacTime = null;
let lastDevices = null;
let lastToolsAvailable = null;
let macError = false;
let devicesError = false;

const t = (key) => i18nApi.translate(language, key);
const value = (number, unit = '') => number === null || number === undefined ? '—' : String(number) + unit;
const capacity = (number) => number === null || number === undefined
  ? '—' : Math.round(number).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU') + (language === 'en' ? ' mAh' : ' мА·ч');
const time = (timestamp) => new Date(timestamp).toLocaleTimeString(
  language === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }
);
const statusLabels = {
  charging: 'charging', plugged_in: 'pluggedIn', full: 'full', on_battery: 'onBattery', unknown: 'noData'
};
const status = (kind) => t(statusLabels[kind] || 'noData');

function applyStaticLanguage() {
  document.documentElement.lang = language;
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-title]')) {
    element.title = t(element.dataset.i18nTitle);
  }
  for (const element of document.querySelectorAll('[data-i18n-aria]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAria));
  }
  $('language-switch').textContent = language.toUpperCase();
}

function paintMac(mac) {
  if (!mac) {
    $('mac-percent').textContent = '—';
    $('mac-caption').textContent = t('noMacData');
    $('mac-status').textContent = t('noData');
    $('mac-status').className = 'status-pill';
    $('mac-fill').style.width = '0%';
    document.querySelector('.battery-track').setAttribute('aria-valuenow', 0);
    for (const id of ['mac-voltage', 'mac-remaining', 'mac-full', 'mac-design', 'mac-health', 'mac-raw-health', 'mac-cycles']) {
      $(id).textContent = '—';
    }
    return;
  }
  $('mac-percent').textContent = value(mac.percent);
  $('mac-caption').textContent = status(mac.status);
  $('mac-status').textContent = status(mac.status);
  $('mac-status').className = 'status-pill ' + mac.status;
  $('mac-fill').style.width = String(Math.min(100, Math.max(0, mac.percent || 0))) + '%';
  document.querySelector('.battery-track').setAttribute('aria-valuenow', mac.percent ?? 0);
  $('mac-voltage').textContent = value(mac.voltage_v, language === 'en' ? ' V' : ' В');
  $('mac-remaining').textContent = capacity(mac.remaining_mah);
  $('mac-full').textContent = capacity(mac.full_charge_mah);
  $('mac-design').textContent = capacity(mac.design_mah);
  const condition = mac.health_condition === 'Good' ? t('normal') :
    mac.health_condition === 'Service Recommended' ? t('service') : '';
  $('mac-health').textContent = mac.health_percent === null
    ? (condition || '—') : String(mac.health_percent) + '%' + (condition ? ' · ' + condition : '');
  $('mac-raw-health').textContent = value(mac.raw_health_percent, '%');
  $('mac-cycles').textContent = value(mac.cycle_count);
  if (mac.external_connected && mac.adapter_watts) {
    $('mac-caption').textContent += ' · ' + t('adapter') + ' ' + mac.adapter_watts + (language === 'en' ? ' W' : ' Вт');
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
  connection.textContent = !device.connected ? t('offline') : device.connection === 'wifi' ? '◉ Wi-Fi' : '↳ USB';
  top.append(title, connection);
  const percent = document.createElement('div');
  percent.className = 'ios-percent';
  percent.textContent = value(device.percent, '%');
  const caption = document.createElement('div');
  caption.className = 'ios-caption';
  const lastSeen = device.observedAt ? time(device.observedAt) : '';
  caption.textContent = device.stale
    ? t('lastReadings') + ' ' + lastSeen + ' · ' + (device.connected ? t('awaitingIos') : t('noConnection'))
    : !device.connected ? t('checkConnection')
      : device.percent === null ? t('iosNoData') : status(device.status);
  const meter = document.createElement('div');
  meter.className = 'ios-meter';
  const fill = document.createElement('div');
  fill.style.width = String(Math.min(100, Math.max(0, device.percent || 0))) + '%';
  meter.append(fill);
  const details = document.createElement('div');
  details.className = 'ios-details';
  for (const [label, displayed] of [
    [t('voltage'), value(device.voltage_v, language === 'en' ? ' V' : ' В')],
    [t('charged'), capacity(device.remaining_mah)],
    [t('fullCapacity'), capacity(device.full_charge_mah)],
    [t('health'), value(device.health_percent, '%')],
    [t('designCapacity'), capacity(device.design_mah)],
    [t('cycles'), value(device.cycle_count)]
  ]) {
    const item = document.createElement('div');
    item.textContent = label + ' · ';
    const strong = document.createElement('strong');
    strong.textContent = displayed;
    item.append(strong);
    details.append(item);
  }
  card.append(top, percent, caption, meter, details);
  return card;
}

function paintDevices(devices, toolsAvailable) {
  $('device-count').textContent = devices.length;
  const container = $('devices');
  container.replaceChildren();
  if (devices.length) {
    for (const device of devices) container.append(deviceCard(device));
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '⌁';
    const heading = document.createElement('strong');
    heading.textContent = t('notFound');
    const message = document.createElement('p');
    message.textContent = t('connectHelp');
    empty.append(icon, heading, message);
    container.append(empty);
  }
  $('help-note').textContent = toolsAvailable ? t('limitedData') : t('installTools');
}

function renderCurrent() {
  applyStaticLanguage();
  if (lastMac !== undefined) paintMac(lastMac);
  if (macError) $('updated').textContent = t('macNoData');
  else if (lastMacTime) $('updated').textContent = t('macUpdated') + ' · ' + time(lastMacTime);
  if (lastDevices !== null) paintDevices(lastDevices, lastToolsAvailable);
  if (devicesError) $('help-note').textContent = t('failedDevices');
}

function showLanguageDialog() {
  $('language-dialog').hidden = false;
  $('language-dialog').querySelector('[data-language="' + language + '"]').focus();
}

for (const button of document.querySelectorAll('[data-language]')) {
  button.addEventListener('click', () => {
    language = button.dataset.language;
    localStorage.setItem('volt-battery-language', language);
    $('language-dialog').hidden = true;
    renderCurrent();
  });
}
$('language-switch').addEventListener('click', showLanguageDialog);
$('refresh').addEventListener('click', () => window.batteryAPI.refresh());

window.batteryAPI.onTelemetry((data) => {
  if ('mac' in data) {
    lastMac = data.mac;
    lastMacTime = data.updated_at;
    macError = false;
    paintMac(lastMac);
    $('updated').textContent = t('macUpdated') + ' · ' + time(lastMacTime);
  }
  if ('devices' in data) {
    lastDevices = data.devices || [];
    lastToolsAvailable = data.ios_tools_available;
    devicesError = false;
    paintDevices(lastDevices, lastToolsAvailable);
  }
});
window.batteryAPI.onError((error) => {
  if (error.kind === 'mac') {
    lastMac = null;
    macError = true;
    paintMac(null);
    $('updated').textContent = t('macNoData');
  } else {
    lastDevices = (lastDevices || []).map((device) => ({ ...device, stale: true, connected: false }));
    lastToolsAvailable = true;
    devicesError = true;
    paintDevices(lastDevices, lastToolsAvailable);
    $('help-note').textContent = t('failedDevices');
  }
});

applyStaticLanguage();
if (!savedLanguage) showLanguageDialog();
