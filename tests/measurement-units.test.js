const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EchoCore = require('../core');

test('all body-weight reference rows follow the report unit, including subsequent weight changes', () => {
  const rows = require('../reference-data');
  let report = EchoCore.generateReport({ species: 'dog', LVDd: '2.2', dx: 'Keep notes' }, rows[0]);
  for (const unit of ['mm', 'cm', 'mm']) {
    report = EchoCore.convertReportMModeUnit(report, unit);
    assert.equal(EchoCore.convertReportMModeUnit(report, unit), report);
    for (const row of rows) {
      report = EchoCore.updateReportReferences(report, row, 'dog');
      for (const key of EchoCore.keys) {
        const source = row.ranges[key];
        const expected = EchoCore.validRange(source)
          ? source.split('-').map(value => EchoCore.convertMModeValue(value, 'cm', unit)).join('-')
          : '원본 확인 필요';
        const line = report.split('\n').find(line => line.startsWith(`- ${key}:`));
        assert.ok(line.endsWith(`${unit} (${expected})`), `${row.weight} kg ${line}`);
      }
      assert.equal(EchoCore.readReportMeasurements(report, 'dog').LVDd.value, 2.2);
      assert.match(EchoCore.updateReportLviddn(report, '4.2', 'dog'), /LVIDDN: 1.443/);
      assert.ok(report.includes('Keep notes'));
    }
  }
});

test('feline ranges convert and blank values, CRLF and notes survive repeated toggles', () => {
  let report = EchoCore.generateReport({ species: 'cat', dx: 'Keep notes' }).replaceAll('\n', '\r\n');
  for (let index = 0; index < 4; index++) {
    report = EchoCore.convertReportMModeUnit(report, 'mm');
    assert.match(report, /- LVDd:  mm \(10.8-21.4\)\r\n/);
    assert.equal(EchoCore.convertReportMModeUnit(report, 'mm'), report);
    report = EchoCore.updateReportReferences(EchoCore.convertReportMModeUnit(report, 'cm'), null, 'cat');
    assert.match(report, /- LVDd:  cm \(1.08-2.14\)\r\n/);
    assert.equal(EchoCore.readReportMeasurements(report, 'cat').LVDd.raw, '');
    assert.ok(report.includes('Keep notes'));
  }
});

test('M mode units default to mm and convert entries with matching report measurements and reference ranges', () => {
  const nodes = new Map();
  const document = { activeElement: null };
  function element() {
    return {
      value: '', dataset: {}, validity: { valid: true }, listeners: {}, children: [], attributes: {},
      classList: { toggle() {} },
      set id(value) { this._id = value; nodes.set(value, this); },
      get id() { return this._id; },
      append(...children) { this.children.push(...children); },
      replaceChildren() { this.children = []; },
      querySelectorAll() { return []; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute() {}, setCustomValidity() {}, checkValidity() { return true; },
      focus() { document.activeElement = this; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
    };
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const speciesButtons = ['dog', 'cat'].map(species => {
    const button = element();
    button.dataset.speciesChoice = species;
    return button;
  });
  Object.assign(document, {
    getElementById: get, createElement: element,
    querySelectorAll: selector => selector === '[data-species-choice]' ? speciesButtons : [],
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, EchoCore, EchoEvaluations: require('../evaluations'), REFERENCE_DATA: require('../reference-data'),
  });
  const enter = (key, value) => {
    const input = get(`measurement-${key}`);
    input.value = value;
    input.focus();
    get('form').listeners.input({ target: input });
    document.activeElement = null;
  };
  const toggle = unit => get(`m-mode-unit-${unit}`).listeners.click();
  assert.equal(get('m-mode-unit-mm').attributes['aria-pressed'], 'true');
  get('weight').value = '4.2';
  get('weight').valueAsNumber = 4.2;
  enter('LVDd', '22');
  assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, 'high');
  get('weight').value = '8.6';
  get('weight').valueAsNumber = 8.6;
  get('form').listeners.input({ target: get('weight') });
  assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, 'low');
  assert.match(get('measurement-reference-LVDd').textContent, /24.98-26.94 mm/);
  get('weight').value = '';
  get('weight').valueAsNumber = NaN;
  get('form').listeners.input({ target: get('weight') });
  assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, '');
  assert.equal(get('measurement-status-LVDd').hidden, true);
  get('weight').value = '0.5';
  get('weight').valueAsNumber = 0.5;
  get('form').listeners.input({ target: get('weight') });
  assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, '');
  assert.match(get('measurement-reference-LVDd').textContent, /Check source/);
  get('weight').value = '4.2';
  get('weight').valueAsNumber = 4.2;
  for (const [index, species] of ['dog', 'cat'].entries()) {
    if (index) speciesButtons[index].listeners.click();
    for (const key of EchoCore.keys) enter(key, '22');
    enter('fs', '35');
    assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, 'high');
    const report = get('report').value;
    assert.equal(EchoCore.readReportMeasurements(report, species).LVDd.value, 2.2);
    assert.equal(EchoCore.readReportMeasurements(report, species).fs.value, 35);
    if (species === 'dog') assert.match(report, /LVIDDN: 1.443/);
    toggle('cm');
    assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, 'high');
    assert.match(get('measurement-reference-LVDd').textContent, /cm/);
    for (const key of EchoCore.keys) assert.equal(get(`measurement-${key}`).value, '2.2');
    assert.deepEqual(EchoCore.readReportMeasurements(get('report').value, species), EchoCore.readReportMeasurements(report, species));
    assert.match(get('report').value, /LVDd:\s*2\.2 cm \(/);
    assert.match(report, /LVDd:\s*22 mm \(/);
    assert.equal(get('measurement-fs').value, '35');
    enter('IVSd', '0.29');
    assert.equal(get('measurement-row-IVSd').dataset.rangeStatus, 'low');
    toggle('mm');
    assert.equal(get('measurement-IVSd').value, '2.9');
    enter('IVSd', '');
    assert.equal(get('measurement-row-IVSd').dataset.rangeStatus, '');
    toggle('cm');
    assert.equal(get('measurement-IVSd').value, '');
    get('report').value = get('report').value.replace(/- LVDd:\s*2\.2/, '- LVDd: 1.23');
    get('report').listeners.input();
    assert.equal(get('measurement-row-LVDd').dataset.rangeStatus, species === 'cat' ? 'normal' : 'low');
    toggle('mm');
    assert.equal(get('measurement-LVDd').value, '12.3', species + ': ' + get('report').value);
    assert.equal(get('measurement-IVSd').value, '');
  }
});
