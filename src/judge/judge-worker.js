
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JudgeEncoding = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var reverse = null, decoder = null;
  function limited(message) {
    var error = new Error(message);
    error.code = 'encoding_unsupported'; error.phase = 'encoding';
    return error;
  }
  function gbkDecoder() {
    if (!decoder) {
      try { decoder = new TextDecoder('gbk', {fatal:true}); }
      catch (_) { throw limited('当前浏览器缺少 GBK 编解码支持。'); }
    }
    return decoder;
  }
  function table() {
    if (reverse) return reverse;
    var map = new Map(), dec = gbkDecoder();
    for (var b = 0; b < 128; b++) map.set(String.fromCharCode(b), [b]);
    
    if (dec.decode(new Uint8Array([0x80])) === '\u20ac') map.set('\u20ac', [0x80]);
    var pair = new Uint8Array(2);
    for (var lead = 0x81; lead <= 0xfe; lead++) {
      pair[0] = lead;
      for (var trail = 0x40; trail <= 0xfe; trail++) {
        if (trail === 0x7f) continue;
        pair[1] = trail;
        var ch;
        try { ch = dec.decode(pair); } catch (_) { continue; }
        if (Array.from(ch).length === 1 && !map.has(ch)) map.set(ch, [lead, trail]);
      }
    }
    reverse = map;
    return map;
  }
  function encode(text) {
    var map = table(), bytes = [];
    for (var ch of String(text)) {
      var entry = map.get(ch);
      if (!entry) throw limited('GBK 无法表示字符 U+' + ch.codePointAt(0).toString(16).toUpperCase() + '，本次未完成运行验证。');
      for (var b of entry) bytes.push(b);
    }
    return new Uint8Array(bytes);
  }
  function decode(bytes) {
    try { return gbkDecoder().decode(bytes); }
    catch (error) {
      if (error.code === 'encoding_unsupported') throw error;
      throw limited('程序输出含不完整或无效的 GBK 字节，本次未完成文本比对。');
    }
  }
  function questionEncoding(q) {
    if (!q) return 'utf-8';
    var explicit = q.quirks && q.quirks.executionEncoding;
    if (explicit === 'gbk' || explicit === 'utf-8') return explicit;
    var key = q.key || q.id;
    return /^(?:2016-[CD]卷#x2|2016-[CD]卷 第2问 第2题)$/.test(key || '') ? 'gbk' : 'utf-8';
  }
  function octal(text) {
    return Array.from(encode(text), function (b) { return '\\' + b.toString(8).padStart(3, '0'); }).join('');
  }

  function source(text) {
    var src = String(text), out = '', i = 0;
    while (i < src.length) {
      if (src.slice(i, i + 2) === '/*') {
        var end = src.indexOf('*/', i + 2);
        end = end < 0 ? src.length : end + 2;
        out += src.slice(i, end); i = end; continue;
      }
      if (src.slice(i, i + 2) === '//') {
        var j = i + 2;
        while (j < src.length) {
          if (src[j] === '\\' && /^\r?\n/.test(src.slice(j + 1))) {
            j += src[j + 1] === '\r' ? 3 : 2; continue;
          }
          if (src[j] === '\n') break;
          j++;
        }
        out += src.slice(i, j); i = j; continue;
      }
      var quote = src[i];
      if (quote !== '"' && quote !== "'") { out += src[i++]; continue; }
      var prefix = /(?:^|[^\w])(?:u8|u|U|L)$/.test(src.slice(Math.max(0, i - 4), i));
      out += quote; i++;
      while (i < src.length) {
        var ch = src[i];
        if (ch === quote) { out += ch; i++; break; }
        if (ch === '\\') {
          var universal = /^\\(?:u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8}))/.exec(src.slice(i));
          if (universal) {
            var cp = parseInt(universal[1] || universal[2], 16);
            if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) throw limited('无效的 C 通用字符转义。');
            if (prefix) throw limited('此题 GBK 模式暂不支持宽字符或 u8 字面量。');
            
            if (cp < 0xa0) { out += universal[0]; i += universal[0].length; continue; }
            out += octal(String.fromCodePoint(cp)); i += universal[0].length; continue;
          }
          
          out += ch; i++;
          if (i < src.length) { out += src[i++]; }
          continue;
        }
        if (ch.charCodeAt(0) > 127) {
          if (prefix) throw limited('此题 GBK 模式暂不支持宽字符或 u8 字面量。');
          var point = String.fromCodePoint(src.codePointAt(i));
          out += octal(point); i += point.length;
        } else { out += ch; i++; }
      }
    }
    return out;
  }
  return {encode:encode, decode:decode, source:source, questionEncoding:questionEncoding};
});

'use strict';

function resolveRuntime() {
  if (typeof TccWasmRuntime !== 'undefined' && TccWasmRuntime.CompilerHost) return TccWasmRuntime;
  if (typeof Runtime !== 'undefined' && Runtime && Runtime.CompilerHost) return Runtime;
  return null;
}
var Runtime2 = resolveRuntime();

var MISSING = [];
if (!Runtime2) MISSING.push('runtime.js（全局 TccWasmRuntime）');
if (typeof WabtModule === 'undefined' && typeof wabt === 'undefined') MISSING.push('wabt.js（全局 WabtModule）');
if (!self.JudgeEngine || !self.JudgeEngine.judge) MISSING.push('判题引擎（faults/formcheck/diagnostics/tests/engine）');

var ctx = {};
var runtime = null;
var libcModule = null;
var tccModule = null;

var RUN_TIMEOUT = 1000;

function reply(msg) { self.postMessage(msg); }

var __JTRACE = { t0: Date.now(), ev: [], max: 400 };

function __jstage(name, extra) {
  if (__JTRACE.ev.length >= __JTRACE.max) return;
  var row = { t: Date.now() - __JTRACE.t0, name: name };
  if (extra !== undefined && extra !== null) {
    try { row.extra = JSON.parse(JSON.stringify(extra)); }
    catch (e) { row.extra = String(extra).slice(0, 200); }
  }
  try { __JTRACE.ev.push(row); } catch (e) {  }
}
__jstage('worker:eval', { hasEngine: !!(self.JudgeEngine && self.JudgeEngine.judge),
                          hasRuntime: !!Runtime2, hasWabt: typeof WabtModule !== 'undefined',
                          testFlag: (typeof __CQUIZ_TEST__ !== 'undefined' && !!__CQUIZ_TEST__) });
self.addEventListener('unhandledrejection', function (ev) {
  var r = ev && ev.reason;
  __jstage('worker:unhandledrejection',
           { msg: String((r && (r.stack || r.message)) || r).slice(0, 800) });
});
self.addEventListener('error', function (ev) {
  __jstage('worker:error', { msg: String((ev && (ev.message || ev.type)) || ev).slice(0, 400) });
});

function probeCompileApi(host) {
  var names = [];
  var proto = Object.getPrototypeOf(host);
  if (proto) names = Object.getOwnPropertyNames(proto);
  for (var k in host) if (names.indexOf(k) < 0) names.push(k);
  return {
    names: names.filter(function (n) { return /^compile/.test(n); }),
    all: names.length,
  };
}

function pickCompileFn(host) {
  var order = ['compileAppResult', 'compileApp', 'compileWithOptionsResult', 'compileWithOptions', 'compileResult', 'compile'];
  for (var i = 0; i < order.length; i++) {
    if (typeof host[order[i]] === 'function') return { name: order[i], fn: host[order[i]].bind(host) };
  }
  return null;
}

var __origHostCreate = Runtime2 && Runtime2.CompilerHost ? Runtime2.CompilerHost.create : null;
if (__origHostCreate) {
  Runtime2.CompilerHost.create = async function (options) {
    var o = options || {};
    __jstage('host::create:enter', { wasmIsModule: !!(o.wasm && o.wasm instanceof WebAssembly.Module) });
    var wasm = o.wasm || './tcc.wasm';
    var module = await compileModuleLite(wasm);
    __jstage('host::create:wasmCompiled', {});
    var host = new Runtime2.CompilerHost(module, o);
    __jstage('host::create:hostMade', { usesLibc: !!host.usesLibc });
    if (host.usesLibc) {
      host.libcModule = await compileModuleLite(o.libc || './libc.wasm');
      __jstage('host::create:libcCompiled', {});
    }
    var origReset = host.reset;
    host.reset = async function (opts) {
      __jstage('host::reset:enter', {});
      var r = await origReset.call(host, opts);
      __jstage('host::reset:done', {});
      return r;
    };
    await host.reset();
    __jstage('host::create:done', {});
    return host;
  };
  
  var compileModuleLite = async function (source) {
    if (source instanceof WebAssembly.Module) return source;
    if (source instanceof Uint8Array || source instanceof ArrayBuffer) return WebAssembly.compile(source);
    var resp = await fetch(source);
    if (!resp.ok) throw new Error('could not fetch ' + source);
    return WebAssembly.compile(await resp.arrayBuffer());
  };
}

var __wiSeq = 0;
(function wrapInstantiateTrace() {
  var prev = WebAssembly.instantiate;
  WebAssembly.instantiate = function (source, imports) {
    var n = ++__wiSeq;
    var isLibc = !!(imports && imports.env && imports.env.rt_host_read);
    var isApp = !!(imports && imports.env && imports.env.memory instanceof WebAssembly.Memory);
    var kind = isLibc ? 'libc' : (isApp ? 'compiler' : 'other');
    var t0 = Date.now();
    var out;
    try {
      out = prev.call(WebAssembly, source, imports);
    } catch (err) {
      __jstage('wi:throw#' + n, { kind: kind, ms: Date.now() - t0, err: String(err && err.message || err).slice(0, 200) });
      throw err;
    }
    if (!out || typeof out.then !== 'function') {
      __jstage('wi:sync#' + n, { kind: kind, ms: Date.now() - t0 });
      return out;
    }
    __jstage('wi:pending#' + n, { kind: kind, sinkType: String(Object.prototype.toString.call(source)) });
    return out.then(function (r) {
      __jstage('wi:done#' + n, { kind: kind, ms: Date.now() - t0 });
      return r;
    }, function (err) {
      __jstage('wi:reject#' + n, { kind: kind, ms: Date.now() - t0, err: String(err && err.message || err).slice(0, 200) });
      throw err;
    });
  };
  
  var prevCompile = WebAssembly.compile;
  WebAssembly.compile = function (bytes) {
    var t0 = Date.now();
    var out = prevCompile.call(WebAssembly, bytes);
    if (!out || typeof out.then !== 'function') {
      __jstage('wc:sync', { ms: Date.now() - t0 });
      return out;
    }
    __jstage('wc:pending', { ms: Date.now() - t0 });
    return out.then(function (r) { __jstage('wc:done', { ms: Date.now() - t0 }); return r; });
  };
  
  var P = Runtime2 && Runtime2.CompilerHost && Runtime2.CompilerHost.prototype;
  if (P && P.instantiateWithLibc && !P.__traced) {
    P.__traced = true;
    var origIWL = P.instantiateWithLibc;
    P.instantiateWithLibc = async function () {
      __jstage('iwl:enter', { pages: this.pages, hasLibcModule: !!this.libcModule });
      var r = await origIWL.call(this);
      __jstage('iwl:done', {});
      return r;
    };
    var origIS = P.instantiateStandalone;
    P.instantiateStandalone = async function () {
      __jstage('is:enter', { pages: this.pages });
      var r = await origIS.call(this);
      __jstage('is:done', {});
      return r;
    };
    var origInit = P.initialize;
    P.initialize = function () { __jstage('init:enter', {}); var r = origInit.call(this); __jstage('init:done', {}); return r; };
    var origSeed = P.seedResources;
    P.seedResources = function (res) {
      
      try {
        var files = res ? (res.files || res) : null;
        var names = files ? Object.keys(files) : [];
        __jstage('seed:enter', { hasRes: !!res, enc: res ? String(res.encoding) : null,
                                 nFiles: names.length, first: names[0] || null });
      } catch (e) {
        try { __jstage('seed:probe:err', { err: String(e && e.message || e).slice(0, 200) }); } catch (e2) {}
      }
      var r = origSeed.call(this, res);
      __jstage('seed:done', {});
      return r;
    };
  }
})();

async function compile(src, executionEncoding) {
  if (executionEncoding === 'gbk') {
    try { src = self.JudgeEncoding.source(src); }
    catch (error) { return {ok:false, artifact:null, diagnostics:error.message,
      errorInfo:self.JudgeDiagnostics.errorDetails(error)}; }
  }

  __jstage('compile:host:create:before', {});
  var host;
  try {
    host = await Runtime2.CompilerHost.create({ wasm: tccModule, libc: libcModule, resources: ctx.resources });
  } catch (e) {
    return {ok:false,artifact:null,diagnostics:'编译环境初始化失败。',
      errorInfo:self.JudgeDiagnostics.errorDetails(e) || {code:'compiler_environment',phase:'compiler',symbols:[]}};
  }
  __jstage('compile:host:create:after', {});
  var pick = pickCompileFn(host);
  if (!pick) {
    var p = probeCompileApi(host);
    return { ok: false, artifact: null,
             diagnostics: '编译器宿主没有可用的编译方法（可用的 compile* 方法：' +
               (p.names.join('、') || '无') + '，共 ' + p.all + ' 个成员）' };
  }
  ctx.compileApi = pick.name;
  var res;
  try {
    
    __jstage('compile:call:before', { api: pick.name, srcLen: src.length });
    res = await pick.fn(src);
    __jstage('compile:call:after', { api: pick.name, hasWat: !!(res && res.wat) });
  } catch (e) {
    __jstage('compile:call:throw', { api: pick.name, msg: String(e && e.message || e).slice(0, 200) });
    res = { rc: (e && e.rc !== undefined) ? e.rc : -99,
            diagnostics: (e && e.diagnostics) || String(e && e.message || e), wat: '' };
  }
  if (typeof res === 'string') res = { wat: res, diagnostics: '' };   
  var diagnostics = (res && res.diagnostics) || '';
  if (!res || !res.wat || /error:/i.test(diagnostics)) {
    return { ok: false, diagnostics: diagnostics, artifact: null, api: pick.name };
  }
  try {
    __jstage('assemble:before', { watLen: res.wat.length });
    var artifact = attachWat(assembleWat(res.wat), res.wat);
    __jstage('assemble:after', { bytes: artifact.byteLength });
    if (executionEncoding === 'gbk') Object.defineProperty(artifact, '__executionEncoding', {value:'gbk'});
    return { ok: true, diagnostics: diagnostics, artifact: artifact, api: pick.name,
      executionEncoding:executionEncoding || 'utf-8' };
  } catch (e) {
    return { ok: false, api: pick.name,
             diagnostics: diagnostics + '\nASSEMBLE: ' + (e && e.message || e), artifact: null };
  }
}

function assembleWat(wat) {
  var wabt = ctx.wabt;
  if (!wabt) throw new Error('wabt 未加载');
  var mod = wabt.parseWat('tcc.wat', wat, {
    exceptions: true, mutable_globals: true, sat_float_to_int: true, sign_extension: true,
    simd: true, threads: true, function_references: true, multi_value: true,
    tail_call: true, bulk_memory: true, reference_types: true,
  });
  mod.resolveNames();
  mod.validate();
  var bin = mod.toBinary({ log: false, canonicalize_lebs: true, write_debug_names: false });
  mod.destroy();
  return bin.buffer;
}

function attachWat(bytes, wat) {
  var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    Object.defineProperty(view, '__wat', { value: wat, enumerable: false, configurable: true });
  } catch (e) {  }
  return view;
}

function runRaw(artifact, opts) {
  var o = opts || {};
  if (!(artifact instanceof Uint8Array) && artifact && artifact.byteLength)
    artifact = new Uint8Array(artifact);
  var runOpts = { stdin: o.stdin || '', args: ['a.out'], timeoutMs: o.timeoutMs,
    executionEncoding: artifact && artifact.__executionEncoding || 'utf-8' };
  if (o.clock) runOpts.clock = o.clock;
  return runtime.run(artifact, runOpts)
    .then(function (out) {
      return { rc: out.rc, stdout: out.stdout, stderr: out.stderr, aborted: false, error: '' };
    }, function (err) {
      var message = String(err && err.message || err);
      var info = self.JudgeDiagnostics.errorDetails(err);
      var category = self.JudgeDiagnostics.classifyRuntime(info, message);
      return { rc: null, stdout: '', stderr: '', aborted: /^TLE\b/.test(message),
        error: /^TLE\b/.test(message) ? message : category.reason,
        errorInfo:info, errorCategory:category.verdict, debugError:message };
    });
}

function installMissingSymbols(imports) {
  if (typeof imports.gets === 'function') return imports;
  var memory = imports.memory;
  var stdinRemaining = imports.rt_stdin_remaining;
  var stdinSet = imports.rt_stdin_set;
  var read = imports.rt_read;
  var malloc = imports.malloc;
  var free = imports.free;
  if (!memory || !stdinRemaining || !stdinSet || !read || !malloc || !free) return imports;

  imports.gets = function (buf) {
    if (!buf) return 0;
    var n = 0;
    for (var guard = 0; guard < 4096; guard++) {
      var rem = stdinRemaining();
      if (rem <= 0) break;
      var tmp = malloc(rem);
      if (!tmp) break;
      var got = read(0, tmp, rem);
      var total = got > 0 ? Math.min(got, rem) : rem;
      var view = new Uint8Array(memory.buffer);
      var out = new Uint8Array(memory.buffer);
      var nl = -1;
      for (var i = 0; i < total; i++) {
        var c = view[tmp + i];
        if (c === 10) { nl = i; break; }
        if (c !== 13) out[buf + n++] = c;
      }
      if (nl >= 0) {
        var rest = total - nl - 1;
        stdinSet(rest > 0 ? tmp + nl + 1 : tmp, rest > 0 ? rest : 0);
        free(tmp);
        break;
      }
      free(tmp);
    }
    new Uint8Array(memory.buffer)[buf + n] = 0;
    return n === 0 ? 0 : buf;
  };
  return imports;
}

var realInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = function (source, imports) {
  var isLibc = !!(imports && imports.env && imports.env.rt_host_read);
  var isApp = !!(imports && imports.env && imports.env.memory instanceof WebAssembly.Memory);
  function shim(r) {
    if (isApp && imports && imports.libc && !imports.libc.__shimmed) {
      installMissingSymbols(imports.libc);
      imports.libc.__shimmed = true;
    }
    return r;
  }
  var out = realInstantiate.call(WebAssembly, source, imports);
  
  if (!out || typeof out.then !== 'function') return shim(out);
  return out.then(shim);
};

var _shimInstalled = false;
function installSymbolShim() {
  if (_shimInstalled || !Runtime2.AppRuntime) return;
  _shimInstalled = true;
  var proto = Runtime2.AppRuntime.prototype;
  var original = proto.validateAppImports;
  proto.validateAppImports = function (appModule, libcImports) {
    if (!libcImports.__shimmed) {
      installMissingSymbols(libcImports);
      libcImports.__shimmed = true;
    }
    return original.call(this, appModule, libcImports);
  };
}

function injectGuard(wat, timeoutMs) {
  var text = wat, loops = 0;

  var step = '      (global.set $__cq_guard_steps (i32.add (global.get $__cq_guard_steps) (i32.const 1)))\n' +
    '      (if (i32.eqz (i32.and (global.get $__cq_guard_steps) (i32.const ' + (GUARD_CHECK_EVERY - 1) + ')))\n' +
    '        (then (call $__on_step)))\n';
  text = text.replace(/(\(loop(\s+\$[\w.$]+)?[^\n]*\n)/g, function (m) {
    loops++;
    return m + step;
  });
  if (loops === 0) return { wat: wat, loops: 0 };
  var at = text.lastIndexOf('(import ');
  var lineEnd = text.indexOf('\n', at);
  text = text.slice(0, lineEnd) + '\n  (import "env" "__on_step" (func $__on_step))' +
    '\n  (global $__cq_guard_steps (mut i32) (i32.const 0))' + text.slice(lineEnd);
  return { wat: text, loops: loops, timeoutMs: timeoutMs };
}

var _runPatched = false;
function patchAppRuntime() {
  if (_runPatched || !Runtime2.AppRuntime) return;
  _runPatched = true;
  var P = Runtime2.AppRuntime.prototype;
  P.run = function (appSource, options) {
    var o = options || {};
    var self_ = this;
    var pages = o.pages || self_.pages;
    var memory = o.memory || new WebAssembly.Memory({ initial: pages, maximum: pages });
    var hook = null;
    return Promise.resolve(Runtime2.compileModule(appSource)).then(function (appModule) {
      
      var wat = (appSource && appSource.__wat) || null;
      var guarded = wat && o.timeoutMs ? injectGuard(wat, o.timeoutMs) : null;
      self_.__guardDbg = { hasWat: !!wat, timeoutMs: o.timeoutMs || 0,
        loops: guarded ? guarded.loops : -1, used: !!(guarded && guarded.loops) };
      if (guarded && guarded.loops) {
        hook = makeStepHook(o.timeoutMs);
        var bin;
        try { bin = assembleWat(guarded.wat); }
        catch (e) { bin = null; hook = null; self_.__guardDbg.error = String(e && e.message || e); }
        if (bin) return Runtime2.compileModule(bin);
      }
      return appModule;
    }).then(function (appModule) {
      return WebAssembly.instantiate(self_.libcModule, Runtime2.createLibcImports(memory, o))
        .then(function (libc) {
          var libcImports = Runtime2.createAppLibcImports(memory, libc.exports);
          installMissingSymbols(libcImports);
          self_.validateAppImports(appModule, libcImports);
          if (o.stdio === 'inherit' && libc.exports.rt_stdio_set_hosted) libc.exports.rt_stdio_set_hosted(1);
          var envImports = { memory: memory };
          if (hook) envImports.__on_step = hook;
          return WebAssembly.instantiate(appModule, { env: envImports, libc: libcImports })
            .then(function (app) {
              return { app: app, libc: libc, memory: memory, appModule: appModule };
            });
        });
    }).then(function (bundle) {
      var app = bundle.app, libc = bundle.libc;
      var heapBase = Runtime2.valueOf(app.exports.__heap_base);
      var heapEnd = Runtime2.valueOf(app.exports.__heap_end);
      if (heapBase === undefined || heapEnd === undefined)
        throw new Error('app module did not export heap bounds');
      var entryName = o.entry || 'main';
      var entry = app.exports[entryName] || app.exports['_' + entryName];
      if (typeof entry !== 'function') throw new Error('app module did not export entry: ' + entryName);
      if (libc.exports.rt_init_heap(heapBase, heapEnd) !== 0) throw new Error('could not initialize libc heap');
      if (o.files) self_.seedFiles(memory, libc.exports, o.files);
      var argv = null;
      if (entry.length >= 2 || o.args) argv = self_.writeArgv(memory, libc.exports, o.args || [entryName]);
      if (o.stdio !== 'inherit') self_.seedStdin(memory, libc.exports,
        o.executionEncoding === 'gbk' ? self.JudgeEncoding.encode(o.stdin || '') : o.stdin || '');
      if (app.exports.__wasm_call_ctors) app.exports.__wasm_call_ctors();
      var rc;
      try {
        rc = argv ? entry(argv.argc, argv.argv) : entry();
      } catch (err) {
        if (err && err.name === 'WasmExit') rc = err.code;
        else throw err;                     
      }
      function readOutput(ptrName, lenName) {
        if (o.executionEncoding !== 'gbk') return self_.readRuntimeBuffer(memory, libc.exports, ptrName, lenName);
        var ptr = libc.exports[ptrName](), len = libc.exports[lenName]();
        return self.JudgeEncoding.decode(new Uint8Array(memory.buffer, ptr, len));
      }
      return {
        rc: rc,
        stdout: readOutput('rt_stdout_ptr', 'rt_stdout_len'),
        stderr: readOutput('rt_stderr_ptr', 'rt_stderr_len'),
        memory: memory, app: app, libc: libc,
      };
    });
  };
}

var GUARD_CHECK_EVERY = 65536;
function makeStepHook(timeoutMs) {
  var t0 = Date.now();
  return function () {
    if (Date.now() - t0 > timeoutMs)
      throw new Error('TLE: 运行超时（超过 ' + timeoutMs + ' ms）');
  };
}

function classifyDiag(raw, errorInfo) {
  var D = (typeof self !== 'undefined' && self.JudgeDiagnostics) || null;
  if (D && typeof D.classify === 'function') {
    try { return D.classify(raw || '', errorInfo); } catch (e) {  }
  }
  return { verdict: raw ? 'student' : 'ok', reason: raw ? '编译器报错（未分类）' : '',
           items: [] };
}

function previewOnly(id, q, studentSrc, timeoutMs, customStdin) {
  __jstage('preview:enter', { id: id, srcLen: (studentSrc || '').length,
                              nTests: (q && q.tests) ? q.tests.length : -1,
                              custom: customStdin == null ? -1 : String(customStdin).length });
  var tests = (q && q.tests) || [];
  return Promise.resolve(compile(studentSrc || '', self.JudgeEncoding.questionEncoding(q))).then(function (c) {
    var cls = classifyDiag(c.diagnostics, c.errorInfo);
    var L2 = { ok: !!c.ok, diagnostics: c.diagnostics || '',
               verdict: c.ok ? 'ok' : cls.verdict,
               reason: c.ok ? '' : cls.reason, items: c.ok ? [] : cls.items,
               errorInfo:c.errorInfo || null, executionEncoding:c.executionEncoding || 'utf-8' };
    if (!c.ok || !c.artifact) {
      __jstage('preview:compileFail', { verdict: L2.verdict });
      return { runOnly: true, L2: L2, L3: { available: false, allPassed: false,
               passed: 0, total: tests.length, cases: [],
               toolLimited: L2.verdict === 'tool' || L2.verdict === 'env',
               reason: L2.reason || '编译未通过，当前运行结果尚未验证。',
               custom: null, runTimeoutMs: timeoutMs || RUN_TIMEOUT } };
    }
    if (customStdin != null) {
      
      return runMeasured(c.artifact, { stdin: String(customStdin) }, timeoutMs || RUN_TIMEOUT)
        .then(function (r) {
          __jstage('preview:custom', { ms: r.ms, aborted: !!r.aborted });
          return { runOnly: true, L2: L2,
                   L3: { available: true, allPassed: !r.aborted && !r.error, passed: 0, total: 0,
                         cases: [], toolLimited: r.errorCategory === 'tool' || r.errorCategory === 'env',
                         reason:r.error || '', runTimeoutMs: timeoutMs || RUN_TIMEOUT,
                         custom: { stdin: String(customStdin),
                                   stdout: r.stdout == null ? '' : String(r.stdout),
                                   stderr: r.stderr == null ? '' : String(r.stderr),
                                   rc: r.rc, ms: r.ms, aborted: !!r.aborted,
                                   error: r.error || '', errorInfo:r.errorInfo || null,
                                   errorCategory:r.errorCategory || '', debugError:r.debugError || '' } } };
        });
    }
    var cases = [];
    var i = 0;
    function step() {
      if (i >= tests.length) return Promise.resolve();
      var t = tests[i] || {};
      return runMeasured(c.artifact, { stdin: t.stdin || '' }, timeoutMs || RUN_TIMEOUT)
        .then(function (r) {
          cases.push({ stdin: t.stdin || '', expect: t.expect, actual: r.stdout,
                       rc: r.rc, ms: r.ms, aborted: !!r.aborted,
                       error: r.error || '', errorInfo:r.errorInfo || null,
                       errorCategory:r.errorCategory || '', debugError:r.debugError || '',
                       pass: !r.aborted && !r.error &&
                             String(r.stdout).replace(/\r\n/g, '\n').replace(/\s+$/, '') ===
                             String(t.expect == null ? '' : t.expect)
                               .replace(/\r\n/g, '\n').replace(/\s+$/, '') });
          i++;
          return step();
        });
    }
    return step().then(function () {
      var passed = cases.filter(function (x) { return x.pass; }).length;
      __jstage('preview:result', { passed: passed, total: cases.length });
      var limited = cases.some(function(c){return c.errorCategory === 'tool' || c.errorCategory === 'env';});
      return { runOnly: true, L2: L2,
               L3: { available: tests.length > 0, allPassed: tests.length > 0 && passed === cases.length,
                     passed: passed, total: cases.length, cases: cases, toolLimited: limited,
                     reason:limited ? '运行库或运行环境受限，本次运行结果尚未验证。' : '',
                     custom: null, runTimeoutMs: timeoutMs || RUN_TIMEOUT } };
    });
  });
}

function judgeOne(id, q, studentSrc, timeoutMs, preset) {
  __jstage('judgeOne:enter', { id: id, srcLen: (studentSrc || '').length });
  var env = {
    compile: function (src) {
      __jstage('compile:enter', { srcLen: (src || '').length });
      return Promise.resolve(compile(src, self.JudgeEncoding.questionEncoding(q))).then(function (r) {
        __jstage('compile:exit', { ok: !!(r && r.ok), artifact: !!(r && r.artifact),
                                   api: (r && r.api) || '',
                                   diag: String((r && r.diagnostics) || '').slice(0, 300) });
        return r;
      }, function (e) {
        __jstage('compile:reject', { msg: String((e && (e.stack || e.message)) || e).slice(0, 500) });
        throw e;
      });
    },
    run: function (artifact, opts) {
      __jstage('run:enter', { stdinLen: ((opts && opts.stdin) || '').length });
      return runMeasured(artifact, opts, timeoutMs).then(function (r) {
        __jstage('run:exit', { ms: r && r.ms, rc: r && r.rc, aborted: !!(r && r.aborted),
                               outLen: ((r && r.stdout) || '').length,
                               err: String((r && r.error) || '').slice(0, 200) });
        return r;
      }, function (e) {
        __jstage('run:reject', { msg: String((e && (e.stack || e.message)) || e).slice(0, 500) });
        throw e;
      });
    },
  };
  return self.JudgeEngine.judge(q, studentSrc, env, { timeoutMs: timeoutMs, preset: preset })
    .then(function (r) {
      __jstage('judgeOne:result', { verdict: r && r.verdict, fixed: r && r.fixed });
      reply({ type: 'result', id: id, result: r });
    })
    .catch(function (e) {
      __jstage('judgeOne:catch', { msg: String((e && (e.stack || e.message)) || e).slice(0, 800) });
      reply({ type: 'error', id: id, message: String(e && e.stack || e) });
    });
}

function runMeasured(artifact, opts, fallbackMs) {
  var limit = (opts && opts.timeoutMs) || fallbackMs || 1000;
  var t0 = Date.now();

  var runOptions = Object.assign({}, opts || {}, { timeoutMs: limit });
  return runRaw(artifact, runOptions).then(function (r) {
    var ms = Date.now() - t0;
    r.ms = ms;
    if (!r.error && limit > 0 && ms > limit) {
      r.aborted = true;
      r.error = 'TLE 运行超时（' + ms + ' ms > ' + limit + ' ms）';
    }
    return r;
  });
}

function initWabt() {
  if (ctx.wabt) return Promise.resolve(ctx.wabt);
  if (typeof WabtModule === 'undefined') return Promise.resolve(null);
  if (typeof WabtModule === 'function') {
    var r = WabtModule();
    return Promise.resolve(r && typeof r.then === 'function' ? r : r).then(function (mod) {
      return (mod && mod.parseWat) ? mod : (r && r.parseWat ? r : null);
    });
  }
  return Promise.resolve(WabtModule.parseWat ? WabtModule : null);
}

function normalizeResources(res) {
  if (!res) return null;
  if (typeof res === 'object') return res;
  var text = String(res);
  
  try {
    var got = new Function('module', 'exports', 'globalThis', text + '\n;return this.TccWasmIdeResources;')
      .call({}, undefined, undefined, {});
    if (got && got.files) { __jstage('res:fromText', { nFiles: Object.keys(got.files).length }); return got; }
  } catch (e) {
    __jstage('res:evalFailed', { err: String(e && e.message || e).slice(0, 160) });
  }
  
  var at = text.indexOf('return');
  if (at >= 0) {
    var brace = text.indexOf('{', at);
    if (brace >= 0) {
      for (var end = text.length; end > brace; end = text.lastIndexOf('}', end - 1)) {
        try {
          var obj = JSON.parse(text.slice(brace, end + 1));
          if (obj && obj.files) { __jstage('res:fromJson', { nFiles: Object.keys(obj.files).length }); return obj; }
        } catch (e2) {  }
      }
    }
  }
  __jstage('res:unrecognized', { head: text.slice(0, 120) });
  return null;
}

try {
  self.addEventListener('unhandledrejection', function (e) {
    try {
      __jstage('unhandledRejection', { reason: String((e && e.reason && (e.reason.stack || e.reason.message)) || (e && e.reason) || e).slice(0, 500) });
    } catch (e2) {}
  });
} catch (e) {}

self.onmessage = function (ev) {
  var m = ev.data || {};
  
  __jstage('msg:in', { type: m.type, id: m.id });
  
  try{ reply({ type: 'rx', rxType: m.type, rxId: m.id }); }catch(e){}
  try {
    if (m.type === 'ping') {
      
      reply({ type: 'pong', id: m.id, n: m.n, hasRuntime: !!runtime });
      return;
    }
    if (m.type === 'init') {
      ctx.resources = normalizeResources(m.resources);
      tccModule = m.tccModule;
      libcModule = m.libcModule;
      if (!tccModule || !libcModule) throw new Error('init 缺少 tccModule / libcModule');
      initWabt().then(function (wb) {
        ctx.wabt = wb;
        if (!wb) { reply({ type: 'error', id: m.id, message: 'wabt 初始化失败（无 parseWat）' }); return; }
        patchAppRuntime();
        installSymbolShim();
        return Runtime2.AppRuntime.create({ libc: libcModule }).then(function (rt) {
          runtime = rt;
          reply({ type: 'init-ok', id: m.id });
        });
      }).catch(function (e) {
        reply({ type: 'error', id: m.id, message: 'init 失败：' + String(e && e.message || e) });
      });
      return;
    }
    if (m.type === 'compile') {
      compile(m.src).then(function (result) {
        if (result.artifact) result.wat = result.artifact.__wat;
        reply({ type: 'result', id: m.id, result: result });
      }).catch(function (e) {
        reply({ type: 'error', id: m.id, message: String(e && e.message || e) });
      });
      return;
    }
    if (m.type === 'run') {
      var runArtifact = m.wat ? attachWat(m.artifact, m.wat) : m.artifact;
      runMeasured(runArtifact, m, m.timeoutMs || 5000).then(function (r) {
        reply({ type: 'result', id: m.id, result: r });
      }).catch(function (e) {
        reply({ type: 'error', id: m.id, message: String(e && e.message || e) });
      });
      return;
    }
    if (m.type === 'debug') {
      
      reply({ type: 'dbg', id: m.id, value: {
        guard: (runtime && runtime.__guardDbg) || null,
        hasRuntime: !!runtime,
        loopsPatched: _runPatched,
        
        traceLen: __JTRACE ? __JTRACE.ev.length : 0,
        trace: __JTRACE ? __JTRACE.ev.slice(-80) : null,
      } });
      return;
    }
    if (m.type === 'judge') {
      
      (async function () {
        __jstage('judge:recv', { id: m.id, srcLen: (m.studentSrc || '').length,
                                 hasQ: !!m.q, qKeys: m.q ? Object.keys(m.q).join(',') : '',
                                 hasOriginal: !!(m.q && m.q.original),
                                 nFaults: (m.q && m.q.faults) ? m.q.faults.length : -1,
                                 nTests: (m.q && m.q.tests) ? m.q.tests.length : -1,
                                 timeoutMs: m.timeoutMs, preset: !!m.preset });
        __jstage('judge:runtimeReady', { hasRuntime: !!runtime });
        
        if (m.runOnly) {

          return previewOnly(m.id, m.q, m.studentSrc, m.timeoutMs, m.stdin).then(function (r) {
            reply({ type: 'result', id: m.id, result: r });
          }, function (e) {
            __jstage('preview:reject', { msg: String((e && (e.stack || e.message)) || e).slice(0, 500) });
            reply({ type: 'error', id: m.id,
                    message: '预览链路异常：' + String((e && (e.message || e)) || e) });
          });
        }
        return judgeOne(m.id, m.q, m.studentSrc, m.timeoutMs, m.preset);
      })().catch(function (e) {
        __jstage('judge:chainRejection', { msg: String((e && (e.stack || e.message)) || e).slice(0, 800) });
        reply({ type: 'error', id: m.id,
                message: '判题链路异常：' + String((e && (e.message || e)) || e) });
      });
      return;
    }
    reply({ type: 'error', id: m.id, message: '未知消息类型: ' + m.type });
  } catch (e) {
    reply({ type: 'error', id: m.id, message: String(e && e.stack || e) });
  }
};

reply({ type: 'loaded', missing: MISSING });
