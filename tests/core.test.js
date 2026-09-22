const { test } = require('node:test');
const assert = require('node:assert/strict');
const rows = require('../reference-data');
const { keys, selectReference, validRange, generateReport } = require('../core');

test('cats use the exact fixed ranges at every weight and omit dog-only fields', () => {
  const expected = ['0.3-0.6', '1.08-2.14', '0.26-0.60', '0.4-0.9', '0.4-1.12', '0.43-0.98'];
  const reports = [0.1, 4.2, 8.6, 41].map(weight => generateReport({ species: 'cat', weight, author: 'GJH' }, selectReference(weight, rows)));
  for (const report of reports) {
    keys.forEach((key, i) => assert.ok(report.includes(`- ${key}:  (${expected[i]})`)));
    assert.doesNotMatch(report, /LVIDDN|MPA\/Ao|RPAD|E\/IVRT|AcT\/ET|원본 확인 필요/);
    assert.doesNotMatch(report, /SEC \(spontaneous|수축기 와류가/);
  }
  assert.ok(reports.every(report => report === reports[0]));
});

test('cat report includes feline measurements, units and manually selected findings', () => {
  const report = generateReport({ species: 'cat', wall: '5', laao: '1.5', laDiameter: '16', laFs: '20', secFinding: '확장 된 좌심방내 SEC (spontaneous echo contrast) 확인됨', dFinding: '수축기 와류가 좌심방과 대동맥 유출로에서 확인됨', ea: '1.2', ivrt: '45', aortic: '1.3', appendage: '0.4', LVDd: '1.8', mr: '3', tr: '2', e: '0.8', eem: '7', dx: 'First\nSecond', author: 'GJH' });
  for (const line of ['- 이완기말 좌심실벽 두께 : 5 mm', '- LA/Ao ratio : 1.5\n  > LA diameter max. 16 mm\n  > LA FS 20 %', '- LVDd: 1.8 (1.08-2.14)', '- E/A : 1.2, IVRT : 45 ms', '- 수축기 대동맥 유출로 속도 : 1.3 m/s', '- LA appendage peak velocity : 0.4 m/s', '- 이첨판 역류 peak velocity : 3 m/s', '- E peak velocity : 0.8 m/s, E/Em ratio : 7', 'DX and DDX)\n- First\n- Second\n\nby GJH']) assert.ok(report.includes(line), line);
});

test('source extraction includes 87 distinct rows and all six measurements', () => {
  assert.equal(rows.length, 87);
  assert.equal(new Set(rows.map(r => r.weight)).size, 87);
  assert.equal(rows[0].weight, 0.5);
  assert.equal(rows.at(-1).weight, 40);
  rows.forEach((row, i) => {
    assert.deepEqual(Object.keys(row.ranges), keys);
    if (i) assert.ok(row.weight > rows[i - 1].weight);
  });
});
test('8.6 kg reproduces every supplied sample range', () => {
  assert.deepEqual(Object.values(selectReference(8.6, rows).ranges), ['0.698-0.834', '2.498-2.694', '0.558-0.670', '1.050-1.200', '1.480-1.651', '0.923-1.062']);
});
test('nearest row selection includes ties, gaps, endpoints and invalid weights', () => {
  assert.equal(selectReference(8.5, rows).weight, 8.6);
  assert.equal(selectReference(8.4, rows).weight, 8.2);
  assert.equal(selectReference(20.5, rows).weight, 20.9);
  assert.equal(selectReference(0.5, rows).weight, 0.5);
  assert.equal(selectReference(40, rows).weight, 40);
  for (const bad of [NaN, Infinity, -1, 0, 0.49, 40.01]) assert.equal(selectReference(bad, rows), null);
});
test('malformed, negative and atypical precision values remain verbatim but are withheld', () => {
  const bad = rows.flatMap(row => keys.filter(k => !validRange(row.ranges[k])).map(k => [row.weight, k]));
  assert.deepEqual(bad, [[0.5, 'LVDd'], [0.5, 'LVDs'], [0.9, 'IVSd'], [0.9, 'LVDs'], [31.4, 'IVSd']]);
  const report = generateReport({}, rows[0]);
  assert.match(report, /LVDd:  \(원본 확인 필요\)/);
  assert.doesNotMatch(report, /-0.297/);
});
test('reports preserve entered values, diagnosis lines and blank clinical findings', () => {
  const report = generateReport({ author: 'GJH', IVSd: '0.75', fs: '35', e: '0.9', dx: 'First\n- Second' }, selectReference(8.6, rows));
  assert.match(report, /IVSd: 0.75 \(0.698-0.834\)/);
  assert.match(report, /FS: 35%/);
  assert.match(report, /E peak velocity : 0.9 m\/s/);
  assert.match(report, /DX and DDX\)\n- First\n- Second\n\nby GJH$/);
  assert.doesNotMatch(report, /prolapse|수축기 와류가/);
  assert.match(generateReport({}, null), /참고범위 없음/);
});

test('LVIDDN appears below LVDd using actual weight and stays blank without valid inputs', () => {
  // The workbook example is 2.2 / 4.2^0.294 = 1.4427377299254971.
  // Its nearest reference row is 4.1 kg, which must not be used for this calculation.
  const row = selectReference(4.2, rows);
  const report = generateReport({ weight: '4.2', LVDd: '2.2' }, row);
  assert.match(report, /- LVDd: 2.2 \(1.783-2.002\)\n  > LVIDDN: 1.443\n- LVPWd:/);
  for (const values of [{}, { weight: '8.6' }, { LVDd: '2.2' }, { weight: '0', LVDd: '2.2' }, { weight: '41', LVDd: '2.2' }, { weight: '8.6', LVDd: '-1' }]) {
    assert.match(generateReport(values, row), /\n  > LVIDDN: \n- LVPWd:/);
  }
});

const { updateReportReferences, updateReportLviddn } = require('../core');
test('weight updates preserve edited prose, measurements, author and deleted lines', () => {
  let report = generateReport({ weight: '8.6', LVDd: '2.2', IVSd: '0.75', author: 'Edited author', dx: 'Custom diagnosis\nFollow up' }, selectReference(8.6, rows));
  report = report.replace('- LVPWs:  (0.923-1.062)\n', '').replace('1. B mode 평가', 'Custom heading\nFree text (0.698-0.834)');
  const updated = updateReportReferences(report, selectReference(4.2, rows), 'dog');
  assert.match(updated, /LVDd: 2.2 \(1.783-2.002\)/);
  assert.match(updated, /IVSd: 0.75/);
  assert.match(updated, /Custom heading\nFree text \(0.698-0.834\)/);
  assert.match(updated, /Custom diagnosis\n- Follow up\n\nby Edited author$/);
  assert.doesNotMatch(updated, /LVPWs/);
  assert.equal(updateReportReferences('', rows[0], 'dog'), '');
  assert.match(updateReportReferences(updated, null, 'dog'), /LVDd: 2.2 \(참고범위 없음\)/);
  assert.match(updateReportReferences(updated, rows[0], 'dog'), /LVDd: 2.2 \(원본 확인 필요\)/);
});
test('direct LVDd edits recalculate LVIDDN without touching other report text', () => {
  const report = 'My notes\n- LVDd: 2.2 (1.783-2.002)\n  > LVIDDN: \n\nOther notes';
  assert.equal(updateReportLviddn(report, '4.2', 'dog'), report.replace('LVIDDN: ', 'LVIDDN: 1.443'));
  assert.equal(updateReportLviddn(report, '4.2', 'cat'), report);
  assert.equal(updateReportLviddn('Free text only', '4.2', 'dog'), 'Free text only');
  assert.match(updateReportLviddn(report.replace('2.2', 'unknown').replace('LVIDDN: ', 'LVIDDN: 1.443'), '4.2', 'dog'), /LVIDDN: \n/);
});
test('feline reference updates preserve the directly edited draft at every weight', () => {
  const report = generateReport({ species: 'cat', LVDd: '1.8', dx: 'My feline notes' });
  assert.equal(updateReportReferences(report, null, 'cat'), report);
});
