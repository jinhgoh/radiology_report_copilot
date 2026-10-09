const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EchoCore = require('../core');

test('abdominal report reproduces the supplied template exactly', () => {
  const expected = '복부 초음파\n간담도계\n- 특이소견 확인되지 않음\n소화기\n- 특이소견 확인되지 않음\n비뇨기\n- 특이소견 확인되지 않음\n비장, 내분비 림프절 \n- 특이소견 확인되지 않음\n생식기\n- 특이소견 확인되지 않음\n기타\n- 특이소견 확인되지 않음\n\nDX and DDX)\n- \n\nby GJH';
  assert.equal(EchoCore.generateAbdominalReport(), `----------------------------------------------------------\n${expected}\n----------------------------------------------------------`);
});

test('adrenal updates preserve findings, reject ambiguous lines, and clear optional measurements', () => {
  const original = EchoCore.generateAbdominalReport().replace('비장, 내분비 림프절 \n- 특이소견 확인되지 않음', '비장, 내분비 림프절 \n- 좌측 부신 전극 및 후극 비후');
  let report = EchoCore.updateAdrenalMeasurement(original, 'ltCd', '6.50');
  report = EchoCore.updateAdrenalMeasurement(report, 'rtCr', '6.8');
  assert.match(report, /- 좌측 부신 전극 및 후극 비후\n  > Rt\.\) Cr\. = 6\.8mm, Cd = mm\n  > Lt\.\) Cr\. = mm, Cd = 6\.50mm/);
  assert.equal(EchoCore.readAdrenalMeasurements(report).ltCd, '6.50');
  assert.equal(EchoCore.updateAdrenalMeasurement(report, 'rtCr', '-2'), report);
  const malformed = report.replace('6.8mm', 'unknown');
  assert.equal(EchoCore.readAdrenalMeasurements(malformed).rtCr, null);
  assert.equal(EchoCore.updateAdrenalMeasurement(malformed, 'rtCr', '7'), malformed);
  const duplicate = report.replace('생식기', '  > Rt.) Cr. = 8mm, Cd = 9mm\n생식기');
  assert.equal(EchoCore.readAdrenalMeasurements(duplicate).rtCr, null);
  assert.equal(EchoCore.updateAdrenalMeasurement(duplicate, 'rtCr', '7'), duplicate);
  const missing = original.replace('비장, 내분비 림프절', 'Edited heading');
  assert.equal(EchoCore.updateAdrenalMeasurement(missing, 'rtCr', '7'), missing);
  report = EchoCore.updateAdrenalMeasurement(report, 'rtCr', '');
  report = EchoCore.updateAdrenalMeasurement(report, 'ltCd', '');
  assert.equal(report, original);
  const crlf = EchoCore.updateAdrenalMeasurement(original.replace(/\n/g, '\r\n'), 'rtCr', '6.8');
  assert.equal(crlf.replace(/\r\n/g, '' ).includes('\n'), false);
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
        if (weight.disabled) return true;
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
  const regions = buttons('drRegion', ['흉부', '복부', '전지', '후지', '두부', '기타']);
  const sections = buttons('reportType', ['echo', 'abdominal']);
  Object.assign(document, { body: element(), getElementById: get, createElement: element,
    querySelectorAll: selector => ({ '[data-dr-region]': regions, '[data-report-choice]': types, '[data-species-choice]': species, '[data-report-type]': sections }[selector] || []) });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), {
    document, EchoCore, EchoEvaluations: require('../evaluations'), REFERENCE_DATA: require('../reference-data'), Blob,
    navigator: { clipboard: { async writeText(value) { copied = value; } } },
    URL: { createObjectURL(blob) { exported = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout(callback) { callback(); },
  });
  const editor = get('report');
  const setWeight = value => { get('weight').value = value; get('form').listeners.input({ target: get('weight') }); };
  const edit = value => { editor.value = value; editor.listeners.input(); editor.listeners.blur(); };
  const checkDrStatuses = (key, cases) => {
    const original = editor.value;
    for (const [value, expected] of cases) {
      const input = get(`dr-${key}`);
      input.value = value;
      get('form').listeners.input({ target: input });
      assert.equal(get(`dr-row-${key}`).dataset.rangeStatus, expected);
      assert.equal(get(`dr-status-${key}`).textContent, expected ? `(${expected})` : '');
      assert.equal(get(`dr-status-${key}`).hidden, !expected);
    }
    edit(original);
  };
  edit(editor.value + '\nEcho dog notes');
  const dogEcho = editor.value;
  assert.equal(get('copy').disabled, true, 'Canine echo still requires weight');
  assert.equal(get('weight').disabled, false);
  types[1].listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  assert.equal(types[1].attributes['aria-pressed'], 'true');
  assert.equal(sections[0].hidden, true);
  assert.equal(sections[1].hidden, false);
  assert.equal(get('weight').disabled, true);
  assert.equal(get('measurements').children.length, 1);
  assert.equal(get('evaluations').children.length, 0);
  assert.equal(get('copy').disabled, false, 'Abdominal export accepts blank weight');
  for (const [key, value] of Object.entries({ rtCr: '6.8', rtCd: '6.5', ltCr: '6.8', ltCd: '6.5' })) {
    const input = get(`adrenal-${key}`);
    input.value = value;
    get('form').listeners.input({ target: input });
  }
  assert.match(editor.value, /  > Rt\.\) Cr\. = 6\.8mm, Cd = 6\.5mm\n  > Lt\.\) Cr\. = 6\.8mm, Cd = 6\.5mm/);
  edit(editor.value.replace('Rt.) Cr. = 6.8mm', 'Rt.) Cr. = 7.1mm'));
  assert.equal(get('adrenal-rtCr').value, '7.1');
  const abdominal = editor.value.replace('by GJH', 'by Test') + '\n- LVDd: 2.2 (1-3)\n  > LVIDDN: untouched';
  edit(abdominal);
  setWeight('50');
  assert.equal(editor.value, abdominal, 'Abdominal prose is never passed through echo calculations');
  assert.equal(get('copy').disabled, false, 'Abdominal reports ignore retained echo weight');
  setWeight('');
  await get('copy').listeners.click();
  assert.equal(copied, abdominal);
  get('download').listeners.click();
  assert.equal(downloaded, 'abdominal_ultrasound_dog.txt');
  assert.equal(await exported.text(), abdominal);
  assert.deepEqual(Array.from(new Uint8Array(await exported.arrayBuffer()).slice(0, 3)), [239, 187, 191]);
  setWeight('-1');
  assert.equal(get('copy').disabled, false, 'Hidden weight cannot block abdominal export');
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
  assert.equal(get('weight').disabled, false);
  assert.equal(get('weight').max, '40');
  types[1].listeners.click();
  assert.equal(editor.value, abdominal);
  assert.equal(get('adrenal-rtCr').value, '7.1');
  species[1].listeners.click();
  assert.equal(editor.value, catAbdominal);
  types[0].listeners.click();
  assert.equal(editor.value, catEcho);
  types[1].listeners.click();
  get('reset').listeners.click();
  assert.equal(editor.value, EchoCore.generateAbdominalReport());
  assert.equal(get('adrenal-rtCr').value, '');
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
    assert.equal(editor.attributes.lang, type === 'dr' ? 'ko' : 'en');
    assert.equal(sections[0].hidden, true);
    assert.equal(sections[1].hidden, true);
    assert.equal(get('imaging-guide').hidden, false);
    assert.equal(get('measurements').children.length, type === 'dr' ? 4 : 0);
    if (type === 'dr') {
      const card = get('measurements').children[0];
      assert.deepEqual(Array.from(card.children.slice(0, -1), child => child.textContent), [
        'Chest',
      ]);
      assert.equal(get('imaging-reference').hidden, false);
      assert.equal(get('imaging-reference').textContent,
        'Dog normal ranges\nVHS [vertebral heart scale]: 8.7-10.7v\nICS [intercostal space]: 2.5-3.5\nVLAS [vertebral left atrial score]: < 2.3v\nCTR [Cardio-thoracic ratio]: 0.5-0.66\n\nVHS breed references\nShi-tzu: 8.3-10.7v\nPomeranian: 9.6-11.4v\nPoodle: 9.1-11.1v');
      assert.equal(get('dr-reference-VHS').textContent,
        'Dog normal ranges\nVHS [vertebral heart scale]: 8.7-10.7v\nVHS breed references\nShi-tzu: 8.3-10.7v\nPomeranian: 9.6-11.4v\nPoodle: 9.1-11.1v');
      assert.equal(get('dr-reference-VLAS').textContent, 'Dog normal ranges\nVLAS [vertebral left atrial score]: < 2.3v');
      checkDrStatuses('VHS', [['8.69', 'low'], ['8.7', 'normal'], ['10.7', 'normal'], ['10.71', 'high'], ['', '']]);
      checkDrStatuses('VLAS', [['2.29', 'normal'], ['2.3', 'high'], ['2.31', 'high'], ['', '']]);
      for (const [key, value] of [['VHS', '10.2'], ['VLAS', '2.1']]) {
        const input = get(`dr-${key}`);
        assert.equal(input.attributes['aria-describedby'], `dr-status-${key} dr-reference-${key}`);
        input.value = value;
        get('form').listeners.input({ target: input });
      }
      assert.match(editor.value, /- VHS: 10.2v, VLAS: 2.1v/);
      edit(editor.value.replace('10.2v', '10.4v'));
      assert.equal(get('dr-VHS').value, '10.4');
      edit(editor.value.replace('10.4v', '10.8v'));
      assert.equal(get('dr-status-VHS').textContent, '(high)');
      edit(editor.value.replace('10.8v', 'unknown'));
      assert.equal(get('dr-VHS').disabled, true);
      assert.equal(get('dr-status-VHS').hidden, true);
      edit(EchoCore.generateImagingReport('dr'));
      assert.equal(get('dr-status-VHS').hidden, true);
    }
    assert.equal(get('evaluations').children.length, 0);
    assert.equal(get('copy').disabled, false);
    const report = editor.value + `\n${type} dog notes\n- LVDd: 2.2 (1-3)\n  > LVIDDN: untouched`;
    edit(report);
    setWeight('50');
    assert.equal(editor.value, report, 'Non-echo reports bypass cardiac calculations');
    assert.equal(get('download').disabled, false);
    get('download').listeners.click();
    assert.equal(downloaded, `${type}_dog.txt`);
    assert.equal(await exported.text(), report);
    setWeight('-1');
    assert.equal(get('download').disabled, false, 'Hidden weight cannot block imaging export');
    setWeight('');
    await get('copy').listeners.click();
    assert.equal(copied, report);
    get('download').listeners.click();
    assert.equal(downloaded, `${type}_dog.txt`);
    species[1].listeners.click();
    assert.equal(editor.value, EchoCore.generateImagingReport(type, 'cat'));
    if (type === 'dr') {
      const card = get('measurements').children[0];
      assert.deepEqual(Array.from(card.children.slice(0, -1), child => child.textContent), [
        'Chest',
      ]);
      assert.equal(get('imaging-reference').textContent,
        'Cat normal ranges\nVHS [vertebral heart score]: 6.8-8.1v\nICS [intercostal space]: 2-2.5\nVHW [vertebral heart width]: 2.9-4.1v');
      assert.equal(get('dr-reference-VHS').textContent, 'Cat normal ranges\nVHS [vertebral heart score]: 6.8-8.1v');
      assert.equal(get('dr-reference-VHW').textContent, 'Cat normal ranges\nVHW [vertebral heart width]: 2.9-4.1v');
      checkDrStatuses('VHS', [['6.79', 'low'], ['6.8', 'normal'], ['8.1', 'normal'], ['8.11', 'high'], ['', '']]);
      checkDrStatuses('VHW', [['2.89', 'low'], ['2.9', 'normal'], ['4.1', 'normal'], ['4.11', 'high'], ['', '']]);
      assert.ok(card.children.slice(0, -1).every(child => child.children.length === 0));
      assert.match(editor.value, /- VHS: v, VHW: v/);
      assert.doesNotMatch(editor.value, /VLAS/);
      assert.match(report, /- VHS: v, VLAS: v/);
      assert.doesNotMatch(report, /VHW/);
      const input = get('dr-VHW');
      input.value = '3.5';
      get('form').listeners.input({ target: input });
      assert.match(editor.value, /- VHS: v, VHW: 3.5v/);
    }
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
  types[2].listeners.click();
  assert.deepEqual(regions.map(input => input.checked), [true, false, false, false, false, false]);
  for (const input of regions.slice(1)) {
    input.checked = true;
    input.listeners.change();
    assert.ok(editor.value.includes(`\n${input.dataset.drRegion}\n`));
  }
  edit(editor.value.replace('복부\n', '복부\nAbdominal notes\n'));
  const allRegions = editor.value;
  regions[1].checked = false;
  regions[1].listeners.change();
  assert.doesNotMatch(editor.value, /복부|Abdominal notes/);
  assert.match(editor.value, /dr dog notes/);
  regions[1].checked = true;
  regions[1].listeners.change();
  assert.equal(editor.value, allRegions);
  species[1].listeners.click();
  assert.deepEqual(regions.map(input => input.checked), [true, false, false, false, false, false]);
  species[0].listeners.click();
  assert.equal(editor.value, allRegions);
  assert.ok(regions.every(input => input.checked));
  get('dr-uncheck-all').listeners.click();
  assert.ok(regions.every(input => !input.checked));
  assert.doesNotMatch(editor.value, /^(흉부|복부|전지|후지|두부|기타)$/m);
  assert.match(editor.value, /DX and DDX\)/);
  assert.match(editor.value, /dr dog notes/);
  get('dr-check-all').listeners.click();
  assert.ok(regions.every(input => input.checked));
  assert.equal(editor.value, allRegions, 'Check all restores edited sections');
  get('dr-check-all').listeners.click();
  assert.equal(editor.value, allRegions, 'Repeated Check all does not duplicate sections');
  get('reset').listeners.click();
  assert.deepEqual(regions.map(input => input.checked), [true, false, false, false, false, false]);
  for (const button of types.slice(2)) {
    button.listeners.click();
    for (const speciesButton of species) {
      speciesButton.listeners.click();
      assert.equal(editor.value, EchoCore.generateImagingReport(button.dataset.reportChoice, speciesButton.dataset.speciesChoice));
    }
  }
  types[2].listeners.click();
  for (const speciesButton of species) {
    speciesButton.listeners.click();
    const section = region => EchoCore.generateDrSection(region, speciesButton.dataset.speciesChoice);
    const wrap = sections => `${'-'.repeat(58)}\n방사선 검사\n${sections}DX and DDX)\n- \n\nby GJH\n${'-'.repeat(58)}`;
    get('dr-check-all').listeners.click();
    assert.equal(editor.value, wrap(['흉부', '복부', '전지', '후지', '두부', '기타'].map(section).join('')));
    for (const input of regions) {
      get('dr-uncheck-all').listeners.click();
      input.checked = true;
      input.listeners.change();
      const region = input.dataset.drRegion;
      assert.equal(editor.value, wrap(section(region)));
    }
  }
  species[0].listeners.click();
  types[1].listeners.click();
  assert.equal(get('imaging-guide').hidden, true);
  assert.equal(editor.attributes.lang, 'ko');
});
