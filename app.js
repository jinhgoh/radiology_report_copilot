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
  updateReportReferences,
  updateReportLviddn,
  insertReportFinding,
  measurementFields,
  readReportMeasurements,
  updateReportMeasurement,
  formatLviddn,
} = EchoCore;

let currentSpecies = 'dog';
const drafts = {};
let measurements = {};

function buildMeasurementInputs() {
  const container = $('measurements');
  container.replaceChildren();
  for (const group of ['B mode', 'M mode', 'Doppler']) {
    const section = document.createElement('section');
    section.className = 'card';
    const heading = document.createElement('h2');
    heading.textContent = `${group} measurements`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const field of measurementFields.filter(field => field.group === group && (!field.species || field.species === currentSpecies))) {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = field.label + (field.unit ? ` (${field.unit})` : '');
      label.append(caption);
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.id = `measurement-${field.key}`;
      input.dataset.measurement = field.key;
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
    section.append(heading, grid);
    container.append(section);
  }
}

function syncMeasurementInputs() {
  measurements = readReportMeasurements($('report').value, currentSpecies);
  for (const [key, measurement] of Object.entries(measurements)) {
    const input = $(`measurement-${key}`);
    if (document.activeElement !== input) input.value = measurement.raw ?? '';
    input.disabled = measurement.raw === null;
    input.placeholder = input.disabled ? 'Check report line' : '';
    input.title = input.disabled ? 'Restore a single template measurement line with a numeric or blank value to use this input.' : '';
  }
  if ($('measurement-lviddn')) $('measurement-lviddn').value = formatLviddn(measurements.LVDd.value, $('weight').value);
}

function updateExport() {
  const ready = $('form').checkValidity() && $('report').value.trim() !== '';
  $('copy').disabled = !ready;
  $('download').disabled = !ready;
  $('feedback').textContent = '';
}

function update() {
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
  const report = updateReportReferences($('report').value, row, currentSpecies);
  $('report').value = updateReportLviddn(report, $('weight').value, currentSpecies);
  syncMeasurementInputs();
  updateExport();
}

function newReport() {
  return generateReport({ species: currentSpecies, author: 'GJH' }, null);
}

$('form').addEventListener('input', event => {
  const key = event.target.dataset.measurement;
  if (key) {
    if (event.target.validity.badInput) return updateExport();
    $('report').value = updateReportMeasurement($('report').value, key, event.target.value, currentSpecies);
  }
  update();
});

$('form').addEventListener('submit', event => event.preventDefault());

$('report').addEventListener('input', () => {
  syncMeasurementInputs();
  updateExport();
});

document.querySelectorAll('[data-finding-section]').forEach(select => {
  select.addEventListener('change', () => {
    if (!select.value) return;
    const editor = $('report');
    const result = insertReportFinding(editor.value, select.dataset.findingSection, select.value);
    const scrollTop = editor.scrollTop;
    if (result.status === 'added') editor.value = result.report;
    editor.scrollTop = scrollTop;
    updateExport();
    $('finding-feedback').textContent = result.status === 'missing-section'
      ? `Restore the heading “${select.dataset.findingSection}” in the preview to add this sentence.`
      : result.status === 'duplicate' ? 'This sentence is already in the report.'
        : `Sentence added to ${select.dataset.findingSection}.`;
    select.value = '';
  });
});

$('report').addEventListener('blur', () => {
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
document.querySelectorAll('[data-species-choice]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.speciesChoice === currentSpecies) return;
    drafts[currentSpecies] = { report: $('report').value };
    currentSpecies = button.dataset.speciesChoice;
    $('finding-feedback').textContent = '';
    $('species').value = currentSpecies;
    $('report').value = drafts[currentSpecies]?.report ?? newReport();
    buildMeasurementInputs();
    update();
  });
});

$('reset').addEventListener('click', () => {
  $('finding-feedback').textContent = '';
  document.querySelectorAll('[data-finding-section]').forEach(select => { select.value = ''; });
  $('weight').value = '';
  delete drafts.dog;
  delete drafts.cat;
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
  link.download = `echocardiography_${currentSpecies}_${$('weight').value}kg.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('feedback').textContent = 'TXT download requested. If it does not start, use Copy report.';
});

$('report').value = newReport();
buildMeasurementInputs();
update();
