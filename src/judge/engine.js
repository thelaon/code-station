
(function (root, factory) {
  const deps = typeof module === 'object' && module.exports
    ? { F: require('./faults.js'), FC: require('./formcheck.js'),
        D: require('./diagnostics.js'), T: require('./tests.js') }
    : { F: root.JudgeFaults, FC: root.JudgeFormCheck,
        D: root.JudgeDiagnostics, T: root.JudgeTests };
  const api = factory(deps);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';
  const F = deps.F, FC = deps.FC, D = deps.D, T = deps.T;

  const VERDICT_TEXT = {
    pass: '全对',
    partial: '部分改对',
    fail: '未改对',
    unknown: '无法判定',
  };

  async function judge(q, studentSrc, env, opts) {
    const o = opts || {};
    const preset = o.preset || null;
    const timeoutMs = o.timeoutMs || 3000;
    const faults = q.faults || [];
    const errorCount = q.errorCount || faults.length;

    const perFault = Number(q.fixPer) > 0 ? Number(q.fixPer) : 10;

    const quirks = q.quirks || {};
    const unjudgeable = quirks.unjudgeable || null;

    const result = {
      id: q.id,
      verdict: 'unknown',
      verdictText: '',
      fixed: 0, total: errorCount, totalScore: perFault * errorCount, score: 0,
      L1: null, L2: null, L3: null, L4: null,
      notes: [], warnings: [],
    };
    if (quirks.encodingSensitive) result.warnings.push(quirks.encodingSensitive);
    if (unjudgeable) result.warnings.push(unjudgeable.reason);

    let l1 = FC.formCheck(studentSrc, q.original, faults);
    if (preset && preset.L1) l1 = preset.L1;
    result.L1 = l1;
    for (const w of l1.warnings) result.warnings.push(w);
    for (const e of l1.errors) result.notes.push(e);

    const studentLines = FC.splitLines(studentSrc);
    let l4;
    if (preset && preset.L4) {
      l4 = preset.L4;
      for (const r of l4) if (r.ok) result.fixed++;
    } else {
      l4 = [];
      for (const f of faults) {
        const cand = studentLines[f.line - 1];
        let r;
        if (cand === undefined) {
          r = { ok: false, why: '这一行不存在（原题第 ' + f.line + ' 行）', line: f.line };
        } else {

          const c = F.checkFix(cand, f, { accept: f.accept });
          r = { ok: c.ok, why: c.why, line: f.line };
        }
        r.original = f.original;
        r.fixed = f.fixed;
        r.reason = f.reason || '';
        r.student = cand === undefined ? '' : cand;
        r.marked = cand !== undefined && F.stripMarker(cand).marked;
        l4.push(r);
        if (r.ok) result.fixed++;
      }
    }
    result.L4 = l4;
    result.score = result.fixed * perFault;

    if (l1.outsideFaultLines.length) {
      result.notes.push('你还在第 ' + l1.outsideFaultLines.join('、') +
        ' 行动了代码，这些行不是题目标注的出错行。');
    }

    let comp;
    try {
      comp = await env.compile(studentSrc);
    } catch (e) {
      comp = { ok: false, diagnostics: '编译环境异常。', errorInfo:D.errorDetails(e) || {code:'compiler_environment',phase:'compiler',symbols:[]} };
    }
    if (o.debug) console.log('[engine] comp =', comp && Object.keys(comp), 'ok=', comp && comp.ok,
      'diagLen=', comp && (comp.diagnostics || '').length);    const cls = D.classify(comp.diagnostics || '', comp.errorInfo);
    result.L2 = {
      ok: !!comp.ok,
      diagnostics: comp.diagnostics || '',
      errorInfo: comp.errorInfo || null,
      verdict: comp.ok ? 'ok' : cls.verdict,   
      reason: comp.ok ? '' : cls.reason,
      items: cls.items,
      libcGaps: D.libcGapsIn(studentSrc),
      risks: D.riskScan(q.original).filter(r => comp.executionEncoding !== 'gbk' || r.kind !== 'cjk_in_source'),
      executionEncoding:comp.executionEncoding || 'utf-8',
    };

    if (unjudgeable && unjudgeable.scope === 'compile' && !comp.ok) {
      result.L2.verdict = 'tool';
      result.L2.reason = unjudgeable.reason;
    }
    if (result.L2.libcGaps.length) {
      result.warnings.push('源码用到了 ' + result.L2.libcGaps.join('、') +
        '，这些函数在 TCC 侧要么缺失、要么需要显式声明，判分前请留意。');
    }

    const tests = q.tests || [];
    if (!comp.ok) {
      result.L3 = {
        available: false,
        reason: result.L2.reason || '编译未通过，当前运行结果尚未验证。',
        toolLimited: result.L2.verdict === 'tool' || result.L2.verdict === 'env',
        cases: [], passed: 0, total: tests.length, allPassed: false,
      };
    } else if (!tests.length) {

      result.L3 = {
        available: false,
        reason: unjudgeable ? unjudgeable.reason : '本题没有可用的运行示例，无法对拍',
        toolLimited: !!unjudgeable,
        cases: [], passed: 0, total: 0,
      };
    } else {
      const cases = [];
      let passed = 0;
      for (let i = 0; i < tests.length; i++) {
        const c = tests[i];
        let run;
        try {
          run = await env.run(comp.artifact, { stdin: c.stdin || '', timeoutMs });
        } catch (e) {
          run = { rc: -1, stdout: '', stderr: '', aborted: false,
                  error: (e && e.message) ? e.message : String(e), errorInfo:D.errorDetails(e) };
        }
        let verdict;
        if (run.aborted) {
          verdict = { pass: false, mode: c.compare || 'contains', expect: c.expect,
                      actual: run.stdout || '', reason: '超时被中断（疑似死循环）' };
        } else if (run.error) {
          const failure = D.classifyRuntime(run.errorInfo, run.error);
          run.errorCategory = failure.verdict;
          run.debugError = run.debugError || String(run.error);
          run.error = failure.reason;
          verdict = { pass: false, mode: c.compare || 'contains', expect: c.expect,
                      actual: run.stdout || '', reason: failure.reason };
        } else {
          verdict = T.compare(c, run.stdout || '');
        }
        if (verdict.pass) passed++;
        cases.push({
          index: i + 1, stdin: c.stdin || '', expect: c.expect, actual: run.stdout || '',
          rc: run.rc, aborted: !!run.aborted, error: run.error || '',
          errorInfo:run.errorInfo || null, errorCategory:run.errorCategory || '', debugError:run.debugError || '',
          pass: verdict.pass, mode: verdict.mode, reason: verdict.reason,
          source: c.source || '',
        });
      }
      const limited = cases.some(c => c.errorCategory === 'tool' || c.errorCategory === 'env');
      result.L3 = {
        available: true, reason: limited ? '运行库或运行环境受限，本次运行结果尚未验证。' : '', toolLimited: limited,
        cases, passed, total: tests.length,
        allPassed: tests.length > 0 && passed === tests.length,
      };
      if (result.L3.cases.some(c => c.aborted)) {
        result.warnings.push('有测试点运行超时被中断（可能是死循环）。');
      }
    }

    if (result.L4.some(r => r.ok) && result.L4.every(r => r.ok)) {
      result.verdict = 'pass';
    } else if (result.fixed > 0) {
      result.verdict = 'partial';
    } else {
      result.verdict = 'fail';
    }
    if (result.L2.verdict === 'tool') {
      
      if (result.L4.length && result.L4.every(r => r.ok)) {
        result.verdict = 'pass';
      } else {
        result.verdict = result.fixed > 0 ? 'partial' : 'unknown';
      }
      result.notes.push(unjudgeable
        ? ('本题已登记为「无法用运行结果判分」：' + unjudgeable.reason + '当前结论只依据「逐处核对」。')
        : ('编译器不支持本题的 C 构造，无法用运行结果确认；当前结论只依据「逐处核对」。'));
    } else if (result.L3.toolLimited) {
      result.notes.push('本次运行受工具或环境限制，运行结果尚未验证；当前得分仍依据逐处核对。');
    } else if (result.L3.available && result.L3.total > 0) {
      if (result.verdict === 'pass' && !result.L3.allPassed) {
        result.notes.push('逐处核对显示 N 处都改对了，但程序运行结果与期望不符（' +
          result.L3.passed + '/' + result.L3.total + ' 通过）。' +
          '可能是改法等价但语义不同，也可能是本机编译器的问题（已知 2015-D卷 有一例误编译）。');
      } else if (result.verdict !== 'pass' && result.L3.allPassed) {
        result.notes.push('程序运行结果全部正确（' + result.L3.passed + '/' + result.L3.total +
          '），但还有错误点没改对——本题型按"改对几处"给分，请注意。');
      }
    }

    result.verdictText = VERDICT_TEXT[result.verdict] || result.verdict;
    result.summary = result.fixed + '/' + errorCount + ' 处，得分 ' + result.score + '/' +
      result.totalScore + '（' + result.verdictText + '）';
    return result;
  }

  function precheck(q, studentSrc) {
    const faults = q.faults || [];
    const L1 = FC.formCheck(studentSrc, q.original, faults);
    const lines = FC.splitLines(studentSrc);
    const L4 = faults.map((f) => {
      const cand = lines[f.line - 1];
      let r;
      if (cand === undefined) {
        r = { ok: false, why: '这一行不存在（原题第 ' + f.line + ' 行）', line: f.line };
      } else {
        const c = F.checkFix(cand, f, { accept: f.accept });
        r = { ok: c.ok, why: c.why, line: f.line };
      }
      r.original = f.original;
      r.fixed = f.fixed;
      r.reason = f.reason || '';
      r.student = cand === undefined ? '' : cand;
      r.marked = cand !== undefined && F.stripMarker(cand).marked;
      return r;
    });
    return { L1, L4 };
  }

  return { judge, precheck, VERDICT_TEXT };
});
