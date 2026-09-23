const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EchoCore = require('../core');

test('evaluation panel updates on input, direct edits, units, species, invalid input and new patient', () => {
  const nodes = new Map();
  const document = { activeElement: null };
  function element(tag = '') {
    return {
      tag, value: '', dataset: {}, validity: { valid: true }, children: [], listeners: {},
      classList: { toggle() {} },
      set id(value) { this._id = value; nodes.set(value, this); }, get id() { return this._id; },
      append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
      setAttribute() {}, removeAttribute() {}, setCustomValidity() {}, checkValidity() { return true; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      focus() { document.activeElement = this; },
      querySelectorAll() {
        return this.children.flatMap(child => [...(child.tag === 'details' && child.open ? [child] : []), ...child.querySelectorAll()]);
      },
    };
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const species = ['dog', 'cat'].map(value => {
    const button = element(); button.dataset.speciesChoice = value; return button;
  });
  Object.assign(document, { getElementById: get, createElement: element,
    querySelectorAll: selector => selector === '[data-species-choice]' ? species : [] });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, EchoCore, EchoEvaluations: require('../evaluations'), REFERENCE_DATA: require('../reference-data'),
  });
  const text = node => (node.textContent || '') + '\n' + node.children.map(text).join('\n');
  const panel = () => text(get('evaluations'));
  const enter = (key, value) => {
    const input = get('measurement-' + key); input.value = value; input.focus();
    get('form').listeners.input({ target: input }); document.activeElement = null;
  };
  const edit = (key, value, animal) => {
    get('report').value = EchoCore.updateReportMeasurement(get('report').value, key, value, animal);
    get('report').listeners.input();
  };
  assert.match(panel(), /Enter measurements to evaluate/);
  get('weight').value = '4.2'; get('weight').valueAsNumber = 4.2;
  enter('laao', '1.7'); enter('LVDd', '26');
  assert.match(panel(), /2\/2 available B2 echo criteria met/);
  const details = get('evaluations').children[0].children[0];
  details.open = true;
  enter('e', '1.3');
  assert.equal(get('evaluations').children[0].children[0].open, true);
  const previous = panel();
  get('m-mode-unit-cm').listeners.click();
  assert.equal(panel(), previous);
  edit('laao', '1.2', 'dog');
  assert.match(panel(), /1\/2 available B2 echo criteria met/);
  const dogDraft = get('report').value;
  species[1].listeners.click();
  assert.doesNotMatch(panel(), /MMVD severity/);
  enter('laao', '1.6'); enter('laDiameter', '16'); enter('ea', '1'); enter('ivrt', '45'); enter('eem', '9');
  assert.match(panel(), /2\/2 available B2 LA criteria met/);
  assert.match(panel(), /Matches the source pattern: Normal/);
  const input = get('measurement-eem'); input.validity.badInput = true;
  get('form').listeners.input({ target: input });
  assert.match(panel(), /Incomplete: E\/Em/);
  assert.doesNotMatch(panel(), /Matches the source pattern: Normal/);
  input.validity.badInput = false;
  edit('eem', '11', 'cat');
  assert.match(panel(), /Matches the source pattern: Pseudonormal/);
  const catDraft = get('report').value;
  species[0].listeners.click();
  assert.equal(get('report').value, dogDraft);
  assert.match(panel(), /1\/2 available B2 echo criteria met/);
  species[1].listeners.click();
  assert.equal(get('report').value, catDraft);
  get('reset').listeners.click();
  assert.match(panel(), /Enter measurements to evaluate/);
  assert.doesNotMatch(panel(), /Matches the source pattern:/);
});
