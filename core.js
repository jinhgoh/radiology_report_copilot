(function (root) {
  'use strict';

  const keys = ['IVSd', 'LVDd', 'LVPWd', 'IVSs', 'LVDs', 'LVPWs'];

  // Stable keys and explicit units keep measurements usable by future calculations.
  const measurementFields = [
    ['wall', 'LV wall thickness', 'mm', 'B mode', 'cat'],
    ['laao', 'LA/Ao', '', 'B mode'],
    ['mpaao', 'MPA/Ao', '', 'B mode', 'dog'],
    ['rpad', 'RPAD index', '%', 'B mode', 'dog'],
    ['laDiameter', 'LA diameter max.', 'mm', 'B mode', 'cat'],
    ['laFs', 'LA FS', '%', 'B mode', 'cat'],
    ...keys.map(key => [key, key, 'cm', 'M mode']),
    ['fs', 'FS', '%', 'M mode'],
    ['jet', 'LA jet / LA ratio', '%', 'Doppler'],
    ['mr', 'MR peak velocity', 'm/s', 'Doppler'],
    ['tr', 'TR peak velocity', 'm/s', 'Doppler'],
    ['e', 'E peak velocity', 'm/s', 'Doppler'],
    ['eem', 'E/Em', '', 'Doppler'],
    ['eivrt', 'E/IVRT', '', 'Doppler', 'dog'],
    ['actet', 'PV flow AcT/ET', '', 'Doppler', 'dog'],
    ['ea', 'E/A', '', 'Doppler', 'cat'],
    ['ivrt', 'IVRT', 'ms', 'Doppler', 'cat'],
    ['aortic', 'Aortic outflow velocity', 'm/s', 'Doppler', 'cat'],
    ['appendage', 'LA appendage peak velocity', 'm/s', 'Doppler', 'cat'],
  ].map(([key, label, unit, group, species]) => ({ key, label, unit, group, species, optional: key === 'actet' || key === 'appendage' }));

  function optionalSlotAvailable(report, field) {
    return field?.optional && !report.includes(field.label) && /^3\. Doppler 평가\r?$/m.test(report);
  }

  const numericSlot = '(?:[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)?';
  const slotPatterns = {};

  function convertMModeValue(raw, from, to) {
    if (raw === null || raw === '' || from === to) return raw ?? '';
    const [value, exponent = '0'] = String(raw).toLowerCase().split('e');
    return String(Number(`${value}e${Number(exponent) + (to === 'mm' ? 1 : -1)}`));
  }

  function convertRange(range, from, to) {
    if (from === to) return range;
    return range.replace(/\d+(?:\.\d+)?/g, value => convertMModeValue(value, from, to));
  }

  function convertReportMModeUnit(report, unit) {
    const pattern = new RegExp(`^([ \\t]*-[ \\t]*(?:${keys.join('|')})[ \\t]*:)[ \\t]*(${numericSlot})[ \\t]*(mm|cm)?[ \\t]*\\(([\\d.]+-[\\d.]+|참고범위 없음|원본 확인 필요)\\)`, 'gm');
    return report.replace(pattern, (_, prefix, raw, previous = 'cm', range) =>
      `${prefix} ${convertMModeValue(raw, previous, unit)} ${unit} (${convertRange(range, previous, unit)})`);
  }

  function measurementUnit(report, match) {
    return /^[ \t]*mm\b/.test(report.slice(match.index + match[0].length)) ? 'mm' : 'cm';
  }

  function measurementPattern(key, species) {
    const cacheKey = `${species}:${key}`;
    if (slotPatterns[cacheKey]) return slotPatterns[cacheKey];
    // Derive labels from the original Korean template rather than duplicating them.
    const marker = '__MEASUREMENT__';
    const line = generateReport({ species, [key]: marker }).split('\n').find(line => line.includes(marker));
    if (!line) return null;
    let [prefix, suffix] = line.split(marker);
    // A second measurement on the same line starts after its comma.
    if (prefix.includes(',')) prefix = prefix.slice(prefix.lastIndexOf(',') + 1);
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ \t]+/g, '[ \\t]*');
    let end = suffix ? escape(suffix.split(',')[0]) : '[ \\t]*(?=\\r?$)';
    if (keys.includes(key)) end = '[ \\t]*(?:(?:cm|mm)[ \\t]*)?\\(';
    if (key === 'e') end = '[ \\t]*m/s,';
    if (key === 'ea') end = ',';
    if (key === 'appendage') end += '[ \\t]*\\r?$';
    return slotPatterns[cacheKey] = new RegExp(`(${prefix.startsWith(' ') && prefix.includes(':') && line.includes(',') ? ',' : '^'}${escape(prefix)})(${numericSlot})(?=${end})`, 'gm');
  }

  function readReportMeasurements(report, species) {
    const values = {};
    for (const field of measurementFields.filter(field => !field.species || field.species === species)) {
      const pattern = measurementPattern(field.key, species);
      pattern.lastIndex = 0;
      const matches = [...report.matchAll(pattern)];
      let raw = matches.length === 1 ? matches[0][2] : matches.length === 0 && optionalSlotAvailable(report, field) ? '' : null;
      // Core measurement values remain in cm for calculations, regardless of report display units.
      if (matches.length === 1 && keys.includes(field.key)) raw = convertMModeValue(raw, measurementUnit(report, matches[0]), 'cm');
      values[field.key] = { raw, value: raw === null || raw === '' ? null : Number(raw) };
    }
    return values;
  }

  function updateReportMeasurement(report, key, raw, species) {
    if (!new RegExp(`^${numericSlot}$`).test(raw) || (raw !== '' && !Number.isFinite(Number(raw)))) return report;
    const pattern = measurementPattern(key, species);
    if (!pattern) return report;
    pattern.lastIndex = 0;
    const matches = [...report.matchAll(pattern)];
    const field = measurementFields.find(field => field.key === key && (!field.species || field.species === species));
    if (matches.length === 0 && raw !== '' && optionalSlotAvailable(report, field)) {
      const line = generateReport({ species, [key]: raw }).split('\n').find(line => line.includes(field.label));
      return insertReportFinding(report, '3. Doppler 평가', line).report;
    }
    if (matches.length !== 1) return report;
    if (keys.includes(key)) raw = convertMModeValue(raw, 'cm', measurementUnit(report, matches[0]));
    if (field?.optional && raw === '') {
      const start = matches[0].index;
      const end = report.indexOf('\n', start);
      return report.slice(0, start) + (end < 0 ? '' : report.slice(end + 1));
    }
    return report.replace(pattern, (_, prefix) => prefix + raw);
  }

  // Fixed feline ranges supplied by the user; preserve their original precision.
  const catReference = {
    ranges: {
      IVSd: '0.3-0.6',
      LVDd: '1.08-2.14',
      LVPWd: '0.26-0.60',
      IVSs: '0.4-0.9',
      LVDs: '0.4-1.12',
      LVPWs: '0.43-0.98',
    },
  };

  function selectReference(weight, rows) {
    if (!Number.isFinite(weight) || weight < rows[0].weight || weight > rows.at(-1).weight) {
      return null;
    }

    return rows.reduce((best, row) => {
      const distance = Math.abs(row.weight - weight);
      const bestDistance = Math.abs(best.weight - weight);
      return distance < bestDistance - 1e-9 ? row : best;
    });
  }

  function validRange(raw) {
    const match = /^(\d+\.\d{3})-(\d+\.\d{3})$/.exec(raw);
    return !!match && Number(match[1]) > 0 && Number(match[2]) >= Number(match[1]);
  }

  function formatLviddn(lvdd, weight) {
    const diameter = Number(lvdd);
    const kg = Number(weight);
    if (!Number.isFinite(diameter) || diameter <= 0 || !Number.isFinite(kg) || kg < 0.5 || kg > 40) {
      return '';
    }

    return (diameter / kg ** 0.294).toFixed(3);
  }

  const reportTypes = {
    echo: { label: 'Echocardiography', filename: 'echocardiography', lang: 'ko' },
    abdominal: { label: 'Abdominal ultrasound', filename: 'abdominal_ultrasound', lang: 'ko' },
    dr: { label: 'DR', filename: 'dr', lang: 'en', title: 'DR (Digital radiography)', technique: ['Projections / positioning', 'Image quality / limitations'] },
    ct: { label: 'CT', filename: 'ct', lang: 'en', title: 'CT (Computed tomography)', technique: ['Acquisition / reconstructions', 'Contrast / phases', 'Image quality / limitations'] },
    mri: { label: 'MRI', filename: 'mri', lang: 'en', title: 'MRI (Magnetic resonance imaging)', technique: ['Sequences / planes', 'Contrast', 'Image quality / limitations'] },
    fluoroscopy: { label: 'Fluoroscopy', filename: 'fluoroscopy', lang: 'en', title: 'Fluoroscopy', technique: ['Procedure / positioning', 'Contrast', 'Dynamic assessment / maneuvers', 'Image quality / limitations'] },
  };

  function generateImagingReport(type) {
    const modality = reportTypes[type];
    if (!modality?.technique) throw new Error(`No imaging template for report type: ${type}`);
    return [
      modality.title, '',
      'Study region: ',
      'Clinical history / indication: ',
      'Comparison: ', '',
      'Technique',
      ...modality.technique.map(label => `- ${label}: `), '',
      'Findings', '- ', '',
      'Impression / differential diagnoses', '- ', '',
      'Recommendations', '- ', '',
      'by GJH',
    ].join('\n');
  }

  function generateAbdominalReport() {
    return [
      '복부 초음파',
      '간담도계',
      '- 특이소견 확인되지 않음',
      '소화기',
      '- 특이소견 확인되지 않음',
      '비뇨기',
      '- 특이소견 확인되지 않음',
      '비장, 내분비 림프절 ',
      '- 특이소견 확인되지 않음',
      '생식기',
      '- 특이소견 확인되지 않음',
      '기타',
      '- 특이소견 확인되지 않음',
      '',
      'DX and DDX)',
      '- ',
      '',
      'by GJH',
    ].join('\n');
  }

  function generateReport(values, row) {
    const getValue = key => String(values[key] ?? '').trim();
    const diagnosisLines = getValue('dx').split('\n').map(line => `- ${line.replace(/^[-]\s*/, '')}`);

    if (values.species === 'cat') {
      return [
        '심장 초음파',
        '1. B mode 평가',
        `- 이완기말 좌심실벽 두께 : ${getValue('wall')} mm`,
        `- LA/Ao ratio : ${getValue('laao')}`,
        `  > LA diameter max. ${getValue('laDiameter')} mm`,
        `  > LA FS ${getValue('laFs')} %`,
        '',
        '2. M mode 평가',
        ...keys.map(key => `- ${key}: ${getValue(key)} (${catReference.ranges[key]})`),
        `- FS: ${getValue('fs')}%`,
        '',
        '3. Doppler 평가',
        `- 좌심방와류/좌심방비 : ${getValue('jet')} %`,
        `- 이첨판 역류 peak velocity : ${getValue('mr')} m/s`,
        `- 삼첨판 역류 peak velocity : ${getValue('tr')} m/s`,
        `- E peak velocity : ${getValue('e')} m/s, E/Em ratio : ${getValue('eem')}`,
        `- E/A : ${getValue('ea')}, IVRT : ${getValue('ivrt')} ms`,
        `- 수축기 대동맥 유출로 속도 : ${getValue('aortic')} m/s`,
        ...(getValue('appendage') ? [`- LA appendage peak velocity : ${getValue('appendage')} m/s`] : []),
        '',
        '',
        'DX and DDX)',
        ...diagnosisLines,
        '',
        `by ${getValue('author')}`,
      ].join('\n');
    }

    const lines = [
      '심장 초음파',
      '1. B mode 평가',
      `- LA/Ao ratio : ${getValue('laao')}`,
      `- MPA/Ao ratio : ${getValue('mpaao')}`,
      `- RPAD index : ${getValue('rpad')}`,
      '',
      '2. M mode 평가',
    ];

    for (const key of keys) {
      const raw = row?.ranges[key];
      const range = !raw ? '참고범위 없음' : validRange(raw) ? raw : '원본 확인 필요';
      lines.push(`- ${key}: ${getValue(key)} (${range})`);
      if (key === 'LVDd') lines.push(`  > LVIDDN: ${formatLviddn(values.LVDd, values.weight)}`);
    }

    lines.push(
      `- FS: ${getValue('fs')}%`,
      '',
      '',
      '3. Doppler 평가',
      `- 좌심방와류/좌심방비 : ${getValue('jet')} %`,
      `- 이첨판 역류 peak velocity : 약 ${getValue('mr')} m/s`,
      `- 삼첨판 역류 peak velocity : 약 ${getValue('tr')} m/s`,
      `- E peak velocity : ${getValue('e')} m/s, E/Em ratio : ${getValue('eem')}`,
      `- E/IVRT : ${getValue('eivrt')}`,
      ...(getValue('actet') ? [`- PV flow AcT/ET : ${getValue('actet')}`] : []),
      '',
      '',
      'DX and DDX)',
      ...diagnosisLines,
      '',
      `by ${getValue('author')}`,
    );
    return lines.join('\n');
  }

  // Only replace template reference slots; leave measurements and other prose intact.

  function updateReportReferences(report, row, species) {
    const ranges = species === 'cat' ? catReference.ranges : row?.ranges;
    return report.replace(/^([ \t]*-[ \t]*(IVSd|LVDd|LVPWd|IVSs|LVDs|LVPWs)[ \t]*:[^\n(]*\()([\d.]+-[\d.]+|참고범위 없음|원본 확인 필요)(\))/gm,
      (match, prefix, key, previous, suffix) => {
        const raw = ranges?.[key];
        const range = !raw ? '참고범위 없음' : species === 'cat' || validRange(raw) ? raw : '원본 확인 필요';
        const unit = /\bmm[ \t]*\($/.test(prefix) ? 'mm' : 'cm';
        return prefix + convertRange(range, 'cm', unit) + suffix;
      });
  }

  function updateReportLviddn(report, weight, species) {
    if (species === 'cat') return report;
    const match = report.match(/^[ \t]*-[ \t]*LVDd[ \t]*:[ \t]*(\d+(?:\.\d+)?|\.\d+)[ \t]*(?:(cm|mm)[ \t]*)?(?:\(|$)/m);
    const diameter = match ? convertMModeValue(match[1], match[2] || 'cm', 'cm') : '';
    return report.replace(/^([ \t]*>[ \t]*LVIDDN:[ \t]*)[\d.]*[ \t]*$/gm,
      (_, prefix) => prefix + formatLviddn(diameter, weight));
  }

  // Insert into the existing draft, without regenerating measurements or prose.
  function insertReportFinding(report, heading, sentence) {
    const newline = report.includes('\r\n') ? '\r\n' : '\n';
    const lines = report.split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === heading);
    if (start < 0) return { report, status: 'missing-section' };
    const finding = sentence.trim();
    if (!finding) return { report, status: 'empty' };
    let end = start + 1;
    while (end < lines.length && !/^(?:\d+\.\s|DX and DDX\)|by\s)/.test(lines[end].trim())) end++;
    if (lines.slice(start + 1, end).some(line => line.trim() === finding)) {
      return { report, status: 'duplicate' };
    }
    while (end > start + 1 && !lines[end - 1].trim()) end--;
    lines.splice(end, 0, finding);
    return { report: lines.join(newline), status: 'added' };
  }
  function removeReportFinding(report, heading, sentence) {
    const newline = report.includes('\r\n') ? '\r\n' : '\n';
    const lines = report.split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === heading);
    if (start < 0) return { report, status: 'missing-section' };
    let end = start + 1;
    while (end < lines.length && !/^(?:\d+\.\s|DX and DDX\)|by\s)/.test(lines[end].trim())) end++;
    const kept = lines.slice(start + 1, end).filter(line => line.trim() !== sentence.trim());
    if (kept.length === end - start - 1) return { report, status: 'absent' };
    lines.splice(start + 1, end - start - 1, ...kept);
    return { report: lines.join(newline), status: 'removed' };
  }

  // Populate only with supplied clinical ranges, separately for each species.
  // Each band has severity, text, and optional min/max and minInclusive/maxInclusive.
  const measurementReferences = {
    dog: { rpad: {
      requireUniqueBand: true,
      bands: [
        { severity: 'normal', min: 30, text: '≥ 30%' },
        { severity: 'severe', min: 0, minInclusive: false, max: 22, maxInclusive: false, text: 'PH < 22%' },
        { severity: 'moderate', min: 23, minInclusive: false, max: 27, maxInclusive: false, text: '23% < PH < 27%' },
        { severity: 'mild', min: 35, minInclusive: false, max: 55, maxInclusive: false, text: '35% < PH < 55%' },
      ],
      note: 'normal≥30%\nSeverePH<22 | 23<moderatePH<27 | 35<mildPH<55\nPH = pulmonary hypertension. Supplied normal and mild PH ranges overlap at >35% and <55%; these values remain unclassified. Gaps and excluded boundaries also remain unclassified.',
    }, mpaao: {
      bands: [
        { severity: 'normal', min: 0, minInclusive: false, max: 1.0, text: '≤ 1.0' },
      ],
      note: 'normal≤1.0 | 1.0초과시 PH의심지표+\nPH = pulmonary hypertension. MPA/Ao > 1.0: indicator of suspected pulmonary hypertension.',
    }, laao: {
      bands: [
        { severity: 'normal', min: 0, minInclusive: false, max: 1.3, maxInclusive: false, text: '< 1.3' },
        { severity: 'mild', min: 1.3, max: 1.7, maxInclusive: false, text: '1.3 ≤ LA/Ao < 1.7' },
        { severity: 'moderate', min: 1.7, max: 2.4, maxInclusive: false, text: '1.7 ≤ LA/Ao < 2.4' },
        { severity: 'severe', min: 2.4, text: '≥ 2.4' },
      ],
      note: '(1.9초과시 심부전의심)',
    } },
    cat: { laFs: {
      bands: [
        { severity: 'low', min: 0, minInclusive: false, max: 15.9, text: '≤ 15.9%' },
        { severity: 'ambiguous', min: 15.9, minInclusive: false, max: 29.0, text: '> 15.9–29.0%' },
        { severity: 'normal', min: 29.0, minInclusive: false, text: '> 29.0%' },
      ],
      note: 'Supplied ranges: Healthy 15.9-36.1%; HCM(asym) 7.4-29.0%; HCM(chf) 6.4-26.6%.\nLabels follow the supplied interpretation, with 15.9% assigned to low. The group ranges overlap; these labels are not a diagnosis. Values above 36.1% exceed the supplied Healthy range.',
    }, laao: {
      bands: [
        { severity: 'normal', min: 0, minInclusive: false, max: 1.5, maxInclusive: false, text: '< 1.5' },
      ],
      note: 'LA size가 더 중요. 16mm 이상이면 안좋은\nLA/Ao ≥ 1.5: severity grades not supplied.',
    } },
  };

  function classifyMeasurement(value, reference) {
    if (!Number.isFinite(value)) return null;
    const matches = (reference?.bands || []).filter(band =>
      ['normal', 'mild', 'moderate', 'severe', 'low', 'ambiguous'].includes(band.severity) &&
      (band.min !== undefined || band.max !== undefined) &&
      (band.min === undefined || (band.minInclusive === false ? value > band.min : value >= band.min)) &&
      (band.max === undefined || (band.maxInclusive === false ? value < band.max : value <= band.max)));
    // Gaps and overlapping bands must never produce a guessed classification.
    return matches.length === 1 ? matches[0].severity : null;
  }

  function measurementReferenceText(reference, species) {
    const name = species === 'cat' ? 'Cat' : 'Dog';
    if (!reference?.bands?.length) return reference?.note || `${name}: reference ranges have not been supplied yet.`;
    return `${name} reference ranges\n` + reference.bands.map(band => `${band.severity}: ${band.text}`).join('\n') +
      (reference.note ? `\n${reference.note}` : '');
  }

  function measurementRangeStatus(value, reference) {
    if (!Number.isFinite(value) || value <= 0) return null;
    if (reference?.requireUniqueBand && classifyMeasurement(value, reference) === null) return null;
    if (reference?.bands?.some(band => ['low', 'ambiguous'].includes(band.severity))) {
      return classifyMeasurement(value, reference);
    }
    const normal = reference?.bands?.filter(band => band.severity === 'normal');
    if (normal?.length !== 1) return null;
    const band = normal[0];
    if (band.min !== undefined && (band.minInclusive === false ? value <= band.min : value < band.min)) return 'low';
    if (band.max !== undefined && (band.maxInclusive === false ? value >= band.max : value > band.max)) return 'high';
    return band.min !== undefined || band.max !== undefined ? 'normal' : null;
  }

  function mModeReference(key, species, row, unit = 'cm') {
    if (!keys.includes(key)) return null;
    const raw = (species === 'cat' ? catReference : row)?.ranges[key];
    if (!raw) return { bands: [], note: 'Enter a weight between 0.5 and 40 kg to select reference ranges.' };
    if (species !== 'cat' && !validRange(raw)) return { bands: [], note: 'Check source: this reference range is unavailable for classification.' };
    const [min, max] = raw.split('-').map(Number);
    return {
      bands: [{ severity: 'normal', min, max, text: `${convertRange(raw, 'cm', unit)} ${unit}` }],
      note: species === 'cat' ? 'Fixed feline reference range.' : `Reference weight: ${row.weight} kg.`,
    };
  }

  const api = {
    reportTypes,
    generateImagingReport,
    generateAbdominalReport,
    mModeReference,
    measurementRangeStatus,
    measurementReferences,
    classifyMeasurement,
    measurementReferenceText,
    convertMModeValue,
    convertReportMModeUnit,
    measurementFields,
    readReportMeasurements,
    updateReportMeasurement,
    keys,
    catReference,
    selectReference,
    validRange,
    formatLviddn,
    generateReport,
    updateReportReferences,
    updateReportLviddn,
    insertReportFinding,
    removeReportFinding,
  };

  if (typeof module !== 'undefined') module.exports = api;
  else root.EchoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
