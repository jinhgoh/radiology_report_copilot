(function (root) {
  'use strict';

  const fields = {
    laao: ['LA/Ao', ''], LVDd: ['LVDd', 'cm'], lviddn: ['LVIDDN', ''],
    jet: ['LA jet / LA ratio', '%'], e: ['E peak velocity', 'm/s'],
    eem: ['E/Em (source E/E′)', ''], eivrt: ['E/IVRT', ''], ivrt: ['IVRT', 'ms'],
    tr: ['TR peak velocity', 'm/s'], mpaao: ['MPA/Ao', ''], rpad: ['RPAD index', '%'],
    actet: ['PV flow AcT/ET', ''], laDiameter: ['LA diameter max.', 'mm'],
    laFs: ['LA FS', '%'], appendage: ['LA appendage peak velocity', 'm/s'], ea: ['E/A', ''],
  };

  // Values come from the report parser: M-mode dimensions are always in cm.
  // Zero is meaningful for fractional shortening and jet area, but not velocities or dimensions.
  function numeric(values, key) {
    const value = values[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const percentage = ['jet', 'laFs', 'rpad'].includes(key);
    if (value < 0 || (!['jet', 'laFs'].includes(key) && value === 0) || (percentage && value > 100)) return null;
    return value;
  }

  function display(value, unit = '') {
    return value === null ? 'Missing / unavailable' : `${Number(value.toFixed(4))}${unit ? ` ${unit}` : ''}`;
  }

  function row(values, key, criterion, predicate) {
    const value = numeric(values, key);
    const [label, unit] = fields[key];
    const met = value === null ? null : predicate(value);
    return { key, label, value: display(value, unit), criterion,
      result: met === null ? 'Needs input' : met ? 'Met' : 'Not met',
      state: met === null ? 'missing' : met ? 'met' : 'not-met', met };
  }

  function unresolved(label, criterion, result, value = 'Not available') {
    return { label, value, criterion, result, state: 'unresolved', met: null };
  }

  function grade(values, key, criterion, classify) {
    const value = numeric(values, key);
    const [label, unit] = fields[key];
    const result = value === null ? 'Needs input' : classify(value);
    return { key, label, value: display(value, unit), criterion, result,
      state: value === null ? 'missing' : ['Mild', 'Moderate', 'Severe'].includes(result) ? result.toLowerCase() : 'unresolved' };
  }

  function matchedSummary(rows, label) {
    const supplied = rows.filter(item => item.met !== null);
    if (!supplied.length) return `Enter measurements to evaluate ${label}.`;
    return `${rows.filter(item => item.met === true).length}/${rows.length} ${label} met${supplied.length < rows.length ? `; ${rows.length - supplied.length} need input` : ''}.`;
  }

  function mmvd(values, weight) {
    const lvdd = numeric(values, 'LVDd');
    const lviddn = Number.isFinite(weight) && weight >= 0.5 && weight <= 40 && lvdd !== null
      ? lvdd / weight ** 0.294 : null;
    const stageRows = [
      row(values, 'laao', '≥ 1.6', value => value >= 1.6),
      row({ lviddn }, 'lviddn', '≥ 1.7 (calculated from LVDd and actual weight)', value => value >= 1.7),
    ];
    const severityRows = [
      unresolved('LA jet / LA ratio', 'Source: Mild 30; Moderate 30–70%; Severe 70%',
        'Mild/severe inequality signs are unspecified', display(numeric(values, 'jet'), '%')),
      grade(values, 'e', 'Mild <1; Moderate 1–1.2; Severe >1.2 m/s', value => value < 1 ? 'Mild' : value <= 1.2 ? 'Moderate' : 'Severe'),
      unresolved('IVRT', 'Mild >45; Moderate >45; Severe <45 ms', 'Not collected in the canine template; mild/moderate overlap'),
      grade(values, 'eivrt', 'Mild <2; Moderate 2–2.5; Severe >2.5', value => value < 2 ? 'Mild' : value <= 2.5 ? 'Moderate' : 'Severe'),
      grade(values, 'eem', 'Mild <6; Moderate 6–9.1; Severe >9.1', value => value < 6 ? 'Mild' : value <= 9.1 ? 'Moderate' : 'Severe'),
    ];
    const pressureRows = [
      row(values, 'e', '> 1.25 m/s', value => value > 1.25),
      row(values, 'eem', '> 12', value => value > 12),
      row(values, 'eivrt', '> 2.5', value => value > 2.5),
      unresolved('IVRT', '< 45 ms', 'Not collected in the canine template'),
    ];
    return {
      id: 'mmvd', title: 'MMVD severity',
      summary: matchedSummary(stageRows, 'available B2 echo criteria') + ' Clinical stage is not assigned.',
      groups: [
        { title: 'Stage B2 criteria', rows: [...stageRows,
          unresolved('VHS / VLAS', 'VHS >10.5; VLAS ≥3', 'Not collected by this app')] },
        { title: 'Severity by parameter', rows: severityRows },
        { title: 'LA pressure indicators', rows: pressureRows },
      ],
      notes: ['Individual parameter grades are shown separately; the source supplies no rule for combining discordant grades.',
        'MMVD diagnosis, clinical signs/CHF history, and radiographic criteria require clinician assessment. B1, B2 and C cannot be distinguished from these numbers alone.',
        'E/Em is mapped to the source E/E′. Use the corresponding tissue Doppler measurement; E/IVRT is the entered ratio, not recalculated.'],
    };
  }

  function phProbability(tr, sites) {
    // At the shared 3.0 boundary, the explicit ≤3.0 source row takes precedence.
    if (tr <= 3) return sites >= 3 ? 'High' : sites === 2 ? 'Intermediate' : 'Low';
    if (tr <= 3.4) return sites >= 2 ? 'High' : 'Intermediate';
    return sites >= 1 ? 'High' : 'Intermediate';
  }

  function ph(values) {
    const paRows = [row(values, 'mpaao', '> 1.0', value => value > 1),
      row(values, 'rpad', '< 30%', value => value < 30)];
    const paPositive = paRows.some(item => item.met === true);
    const minimumSites = paPositive ? 1 : 0;
    const tr = numeric(values, 'tr');
    const possibilities = tr === null ? [] : [...new Set(Array.from({ length: 4 - minimumSites }, (_, index) => phProbability(tr, minimumSites + index)))];
    const summary = tr === null ? 'Enter TR peak velocity to evaluate PH probability.'
      : possibilities.length === 1 ? `${possibilities[0]} PH probability from the available evidence.`
        : `PH probability unresolved: ${possibilities.join(' / ')} remain possible.`;
    return { id: 'ph', title: 'PH severity / probability', summary,
      probability: possibilities.length === 1 ? possibilities[0] : null, possibilities, minimumSites,
      groups: [{ title: 'Available PH measurements', rows: [
        { label: 'TR peak velocity', value: display(tr, 'm/s'), criterion: '≤3.0 / >3.0–3.4 / >3.4 m/s',
          result: tr === null ? 'Needs input' : tr <= 3 ? '≤3.0 group' : tr <= 3.4 ? '>3.0–3.4 group' : '>3.4 group', state: tr === null ? 'missing' : 'info' },
        ...paRows,
        unresolved('PV flow AcT/ET', 'Source AT:ET <30', 'Source scale/unit needs confirmation', display(numeric(values, 'actet'))),
      ] }, { title: 'Anatomical sites', rows: [
        unresolved('1. Ventricles', 'IVS flattening, RV changes, selected LV findings', 'Not assessed by the available numeric inputs'),
        { label: '2. Pulmonary artery', value: paPositive ? 'At least one indicator met' : 'No positive available indicator',
          criterion: 'MPA/Ao >1.0 or RPAD <30%', result: paPositive ? 'One site supported' : 'Unknown; other PA signs are not collected', state: paPositive ? 'met' : 'missing' },
        unresolved('3. RA / CaVC', 'RA or caudal vena cava enlargement', 'Not assessed by the available numeric inputs'),
      ] }],
      notes: ['The source table reports PH probability, not a mild/moderate/severe pressure grade. Multiple positive PA measurements count as one anatomical site.',
        'Missing sites are unknown, not negative. A blank TR value is not assumed to mean “not measurable”. Exactly 3.0 m/s uses the source ≤3.0 group.',
        'The source also lists PR velocity, RV outflow AT and notching; these are not collected. LV underfilling is not applicable in dogs with group 2 PH.'],
    };
  }

  function hcm(values) {
    const stageRows = [row(values, 'laao', '> 1.5', value => value > 1.5),
      row(values, 'laDiameter', '> 15 mm', value => value > 15)];
    const secRows = [row(values, 'laFs', '< 20%', value => value < 20),
      row(values, 'appendage', '< 0.25 m/s (source <25 cm/s)', value => value < 0.25)];
    return { id: 'hcm', title: 'HCM severity',
      summary: matchedSummary(stageRows, 'available B2 LA criteria') + ' Clinical stage requires morphology and history.',
      groups: [{ title: 'Source Stage B2 criteria', rows: stageRows },
      { title: 'SEC possibility indicators', rows: secRows }],
      notes: ['HCM diagnosis and clinical stage require morphology and clinical history. These checks alone do not establish HCM or B2.',
        'SEC indicators are shown independently; neither a positive nor negative indicator establishes whether SEC is present.'],
    };
  }

  const diastolicPatterns = [
    ['Normal', ['1–1.3', '34–52 ms', '<10'], [v => v >= 1 && v <= 1.3, v => v >= 34 && v <= 52, v => v < 10]],
    ['Normal filling pressure (Stage 1a)', ['<1', '>60 ms', '<10'], [v => v < 1, v => v > 60, v => v < 10]],
    ['Elevated LV filling pressure', ['<1', '>60 ms', '>10'], [v => v < 1, v => v > 60, v => v > 10]],
    ['Pseudonormal diastole (Stage 2)', ['=1', '37–60 ms', '>10'], [v => v === 1, v => v >= 37 && v <= 60, v => v > 10]],
    ['Restrictive diastole (Stage 3)', ['>2', '<37 ms', '>10'], [v => v > 2, v => v < 37, v => v > 10]],
  ];

  function diastolic(values, species) {
    const available = species === 'cat' ? values : { eem: values.eem };
    const groups = diastolicPatterns.map(([title, criteria, predicates]) => ({ title,
      rows: ['ea', 'ivrt', 'eem'].map((key, index) => row(available, key, criteria[index], predicates[index])) }));
    const matches = groups.filter(group => group.rows.every(item => item.met === true)).map(group => group.title);
    const missing = ['ea', 'ivrt', 'eem'].filter(key => numeric(available, key) === null);
    return { id: 'diastolic', title: 'Diastolic dysfunction', matches,
      summary: missing.length ? `Incomplete: ${missing.map(key => fields[key][0]).join(', ')} required.`
        : matches.length === 1 ? `Matches the source pattern: ${matches[0]}.`
          : 'No single source pattern matches all three measurements.', groups,
      notes: ['A pattern requires all three criteria; discordant measurements are not forced into a stage. E/E′ =10 and other gaps are left unmatched.',
        'E/Em is mapped to E/E′. The source table does not specify species or acquisition conditions; interpret the pattern in clinical context.',
        ...(species === 'dog' ? ['The current canine template does not collect E/A or IVRT, so a complete diastolic pattern cannot be evaluated.'] : [])],
    };
  }

  function compareSecRanges(value, positive, negative) {
    const inPositive = value !== null && value >= positive[0] && value <= positive[1];
    const inNegative = value !== null && value >= negative[0] && value <= negative[1];
    return value === null ? 'Needs input' : inPositive && inNegative ? 'Within both reported group ranges'
      : inPositive ? 'Within the reported SEC+ range only' : inNegative ? 'Within the reported SEC− range only'
        : 'Outside both reported group ranges';
  }

  function sec(values) {
    const fs = numeric(values, 'laFs');
    const diameterMm = numeric(values, 'laDiameter');
    const diameterCm = diameterMm === null ? null : diameterMm / 10;
    return { id: 'sec', title: 'Cats with / without SEC',
      summary: 'Descriptive group comparison; SEC presence cannot be predicted from this table.',
      groups: [{ title: 'Significantly different parameters in Cats w/ or w/o SEC', rows: [
        { label: 'LA max', value: diameterCm === null ? display(null) : `${display(diameterCm, 'cm')} (${display(diameterMm, 'mm')})`,
          criterion: 'SEC+: 2.4 (1.3–3.1) cm; SEC−: 1.9 (1.3–3.2) cm',
          result: compareSecRanges(diameterCm, [1.3, 3.1], [1.3, 3.2]), state: diameterCm === null ? 'missing' : 'info' },
        { label: 'LA FS', value: display(fs, '%'), criterion: 'SEC+: 10 (0–37)%; SEC−: 20 (1–45)%',
          result: compareSecRanges(fs, [0, 37], [1, 45]), state: fs === null ? 'missing' : 'info' },
      ] }],
      notes: ['LA max group values use cm, as clarified by the user; the app converts the LA diameter input from mm.',
        'The supplied group values and ranges are preserved. They are not diagnostic cutoffs, and no p-values or individual prediction rule are supplied.',
        'SEC presence remains an imaging finding entered by the clinician. A measurement in only one reported group range does not establish SEC status.'],
    };
  }

  function evaluateMeasurements({ species, values = {}, weight = null }) {
    if (species === 'dog') return [mmvd(values, weight), ph(values), diastolic(values, species)];
    if (species === 'cat') return [hcm(values), diastolic(values, species), sec(values)];
    return [];
  }

  const api = { evaluateMeasurements };
  if (typeof module !== 'undefined') module.exports = api;
  else root.EchoEvaluations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
