const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMeasurements } = require('../evaluations');
const core = require('../core');
const evaluate = (species, values = {}, weight = 4.2) => evaluateMeasurements({ species, values, weight });
const result = (id, species, values, weight) => evaluate(species, values, weight).find(item => item.id === id);
const criterion = (evaluation, group, key) => evaluation.groups[group].rows.find(item => item.key === key);

test('evaluation is species-specific, handles empty inputs, and never reports blank values as normal', () => {
  assert.deepEqual(evaluate('dog').map(item => item.id), ['mmvd', 'ph', 'diastolic']);
  assert.deepEqual(evaluate('cat').map(item => item.id), ['hcm', 'diastolic', 'sec']);
  assert.deepEqual(evaluate('unknown'), []);
  assert.equal(result('ph', 'dog').probability, null);
  assert.deepEqual(result('diastolic', 'cat').matches, []);
  assert.ok(result('hcm', 'cat').summary.startsWith('Enter measurements'));
  for (const value of [null, undefined, '', '1.7', NaN, Infinity, -1, 0]) {
    assert.equal(criterion(result('mmvd', 'dog', { laao: value }), 0, 'laao').state, 'missing');
  }
  assert.equal(criterion(result('hcm', 'cat', { laFs: 101 }), 1, 'laFs').state, 'missing');
});

test('MMVD uses inclusive B2 echo thresholds and unrounded LVIDDN with actual weight', () => {
  const weight = 4.2;
  const lvdd = 1.7 * weight ** 0.294;
  let evaluation = result('mmvd', 'dog', { laao: 1.6, LVDd: lvdd }, weight);
  assert.equal(criterion(evaluation, 0, 'laao').met, true);
  assert.equal(criterion(evaluation, 0, 'lviddn').met, true);
  assert.match(evaluation.summary, /2\/2/);
  assert.match(evaluation.summary, /stage is not assigned/);
  evaluation = result('mmvd', 'dog', { laao: 1.5999, LVDd: 1.69999 * weight ** 0.294 }, weight);
  assert.equal(criterion(evaluation, 0, 'laao').met, false);
  assert.equal(criterion(evaluation, 0, 'lviddn').met, false);
  for (const invalidWeight of [null, NaN, 0, 0.49, 40.1]) {
    assert.equal(criterion(result('mmvd', 'dog', { LVDd: lvdd }, invalidWeight), 0, 'lviddn').state, 'missing');
  }
});

test('MMVD severity and LA pressure criteria retain distinct thresholds', () => {
  for (const [key, cases] of Object.entries({
    e: [[0.99, 'Mild'], [1, 'Moderate'], [1.2, 'Moderate'], [1.20001, 'Severe']],
    eivrt: [[1.99, 'Mild'], [2, 'Moderate'], [2.5, 'Moderate'], [2.50001, 'Severe']],
    eem: [[5.99, 'Mild'], [6, 'Moderate'], [9.1, 'Moderate'], [9.10001, 'Severe']],
  })) {
    for (const [value, expected] of cases) assert.equal(criterion(result('mmvd', 'dog', { [key]: value }), 1, key).result, expected);
  }
  for (const [key, threshold] of [['e', 1.25], ['eem', 12], ['eivrt', 2.5]]) {
    assert.equal(criterion(result('mmvd', 'dog', { [key]: threshold }), 2, key).met, false);
    assert.equal(criterion(result('mmvd', 'dog', { [key]: threshold + 0.0001 }), 2, key).met, true);
  }
  assert.equal(result('mmvd', 'dog', { jet: 80 }).groups[1].rows[0].state, 'unresolved');
});

test('PH counts anatomical sites once and preserves uncertainty about unmeasured sites', () => {
  for (const tr of [2.9, 3]) {
    assert.deepEqual(result('ph', 'dog', { tr, mpaao: 1.1, rpad: 20 }).possibilities, ['Low', 'Intermediate', 'High']);
  }
  for (const tr of [3.0001, 3.4]) {
    assert.deepEqual(result('ph', 'dog', { tr, mpaao: 1.1, rpad: 20 }).possibilities, ['Intermediate', 'High']);
  }
  let evaluation = result('ph', 'dog', { tr: 3.4001, mpaao: 1.1, rpad: 20 });
  assert.equal(evaluation.minimumSites, 1);
  assert.equal(evaluation.probability, 'High');
  evaluation = result('ph', 'dog', { tr: 3.4001, mpaao: 1, rpad: 30 });
  assert.equal(evaluation.minimumSites, 0);
  assert.equal(evaluation.probability, null);
  assert.deepEqual(evaluation.possibilities, ['Intermediate', 'High']);
  assert.equal(result('ph', 'dog', { mpaao: 2, rpad: 20 }).probability, null);
  assert.equal(result('ph', 'dog', { tr: 3.5, actet: 0.2 }).probability, null, 'Unconfirmed AT:ET scale is not applied');
});

test('HCM uses strict LA criteria and converts LAA cm/s to m/s without diagnosing SEC', () => {
  let evaluation = result('hcm', 'cat', { laao: 1.5, laDiameter: 15, laFs: 20, appendage: 0.25 });
  assert.equal(criterion(evaluation, 0, 'laao').met, false);
  assert.equal(criterion(evaluation, 0, 'laDiameter').met, false);
  assert.equal(criterion(evaluation, 1, 'laFs').met, false);
  assert.equal(criterion(evaluation, 1, 'appendage').met, false);
  evaluation = result('hcm', 'cat', { laao: 1.5001, laDiameter: 15.001, laFs: 19.999, appendage: 0.24999, wall: 7 });
  for (const item of [...evaluation.groups[0].rows.slice(0, 2), ...evaluation.groups[1].rows]) assert.equal(item.met, true);
  assert.equal(evaluation.groups[0].rows.length, 2);
  assert.doesNotMatch(JSON.stringify(evaluation), /Width|4\.0v/);
  assert.match(evaluation.summary, /Clinical stage requires morphology and history/);
  assert.equal(criterion(result('hcm', 'cat', { laFs: 0 }), 1, 'laFs').met, true);
});

test('diastolic classification requires every criterion and keeps gaps and exact boundaries', () => {
  for (const [values, expected] of [
    [{ ea: 1, ivrt: 34, eem: 9.9 }, 'Normal'],
    [{ ea: 1.3, ivrt: 52, eem: 9.9 }, 'Normal'],
    [{ ea: 0.99, ivrt: 60.001, eem: 9.9 }, 'Normal filling pressure (Stage 1a)'],
    [{ ea: 0.99, ivrt: 60.001, eem: 10.001 }, 'Elevated LV filling pressure'],
    [{ ea: 1, ivrt: 37, eem: 10.001 }, 'Pseudonormal diastole (Stage 2)'],
    [{ ea: 1, ivrt: 60, eem: 11 }, 'Pseudonormal diastole (Stage 2)'],
    [{ ea: 2.001, ivrt: 36.999, eem: 10.001 }, 'Restrictive diastole (Stage 3)'],
  ]) assert.deepEqual(result('diastolic', 'cat', values).matches, [expected]);
  for (const values of [
    { ea: 1, ivrt: 45, eem: 10 }, { ea: 0.9, ivrt: 60, eem: 9 },
    { ea: 2, ivrt: 35, eem: 11 }, { ea: 2.1, ivrt: 37, eem: 11 },
    { ea: 1.2, ivrt: 55, eem: 11 }, { ea: 1, ivrt: 45 }, {},
  ]) assert.deepEqual(result('diastolic', 'cat', values).matches, []);
  assert.deepEqual(result('diastolic', 'dog', { ea: 1, ivrt: 45, eem: 9 }).matches, []);
});

test('SEC comparisons preserve overlapping ranges and convert LA diameter from mm to cm', () => {
  for (const [laFs, expected] of [[0, 'SEC+ range only'], [1, 'both'], [20, 'both'], [37, 'both'], [37.01, 'SEC− range only'], [45, 'SEC− range only'], [45.01, 'Outside both']]) {
    const evaluation = result('sec', 'cat', { laFs, laDiameter: 24 });
    assert.ok(evaluation.groups[0].rows[1].result.includes(expected));
    assert.equal(evaluation.groups[0].rows[0].value, '2.4 cm (24 mm)');
    assert.equal(evaluation.groups[0].rows[0].result, 'Within both reported group ranges');
    assert.match(evaluation.summary, /cannot be predicted/);
  }
  for (const [laDiameter, expected] of [[12.999, 'Outside both'], [13, 'both'], [31, 'both'],
    [31.001, 'SEC− range only'], [32, 'SEC− range only'], [32.001, 'Outside both']]) {
    const row = result('sec', 'cat', { laDiameter }).groups[0].rows[0];
    assert.ok(row.result.includes(expected), String(laDiameter));
  }
  for (const laDiameter of [null, undefined, 0, -1, NaN, Infinity]) {
    const row = result('sec', 'cat', { laDiameter }).groups[0].rows[0];
    assert.equal(row.state, 'missing');
    assert.equal(row.result, 'Needs input');
  }
});

test('evaluation follows report parsing and is invariant under mm/cm conversion without changing prose', () => {
  const report = core.generateReport({ species: 'dog', laao: 1.7, LVDd: 2.6, e: 1.3, eem: 13, tr: 3.5, mpaao: 1.1, dx: 'Manual diagnosis' });
  const fromReport = text => Object.fromEntries(Object.entries(core.readReportMeasurements(text, 'dog')).map(([key, item]) => [key, item.value]));
  const expected = evaluate('dog', fromReport(report), 8.6);
  for (const unit of ['mm', 'cm']) assert.deepEqual(evaluate('dog', fromReport(core.convertReportMModeUnit(report, unit)), 8.6), expected);
  const removed = report.replace(/^- LA\/Ao ratio.*\n/m, '');
  assert.equal(criterion(result('mmvd', 'dog', fromReport(removed), 8.6), 0, 'laao').state, 'missing');
  assert.ok(report.includes('Manual diagnosis'));
});
