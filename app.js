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
  drMeasurementKeys,
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
        const measurements = currentSpecies === 'cat' ? '- VHS: v, VHW: v' : '- VHS: v, VLAS: v';
        const section = saved[region] ?? `${region}\n${region === '흉부' ? measurements + '\n' : ''}- \n\n`;
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
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = 'Heart size';
    section.append(heading);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const key of drMeasurementKeys(currentSpecies)) {
      const label = document.createElement('label');
      label.id = `dr-row-${key}`;
      label.className = 'has-reference dr-heart-measurement';
      const caption = document.createElement('span');
      caption.id = `dr-caption-${key}`;
      caption.className = 'measurement-reference';
      caption.textContent = `${key} (v)`;
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
      grid.append(label);
    }
    section.append(grid);
    container.append(section);
    return;
  }
  if (currentReportType === 'abdominal') {
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = 'Adrenal gland measurements';
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Enter pole sizes in mm. Measurements update the spleen / endocrine / lymph node section. Edit clinical findings directly in the report.';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const field of adrenalFields) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = `${field.label} (mm)`;
      label.append(caption);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = 'any';
      input.id = `adrenal-${field.key}`;
      input.dataset.adrenal = field.key;
      label.append(input);
      grid.append(label);
    }
    section.append(heading, hint, grid);
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
    }
    if (group === 'M mode' && currentSpecies === 'dog') {
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
  const normal = currentSpecies === 'cat'
    ? { VHS: { min: 6.8, max: 8.1 }, VHW: { min: 2.9, max: 4.1 } }
    : { VHS: { min: 8.7, max: 10.7 }, VLAS: { max: 2.3, maxInclusive: false } };
  const rangeStatus = measurementRangeStatus(
    input.disabled || !input.validity.valid ? NaN : input.valueAsNumber,
    { bands: [{ severity: 'normal', ...normal[key] }] });
  const row = $(`dr-row-${key}`);
  row.dataset.rangeStatus = rangeStatus || '';
  row.classList.toggle('has-classification', Boolean(rangeStatus));
  const status = $(`dr-status-${key}`);
  status.textContent = rangeStatus ? `(${rangeStatus})` : '';
  status.hidden = !rangeStatus;
}

function syncMeasurementInputs() {
  if (currentReportType === 'dr') {
    for (const [key, raw] of Object.entries(readDrMeasurements($('report').value, currentSpecies))) {
      const input = $(`dr-${key}`);
      if (document.activeElement !== input || raw === null) {
        input.value = raw ?? '';
        input.setCustomValidity('');
      }
      input.disabled = raw === null;
      input.placeholder = input.disabled ? 'Check report line' : '';
      input.title = input.disabled ? 'Restore the chest section and a single numeric or blank measurement with its v unit.' : '';
      syncDrClassification(key);
    }
    return;
  }
  if (currentReportType === 'abdominal') {
    for (const [key, raw] of Object.entries(readAdrenalMeasurements($('report').value))) {
      const input = $(`adrenal-${key}`);
      if (document.activeElement !== input) input.value = raw ?? '';
      input.disabled = raw === null;
      input.placeholder = input.disabled ? 'Check report section' : '';
      input.title = input.disabled ? 'Restore the section heading and a single numeric or blank measurement line for this side.' : '';
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
    const details = document.createElement('details');
    details.dataset.evaluation = evaluation.id;
    details.open = expanded.has(evaluation.id);
    const summary = document.createElement('summary');
    summary.textContent = evaluation.title;
    const outcome = document.createElement('span');
    outcome.className = 'evaluation-outcome';
    outcome.textContent = evaluation.summary;
    summary.append(outcome);
    details.append(summary);
    for (const group of evaluation.groups) {
      const heading = document.createElement('h3');
      heading.textContent = group.title;
      details.append(heading);
      const list = document.createElement('dl');
      for (const row of group.rows) {
        const term = document.createElement('dt');
        term.textContent = `${row.label}: ${row.value}`;
        const description = document.createElement('dd');
        description.dataset.state = row.state;
        const criterion = document.createElement('span');
        criterion.textContent = row.criterion;
        const result = document.createElement('strong');
        result.textContent = row.result;
        description.append(criterion, result);
        list.append(term, description);
      }
      details.append(list);
    }
    for (const note of evaluation.notes) {
      const paragraph = document.createElement('p');
      paragraph.className = 'hint';
      paragraph.textContent = note;
      details.append(paragraph);
    }
    const section = document.createElement('section');
    section.className = 'evaluation-result';
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
  const ready = $('form').checkValidity() && $('report').value.trim() !== '';
  $('copy').disabled = !ready;
  $('download').disabled = !ready;
  $('feedback').textContent = '';
}

function update() {
  syncDrRegions();
  const abdominal = currentReportType === 'abdominal';
  const echo = currentReportType === 'echo';
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
    ? 'Enter heart-size measurements in the left panel or edit them in Report preview. Select study regions and edit findings, diagnoses, and author in the preview. Dogs use VHS and VLAS; cats use VHS and VHW.'
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

$('form').addEventListener('input', event => {
  if (currentReportType === 'dr' && event.target.dataset.drMeasurement) {
    const input = event.target;
    input.setCustomValidity(input.value !== '' && Number(input.value) <= 0 ? 'Enter a value greater than 0.' : '');
    if (input.validity.valid) {
      $('report').value = updateDrMeasurement($('report').value, input.dataset.drMeasurement, input.value, currentSpecies);
      syncMeasurementInputs();
    }
    syncDrClassification(input.dataset.drMeasurement);
    updateExport();
    return;
  }
  if (currentReportType === 'abdominal' && event.target.dataset.adrenal) {
    if (event.target.validity.valid) {
      $('report').value = updateAdrenalMeasurement($('report').value, event.target.dataset.adrenal, event.target.value);
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
