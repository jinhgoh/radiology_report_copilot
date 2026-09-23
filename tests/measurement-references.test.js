const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyMeasurement, measurementRangeStatus, measurementReferences, measurementReferenceText } = require('../core');

test('M mode reference boundaries are inclusive and invalid source ranges are withheld', () => {
  const { keys, mModeReference, validRange } = require('../core');
  const rows = require('../reference-data');
  for (const species of ['dog', 'cat']) {
    for (const row of species === 'dog' ? rows : [null]) {
      for (const key of keys) {
        const reference = mModeReference(key, species, row, 'mm');
        if (species === 'dog' && !validRange(row.ranges[key])) {
          assert.equal(measurementRangeStatus(1, reference), null);
          continue;
        }
        const { min, max } = reference.bands[0];
        for (const [value, expected] of [[min - 0.001, 'low'], [min, 'normal'], [max, 'normal'], [max + 0.001, 'high']]) {
          assert.equal(measurementRangeStatus(value, reference), expected);
        }
        assert.equal(measurementRangeStatus(null, reference), null);
      }
    }
  }
  assert.equal(measurementRangeStatus(1, mModeReference('IVSd', 'dog', null)), null);
  assert.equal(mModeReference('fs', 'cat', null), null);
});

test('RPAD preserves strict PH boundaries and leaves gaps and overlaps unclassified', () => {
  const reference = measurementReferences.dog.rpad;
  for (const [value, severity, status] of [
    [21.999, 'severe', 'low'], [22, null, null], [22.5, null, null],
    [23, null, null], [23.001, 'moderate', 'low'], [26.999, 'moderate', 'low'],
    [27, null, null], [29.999, null, null], [30, 'normal', 'normal'],
    [35, 'normal', 'normal'], [35.001, null, null], [54.999, null, null],
    [55, 'normal', 'normal'], [60, 'normal', 'normal'],
  ]) {
    assert.equal(classifyMeasurement(value, reference), severity, String(value));
    assert.equal(measurementRangeStatus(value, reference), status, String(value));
  }
  for (const value of [null, undefined, '', NaN, Infinity, 0, -1]) {
    assert.equal(classifyMeasurement(value, reference), null);
    assert.equal(measurementRangeStatus(value, reference), null);
  }
  assert.equal(measurementReferences.cat.rpad, undefined);
  const text = measurementReferenceText(reference, 'dog');
  assert.ok(text.includes('normal≥30%'));
  assert.ok(text.includes('SeverePH<22 | 23<moderatePH<27 | 35<mildPH<55'));
});

test('canine MPA/Ao includes 1.0 in normal and flags values above it as high', () => {
  const reference = measurementReferences.dog.mpaao;
  for (const value of [0.5, 0.999, 1.0]) {
    assert.equal(classifyMeasurement(value, reference), 'normal');
    assert.equal(measurementRangeStatus(value, reference), 'normal');
  }
  for (const value of [1.001, 1.5]) {
    assert.equal(classifyMeasurement(value, reference), null);
    assert.equal(measurementRangeStatus(value, reference), 'high');
  }
  for (const value of [null, undefined, '', NaN, Infinity, 0, -1]) {
    assert.equal(classifyMeasurement(value, reference), null);
    assert.equal(measurementRangeStatus(value, reference), null);
  }
  const text = measurementReferenceText(reference, 'dog');
  assert.ok(text.includes('normal≤1.0 | 1.0초과시 PH의심지표+'));
  assert.ok(text.includes('PH = pulmonary hypertension'));
  assert.equal(measurementReferences.cat.mpaao, undefined);
});

test('feline LA FS uses the supplied interpretation at both boundaries', () => {
  const reference = measurementReferences.cat.laFs;
  for (const [value, expected] of [[6.4, 'low'], [15.899, 'low'], [15.9, 'low'],
    [15.901, 'ambiguous'], [26.6, 'ambiguous'], [29, 'ambiguous'],
    [29.001, 'normal'], [36.1, 'normal'], [36.2, 'normal']]) {
    assert.equal(classifyMeasurement(value, reference), expected);
    assert.equal(measurementRangeStatus(value, reference), expected);
  }
  for (const value of [null, undefined, '', NaN, Infinity, -1, 0]) {
    assert.equal(classifyMeasurement(value, reference), null);
    assert.equal(measurementRangeStatus(value, reference), null);
  }
  assert.equal(measurementReferences.dog.laFs, undefined);
  const text = measurementReferenceText(reference, 'cat');
  for (const range of ['Healthy 15.9-36.1%', 'HCM(asym) 7.4-29.0%', 'HCM(chf) 6.4-26.6%']) {
    assert.ok(text.includes(range));
  }
});

test('range colors distinguish normal and high independently of severity grades', () => {
  for (const [species, cutoff] of [['dog', 1.3], ['cat', 1.5]]) {
    const reference = measurementReferences[species].laao;
    assert.equal(measurementRangeStatus(cutoff - 0.01, reference), 'normal');
    assert.equal(measurementRangeStatus(cutoff, reference), 'high');
    assert.equal(measurementRangeStatus(2.4, reference), 'high');
    for (const value of [null, '', NaN, Infinity, 0, -1]) {
      assert.equal(measurementRangeStatus(value, reference), null);
    }
  }
});

test('a supplied lower normal limit supports low values and exact boundaries', () => {
  const reference = { bands: [{ severity: 'normal', min: 1, max: 2 }] };
  for (const [value, status] of [[0.9, 'low'], [1, 'normal'], [2, 'normal'], [2.1, 'high']]) {
    assert.equal(measurementRangeStatus(value, reference), status);
  }
  assert.equal(measurementRangeStatus(1, undefined), null);
});

test('dog LA/Ao cutoffs start the next severity category', () => {
  for (const [value, severity] of [[1.29, 'normal'], [1.3, 'mild'], [1.69, 'mild'],
    [1.7, 'moderate'], [1.9, 'moderate'], [1.91, 'moderate'], [2.39, 'moderate'],
    [2.4, 'severe'], [3, 'severe']]) {
    assert.equal(classifyMeasurement(value, measurementReferences.dog.laao), severity);
  }
});

test('cat LA/Ao does not infer unsupplied severity grades', () => {
  assert.equal(classifyMeasurement(1.49, measurementReferences.cat.laao), 'normal');
  for (const value of [1.5, 1.7, 2.4, 3]) {
    assert.equal(classifyMeasurement(value, measurementReferences.cat.laao), null);
  }
});

test('empty, invalid, nonpositive, and ambiguous values stay unclassified', () => {
  for (const species of ['dog', 'cat']) {
    for (const value of [null, undefined, '', NaN, Infinity, -1, 0]) {
      assert.equal(classifyMeasurement(value, measurementReferences[species].laao), null);
    }
  }
  assert.equal(classifyMeasurement(1, { bands: [
    { severity: 'normal', max: 2 }, { severity: 'mild', min: 1 },
  ] }), null);
});

test('hover text preserves supplied species-specific clinical notes', () => {
  assert.match(measurementReferenceText(measurementReferences.dog.laao, 'dog'), /1.9초과시 심부전의심/);
  assert.match(measurementReferenceText(measurementReferences.cat.laao, 'cat'), /LA size가 더 중요. 16mm 이상이면 안좋은/);
});
