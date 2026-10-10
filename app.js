'use strict';

const $ = id => document.getElementById(id);

document.querySelectorAll('.help').forEach(help => {
  help.addEventListener('keydown', event => {
    if (event.key === 'Escape') help.classList.add('dismissed');
  });
  help.addEventListener('mouseenter', () => help.classList.remove('dismissed'));
  help.addEventListener('focusin', () => help.classList.remove('dismissed'));
  help.querySelector('button').addEventListener('click', () => help.classList.remove('dismissed'));
});

const {
  keys,
  catReference,
  selectReference,
  validRange,
  generateReport,
  generateAbdominalReport,
  adrenalFields,
  readAdrenalMeasurements,
  updateAdrenalMeasurement,
  generateImagingReport,
  drMeasurementFields,
  generateDrSection,
  readDrMeasurements,
  updateDrMeasurement,
  reportTypes,
  updateReportReferences,
  updateReportLviddn,
  insertReportFinding,
  removeReportFinding,
  measurementFields,
  measurementReferences,
  mModeReference,
  classifyMeasurement,
  measurementRangeStatus,
  measurementReferenceText,
  readReportMeasurements,
  updateReportMeasurement,
  formatLviddn,
  convertMModeValue,
  convertReportMModeUnit,
} = EchoCore;

let currentSpecies = 'dog';
let currentReportType = 'echo';
const echoPreviewHelp = $('preview-help').textContent;
const drafts = {};
const drRegions = ['흉부', '복부', '전지', '후지', '두부', '기타'];
const hiddenDrSections = {};
const abdominalRegions = ['간담도계', '소화기', '비뇨기', '비장, 내분비, 림프절', '생식기', '기타'];
const standardAbdominalRegions = abdominalRegions.filter(region => region !== '기타');
const hiddenAbdominalSections = {};

function abdominalHeadings(report = $('report').value) {
  return [...report.matchAll(/^(간담도계|소화기|비뇨기|비장, 내분비, 림프절|생식기|기타|DX and DDX\)|by [^\r\n]+|-{3,})[ \t]*\r?$/gm)];
}

function syncAbdominalRegions() {
  if (currentReportType !== 'abdominal') return;
  const headings = abdominalHeadings();
  const all = standardAbdominalRegions.every(region => headings.some(match => match[1] === region));
  document.querySelectorAll('[data-abdominal-region]').forEach(input => {
    input.checked = input.dataset.abdominalRegion === '전체'
      ? all : (input.dataset.abdominalRegion === '기타' || !all) && headings.some(match => match[1] === input.dataset.abdominalRegion);
  });
}

function setAbdominalRegions(selected) {
  if (currentReportType !== 'abdominal') return;
  const editor = $('report');
  const initialHeadings = abdominalHeadings();
  const duplicate = abdominalRegions.find(region => initialHeadings.filter(match => match[1] === region).length > 1);
  if (duplicate) {
    syncAbdominalRegions();
    $('feedback').textContent = `Remove duplicate “${duplicate}” headings in the preview to change regions.`;
    return;
  }
  const saved = hiddenAbdominalSections[currentSpecies] ??= {};
  let message = '';
  for (const region of abdominalRegions) {
    const headings = abdominalHeadings();
    const matches = headings.filter(match => match[1] === region);
    if (!selected.includes(region) && matches.length === 1) {
      const start = matches[0].index;
      const end = headings[headings.indexOf(matches[0]) + 1]?.index ?? editor.value.length;
      saved[region] = editor.value.slice(start, end);
      editor.value = editor.value.slice(0, start) + editor.value.slice(end);
    } else if (selected.includes(region) && !matches.length) {
      const next = headings.find(match => abdominalRegions.indexOf(match[1]) > abdominalRegions.indexOf(region) || match[1] === 'DX and DDX)');
      if (next) {
        const template = generateAbdominalReport({ includeOther: true });
        const defaults = abdominalHeadings(template);
        const index = defaults.findIndex(match => match[1] === region);
        const section = saved[region] ?? template.slice(defaults[index].index, defaults[index + 1].index);
        const newline = editor.value.includes('\r\n') ? '\r\n' : '\n';
        const prefix = next[1] === 'DX and DDX)'
          ? editor.value.slice(0, next.index).replace(/(?:\r?\n[ \t]*)+$/, newline)
          : editor.value.slice(0, next.index);
        editor.value = prefix + section.replace(/(?:\r?\n[ \t]*)+$/, '\n').replace(/\r?\n/g, newline) + editor.value.slice(next.index);
      } else {
        message = 'Restore the DX and DDX) heading in the preview to add this region.';
      }
    }
  }
  syncAbdominalRegions();
  syncMeasurementInputs();
  updateExport();
  $('feedback').textContent = message;
}

document.querySelectorAll('[data-abdominal-region]').forEach(input => {
  input.addEventListener('change', () => {
    const region = input.dataset.abdominalRegion;
    const headings = abdominalHeadings();
    const current = abdominalRegions.filter(name => headings.some(match => match[1] === name));
    const other = current.filter(name => name === '기타');
    if (region === '전체') {
      setAbdominalRegions(input.checked ? [...standardAbdominalRegions, ...other] : other);
      return;
    }
    const all = standardAbdominalRegions.every(name => current.includes(name));
    const selected = all && region !== '기타' ? other : current.filter(name => name !== region);
    if (input.checked) selected.push(region);
    setAbdominalRegions(selected);
  });
});

for (const [id, checked] of [['abdominal-check-all', true], ['abdominal-uncheck-all', false]]) {
  $(id).addEventListener('click', () => {
    setAbdominalRegions(checked ? abdominalRegions : []);
  });
}

function drHeadings() {
  return [...$('report').value.matchAll(/^(흉부|복부|전지|후지|두부|기타|DX and DDX\)|-{61})\r?$/gm)];
}

function syncDrRegions() {
  if (currentReportType !== 'dr') return;
  const headings = drHeadings();
  document.querySelectorAll('[data-dr-region]').forEach(input => {
    input.checked = headings.some(match => match[1] === input.dataset.drRegion);
  });
}

function changeDrRegion(input) {
    if (currentReportType !== 'dr') return;
    const editor = $('report');
    const region = input.dataset.drRegion;
    const headings = drHeadings();
    const index = headings.findIndex(match => match[1] === region);
    const saved = hiddenDrSections[currentSpecies] ??= {};
    if (!input.checked && index >= 0) {
      const start = headings[index].index;
      const end = headings[index + 1]?.index ?? editor.value.length;
      saved[region] = editor.value.slice(start, end);
      editor.value = editor.value.slice(0, start) + editor.value.slice(end);
    } else if (input.checked && index < 0) {
      const next = headings.find(match => drRegions.indexOf(match[1]) > drRegions.indexOf(region) || match[1] === 'DX and DDX)');
      if (next) {
        const section = saved[region] ?? generateDrSection(region, currentSpecies);
        editor.value = editor.value.slice(0, next.index) + section + editor.value.slice(next.index);
      }
    }
    syncDrRegions();
    syncMeasurementInputs();
    updateExport();
}

document.querySelectorAll('[data-dr-region]').forEach(input => {
  input.addEventListener('change', () => changeDrRegion(input));
});

for (const [id, checked] of [['dr-check-all', true], ['dr-uncheck-all', false]]) {
  $(id).addEventListener('click', () => {
    if (currentReportType !== 'dr') return;
    document.querySelectorAll('[data-dr-region]').forEach(input => {
      if (input.checked === checked) return;
      input.checked = checked;
      changeDrRegion(input);
    });
  });
}
let measurements = {};
let mModeUnit = 'mm';

function activeMeasurementReference(key) {
  return keys.includes(key)
    ? mModeReference(key, currentSpecies, currentSpecies === 'cat' ? null : selectReference($('weight').valueAsNumber, REFERENCE_DATA), mModeUnit)
    : measurementReferences[currentSpecies]?.[key];
}

function drReferenceText(key) {
  const field = drMeasurementFields(currentSpecies).find(field => field.key === key);
  if (field?.reference) return `${currentSpecies === 'cat' ? 'Cat' : 'Dog'} normal ranges\n${field.reference}`;
  const cat = currentSpecies === 'cat';
  const ranges = cat ? [
    ['VHS', 'vertebral heart score', '6.8-8.1v'],
    ['ICS', 'intercostal space', '2-2.5'],
    ['VHW', 'vertebral heart width', '2.9-4.1v'],
  ] : [
    ['VHS', 'vertebral heart scale', '8.7-10.7v'],
    ['ICS', 'intercostal space', '2.5-3.5'],
    ['VLAS', 'vertebral left atrial score', '< 2.3v'],
    ['CTR', 'Cardio-thoracic ratio', '0.5-0.66'],
  ];
  return `${cat ? 'Cat' : 'Dog'} normal ranges\n` +
    ranges.filter(row => !key || row[0] === key)
      .map(([name, description, range]) => `${name} [${description}]: ${range}`).join('\n') +
    (!cat && (!key || key === 'VHS') ? `${key ? '\n' : '\n\n'}VHS breed references\nShi-tzu: 8.3-10.7v\nPomeranian: 9.6-11.4v\nPoodle: 9.1-11.1v` : '');
}

function buildMeasurementInputs() {
  const container = $('measurements');
  container.replaceChildren();
  if (currentReportType === 'dr') {
    const primaryKeys = ['VHS', 'VLAS', 'VHW'];
    const additional = document.createElement('details');
    additional.className = 'dr-additional-measurements';
    const summary = document.createElement('summary');
    summary.textContent = 'More measurements';
    additional.append(summary);
    const primary = document.createElement('section');
    primary.className = 'card';
    const primaryHeading = document.createElement('h2');
    primaryHeading.textContent = 'Heart measurements';
    const primaryGrid = document.createElement('div');
    primaryGrid.className = 'grid';
    primary.append(primaryHeading, primaryGrid);
    container.append(primary, additional);
    for (const [region, title] of [['흉부', 'Chest'], ['복부', 'Abdomen'], ['후지', 'Hindlimbs'], ['두부', 'Head / neck']]) {
    const fields = drMeasurementFields(currentSpecies).filter(field => field.region === region);
    if (!fields.length) continue;
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = title;
    section.append(heading);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const field of fields) {
      const { key } = field;
      const label = document.createElement('label');
      label.id = `dr-row-${key}`;
      label.className = 'has-reference dr-heart-measurement';
      const caption = document.createElement('span');
      caption.id = `dr-caption-${key}`;
      caption.className = 'measurement-reference';
      caption.textContent = `${field.label} (${field.unit})`;
      const tooltip = document.createElement('span');
      tooltip.id = `dr-reference-${key}`;
      tooltip.className = 'measurement-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = drReferenceText(key);
      caption.setAttribute('aria-describedby', tooltip.id);
      caption.append(tooltip);
      label.addEventListener('keydown', event => {
        if (event.key === 'Escape') caption.classList.add('dismissed');
      });
      label.addEventListener('mouseenter', () => caption.classList.remove('dismissed'));
      label.addEventListener('focusin', () => caption.classList.remove('dismissed'));
      const status = document.createElement('span');
      status.id = `dr-status-${key}`;
      status.className = 'measurement-status';
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.id = `dr-${key}`;
      input.dataset.drMeasurement = key;
      input.setAttribute('aria-labelledby', caption.id);
      input.setAttribute('aria-describedby', `${status.id} ${tooltip.id}`);
      label.append(caption, status, input);
      (primaryKeys.includes(key) ? primaryGrid : grid).append(label);
    }
    if (grid.childElementCount) {
      section.append(grid);
      additional.append(section);
    }
    }
    return;
  }
  if (currentReportType === 'abdominal') {
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = 'Adrenal gland measurements';
    const referenceText = `${currentSpecies === 'cat' ? 'Cat: 4-5.3mm (VF)' : 'Dog: 3-6mm'}\n\n` +
      '- normal range\n' +
      ': 부신사이즈RR은 종별로 차이가 없이 동일하다고 알려져 있음(nyland 피셜).\n' +
      '그러나 최근엔 아래와 같이 구분하는듯(체중과 관련)\n\n' +
      '- 개: 3-6mm(소형견)/ 7.4mm(최대. 대형견 등) (VF)\n' +
      '- 고양이: 4-5.3mm (VF)\n\n' +
      '- ADG size는 HAC 위한 절대적인 기준이 아님\n' +
      '(부신 크다고 HAC인것도 아니며(다른 ddx있으니), 부신 size 정상이라고 HAC가 아닌 것도 아님)\n' +
      '- 쿠싱 환자중 23%는 부신크기 정상';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const field of adrenalFields) {
      const label = document.createElement('label');
      label.className = 'has-reference adrenal-measurement';
      const caption = document.createElement('span');
      caption.id = `adrenal-caption-${field.key}`;
      caption.className = 'measurement-reference';
      caption.textContent = `${field.label} (mm)`;
      const tooltip = document.createElement('span');
      tooltip.id = `adrenal-reference-${field.key}`;
      tooltip.className = 'measurement-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      const reference = document.createElement('span');
      reference.lang = 'ko';
      reference.textContent = referenceText;
      const instructions = document.createElement('span');
      instructions.textContent = '\n\nEnter pole sizes in mm. Measurements update the spleen / endocrine / lymph node section. Edit clinical findings directly in the report.';
      tooltip.append(reference, instructions);
      caption.setAttribute('aria-describedby', tooltip.id);
      caption.append(tooltip);
      label.addEventListener('keydown', event => {
        if (event.key === 'Escape') caption.classList.add('dismissed');
      });
      label.addEventListener('mouseenter', () => caption.classList.remove('dismissed'));
      label.addEventListener('focusin', () => caption.classList.remove('dismissed'));
      label.append(caption);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.id = `adrenal-${field.key}`;
      input.dataset.adrenal = field.key;
      input.setAttribute('aria-labelledby', caption.id);
      input.setAttribute('aria-describedby', tooltip.id);
      label.append(input);
      grid.append(label);
    }
    section.append(heading, grid);
    container.append(section);
    return;
  }
  if (currentReportType !== 'echo') return;
  for (const group of ['B mode', 'M mode', 'Doppler']) {
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = `${group} measurements`;
    const title = document.createElement('div');
    title.className = 'section-title';
    title.append(heading);
    if (group === 'M mode') {
      const toggle = document.createElement('div');
      toggle.className = 'species-toggle';
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', 'M mode measurement unit');
      for (const unit of ['mm', 'cm']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = unit;
        button.setAttribute('aria-pressed', String(mModeUnit === unit));
        button.addEventListener('click', () => {
          mModeUnit = unit;
          buildMeasurementInputs();
          update();
          $('m-mode-unit-' + unit).focus();
        });
        button.id = 'm-mode-unit-' + unit;
        toggle.append(button);
      }
      title.append(toggle);
    }
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const field of measurementFields.filter(field => field.group === group && (!field.species || field.species === currentSpecies))) {
      const label = document.createElement('label');
      label.id = `measurement-row-${field.key}`;
      const caption = document.createElement('span');
      caption.id = `measurement-caption-${field.key}`;
      const unit = keys.includes(field.key) ? mModeUnit : field.unit;
      caption.textContent = field.label + (unit ? ` (${unit})` : '');
      label.append(caption);
      const reference = activeMeasurementReference(field.key);
      if (reference) {
        label.className = 'has-reference';
        caption.className = 'measurement-reference';
        const tooltip = document.createElement('span');
        tooltip.id = `measurement-reference-${field.key}`;
        tooltip.className = 'measurement-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = measurementReferenceText(reference, currentSpecies);
        caption.setAttribute('aria-describedby', tooltip.id);
        caption.append(tooltip);
        label.addEventListener('keydown', event => {
          if (event.key === 'Escape') caption.classList.add('dismissed');
        });
        caption.addEventListener('mouseenter', () => caption.classList.remove('dismissed'));
        label.addEventListener('focusin', () => caption.classList.remove('dismissed'));
        const status = document.createElement('span');
        status.id = `measurement-status-${field.key}`;
        status.className = 'measurement-status';
        status.setAttribute('aria-live', 'polite');
        status.hidden = true;
        label.append(status);
      }
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.id = `measurement-${field.key}`;
      input.dataset.measurement = field.key;
      input.setAttribute('aria-labelledby', caption.id);
      if (reference) input.setAttribute('aria-describedby', `measurement-status-${field.key} measurement-reference-${field.key}`);
      label.append(input);
      grid.append(label);
      if (field.key === 'LVPWd' && currentSpecies === 'dog') {
        const label = document.createElement('label');
        const caption = document.createElement('span');
        caption.textContent = 'LVIDDN (calculated)';
        label.append(caption);
        const output = document.createElement('output');
        output.id = 'measurement-lviddn';
        output.setAttribute('for', 'measurement-LVDd weight');
        label.append(output);
        grid.append(label);
      }
    }
    section.append(title);
    if (group === 'M mode') {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = `Report values and reference ranges are in ${mModeUnit}. FS is in %.`;
      section.append(hint);
    }
    section.append(grid);
    container.append(section);
  }
}

function syncDrClassification(key) {
  const input = $(`dr-${key}`);
  const normal = drMeasurementFields(currentSpecies).find(field => field.key === key)?.range;
  const rangeStatus = measurementRangeStatus(
    input.disabled || !input.validity.valid ? NaN : input.valueAsNumber,
    { bands: normal ? [{ severity: 'normal', ...normal }] : [] });
  const row = $(`dr-row-${key}`);
  row.dataset.rangeStatus = rangeStatus || '';
  row.classList.toggle('has-classification', Boolean(rangeStatus));
  const status = $(`dr-status-${key}`);
  status.textContent = rangeStatus ? `(${rangeStatus})` : '';
  status.hidden = !rangeStatus;
}

function restorableMeasurementSection(region) {
  const abdominal = currentReportType === 'abdominal';
  const headings = abdominal ? abdominalHeadings() : drHeadings();
  const regions = abdominal ? abdominalRegions : drRegions;
  if (headings.some(match => match[1] === region)) return null;
  if (abdominal && regions.some(name => headings.filter(match => match[1] === name).length > 1)) return null;
  if (!headings.some(match => regions.indexOf(match[1]) > regions.indexOf(region) || match[1] === 'DX and DDX)')) return null;
  const saved = (abdominal ? hiddenAbdominalSections : hiddenDrSections)[currentSpecies]?.[region];
  if (saved !== undefined) return saved;
  if (!abdominal) return generateDrSection(region, currentSpecies);
  const template = generateAbdominalReport({ includeOther: true });
  const defaults = abdominalHeadings(template);
  const index = defaults.findIndex(match => match[1] === region);
  return template.slice(defaults[index].index, defaults[index + 1].index);
}

function syncMeasurementInputs() {
  if (currentReportType === 'dr') {
    for (const [key, raw] of Object.entries(readDrMeasurements($('report').value, currentSpecies))) {
      const input = $(`dr-${key}`);
      if (document.activeElement !== input || raw === null) {
        input.value = raw ?? '';
        input.setCustomValidity('');
      }
      const field = drMeasurementFields(currentSpecies).find(field => field.key === key);
      const section = restorableMeasurementSection(field.region);
      const canRestore = section !== null && readDrMeasurements(section, currentSpecies)[key] !== null;
      input.disabled = raw === null && !canRestore;
      input.placeholder = input.disabled ? 'Check report line' : '';
      input.title = input.disabled ? `Select the ${field.region} region and restore a single numeric or blank ${field.label} line${field.unit === 'ratio' ? '' : ` with its ${field.unit} unit`}.` : '';
      syncDrClassification(key);
    }
    return;
  }
  if (currentReportType === 'abdominal') {
    for (const [key, raw] of Object.entries(readAdrenalMeasurements($('report').value))) {
      const input = $(`adrenal-${key}`);
      if (document.activeElement !== input) input.value = raw ?? '';
      const section = restorableMeasurementSection('비장, 내분비, 림프절');
      const canRestore = section !== null && readAdrenalMeasurements(section)[key] !== null;
      input.disabled = raw === null && !canRestore;
      input.placeholder = input.disabled ? 'Check report section' : '';
      input.title = input.disabled ? 'Select 비장, 내분비, 림프절 in Study regions, or restore its heading and a single numeric or blank measurement line for this side.' : '';
    }
    return;
  }
  if (currentReportType !== 'echo') return;
  measurements = readReportMeasurements($('report').value, currentSpecies);
  for (const [key, measurement] of Object.entries(measurements)) {
    const input = $(`measurement-${key}`);
    if (document.activeElement !== input) input.value = keys.includes(key)
      ? convertMModeValue(measurement.raw, 'cm', mModeUnit) : measurement.raw ?? '';
    input.disabled = measurement.raw === null;
    input.placeholder = input.disabled ? 'Check report line' : '';
    input.title = input.disabled ? 'Restore a single template measurement line with a numeric or blank value to use this input.' : '';
    syncMeasurementClassification(key, measurement.value);
  }
  if ($('measurement-lviddn')) $('measurement-lviddn').value = formatLviddn(measurements.LVDd.value, $('weight').value);
  syncEvaluations();
}

function syncEvaluations() {
  const container = $('evaluations');
  const expanded = new Set([...container.querySelectorAll('details[open]')].map(item => item.dataset.evaluation));
  const values = Object.fromEntries(Object.entries(measurements).map(([key, measurement]) => [key, measurement.value]));
  const evaluations = EchoEvaluations.evaluateMeasurements({ species: currentSpecies, values, weight: $('weight').valueAsNumber });
  container.replaceChildren();
  for (const evaluation of evaluations) {
    const section = document.createElement('section');
    section.className = 'evaluation-result';
    const title = document.createElement('h3');
    title.textContent = evaluation.title;
    section.append(title);
    const details = document.createElement('details');
    details.dataset.evaluation = evaluation.id;
    details.open = expanded.has(evaluation.id);
    const summary = document.createElement('summary');
    summary.textContent = 'Criteria and interpretation';
    const outcome = document.createElement('span');
    outcome.className = 'evaluation-outcome';
    outcome.textContent = evaluation.summary;
    section.append(outcome);
    details.append(summary);
    for (const group of evaluation.groups) {
      const heading = document.createElement('h3');
      heading.textContent = group.title;
      section.append(heading);
      const referenceHeading = document.createElement('h4');
      referenceHeading.textContent = group.title;
      const references = document.createElement('dl');
      details.append(referenceHeading, references);
      const list = document.createElement('dl');
      list.className = 'evaluation-values';
      for (const row of group.rows) {
        const term = document.createElement('dt');
        term.textContent = `${row.label}: ${row.value}`;
        const description = document.createElement('dd');
        description.dataset.state = row.state;
        const criterion = document.createElement('span');
        criterion.textContent = row.criterion;
        const result = document.createElement('strong');
        result.textContent = row.result;
        description.append(result);
        const referenceLabel = document.createElement('dt');
        referenceLabel.textContent = row.label;
        const reference = document.createElement('dd');
        reference.append(criterion);
        references.append(referenceLabel, reference);
        list.append(term, description);
      }
      section.append(list);
    }
    for (const note of evaluation.notes) {
      const paragraph = document.createElement('p');
      paragraph.className = 'hint';
      paragraph.textContent = note;
      details.append(paragraph);
    }
    section.append(details);
    container.append(section);
  }
}

function syncMeasurementClassification(key, value) {
  const reference = activeMeasurementReference(key);
  if (!reference) return;
  $(`measurement-reference-${key}`).textContent = measurementReferenceText(reference, currentSpecies);
  const severity = classifyMeasurement(value, reference);
  const rangeStatus = measurementRangeStatus(value, reference);
  const description = severity || rangeStatus;
  const row = $(`measurement-row-${key}`);
  row.dataset.severity = severity || '';
  row.dataset.rangeStatus = rangeStatus || '';
  row.classList.toggle('has-classification', Boolean(description));
  const status = $(`measurement-status-${key}`);
  status.textContent = description ? `(${description})` : '';
  status.hidden = !description;
}

function updateExport() {
  if (currentReportType === 'abdominal') {
    const editor = $('report');
    const separator = /([^\r\n])(\r?\n)(?=DX and DDX\)[ \t]*\r?$)/m.exec(editor.value);
    if (separator) {
      const position = separator.index + separator[0].length;
      const { selectionStart, selectionEnd } = editor;
      editor.value = editor.value.slice(0, position) + separator[2] + editor.value.slice(position);
      if (document.activeElement === editor) {
        editor.setSelectionRange(selectionStart + (selectionStart >= position ? separator[2].length : 0),
          selectionEnd + (selectionEnd >= position ? separator[2].length : 0));
      }
    }
  }
  const ready = $('form').checkValidity() && $('report').value.trim() !== '';
  $('copy').disabled = !ready;
  $('download').disabled = !ready;
  $('feedback').textContent = '';
}

function update() {
  syncDrRegions();
  syncAbdominalRegions();
  const abdominal = currentReportType === 'abdominal';
  const echo = currentReportType === 'echo';
  $('reference-badge').hidden = !echo;
  $('weight').disabled = !echo;
  const modality = reportTypes[currentReportType];
  $('report').dataset.reportMode = currentReportType;
  document.querySelectorAll('[data-report-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.reportChoice === currentReportType));
  });
  document.querySelectorAll('[data-report-type]').forEach(section => {
    section.hidden = section.dataset.reportType !== currentReportType;
  });
  $('imaging-guide').hidden = echo || abdominal;
  $('imaging-title').textContent = modality.title || modality.label;
  $('imaging-reference').hidden = currentReportType !== 'dr';
  $('imaging-reference').textContent = currentReportType === 'dr' ? drReferenceText() : '';
  $('imaging-instructions').textContent = currentReportType === 'dr'
    ? 'Entering a measurement automatically selects and shows its study region. Enter measurements in the left panel or edit them in Report preview. Edit findings, diagnoses, and author in the preview.'
    : 'Edit the study region, clinical history, comparison, technique, findings, impressions, recommendations, and author directly in Report preview. Fill in the blank sections for the patient.';
  $('report').setAttribute('aria-label', `Editable ${modality.label} report`);
  $('report').setAttribute('lang', modality.lang);
  $('preview-help').textContent = abdominal
    ? 'Enter adrenal pole sizes in the left panel or edit them directly in the report. Review each organ finding, then edit diagnoses and author. Copy report or Save TXT exports the current draft.'
    : currentReportType === 'dr' ? `${$('imaging-instructions').textContent} Copy report or Save TXT exports the current draft.`
    : echo ? echoPreviewHelp
      : `Edit the ${modality.label} template directly. Enter the study region, history, technique, findings, impressions, recommendations, and author. Copy report or Save TXT exports the current draft.`;
  const cat = currentSpecies === 'cat';
  const weight = $('weight').valueAsNumber;
  const row = cat ? catReference : selectReference(weight, REFERENCE_DATA);
  document.querySelectorAll('[data-species-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.speciesChoice === currentSpecies));
  });
  document.querySelectorAll('[data-species]').forEach(section => {
    section.hidden = section.dataset.species !== currentSpecies;
    if (section.tagName === 'OPTION') section.disabled = section.hidden;
  });
  if (!echo) {
    $('weight').required = false;
    $('weight').setCustomValidity('');
    $('reference-badge').textContent = modality.label;
    measurements = {};
    $('evaluations').replaceChildren();
    syncMeasurementInputs();
    updateExport();
    return;
  }
  $('weight').min = cat ? '0' : '0.5';
  $('weight').required = !cat;
  if (cat) {
    $('weight').removeAttribute('max');
  } else {
    $('weight').max = '40';
  }
  $('weight').setCustomValidity(cat && weight <= 0 ? 'Enter a weight greater than 0.' : '');
  $('weight-policy').textContent = cat
    ? 'Cats use the same reference ranges at all weights.'
    : 'Weights between table entries use the nearest row. Ties use the lower weight. Values are not interpolated.';
  const issues = !cat && row ? keys.filter(key => !validRange(row.ranges[key])) : [];
  $('weight-status').textContent = row
    ? `Patient ${weight} kg · reference weight ${row.weight} kg${weight === row.weight ? ' (exact match)' : ' (nearest row)'}${issues.length ? ` · ${issues.join(', ')}: Check source` : ''}`
    : 'Enter a weight between 0.5 and 40 kg. Values outside this range are not estimated.';
  $('weight-status').classList.toggle('warning', !row || issues.length > 0);
  $('reference-badge').textContent = row ? `Reference ${row.weight} kg` : 'Check weight';
  if (cat) {
    $('weight-status').textContent = Number.isFinite(weight) && weight > 0
      ? `Cat · patient ${weight} kg · same reference ranges at all weights`
      : $('weight').value === '' && !$('weight').validity.badInput
        ? 'Fixed feline reference ranges · weight is optional.'
        : 'Enter a patient weight greater than 0, or leave it blank.';
    $('weight-status').classList.toggle('warning', !$('weight').validity.valid);
    $('reference-badge').textContent = 'Cat · all weights';
  }
  $('source-issues').textContent = issues.map(key => `${row.weight} kg ${key} source: (${row.ranges[key]})`).join(' / ');
  const report = updateReportReferences(convertReportMModeUnit($('report').value, mModeUnit), row, currentSpecies);
  $('report').value = updateReportLviddn(report, $('weight').value, currentSpecies);
  syncMeasurementInputs();
  syncFindingCheckboxes();
  updateExport();
}

function newReport() {
  if (currentReportType === 'abdominal') return generateAbdominalReport();
  if (currentReportType !== 'echo') return generateImagingReport(currentReportType, currentSpecies);
  return generateReport({ species: currentSpecies, author: 'GJH' }, null);
}

$('form').addEventListener('keydown', event => {
  const direction = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!direction || event.defaultPrevented || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      !event.target.matches('input[type="number"]')) return;

  const inputs = Array.from($('form').querySelectorAll('input[type="number"]'))
    .filter(input => !input.matches(':disabled') && !input.readOnly &&
      input.tabIndex >= 0 && input.getClientRects().length > 0 &&
      getComputedStyle(input).visibility === 'visible');
  const index = inputs.indexOf(event.target);
  if (index < 0) return;

  // Navigation must not increment or decrement the current measurement.
  event.preventDefault();
  let next;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const current = event.target.getBoundingClientRect();
    const currentX = current.left + current.width / 2;
    const currentY = current.top + current.height / 2;
    const candidates = inputs.filter(input => input !== event.target).map(input => {
      const rect = input.getBoundingClientRect();
      return {
        input,
        verticalDistance: direction * (rect.top + rect.height / 2 - currentY),
        horizontalDistance: Math.abs(rect.left + rect.width / 2 - currentX),
      };
    }).filter(candidate => candidate.verticalDistance > 4);

    if (candidates.length) {
      const nearestRow = Math.min(...candidates.map(candidate => candidate.verticalDistance));
      next = candidates.filter(candidate => candidate.verticalDistance <= nearestRow + 4)
        .sort((a, b) => a.horizontalDistance - b.horizontalDistance)[0].input;
    }
  } else {
    next = inputs[index + direction];
  }
  if (next) {
    next.focus();
    next.select();
  }
});

$('form').addEventListener('input', event => {
  if (currentReportType === 'dr' && event.target.dataset.drMeasurement) {
    const input = event.target;
    input.setCustomValidity(input.value !== '' && Number(input.value) <= 0 ? 'Enter a value greater than 0.' : '');
    if (input.validity.valid && !input.disabled) {
      const value = input.value;
      const field = drMeasurementFields(currentSpecies).find(field => field.key === input.dataset.drMeasurement);
      if (value !== '' && restorableMeasurementSection(field.region) !== null) {
        const regionInput = [...document.querySelectorAll('[data-dr-region]')].find(item => item.dataset.drRegion === field.region);
        regionInput.checked = true;
        changeDrRegion(regionInput);
      }
      $('report').value = updateDrMeasurement($('report').value, input.dataset.drMeasurement, value, currentSpecies);
      syncMeasurementInputs();
    }
    syncDrClassification(input.dataset.drMeasurement);
    updateExport();
    return;
  }
  if (currentReportType === 'abdominal' && event.target.dataset.adrenal) {
    if (event.target.validity.valid && !event.target.disabled) {
      const value = event.target.value;
      const region = '비장, 내분비, 림프절';
      if (value !== '' && restorableMeasurementSection(region) !== null) {
        const headings = abdominalHeadings();
        setAbdominalRegions([...abdominalRegions.filter(name => headings.some(match => match[1] === name)), region]);
      }
      $('report').value = updateAdrenalMeasurement($('report').value, event.target.dataset.adrenal, value);
      syncMeasurementInputs();
    }
    updateExport();
    return;
  }
  if (currentReportType !== 'echo') {
    if (event.target === $('weight')) update();
    return;
  }
  const key = event.target.dataset.measurement;
  // Finding checkboxes update the report on change, after the input event.
  if (!key && event.target !== $('weight')) return;
  if (key) {
    if (event.target.validity.badInput) {
      syncMeasurementClassification(key, null);
      measurements[key] = { raw: null, value: null };
      syncEvaluations();
      return updateExport();
    }
    const raw = keys.includes(key) ? convertMModeValue(event.target.value, mModeUnit, 'cm') : event.target.value;
    $('report').value = updateReportMeasurement($('report').value, key, raw, currentSpecies);
  }
  update();
});

$('form').addEventListener('submit', event => event.preventDefault());

$('report').addEventListener('input', () => {
  syncDrRegions();
  syncAbdominalRegions();
  syncMeasurementInputs();
  syncFindingCheckboxes();
  updateExport();
});

function syncFindingCheckboxes() {
  if (currentReportType !== 'echo') return;
  document.querySelectorAll('[data-finding-section]').forEach(group => {
    group.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = insertReportFinding($('report').value, group.dataset.findingSection, checkbox.value).status === 'duplicate';
    });
  });
}

for (const [id, open] of [['expand-findings', true], ['collapse-findings', false]]) {
  $(id).addEventListener('click', () => {
    document.querySelectorAll('.finding-group').forEach(group => { group.open = open; });
  });
}

document.querySelectorAll('[data-finding-section]').forEach(group => {
  group.addEventListener('change', event => {
    if (currentReportType !== 'echo') return;
    const checkbox = event.target;
    if (!checkbox.matches('input[type="checkbox"]')) return;
    const editor = $('report');
    const changeFinding = checkbox.checked ? insertReportFinding : removeReportFinding;
    const result = changeFinding(editor.value, group.dataset.findingSection, checkbox.value);
    const scrollTop = editor.scrollTop;
    editor.value = result.report;
    editor.scrollTop = scrollTop;
    syncFindingCheckboxes();
    updateExport();
    $('finding-feedback').textContent = result.status === 'missing-section'
      ? `Restore the heading “${group.dataset.findingSection}” in the preview to change this sentence.`
      : result.status === 'duplicate' ? 'This sentence is already in the report.'
        : result.status === 'removed' ? `Sentence removed from ${group.dataset.findingSection}.`
          : `Sentence added to ${group.dataset.findingSection}.`;
  });
});

$('report').addEventListener('blur', () => {
  if (currentReportType !== 'echo') return;
  const report = $('report');
  const next = updateReportLviddn(report.value, $('weight').value, currentSpecies);
  if (next !== report.value) {
    const { selectionStart, selectionEnd, scrollTop } = report;
    report.value = next;
    report.setSelectionRange(selectionStart, selectionEnd);
    report.scrollTop = scrollTop;
  }
  syncMeasurementInputs();
});
function draftKey() {
  return `${currentReportType}:${currentSpecies}`;
}

function switchReport(type, species) {
  drafts[draftKey()] = { report: $('report').value };
  currentReportType = type;
  currentSpecies = species;
  $('finding-feedback').textContent = '';
  $('species').value = currentSpecies;
  $('report').value = drafts[draftKey()]?.report ?? newReport();
  buildMeasurementInputs();
  update();
}

document.querySelectorAll('[data-report-choice]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.reportChoice === currentReportType) return;
    switchReport(button.dataset.reportChoice, currentSpecies);
  });
});

document.querySelectorAll('[data-species-choice]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.speciesChoice === currentSpecies) return;
    switchReport(currentReportType, button.dataset.speciesChoice);
  });
});

$('reset').addEventListener('click', () => {
  $('finding-feedback').textContent = '';
  $('weight').value = '';
  for (const key of Object.keys(drafts)) delete drafts[key];
  for (const key of Object.keys(hiddenDrSections)) delete hiddenDrSections[key];
  for (const key of Object.keys(hiddenAbdominalSections)) delete hiddenAbdominalSections[key];
  $('report').value = newReport();
  update();
  (currentReportType === 'echo' ? $('weight') : $('report')).focus();
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('report').value);
    $('feedback').textContent = 'Report copied.';
  } catch {
    $('report').focus();
    $('report').select();
    $('feedback').textContent = 'Report selected. Press Ctrl+C (Mac: ⌘C) to copy.';
  }
});

$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob(['\uFEFF', $('report').value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  const name = reportTypes[currentReportType].filename;
  const weightSuffix = currentReportType === 'echo' && $('weight').value ? `_${$('weight').value}kg` : '';
  link.download = `${name}_${currentSpecies}${weightSuffix}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('feedback').textContent = 'TXT download requested. If it does not start, use Copy report.';
});

$('report').value = newReport();
buildMeasurementInputs();
update();
