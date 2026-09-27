const strings = {
  ru: {
    live: 'В РЕАЛЬНОМ ВРЕМЕНИ', overview: 'ОБЗОР', updating: 'ОБНОВЛЕНИЕ...',
    thisMac: 'Этот Mac', builtInBattery: 'Встроенная батарея', waiting: 'Ожидание',
    readingBattery: 'Получаем показания батареи', macBattery: 'Батарея Mac', macCharge: 'Заряд Mac',
    voltage: 'НАПРЯЖЕНИЕ', charged: 'ЗАРЯЖЕНО', fullCapacity: 'ПОЛНАЯ ЁМКОСТЬ',
    designCapacity: 'ПРОЕКТНАЯ ЁМКОСТЬ', healthByMac: 'Состояние по macOS',
    rawRatio: 'Полная / проектная (расчёт)', chargeCycles: 'Циклов зарядки',
    nearby: 'УСТРОЙСТВА РЯДОМ', iosTitle: 'iPhone и iPad', refresh: 'Обновить',
    searching: 'Ищем устройства', connectIntro: 'Подключите iPhone или iPad по USB и подтвердите доверие либо включите синхронизацию по Wi‑Fi.',
    initialHelp: 'Данные iPhone и iPad зависят от доступа, предоставленного iOS после сопряжения.',
    notFound: 'Устройства не найдены', connectHelp: 'Подключите iPhone или iPad по USB и подтвердите доверие. Для Wi‑Fi включите синхронизацию через Finder.',
    limitedData: 'Некоторые показатели iPhone и iPad скрыты самой iOS и отображаются только когда доступны.',
    installTools: 'Для чтения iPhone и iPad установите libimobiledevice: brew install libimobiledevice',
    noMacData: 'Нет актуальных показаний батареи Mac', noData: 'Нет данных',
    charging: 'Заряжается', pluggedIn: 'Подключён к сети', full: 'Заряжен', onBattery: 'От батареи',
    normal: 'норма', service: 'нужен сервис', adapter: 'адаптер',
    offline: 'Не в сети', lastReadings: 'Последние данные', awaitingIos: 'ожидаем ответ iOS',
    noConnection: 'нет связи', checkConnection: 'Проверьте Wi‑Fi или подключите по USB',
    iosNoData: 'iOS не предоставила данные батареи', health: 'Состояние (расчёт)', cycles: 'Циклов',
    failedDevices: 'Не удалось обновить устройства. Показаны последние данные.',
    macUpdated: 'MAC', macNoData: 'MAC · НЕТ ДАННЫХ', switchLanguage: 'Сменить язык'
  },
  en: {
    live: 'LIVE UPDATES', overview: 'OVERVIEW', updating: 'UPDATING...',
    thisMac: 'This Mac', builtInBattery: 'Built-in battery', waiting: 'Waiting',
    readingBattery: 'Reading battery data', macBattery: 'Mac battery', macCharge: 'Mac charge',
    voltage: 'VOLTAGE', charged: 'CHARGE LEFT', fullCapacity: 'FULL CAPACITY',
    designCapacity: 'DESIGN CAPACITY', healthByMac: 'Battery health by macOS',
    rawRatio: 'Full / design (calculated)', chargeCycles: 'Charge cycles',
    nearby: 'NEARBY DEVICES', iosTitle: 'iPhone and iPad', refresh: 'Refresh',
    searching: 'Looking for devices', connectIntro: 'Connect an iPhone or iPad by USB and tap Trust, or enable Wi-Fi syncing.',
    initialHelp: 'iPhone and iPad data depends on what iOS allows after pairing.',
    notFound: 'No devices found', connectHelp: 'Connect an iPhone or iPad by USB and tap Trust. For Wi-Fi, enable syncing in Finder.',
    limitedData: 'Some iPhone and iPad battery values are hidden by iOS and appear only when available.',
    installTools: 'To read iPhone and iPad data, install libimobiledevice: brew install libimobiledevice',
    noMacData: 'No current Mac battery readings', noData: 'No data',
    charging: 'Charging', pluggedIn: 'Plugged in', full: 'Fully charged', onBattery: 'On battery',
    normal: 'normal', service: 'service recommended', adapter: 'adapter',
    offline: 'Offline', lastReadings: 'Last reading', awaitingIos: 'waiting for iOS',
    noConnection: 'disconnected', checkConnection: 'Check Wi-Fi or connect by USB',
    iosNoData: 'iOS did not provide battery data', health: 'Health (estimated)', cycles: 'Cycles',
    failedDevices: 'Could not refresh devices. Showing the last readings.',
    macUpdated: 'MAC', macNoData: 'MAC · NO DATA', switchLanguage: 'Change language'
  }
};

function initialLanguage(saved) {
  return saved === 'ru' || saved === 'en' ? saved : null;
}

function translate(language, key) {
  return strings[language]?.[key] ?? strings.ru[key] ?? key;
}

const api = { strings, initialLanguage, translate };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.batteryI18n = api;
