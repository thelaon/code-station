
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeDiagnostics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const UNSUPPORTED_PAT = /wasm32:\s*(?:unsupported\b|unimplemented\b|not supported\b|TODO\b|(?:VLA|computed goto) is not implemented yet\b)/i;
  const TOOL_CRASH_PAT = /(internal compiler error|out of memory|memory exhausted)/i;
  const ENV_PAT = /(EPERM|EACCES|ENOENT|fetch failed|NetworkError|failed to load)/i;

  const DIAG_RE = /^(.+?):(\d+):\s*(error|warning|note):\s*(.*)$/i;

  function parseDiagnostics(text) {
    const out = [];
    for (const raw of String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = DIAG_RE.exec(line);
      if (m) {
        out.push({ file: m[1], line: parseInt(m[2], 10), kind: m[3].toLowerCase(),
                   message: m[4].trim(), raw: line });
      } else if (/error:/i.test(line)) {
        out.push({ file: '', line: 0, kind: 'error', message: line, raw: line });
      }
    }
    return out;
  }

  function classify(text, errorInfo) {
    if (errorInfo && errorInfo.code) {
      const c = classifyRuntime(errorInfo, text);
      return { verdict:c.verdict, kind:c.kind, reason:c.reason, items:[], toolItems:[], studentItems:[] };
    }
    const items = parseDiagnostics(text);
    const toolItems = [], studentItems = [];
    let envHit = false;

    for (const it of items) {
      const s = it.raw;
      if (UNSUPPORTED_PAT.test(s) || TOOL_CRASH_PAT.test(s)) { it.category = 'tool'; toolItems.push(it); }
      else if (ENV_PAT.test(s) && !it.file) { it.category = 'env'; envHit = true; }
      else { it.category = 'student'; studentItems.push(it); }
    }

    const raw = String(text == null ? '' : text).trim();
    if (!items.length && raw) {
      
      if (ENV_PAT.test(raw)) {
        return { verdict: 'env', kind: 'env', reason: '编译环境异常，本次未完成验证，请重新加载后重试。',
                 items: [], toolItems: [], studentItems: [] };
      }
      return { verdict: 'tool', kind: 'unknown',
               reason: '编译工具未能完成处理，本次无法验证，请重新加载后重试。',
               items: [], toolItems: [], studentItems: [] };
    }

    if (toolItems.length) {
      
      const extra = studentItems.length
        ? '；另有 ' + studentItems.length + ' 条疑似由你的改动引起的问题，已一并列出' : '';
      return { verdict: 'tool', kind: studentItems.length ? 'mixed' : 'unsupported',
               reason: toolReason(toolItems) + extra, items, toolItems, studentItems };
    }
    if (envHit && !studentItems.length) {
      return { verdict: 'env', kind: 'env', reason: '环境异常', items, toolItems, studentItems };
    }
    if (!items.length) return { verdict: 'ok', kind: 'ok', reason: '', items, toolItems, studentItems };
    return { verdict: 'student', kind: 'compile_error',
             reason: '编译错误 ' + items.filter(i => i.kind === 'error').length + ' 处',
             items, toolItems, studentItems };
  }

  function toolReason(toolItems) {
    if (toolItems.some(i => /wasm32:\s*VLA is not implemented yet/i.test(i.raw)))
      return '当前离线编译器暂不支持变长数组，运行验证不可用。';
    if (toolItems.some(i => /unsupported vararg type/i.test(i.raw)))
      return '当前离线编译器暂不支持这种可变参数类型，运行验证不可用。';
    return '当前离线编译器暂不支持这段代码中的某项语言特性，运行验证不可用。';
  }

  const KNOWN_LIBC_GAPS = ['strrev', 'itoa'];

  const STANDARD_LIBCALLS = new Set(('strrev itoa printf fprintf sprintf puts fputs putchar fputc getchar fgets gets ' +
    'strlen strcpy strncpy strcat strncat strcmp strncmp strchr strrchr strstr strtok memcpy memmove memset memcmp ' +
    'setlocale localeconv signal raise system getenv ' +
    'mktime localtime gmtime strftime difftime time clock tmpfile tmpnam rename remove ' +
    'fopen fclose fread fwrite fseek ftell rewind fflush feof ferror perror strerror ' +
    'vprintf vsprintf snprintf vsnprintf sscanf vsscanf scanf fscanf vfscanf ' +
    'strtod strtof strtold strtol strtoul strtoll strtoull atoi atol atoll atof ' +
    'malloc calloc realloc free qsort bsearch rand srand abort exit atexit imaxabs imaxdiv div ldiv lldiv ' +
    'sqrt pow exp log log10 sin cos tan asin acos atan atan2 sinh cosh tanh ' +
    'floor ceil trunc round lround fabs fmod frexp ldexp modf hypot cbrt').split(/\s+/));

  function errorDetails(error) {
    if (!error || typeof error !== 'object') return null;
    if (error.errorInfo) return errorDetails(error.errorInfo);
    if (!error.code) return null;
    return {code:String(error.code), phase:String(error.phase || ''),
      symbols:Array.isArray(error.symbols) ? [...new Set(error.symbols.map(String))].sort() : []};
  }

  function classifyRuntime(info, text) {
    const details = errorDetails(info);
    if (details && details.code === 'encoding_unsupported')
      return {verdict:'tool', kind:'encoding_unsupported', reason:String(text || '当前编码无法处理，本次未完成验证。')};
    if (details && (details.phase === 'compiler' || details.code === 'compiler_environment'))
      return {verdict:'env',kind:'compiler_environment',
        reason:'编译环境缺少必要功能，当前无法编译，请重新加载后重试。'};
    if (details && details.code === 'unavailable_libc_symbols') {
      if (details.symbols.some(s => /^__(?:u?divdi3|u?moddi3|a?l?shrdi3|ashldi3)$/.test(s)))
        return {verdict:'env',kind:'runtime_environment',reason:'运行环境缺少必要功能，本次未完成验证，请重新加载后重试。'};
      if (details.symbols.length && details.symbols.every(s => STANDARD_LIBCALLS.has(s)))
        return {verdict:'tool',kind:'unsupported_libcall',
          reason:'当前离线运行库暂不支持程序调用的部分函数，运行结果尚未验证；逐处核对得分不受影响。'};
      return {verdict:'student',kind:'unresolved_function',
        reason:'程序调用了未找到的函数，请检查函数名、声明和定义；当前运行结果尚未验证。'};
    }
    const message = String(text || '');
    if (/^TLE\b|运行超时/.test(message)) return {verdict:'student',kind:'timeout',reason:'运行超时，程序已中断。'};
    if (ENV_PAT.test(message) || /LinkError|import.*(?:memory|type|function)|initialize|export.*(?:entry|bounds)/i.test(message))
      return {verdict:'env',kind:'runtime_environment',reason:'运行环境异常，本次未完成验证，请重新加载后重试。'};
    return {verdict:'student',kind:'runtime_error',reason:'程序运行异常，请检查内存访问、运算和函数调用。'};
  }

  function libcGapsIn(src) {
    const s = String(src || '');
    const hit = [];
    for (const fn of KNOWN_LIBC_GAPS) {
      if (new RegExp('\\b' + fn + '\\s*\\(').test(s)) hit.push(fn);
    }
    return hit;
  }

  function riskScan(src) {
    const s = String(src || '');
    const risks = [];

    if (/[\u4e00-\u9fff]/.test(s)) {
      risks.push({ kind: 'cjk_in_source', note:
        '源码里有中文字符。若本题按 GBK（汉字 2 字节）设计，UTF-8 下结果不可信（2016-D卷 q2 就是这种）' });
    }
    return risks;
  }

  return { parseDiagnostics, classify, classifyRuntime, errorDetails, libcGapsIn, riskScan, KNOWN_LIBC_GAPS };
});
