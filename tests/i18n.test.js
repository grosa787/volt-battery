const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { strings, initialLanguage, translate } = require('../src/i18n');

test('first launch asks for a language and later launches use the saved choice', () => {
  assert.equal(initialLanguage(null), null);
  assert.equal(initialLanguage('en'), 'en');
  assert.equal(initialLanguage('ru'), 'ru');
  assert.equal(initialLanguage('unsupported'), null);
});

test('every visible phrase has Russian and English text', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.ru).sort());
  for (const language of ['ru', 'en']) {
    for (const [key, value] of Object.entries(strings[language])) {
      assert.ok(typeof value === 'string' && value.trim(), `${language}.${key}`);
    }
  }
  assert.equal(translate('en', 'healthByMac'), 'Battery health by macOS');
  assert.equal(translate('ru', 'healthByMac'), 'Состояние по macOS');
});

test('unknown locale uses Russian fallback', () => {
  assert.equal(translate('de', 'healthByMac'), 'Состояние по macOS');
});

test('all interface translation keys exist in both languages', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer.js'), 'utf8');
  const staticKeys = [...html.matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g)].map((match) => match[1]);
  const dynamicKeys = [...renderer.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  for (const key of [...staticKeys, ...dynamicKeys]) {
    assert.ok(strings.ru[key], `ru.${key}`);
    assert.ok(strings.en[key], `en.${key}`);
  }
});
