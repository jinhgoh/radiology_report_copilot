(function (root) {
  'use strict';

  const keys = ['IVSd', 'LVDd', 'LVPWd', 'IVSs', 'LVDs', 'LVPWs'];

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
        `- LA appendage peak velocity : ${getValue('appendage')} m/s`,
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
      `- PV flow AcT/ET : ${getValue('actet')}`,
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
        return prefix + range + suffix;
      });
  }

  function updateReportLviddn(report, weight, species) {
    if (species === 'cat') return report;
    const diameter = report.match(/^[ \t]*-[ \t]*LVDd[ \t]*:[ \t]*(\d+(?:\.\d+)?|\.\d+)[ \t]*(?:cm[ \t]*)?(?:\(|$)/m)?.[1];
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
  const api = {
    keys,
    catReference,
    selectReference,
    validRange,
    formatLviddn,
    generateReport,
    updateReportReferences,
    updateReportLviddn,
    insertReportFinding,
  };

  if (typeof module !== 'undefined') module.exports = api;
  else root.EchoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
