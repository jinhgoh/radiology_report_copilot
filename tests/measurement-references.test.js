const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyMeasurement, measurementRangeStatus, measurementReferences, measurementReferenceText } = require('../core');

test('TR uses the supplied strict RR boundary and preserves clinical descriptions', () => {
  for (const species of ['dog', 'cat']) {
    const reference = measurementReferences[species].tr;
    for (const [value, expected] of [[0.1, 'normal'], [2.599, 'normal'],
      [2.6, 'high'], [2.601, 'high'], [3.499, 'high'], [3.5, 'high'], [3.501, 'high']]) {
      assert.equal(measurementRangeStatus(value, reference), expected);
      assert.equal(classifyMeasurement(value, reference), expected === 'normal' ? 'normal' : null);
    }
    for (const value of [null, undefined, '', NaN, Infinity, 0, -1]) {
      assert.equal(measurementRangeStatus(value, reference), null);
    }
    assert.ok(measurementReferenceText(reference, species)
      .includes('RR<2.6m/s<Abnormal but meaningless<3.5m/s<의미있는 TR'));
  }
});

test('E peak uses the requested strict upper RR boundary independently of clinical notes', () => {
  for (const species of ['dog', 'cat']) {
    const reference = measurementReferences[species].e;
    for (const [value, expected] of [[0.519, 'normal'], [0.52, 'normal'],
      [0.82, 'normal'], [0.821, 'normal'], [1.199, 'normal'], [1.2, 'high'], [1.25, 'high'],
      [1.3, 'high'], [1.5, 'high']]) {
      assert.equal(measurementRangeStatus(value, reference), expected);
    }
    for (const value of [null, undefined, '', NaN, Infinity, 0, -1]) {
      assert.equal(measurementRangeStatus(value, reference), null);
    }
    for (const value of [1.2, 1.25, 1.3, 1.5, 1.6]) {
      assert.equal(classifyMeasurement(value, reference), null);
    }
    const suppliedNotes = `RR:0.52-0.82m/s |
RR<1.2m/s<LAP증가(윤심초,vf)
>1.25m/s: 역류의 양이 유의적으로 多
>1.25m/s: LVFP증가
>1.3m/s: (위험)곧 CHF가 발생할 수 있음
>1.5m/s: 급사 가능(예후안좋음)

심장병있으면 E파가 커짐
정상: E peak <1.25m/s  // 1< E/A <2
1.3m/s 이상이면 위험. (Yoon)1.3이상이면 LAP가 높아져서 폐수종 가능성이 상당히 높아진다(Yoon) E peak 위험수치가 1.3m/s다 (Yoon). E peak이 1.2거나 낮아도  CPE 유발도 가능(다른요소에 의해서)( Yoon)`;
    assert.ok(measurementReferenceText(reference, species).includes(suppliedNotes));
  }
});

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
