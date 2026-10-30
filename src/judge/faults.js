
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeFaults = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAIL_BLOCK_RE = /\/\*[\s\S]*\*\/\s*$/;
  const TAIL_LINE_RE = /\/\/[^\n]*$/;

  const OPERATORS = /^(?:%:%:|>>=|<<=|\.\.\.|->|\+\+|--|<<|>>|<=|>=|==|!=|&&|\|\||\*=|\/=|%=|\+=|-=|&=|\^=|\|=|##|<:|:>|<%|%>|%:)/;
  const C_SPACE = /^[ \t\v\f\r\n]$/;

  function scanLine(line) {
    const text = String(line == null ? '' : line);
    const tokens = [], comments = [];
    let i = 0;
    while (i < text.length) {
      if (C_SPACE.test(text[i])) { i++; continue; }
      const start = i;
      if (text.startsWith('//', i)) {
        comments.push({ start, end: text.length });
        break;
      }
      if (text.startsWith('/*', i)) {
        const end = text.indexOf('*/', i + 2);
        if (end >= 0) {
          i = end + 2;
          comments.push({ start, end: i });
          continue;
        }
        
        tokens.push({ text: text.slice(i), end: text.length });
        break;
      }
      const rest = text.slice(i);
      const literal = /^(?:u8|[LuU])?["']/.exec(rest);
      if (literal) {
        const quote = literal[0].slice(-1);
        i += literal[0].length;
        while (i < text.length) {
          const ch = text[i++];
          if (ch === '\\' && i < text.length) { i++; continue; }
          if (ch === quote) break;
        }
      } else {
        const token = /^[A-Za-z_]\w*/.exec(rest)
          || /^(?:\d|\.\d)(?:[eEpP][+-]|[A-Za-z0-9_.])*/.exec(rest)
          || OPERATORS.exec(rest);
        i += token ? token[0].length : 1;
      }
      tokens.push({ text: text.slice(start, i), end: i });
    }
    
    if (/\\[ \t]*$/.test(text)) tokens.push({ text: '\\', end: text.length });
    return { text, tokens, comments };
  }

  function stripMarker(line) {
    const scanned = scanLine(line);
    const lastEnd = scanned.tokens.length ? scanned.tokens[scanned.tokens.length - 1].end : 0;
    const tail = scanned.comments.find(c => c.start >= lastEnd);
    return {
      code: tail ? scanned.text.slice(0, tail.start).replace(/[ \t\v\f\r\n]+$/, '') : scanned.text,
      marked: !!tail && scanned.tokens.length > 0,
    };
  }

  function hasTailComment(line) {
    return stripMarker(line).marked;
  }

  function strictNorm(line) {
    const { text, tokens, comments } = scanLine(line);
    if (/\\[ \t]*$/.test(text)) return JSON.stringify(['#continuation', text]);
    if (tokens.length && tokens[0].text === '#') {
      
      let directive = text;
      for (let i = comments.length - 1; i >= 0; i--)
        directive = directive.slice(0, comments[i].start) + ' ' + directive.slice(comments[i].end);
      return JSON.stringify(['#directive', directive.replace(/^[ \t\v\f\r\n]+|[ \t\v\f\r\n]+$/g, '')]);
    }
    return tokens.length ? JSON.stringify(tokens.map(t => t.text)) : '';
  }

  function norm(line) { return strictNorm(line); }
  function looseNorm(line) { return strictNorm(line); }

  function diffLines(studentLines, originalLines) {
    const out = [];
    if (studentLines.length === originalLines.length) {
      for (let i = 0; i < studentLines.length; i++) {
        if (strictNorm(studentLines[i]) !== strictNorm(originalLines[i])) {
          out.push({ line: i + 1, text: studentLines[i], index: i,
                     marked: stripMarker(studentLines[i]).marked });
        }
      }
      return out;
    }
    
    for (let i = 0; i < studentLines.length; i++) {
      const orig = originalLines[i];
      if (orig === undefined) continue;
      if (strictNorm(studentLines[i]) === strictNorm(orig)) continue;
      out.push({ line: i + 1, text: studentLines[i], index: i,
                 marked: stripMarker(studentLines[i]).marked, realigned: true });
    }
    return out;
  }

  function checkFix(studentLine, fault, opts) {
    const opts2 = opts || {};
    const s = strictNorm(studentLine);
    const orig = strictNorm(fault.original);
    const fixed = strictNorm(fault.fixed);

    if (!s || s === orig)
      return { ok: false, why: '未修改（与本行原始内容相同）' };

    if (s === fixed) return { ok: true, why: '与参考答案一致' };

    for (const alternative of (fault.alternatives || [])) {
      if (alternative && typeof alternative.code === 'string' && s === strictNorm(alternative.code))
        return { ok: true, why: '已核对的等价写法' };
    }

    for (const pat of (opts2.accept || [])) {
      let re;
      try { re = new RegExp('^(?:' + pat + ')$'); } catch (e) { continue; }
      if (re.test(stripMarker(studentLine).code.trim()))
        return { ok: true, why: '命中可接受写法 ' + pat };
    }
    return { ok: false, why: '与参考答案不一致' };
  }

  function skeleton(s) {
    return String(s)
      .replace(/"(?:\\.|[^"\\])*"/g, '"S"')
      .replace(/'(?:\\.|[^'\\])*'/g, "'C'")
      .replace(/[A-Za-z_]\w*/g, 'I')
      .replace(/\d+/g, 'N')
      .replace(/\s+/g, '');
  }

  return { MARKER_RE: TAIL_BLOCK_RE, TAIL_BLOCK_RE, TAIL_LINE_RE, hasTailComment,
           stripMarker, norm, strictNorm, looseNorm, diffLines, checkFix, skeleton };
});
