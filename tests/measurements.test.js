const { test } = require('node:test');
const assert = require('node:assert/strict');
const { measurementFields, generateReport, readReportMeasurements, updateReportMeasurement, updateReportLviddn } = require('../core');

for (const species of ['dog', 'cat']) {
  test(`${species}: every measurement supports entry, numeric reading and clearing`, () => {
    let report = generateReport({ species, dx: 'Preserve notes', author: 'Author' });
    const fields = measurementFields.filter(field => !field.species || field.species === species);
    for (const field of fields) {
      assert.equal(readReportMeasurements(report, species)[field.key].raw, '', field.key);
      const next = updateReportMeasurement(report, field.key, '1.250', species);
      assert.notEqual(next, report, field.key);
      assert.deepEqual(readReportMeasurements(next, species)[field.key], { raw: '1.250', value: 1.25 }, field.key);
      assert.equal(updateReportMeasurement(next, field.key, '', species), report, field.key);
      report = next;
    }
    assert.ok(report.endsWith('DX and DDX)\n- Preserve notes\n\nby Author'));
    for (const field of fields) assert.equal(readReportMeasurements(report, species)[field.key].value, 1.25, field.key);
  });
}

test('synchronization preserves other values, references and CRLF', () => {
  const report = generateReport({ species: 'dog', e: '.8', eem: '7', LVDd: '2.2' }).replaceAll('\n', '\r\n');
  const next = updateReportMeasurement(report, 'eem', '8.5', 'dog');
  assert.equal(next, report.replace('E/Em ratio : 7', 'E/Em ratio : 8.5'));
  assert.equal(readReportMeasurements(next, 'dog').e.value, .8);
  assert.match(updateReportLviddn(next, '4.2', 'dog'), /LVIDDN: 1.443/);
});

test('unavailable, ambiguous and nonnumeric report slots do not overwrite prose', () => {
  for (const report of ['Custom notes', '- LA/Ao ratio : unknown', '- LA/Ao ratio : 1\n- LA/Ao ratio : 2']) {
    assert.equal(readReportMeasurements(report, 'dog').laao.value, null);
    assert.equal(updateReportMeasurement(report, 'laao', '1.5', 'dog'), report);
  }
  const report = generateReport({});
  for (const value of ['NaN', 'Infinity', 'notes', '1e999']) assert.equal(updateReportMeasurement(report, 'laao', value, 'dog'), report);
  assert.equal(readReportMeasurements('- LVDd: 2.2 cm (1-2)', 'dog').LVDd.value, 2.2);
});

for (const [species, key, label] of [['dog', 'actet', 'PV flow AcT/ET'], ['cat', 'appendage', 'LA appendage peak velocity']]) {
  test(`${species}: optional measurement is omitted, inserted and removed without changing notes`, () => {
    const report = generateReport({ species, dx: 'Keep diagnosis', author: 'Author' }).replaceAll('\n', '\r\n');
    assert.ok(!report.includes(label));
    assert.equal(readReportMeasurements(report, species)[key].raw, '');
    const filled = updateReportMeasurement(report, key, '0', species);
    assert.ok(filled.includes(label));
    assert.equal(readReportMeasurements(filled, species)[key].value, 0);
    assert.equal(updateReportMeasurement(filled, key, '', species), report);
    assert.ok(generateReport({ species, [key]: '1.2' }).includes(label));
    assert.equal(updateReportMeasurement('Custom notes', key, '1.2', species), 'Custom notes');
    const invalid = `${report}\r\n- ${label} : unknown`;
    assert.equal(readReportMeasurements(invalid, species)[key].raw, null);
    assert.equal(updateReportMeasurement(invalid, key, '1.2', species), invalid);
  });
}
