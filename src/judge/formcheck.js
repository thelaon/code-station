
(function (root, factory) {
  const api = factory(
    typeof module === 'object' && module.exports ? require('./faults.js') : root.JudgeFaults
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeFormCheck = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (F) {
  'use strict';

  function formCheck(studentSrc, originalSrc, faults) {
    const s = splitLines(studentSrc);
    const o = splitLines(originalSrc);
    const faultLines = new Set((faults || []).map(f => f.line));
    const res = {
      ok: true, errors: [], warnings: [],
      lineCount: { student: s.length, original: o.length },
      changed: [], outsideFaultLines: [], unmarked: [],
      faultLines: [...faultLines].sort((a, b) => a - b),   
    };

    if (s.length !== o.length) {
      const d = s.length - o.length;
      const msg = '行数与原题不一致（原题 %d 行，你交了 %d 行，%s %d 行）'
        .replace('%d', o.length).replace('%d', s.length)
        .replace('%s', d > 0 ? '多了' : '少了').replace('%d', Math.abs(d));
      res.errors.push(msg + '——本题型要求「只改不删」，请把删掉的行补回来。');
      res.ok = false;
    }

    const diffs = F.diffLines(s, o);
    for (const d of diffs) {
      res.changed.push(d.line);
      if (!faultLines.has(d.line)) res.outsideFaultLines.push(d.line);
      if (!d.marked) res.unmarked.push(d.line);
    }

    if (res.outsideFaultLines.length) {
      res.warnings.push('第 ' + res.outsideFaultLines.join('、') +
        ' 行有改动，但这些行不是题目标注的出错行——这些改动不计分（也可能是你把行改错了位置）。');
    }
    if (res.unmarked.length) {
      res.warnings.push('第 ' + res.unmarked.join('、') +
        ' 行改了但没有在所修改语句后加注释标记（考纲要求加 /*_*/ 或 //_ 形式的注释，' +
        '内容不限；阅卷时会看这一行改过没有）。');
    }
    if (res.changed.length === 0) {
      res.warnings.push('你一行都没改。');
    }
    return res;
  }

  function splitLines(src) {
    const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines;
  }

  return { formCheck, splitLines };
});
