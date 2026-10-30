
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeTests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NOISE = [
    /^Press any key to continue\s*\.*\s*$/gim,
    /^\s*$/,           
  ];

  function normalize(out) {
    let s = String(out == null ? '' : out).replace(/\r\n?/g, '\n');
    for (const re of NOISE) s = s.replace(re, '');
    return s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n')
            .replace(/\n+$/, '');
  }

  function flat(s) {
    return normalize(s).replace(/\s+/g, ' ').trim();
  }

  function compare(test, actual) {
    const exp = String(test.expect == null ? '' : test.expect);
    const act = normalize(actual);
    
    const mode = test.compare || (test.source === '人工验算' || test.source === 'hand'
      ? 'exact' : 'contains');

    if (mode === 'exact') {
      const ok = flat(exp) === flat(act);
      return { pass: ok, mode, expect: exp, actual: act,
               reason: ok ? '' : '期望与实际不完全一致（本测试点的期望值是独立算出来的，必须逐字相同）' };
    }
    if (mode === 'skip_prompt') {
      const ok = flat(act).indexOf(flat(exp)) >= 0;
      return { pass: ok, mode, expect: exp, actual: act,
               reason: ok ? '' : '在（忽略提示语后的）实际输出里找不到期望结果' };
    }
    
    const e = flat(exp), a = flat(act);
    if (!e) return { pass: false, mode: 'contains', expect: exp, actual: act,
                     reason: '这个测试点没有期望值（数据缺失），无法判定' };
    const ok = a.indexOf(e) >= 0;
    return { pass: ok, mode: 'contains', expect: exp, actual: act,
             reason: ok ? '' : '实际输出里找不到期望结果' };
  }

  return { compare, normalize, flat };
});
