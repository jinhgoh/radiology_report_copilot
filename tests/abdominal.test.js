const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EchoCore = require('../core');

test('abdominal report reproduces the supplied template exactly', () => {
  const expected = '복부 초음파\n간담도계\n- 특이소견 확인되지 않음\n소화기\n- 특이소견 확인되지 않음\n비뇨기\n- 특이소견 확인되지 않음\n비장, 내분비 림프절 \n- 특이소견 확인되지 않음\n생식기\n- 특이소견 확인되지 않음\n기타\n- 특이소견 확인되지 않음\n\nDX and DDX)\n- \n\nby GJH';
  assert.equal(EchoCore.generateAbdominalReport(), expected);
});

test('all six report modes preserve species drafts, isolate cardiac controls, export and reset', async () => {
  const nodes = new Map();
  let copied, exported, downloaded;
  const document = { activeElement: null };
  function element() {
    return {
      value: '', dataset: {}, children: [], listeners: {}, attributes: {}, validity: { valid: true },
      classList: { toggle() {} },
      get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); },
      set id(value) { this._id = value; nodes.set(value, this); }, get id() { return this._id; },
      append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
      setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this[key]; },
      setCustomValidity(message) { this.customError = message; },
      checkValidity() {
        const weight = get('weight');
        if (weight.customError) return false;
        if (weight.value === '') return !weight.required;
        return weight.valueAsNumber >= Number(weight.min) && (!weight.max || weight.valueAsNumber <= Number(weight.max));
      },
      querySelectorAll() { return []; },
      addEventListener(type, listener) { this.listeners[type] = listener; },
      focus() { document.activeElement = this; }, click() { downloaded = this.download; }, remove() {},
    };
  }
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  const buttons = (key, values) => values.map(value => {
    const button = element(); button.dataset[key] = value; return button;
  });
  const types = buttons('reportChoice', ['echo', 'abdominal', 'dr', 'ct', 'mri', 'fluoroscopy']);
  const species = buttons('speciesChoice', ['dog', 'cat']);
  const sections = buttons('reportType', ['echo', 'abdominal']);
  Object.assign(document, { body: element(), getElementById: get, createElement: element,
    querySelectorAll: selector => ({ '[data-report-choice]': types, '[data-species-choice]': species, '[data-report-type]': sections }[selector] || []) });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, EchoCore, EchoEvaluations: require('../evaluations'), REFERENCE_DATA: require('../reference-data'), Blob,
    navigator: { clipboard: { async writeText(value) { copied = value; } } },
    URL: { createObjectURL(blob) { exported = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout(callback) { callback(); },
  });
  const editor = get('report');
  const setWeight = value => { get('weight').value = value; get('form').listeners.input({ target: get('weight') }); };
  const edit = value => { editor.value = value; editor.listeners.input(); editor.listeners.blur(); };
  edit(editor.value + '\nEcho dog notes');
  const dogEcho = editor.value;
  assert.equal(get('copy').disabled, true, 'Canine echo still requires weight');
  types[1].listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  assert.equal(types[1].attributes['aria-pressed'], 'true');
  assert.equal(sections[0].hidden, true);
  assert.equal(sections[1].hidden, false);
  assert.equal(get('measurements').children.length, 0);
  assert.equal(get('evaluations').children.length, 0);
  assert.equal(get('copy').disabled, false, 'Abdominal export accepts blank weight');
  const abdominal = EchoCore.generateAbdominalReport().replace('by GJH', 'by Test') + '\n- LVDd: 2.2 (1-3)\n  > LVIDDN: untouched';
  edit(abdominal);
  setWeight('50');
  assert.equal(editor.value, abdominal, 'Abdominal prose is never passed through echo calculations');
  assert.equal(get('copy').disabled, false, 'Abdominal weight has no canine echo maximum');
  setWeight('');
  await get('copy').listeners.click();
  assert.equal(copied, abdominal);
  get('download').listeners.click();
  assert.equal(downloaded, 'abdominal_ultrasound_dog.txt');
  assert.equal(await exported.text(), abdominal);
  assert.deepEqual(Array.from(new Uint8Array(await exported.arrayBuffer()).slice(0, 3)), [239, 187, 191]);
  setWeight('-1');
  assert.equal(get('copy').disabled, true);
  setWeight('');
  species[1].listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  edit(editor.value + '\nCat abdominal notes');
  const catAbdominal = editor.value;
  types[0].listeners.click();
  assert.match(editor.value, /심장 초음파/);
  assert.equal(sections[0].hidden, false);
  assert.ok(get('measurements').children.length > 0);
  edit(editor.value + '\nEcho cat notes');
  const catEcho = editor.value;
  species[0].listeners.click();
  assert.equal(editor.value, dogEcho);
  assert.equal(get('weight').required, true);
  assert.equal(get('weight').max, '40');
  types[1].listeners.click();
  assert.equal(editor.value, abdominal);
  species[1].listeners.click();
  assert.equal(editor.value, catAbdominal);
  types[0].listeners.click();
  assert.equal(editor.value, catEcho);
  types[1].listeners.click();
  get('reset').listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  types[0].listeners.click();
  assert.doesNotMatch(editor.value, /Echo cat notes/);
  species[0].listeners.click();
  assert.doesNotMatch(editor.value, /Echo dog notes/);
  types[1].listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  const imagingDrafts = {};
  for (const button of types.slice(2)) {
    const type = button.dataset.reportChoice;
    button.listeners.click();
    assert.equal(editor.value, EchoCore.generateImagingReport(type));
    assert.equal(button.attributes['aria-pressed'], 'true');
    assert.equal(editor.attributes.lang, 'en');
    assert.equal(sections[0].hidden, true);
    assert.equal(sections[1].hidden, true);
    assert.equal(get('imaging-guide').hidden, false);
    assert.equal(get('measurements').children.length, 0);
    assert.equal(get('evaluations').children.length, 0);
    assert.equal(get('copy').disabled, false);
    const report = editor.value + `\n${type} dog notes\n- LVDd: 2.2 (1-3)\n  > LVIDDN: untouched`;
    edit(report);
    setWeight('50');
    assert.equal(editor.value, report, 'Non-echo reports bypass cardiac calculations');
    assert.equal(get('download').disabled, false);
    get('download').listeners.click();
    assert.equal(downloaded, `${type}_dog_50kg.txt`);
    assert.equal(await exported.text(), report);
    setWeight('-1');
    assert.equal(get('download').disabled, true);
    setWeight('');
    await get('copy').listeners.click();
    assert.equal(copied, report);
    get('download').listeners.click();
    assert.equal(downloaded, `${type}_dog.txt`);
    species[1].listeners.click();
    assert.equal(editor.value, EchoCore.generateImagingReport(type));
    edit(editor.value + `\n${type} cat notes`);
    imagingDrafts[type] = { dog: report, cat: editor.value };
    species[0].listeners.click();
    assert.equal(editor.value, report);
  }
  for (const button of types.slice(2)) {
    button.listeners.click();
    assert.equal(editor.value, imagingDrafts[button.dataset.reportChoice].dog);
    species[1].listeners.click();
    assert.equal(editor.value, imagingDrafts[button.dataset.reportChoice].cat);
    species[0].listeners.click();
  }
  get('reset').listeners.click();
  for (const button of types.slice(2)) {
    button.listeners.click();
    for (const speciesButton of species) {
      speciesButton.listeners.click();
      assert.equal(editor.value, EchoCore.generateImagingReport(button.dataset.reportChoice));
    }
  }
  species[0].listeners.click();
  types[1].listeners.click();
  assert.equal(get('imaging-guide').hidden, true);
  assert.equal(editor.attributes.lang, 'ko');
});
