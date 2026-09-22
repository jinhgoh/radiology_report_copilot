'use strict';

const $ = id => document.getElementById(id);
const {
  keys,
  catReference,
  selectReference,
  validRange,
  generateReport,
  updateReportReferences,
  updateReportLviddn,
  insertReportFinding,
} = EchoCore;

let currentSpecies = 'dog';
const drafts = {};

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
      : 'Fixed feline reference ranges · enter a patient weight greater than 0.';
    $('weight-status').classList.toggle('warning', !Number.isFinite(weight) || weight <= 0);
    $('reference-badge').textContent = 'Cat · all weights';
  }
  $('source-issues').textContent = issues.map(key => `${row.weight} kg ${key} source: (${row.ranges[key]})`).join(' / ');
  const report = updateReportReferences($('report').value, row, currentSpecies);
  $('report').value = updateReportLviddn(report, $('weight').value, currentSpecies);
  updateExport();
}

function newReport() {
  return generateReport({ species: currentSpecies, author: 'GJH' }, null);
}

$('form').addEventListener('input', update);

$('form').addEventListener('submit', event => event.preventDefault());

$('report').addEventListener('input', updateExport);

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
});
document.querySelectorAll('[data-species-choice]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.speciesChoice === currentSpecies) return;
    drafts[currentSpecies] = { report: $('report').value };
    currentSpecies = button.dataset.speciesChoice;
    $('finding-feedback').textContent = '';
    $('species').value = currentSpecies;
    $('report').value = drafts[currentSpecies]?.report ?? newReport();
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
update();
