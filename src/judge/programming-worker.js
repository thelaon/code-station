
(function () {
  'use strict';
  var originalMessage = self.onmessage, active = null;
  var originalHost = Runtime2.createLibcImports;
  var originalApp = Runtime2.createAppLibcImports;
  Runtime2.createLibcImports = function (memory, options) {
    var imports = originalHost(memory, options);
    if (!active) return imports;
    var budget = active, input = new TextEncoder().encode(options.stdin || ''), position = 0;
    imports.env.rt_host_read = function (fd, ptr, len) {
      if (fd !== 0) return -9;
      var n = Math.min(len >>> 0, input.length - position);
      if (ptr < 0 || ptr + n > memory.buffer.byteLength) throw new Error('无效的输入缓冲地址');
      new Uint8Array(memory.buffer).set(input.subarray(position, position + n), ptr);
      position += n;
      return n;
    };
    imports.env.rt_host_write = function (fd, ptr, len) {
      if (fd !== 1 && fd !== 2) return -9;
      len = len >>> 0; ptr = ptr >>> 0;
      if (ptr + len > memory.buffer.byteLength) throw new Error('无效的输出缓冲地址');
      var take = Math.min(len, budget.cap - budget.total), channel = fd === 1 ? 'stdout' : 'stderr';
      budget[channel].set(new Uint8Array(memory.buffer, ptr, take), budget[channel+'Bytes']);
      budget[channel+'Bytes'] += take; budget.total += take;
      if (take < len) {
        budget.exceeded = true;
        throw new Error('PILOT_OUTPUT_LIMIT：输出超过 '+budget.cap+' 字节');
      }
      return len;
    };
    return imports;
  };
  Runtime2.createAppLibcImports = function (memory, exports) {
    var imports = originalApp(memory, exports);
    if (!active) return imports;
    exports.rt_stdio_set_hosted(1);

    ['rt_stdio_set_hosted', 'rt_stdio_reset', 'rt_init_heap', 'rt_stdin_set'].forEach(function (name) {
      if (typeof imports[name] === 'function') imports[name] = function () {
        throw new Error('PILOT_INTERNAL_API：实验版不开放运行库内部配置接口 '+name);
      };
    });
    return imports;
  };
  self.onmessage = function (event) {
    var m = event.data || {};
    if (m.type !== 'pilot-run') return originalMessage(event);
    if (active) { self.postMessage({type:'error', id:m.id, message:'已有程序运行中'}); return; }
    var cap = 65536;
    active = {cap:cap, total:0, stdout:new Uint8Array(cap), stderr:new Uint8Array(cap), stdoutBytes:0, stderrBytes:0, exceeded:false};
    var current = active;
    Promise.resolve().then(function () {
      var artifact = attachWat(m.artifact, m.wat);
      return runMeasured(artifact, {stdin:String(m.stdin || ''), timeoutMs:2000}, 2000);
    }).then(function (r) {
      r.stdout = new TextDecoder().decode(current.stdout.subarray(0,current.stdoutBytes));
      r.stderr = new TextDecoder().decode(current.stderr.subarray(0,current.stderrBytes));
      r.stdoutBytes = current.stdoutBytes; r.stderrBytes = current.stderrBytes;
      if (current.exceeded) { r.error = '输出超过64 KiB，已停止运行'; r.errorCategory = 'output_limit'; r.aborted = true; }
      else if (/PILOT_INTERNAL_API/.test(r.debugError || r.error || '')) { r.error = '程序调用了实验版未开放的运行库内部接口'; r.errorCategory = 'tool'; }
      active = null;
      self.postMessage({type:'result', id:m.id, result:r});
    }).catch(function (e) {
      active = null;
      self.postMessage({type:'error', id:m.id, message:String(e && e.message || e)});
    });
  };
}());
