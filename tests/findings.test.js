const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateReport, insertReportFinding, updateReportReferences } = require('../core');
const rows = require('../reference-data');

const heading = '1. B mode 평가';
const sentence = '- 이첨판막의 비후 및 prolapse';

test('selected findings enter the correct section without replacing edited content', () => {
  for (const species of ['dog', 'cat']) {
    const draft = generateReport({ species, laao: '1.5', dx: 'Custom diagnosis', author: 'Author' });
    const added = insertReportFinding(draft, heading, sentence);
    assert.equal(added.status, 'added');
    assert.equal(added.report.replace(sentence + '\n', ''), draft);
    assert.ok(added.report.indexOf(sentence) > added.report.indexOf(heading));
    assert.ok(added.report.indexOf(sentence) < added.report.indexOf('2. M mode 평가'));
    assert.ok(updateReportReferences(added.report, rows[10], species).includes(sentence));
    assert.deepEqual(insertReportFinding(added.report, heading, sentence), { report: added.report, status: 'duplicate' });
    const second = insertReportFinding(added.report, heading, '- Another finding');
    assert.ok(second.report.includes(sentence + '\n- Another finding'));
  }
});

test('Doppler insertion preserves diagnoses and CRLF line endings', () => {
  const draft = generateReport({ species: 'cat', dx: 'Diagnosis' }).replaceAll('\n', '\r\n');
  const added = insertReportFinding(draft, '3. Doppler 평가', '- Doppler finding');
  assert.equal(added.report.replace('- Doppler finding\r\n', ''), draft);
  assert.ok(added.report.indexOf('- Doppler finding') < added.report.indexOf('DX and DDX)'));
});

test('missing or edited headings leave free-form reports intact', () => {
  for (const draft of ['', 'My custom report', generateReport({}).replace(heading, 'Edited heading')]) {
    assert.deepEqual(insertReportFinding(draft, heading, sentence), { report: draft, status: 'missing-section' });
  }
});
