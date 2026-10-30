
var CQuizProgrammingRuntime = (function () {
  'use strict';
  var tasks = new Map(), sequence = 0;
  function bounded(value, cap) {
    var text=String(value || ''), enc=new TextEncoder(), raw=enc.encode(text);
    if(raw.length<=cap)return text;
    text=new TextDecoder().decode(raw.subarray(0,Math.max(0,cap)));
    while(enc.encode(text).length>cap)text=text.slice(0,-1);
    return text;
  }
  function resultStatus(r) {
    if(r.errorCategory==='output_limit')return 'output_limit';
    if(r.errorCategory==='tool'||r.errorCategory==='env')return 'tool_error';
    if(r.aborted||/^TLE/.test(r.error || ''))return 'timeout';
    if(r.error||!Number.isInteger(r.rc))return 'runtime_error';
    return 'completed';
  }
  function resource(id) {
    var node=document.getElementById(id);
    if(!node)throw new Error('编程运行资源缺失：'+id);
    return node.textContent;
  }
  function Client() {
    this.pending=new Map();this.closed=false;
    var code=['res-wabt','res-runtime','res-engine','res-worker','res-program-worker'].map(resource).join('\n');
    var url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
    try{this.worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    this.loaded=this.wait('loaded',20000);
    this.worker.onmessage=function(event){
      var m=event.data || {},key=m.type==='loaded'?'loaded':m.id,p=this.pending.get(key);
      if(!p||m.type==='rx')return;
      this.pending.delete(key);clearTimeout(p.timer);
      if(m.type==='error')p.reject(new Error(m.message || '编程运行环境失败'));else p.resolve(m.result || m);
    }.bind(this);
    this.worker.onerror=function(event){event.preventDefault();this.close(new Error(event.message || '编程运行环境失败'));}.bind(this);
  }
  Client.prototype.wait=function(id,ms){
    if(this.closed)return Promise.reject(new Error('任务已停止'));
    return new Promise(function(resolve,reject){var timer=setTimeout(function(){this.close(new Error('编译或运行环境等待超时'));}.bind(this),ms);this.pending.set(id,{resolve:resolve,reject:reject,timer:timer});}.bind(this));
  };
  Client.prototype.request=function(message,ms){var id=++sequence,p=this.wait(id,ms || 20000);if(!this.closed)this.worker.postMessage(Object.assign({id:id},message));return p;};
  Client.prototype.init=async function(){
    var loaded=await this.loaded;if(loaded.missing&&loaded.missing.length)throw new Error('运行资源缺失：'+loaded.missing.join(','));
    var modules=await Promise.all(['res-tcc','res-libc'].map(function(id){return WebAssembly.compile(Uint8Array.from(atob(resource(id).trim()),function(c){return c.charCodeAt(0);}));}));
    await this.request({type:'init',tccModule:modules[0],libcModule:modules[1],resources:resource('res-ide')});
  };
  Client.prototype.close=function(reason){if(this.closed)return;this.closed=true;this.worker.terminate();this.pending.forEach(function(p){clearTimeout(p.timer);p.reject(reason || new Error('任务已停止'));});this.pending.clear();};
  function cancel(requestId){var task=tasks.get(requestId);if(task){task.close();tasks.delete(requestId);}}
  async function execute(request,context){
    var signal=context&&context.signal,client=null,abort=function(){cancel(request.requestId);};
    var response={protocol:1,requestId:request.requestId,status:'tool_error',diagnostics:'',cases:[]};
    try{
      if(!request||request.protocol!==1||typeof request.code!=='string'||!Array.isArray(request.tests)||request.tests.length<1||request.tests.length>32)throw new Error('编程运行请求无效');
      if(signal&&signal.aborted)throw new Error('任务已停止');
      client=new Client();tasks.set(request.requestId,client);if(signal)signal.addEventListener('abort',abort,{once:true});
      await client.init();
      var compiled=await client.request({type:'compile',src:request.code});
      response.diagnostics=bounded(compiled.diagnostics,65536);
      if(!compiled.ok){
        var category=typeof JudgeDiagnostics==='object'?JudgeDiagnostics.classify(compiled.diagnostics,compiled.errorInfo):null;
        response.status=category&&(category.verdict==='tool'||category.verdict==='env')?'tool_error':'compile_error';
        return response;
      }
      for(var i=0;i<request.tests.length;i++){
        var test=request.tests[i],r=await client.request({type:'pilot-run',artifact:compiled.artifact,wat:compiled.wat,stdin:test.stdin},6500);
        var stdout=bounded(r.stdout,65536),remaining=65536-new TextEncoder().encode(stdout).length,stderr=bounded(r.stderr,remaining);
        var status=resultStatus(r);

        if(status==='completed'&&(stdout!==r.stdout||stderr!==r.stderr))status='tool_error';
        response.cases.push({id:test.id,status:status,stdout:stdout,stderr:stderr,exitCode:r.rc,ms:r.ms,stdoutBytes:r.stdoutBytes,stderrBytes:r.stderrBytes});
      }
      response.status='completed';return response;
    }catch(e){response.status='tool_error';response.diagnostics=bounded(e&&e.message || e,65536);response.cases=[];return response;}
    finally{if(signal)signal.removeEventListener('abort',abort);if(client)client.close();tasks.delete(request.requestId);}
  }
  var adapter={protocol:1,name:'TCC 本地离线运行 · 稳定配套内核',responseWaitMs:120000,execute:execute,cancel:cancel};
  return {adapter:adapter,execute:execute,cancel:cancel,resultStatus:resultStatus,bounded:bounded};
}());
if(typeof window==='object'){
  window.CQuizProgrammingRuntime=CQuizProgrammingRuntime;
  if(window.CQuizProgramming&&typeof Worker==='function')window.CQuizProgramming.connect(CQuizProgrammingRuntime.adapter);
}
if(typeof module==='object'&&module.exports)module.exports=CQuizProgrammingRuntime;
