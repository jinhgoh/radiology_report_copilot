const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateImagingReport, readDrMeasurements, updateDrMeasurement } = require('../core');

for (const [species, other] of [['dog', 'VLAS'], ['cat', 'VHW']]) {
  test(`${species} DR measurements preserve prose, units, and line endings`, () => {
    const original = generateImagingReport('dr', species).replace('- \n', '- Clinical note\n').replace(/\n/g, '\r\n');
    let report = updateDrMeasurement(original, 'VHS', '9.50', species);
    report = updateDrMeasurement(report, other, '2.1', species);
    assert.equal(readDrMeasurements(report, species).VHS, '9.50');
    assert.equal(readDrMeasurements(report, species)[other], '2.1');
    report = updateDrMeasurement(report, 'VHS', '', species);
    report = updateDrMeasurement(report, other, '', species);
    assert.equal(report, original);
    for (const raw of ['-1', '0', 'Infinity', 'NaN', 'text']) {
      assert.equal(updateDrMeasurement(original, 'VHS', raw, species), original);
    }
    for (const malformed of [
      original.replace('흉부', 'Edited heading'),
      original.replace('VHS: v', 'VHS: unknown'),
      original.replace('VHS: v', 'VHS: 9v, VHS: 10v'),
    ]) {
      assert.equal(readDrMeasurements(malformed, species).VHS, null);
      assert.equal(updateDrMeasurement(malformed, 'VHS', '9.5', species), malformed);
    }
    const outside = original.replace('DX and DDX)', '복부\r\n- VHS: 12v\r\nDX and DDX)');
    assert.equal(readDrMeasurements(outside, species).VHS, '');
    assert.match(updateDrMeasurement(outside, 'VHS', '9', species), /복부\r\n- VHS: 12v/);
    const wrongKey = species === 'cat' ? 'VLAS' : 'VHW';
    assert.equal(updateDrMeasurement(original, wrongKey, '2', species), original);
  });
}
