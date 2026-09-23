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
  generateImagingReport,
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
let measurements = {};
let mModeUnit = 'mm';

function activeMeasurementReference(key) {
  return keys.includes(key)
    ? mModeReference(key, currentSpecies, currentSpecies === 'cat' ? null : selectReference($('weight').valueAsNumber, REFERENCE_DATA), mModeUnit)
    : measurementReferences[currentSpecies]?.[key];
}

function buildMeasurementInputs() {
  const container = $('measurements');
  container.replaceChildren();
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
        caption.tabIndex = 0;
        const tooltip = document.createElement('span');
        tooltip.id = `measurement-reference-${field.key}`;
        tooltip.className = 'measurement-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = measurementReferenceText(reference, currentSpecies);
        caption.setAttribute('aria-describedby', tooltip.id);
        caption.append(tooltip);
        caption.addEventListener('keydown', event => {
          if (event.key === 'Escape') caption.classList.add('dismissed');
        });
        caption.addEventListener('mouseenter', () => caption.classList.remove('dismissed'));
        caption.addEventListener('focus', () => caption.classList.remove('dismissed'));
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

function syncMeasurementInputs() {
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
  const abdominal = currentReportType === 'abdominal';
  const echo = currentReportType === 'echo';
  const modality = reportTypes[currentReportType];
  document.querySelectorAll('[data-report-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.reportChoice === currentReportType));
  });
  document.querySelectorAll('[data-report-type]').forEach(section => {
    section.hidden = section.dataset.reportType !== currentReportType;
  });
  $('imaging-guide').hidden = echo || abdominal;
  $('imaging-title').textContent = modality.title || modality.label;
  $('report').setAttribute('aria-label', `Editable ${modality.label} report`);
  $('report').setAttribute('lang', modality.lang);
  $('preview-help').textContent = abdominal
    ? 'Edit the supplied Korean abdominal ultrasound template directly. Review each organ finding, then edit diagnoses and author. Copy report or Save TXT exports the current draft.'
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
    $('weight').min = '0';
    $('weight').removeAttribute('max');
    $('weight').setCustomValidity(weight <= 0 ? 'Enter a weight greater than 0.' : '');
    $('weight-policy').textContent = `Weight is optional for ${modality.label} reports.`;
    $('weight-status').textContent = `${modality.label} · weight is optional.`;
    $('weight-status').classList.toggle('warning', !$('weight').validity.valid);
    $('reference-badge').textContent = modality.label;
    measurements = {};
    $('evaluations').replaceChildren();
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
  if (currentReportType !== 'echo') return generateImagingReport(currentReportType);
  return generateReport({ species: currentSpecies, author: 'GJH' }, null);
}

$('form').addEventListener('input', event => {
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
  $('report').value = newReport();
  update();
  $('weight').focus();
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
  const weightSuffix = $('weight').value ? `_${$('weight').value}kg` : '';
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
