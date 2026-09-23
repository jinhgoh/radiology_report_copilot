const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EchoCore = require('../core');
const REFERENCE_DATA = require('../reference-data');

test('checkbox input followed by change adds and removes the sentence', () => {
  function element() {
    return {
      value: '', dataset: {}, validity: { valid: true }, listeners: {},
      classList: { toggle() {} },
      append() {}, replaceChildren() {}, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {},
      setCustomValidity() {}, checkValidity() { return true; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
    };
  }
  const nodes = new Map();
  const getElementById = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const checkbox = element();
  checkbox.value = '- 이첨판막의 비후 및 prolapse';
  checkbox.matches = selector => selector === 'input[type="checkbox"]';
  const group = element();
  group.dataset.findingSection = '1. B mode 평가';
  group.querySelectorAll = () => [checkbox];
  const document = {
    getElementById, createElement: element,
    querySelectorAll: selector => selector === '[data-finding-section]' ? [group] : [],
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, EchoCore, EchoEvaluations: require('../evaluations'), REFERENCE_DATA,
  });
  const editor = getElementById('report');
  const draft = editor.value;
  for (const checked of [true, false, true]) {
    checkbox.checked = checked;
    // Browsers dispatch input before change when a checkbox is activated.
    getElementById('form').listeners.input({ target: checkbox });
    assert.equal(checkbox.checked, checked, 'input must preserve the pending choice');
    group.listeners.change({ target: checkbox });
    assert.equal(checkbox.checked, checked);
    assert.equal(editor.value.includes(checkbox.value), checked);
    if (!checked) assert.equal(editor.value, draft);
  }
});
