
var FixEngine = (function(){
  'use strict';

  
  function __cq(){ return window.__cq || {}; }
  function el(t, c, x){ return __cq().el(t, c, x); }
  function viewEl(){ return __cq().viewEl(); }
  function emptyNode(n){ return __cq().emptyNode(n); }
  function save(k, v){ return __cq().save(k, v); }
  function load(k, d){ return __cq().load(k, d); }
  function renderNav(){ return __cq().renderNav(); }
  function scheduleAfter(p, n, g){ return __cq().scheduleAfter(p, n, g); }
  function bumpDaily(){ return __cq().bumpDaily(); }
  function papLabel(p){ return __cq().papLabel(p); }
  function qLabel(o){ return __cq().qLabel(o); }
  function fxid(p, n){ return __cq().fxid(p, n); }
  function fixPer(q){ return __cq().fixPer(q); }
  function fixScoreOf(q){ return __cq().fixScoreOf(q); }
  function shell(main, side, opt){ return __cq().shell(main, side, opt); }
  function refreshProgress(){ return __cq().refreshProgress(); }
  function queueAutoNext(o,correct,token){return __cq().queueAutoNext(o,correct,token);}
  function numOf(n){ return __cq().numOf(n); }
  function findF(p, n){ return __cq().findF(p, n); }
  function SESSION(){ return __cq().SESSION; }
  function MARKS(){ return __cq().MARKS; }
  function LSKEY(){ return __cq().LSKEY; }
  function examCanEdit(){return __cq().examCanEdit();}
  function saveExamCode(o,code){return __cq().saveExamCode(o,code);}

  var RUN_TIMEOUT = 1000;        
  
  var RUN_TIMEOUT_PREVIEW = 3000;
  
  var INIT_TIMEOUT = 60000;
  var INIT_TICK = 500;
  
  var COLD_BUDGET = INIT_TIMEOUT + 15000;

  
  var WORKER_SRC  = ['res-wabt', 'res-runtime', 'res-engine', 'res-worker'];

  var st = {
    worker: null, workerUrl: null, starting: null, seq: 0, pending: {},
    tcc: null, libc: null, ready: false, initErr: null,
    saveTimer: null, judging: null, epoch: 0,
    
    pong: null, pongOk: false, pongWait: null, pongSeq: 0
  };

  
  function resetChannel(){ st.pong = null; st.pongOk = false; st.pongWait = null; }

  
  function $(id){ return document.getElementById(id); }
  
  function stage(name, extra){
    if(!window.__CQUIZ_TEST__) return;
    var t = window.__FIXTRACE || (window.__FIXTRACE = []);
    if(!t.t0) t.t0 = Date.now();
    t.push({ t: Date.now() - t.t0, name: name,
             extra: extra === undefined ? null : extra });
  }
  function b64ToBytes(b64){
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n), i;
    for(i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function lines(s){ return String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n'); }
  function codeKey(pid, num){ return 'cqframe.fix.' + pid + '.x' + num; }

  
  function getCode(pid, num, defCode){
    try{
      var v = localStorage.getItem(codeKey(pid, num));
      
      if(v && v.length >= defCode.length * 0.5) return v;
    }catch(e){}
    return defCode;
  }
  function putCode(pid, num, code){
    window.CQStorage.setRaw(codeKey(pid,num),code);
  }
  function saveSoon(pid, num, code){
    if(st.saveTimer) clearTimeout(st.saveTimer);
    st.saveTimer = setTimeout(function(){ putCode(pid, num, code); }, 400);
  }
  function dropCode(pid, num){
    if(st.saveTimer) clearTimeout(st.saveTimer);
    st.saveTimer = null;
    window.CQStorage.remove(codeKey(pid,num));
  }

  function resetUserData(){
    st.epoch++;
    clearTimeout(st.saveTimer); clearTimeout(st.ioTimer); clearInterval(st.initTick);
    st.saveTimer = st.ioTimer = st.initTick = null;
    if(st.worker){ try{ st.worker.terminate(); }catch(e){} }
    if(st.workerUrl){ try{ URL.revokeObjectURL(st.workerUrl); }catch(e){} }
    st.worker = null; st.workerUrl = null;
    settleAll('学习数据已清空');
    st.starting = null; st.ready = false; st.initErr = null; st.judging = null;
    resetChannel();
  }

  
  function ensureAssets(){
    if(st.tcc && st.libc) return Promise.resolve();
    stage('ensureAssets:begin');
    var tccB = b64ToBytes($('res-tcc').textContent.trim());
    var libcB = b64ToBytes($('res-libc').textContent.trim());
    stage('ensureAssets:decoded', { tcc: tccB.length, libc: libcB.length });
    return Promise.all([
      st.tcc  ? Promise.resolve(st.tcc)  : WebAssembly.compile(tccB),
      st.libc ? Promise.resolve(st.libc) : WebAssembly.compile(libcB)
    ]).then(function(mods){
      st.tcc = mods[0]; st.libc = mods[1];
      stage('ensureAssets:compiled');
    });
  }

  
  function buildWorkerUrl(){
    var parts = WORKER_SRC.map(function(id){
      var n = $(id);
      if(!n) throw new Error('页面缺少引擎资源块 #' + id + '（构建时没注入？）');
      stage('workerSrc:' + id, { len: n.textContent.length });
      return n.textContent;
    });
    var blob = new Blob(parts, { type: 'text/javascript' });
    stage('workerSrc:blob', { size: blob.size });
    var url = URL.createObjectURL(blob);
    if(window.__CQUIZ_TEST__) window.__WORKER_URL = url;   
    return url;
  }

  function startWorker(onTick){
    var epoch = st.epoch;
    if(st.worker) return Promise.resolve(st.worker);
    if(st.starting) return st.starting;
    st.ready = false; st.initErr = null;
    
    if(onTick) onTick('正在装载判题引擎……');
    var t0 = Date.now();
    st.initTick = setInterval(function(){
      var s = Math.round((Date.now() - t0) / 1000);
      if(onTick) onTick('正在装载判题引擎……已用 ' + s + ' 秒' +
                        (s >= 8 ? '（首次判题要装载 C 编译器，慢一点是正常的）' : ''));
      
      if(st.worker && !st.ready && s >= 8 && !st.quiet){
        st.quiet = true;
        st.initErr = '判题引擎没能完成初始化（已等待 ' + s + ' 秒）';
        stage('worker:quiet', { s: s });
        settleAll(st.initErr);
      }
    }, INIT_TICK);
    stage('startWorker:begin');
    st.starting = ensureAssets().then(function(){
      if(epoch !== st.epoch) throw new Error('学习数据已清空');
      stage('startWorker:assetsReady');
      if(onTick) onTick('编译器已就绪，正在启动判题线程……');
      var url = buildWorkerUrl();
      var w = new Worker(url);
      
      w.onmessage = onMessage;
      w.onerror = function(ev){
        stage('worker:onerror', { msg: ev.message || ev.type });
        st.initErr = '判题 Worker 出错：' + (ev.message || ev.type || '未知');
        st.ready = false;
        settleAll('判题引擎崩溃：' + st.initErr);
      };
      
      w.onmessageerror = function(ev){
        stage('worker:onmessageerror', { data: String(ev && ev.data).slice(0, 120) });
        st.initErr = '判题 Worker 消息无法反序列化（WebAssembly.Module 传递失败）';
        st.ready = false;
        settleAll(st.initErr);
      };
      st.worker = w;
      st.workerUrl = url;
      
      if(window.__CQUIZ_TEST__){
        window.__WMSG = [];
        w.addEventListener('message', function(ev){
          try{
            window.__WMSG.push({ at: Date.now(), type: (ev.data || {}).type, id: (ev.data || {}).id,
                                 ctor: (w && w.constructor && w.constructor.name) || '?' });
            if(window.__WMSG.length > 50) window.__WMSG.shift();
          }catch(e){}
        });
        window.__WHOOK = { ctor: (w && w.constructor && w.constructor.name) || '?',
                           hasAddEventListener: !!(w && w.addEventListener),
                           postType: typeof (w && w.postMessage),
                           urlHead: String(url).slice(0, 32) };
      }
      return new Promise(function(res, rej){
        var p = { init: true, res: res, rej: rej, timer: null,
                  type: 'init', ms: INIT_TIMEOUT, onDead: null, postPatch: null };
        p.timer = setTimeout(function(){
          
          stage('init:timeout');
          delete st.pending[0];
          try{ w.terminate(); }catch(e){}
          if(st.worker === w){ st.worker = null; st.ready = false; }
          resetChannel();
          rej(new Error('判题引擎启动超时（' + Math.round(INIT_TIMEOUT / 1000) + ' 秒）'));
        }, INIT_TIMEOUT);
        st.pending[0] = p;
        stage('init:posted');
        
        w.postMessage({ id: 0, type: 'init', tccModule: st.tcc, libcModule: st.libc,
                        resources: $('res-ide') ? $('res-ide').textContent : null });
      });
    }).then(function(){
      if(st.initTick){ clearInterval(st.initTick); st.initTick = null; }
      stage('startWorker:ready');
      st.starting = null; st.ready = true; return st.worker;
    }, function(e){
      if(st.initTick){ clearInterval(st.initTick); st.initTick = null; }
      stage('startWorker:failed', { err: String(e && e.message || e) });
      st.starting = null; st.ready = false; st.initErr = String(e && e.message || e);
      throw e;
    });
    return st.starting;
  }

  function onMessage(ev){
    try{ handleMessage(ev); }
    catch(e){
      
      stage('worker:onmessage-throw', { err: String(e && (e.stack || e.message) || e) });
      st.initErr = '判题消息处理失败：' + String(e && e.message || e);
      settleAll(st.initErr);
    }
  }

  function handleMessage(ev){
    var m = ev.data || {};
    
    if(m.type === 'pong'){
      stage('pong:in', { n: m.n, hasRuntime: m.hasRuntime });
      if(st.pongWait){ var pw = st.pongWait; st.pongWait = null; pw.res(m); }
      return;
    }
    var p = st.pending[m.id];
    if(!p) return;
    if(m.type === 'init-ok'){
      clearTimeout(p.timer); delete st.pending[m.id];
      if(st.workerUrl){ try{ URL.revokeObjectURL(st.workerUrl); }catch(e){} st.workerUrl = null; }
      p.res(true); return;
    }
    if(m.type === 'loaded'){
      clearTimeout(p.timer); delete st.pending[m.id];
      var miss = (m.missing || []).join('、');
      p.rej(new Error('判题引擎缺少依赖：' + miss)); return;
    }
    if(m.type === 'result' || m.type === 'dbg'){
      clearTimeout(p.timer); delete st.pending[m.id];
      
      var val = (m.type === 'dbg') ? { dbg: m.value } : m.result;
      p.res({ result: val, ms: Date.now() - p.t0, killed: false }); return;
    }
    if(m.type === 'error'){
      clearTimeout(p.timer); delete st.pending[m.id];
      p.rej(new Error(m.message || '判题失败')); return;
    }
  }

  function settleAll(msg){
    Object.keys(st.pending).forEach(function(k){
      var p = st.pending[k];
      delete st.pending[k];
      if(p.timer) clearTimeout(p.timer);
      if(p.postPatch) p.postPatch(msg);
      else p.rej(new Error(msg));
    });
  }

  
  
  function takePending(){ return st.pending[st.seq] || null; }

  
  function ensurePong(w){
    if(st.pongOk) return Promise.resolve(true);
    if(st.pong) return st.pong;
    st.pongSeq = (st.pongSeq || 0) + 1;
    var n = st.pongSeq;
    st.pong = new Promise(function(res){
      st.pongWait = { res: res };
      setTimeout(function(){
        if(!st.pongWait) return;
        
        stage('pong:retry', { n: n });
        try{ w.postMessage({ type: 'ping', id: 0, n: n }); }catch(e){}
        setTimeout(function(){
          if(!st.pongWait) return;
          stage('pong:timeout', { n: n });
          st.pongWait = null; st.pong = null; res(false);
        }, 2000);
      }, 2000);
      stage('ping:post', { n: n });
      try{ w.postMessage({ type: 'ping', id: 0, n: n }); }
      catch(e){ stage('ping:post-throw', { err: String(e && e.message || e) }); }
    }).then(function(v){ if(v){ st.pongOk = true; } return v; });
    return st.pong;
  }

  
  function ask(msg, budget, onTick, onDead){
    var epoch = st.epoch;
    return startWorker(onTick).then(function(w){
      if(epoch !== st.epoch) throw new Error('学习数据已清空');
      var id = ++st.seq;
      var tStart = Date.now();
      msg.id = id;
      
      return ensurePong(w).then(function(ok){
        if(epoch !== st.epoch) throw new Error('学习数据已清空');
        var t = Date.now();
        stage('ask:handshake', { type: msg.type, id: id, pong: ok, ms: t - tStart });
        return sendNow(w, msg, id, budget, ok, t, onDead);
      });
    });
  }

  
  function sendNow(w, msg, id, budget, chOk, t0, onDead){
    return new Promise(function(res, rej){
        var p = { res: res, rej: rej, type: msg.type, ms: budget, t0: t0,
                  onDead: onDead || null, postPatch: null }; 
        p.timer = setTimeout(function(){
          
          stage('ask:timeout', { type: p.type, id: id, ms: Date.now() - t0, budget: budget });
          delete st.pending[id];
          var partial = p.onDead ? p.onDead() : null;
          try{ w.terminate(); }catch(e){}
          st.worker = null; st.ready = false;
          st.stopping = true;
          
          st.starting = null;
          resetChannel();
          res({ result: partial, ms: Date.now() - t0, killed: true });
        }, budget);
        st.pending[id] = p;
        stage('ask:post', { type: msg.type, id: id, budget: budget,
                            payload: JSON.stringify(msg).length, channelVerified: !!chOk });
        
        try{
          
          if(window.__CQUIZ_TEST__){
            window.__WPOST = window.__WPOST || [];
            window.__WPOST.push({ at: Date.now(), type: msg.type, id: id,
                                  bytes: JSON.stringify(msg).length,
                                  sameWorker: (st.worker === w) });
            if(window.__WPOST.length > 60) window.__WPOST.shift();
          }
          w.postMessage(msg);
          stage('ask:posted', { type: msg.type, id: id });
        }catch(e){
          delete st.pending[id];
          clearTimeout(p.timer);
          stage('ask:post-throw', { type: msg.type, id: id,
                                    err: String(e && (e.name + ': ' + e.message) || e) });
          rej(new Error('这条消息无法发给判题线程（' + String(e && e.message || e) +
                        '）。载荷大小 ' + JSON.stringify(msg).length + ' 字节。'));
        }
    });
  }

  
  
  
  function markerAt(line){
    try {
      var F = window.JudgeFaults;
      if (F && typeof F.hasTailComment === 'function') return F.hasTailComment(line);
    } catch (e) {}
    var s = String(line == null ? '' : line);
    if (/\/\*[\s\S]*\*\/\s*$/.test(s)) return true;
    var q = s.replace(/\/\/[^\n]*$/, '').replace(/\s+$/, '');
    return q.length > 0 && q !== s.replace(/\s+$/, '');
  }
  
  function renderGutter(ta, gut){
    var n = ta.value.split('\n').length;
    var out = [];
    for(var i = 1; i <= n; i++) out.push(String(i));
    gut.textContent = out.join('\n');
    
    gut.style.width = (String(n).length + 0.7) + 'em';
    syncScroll(ta, gut);
  }
  function syncScroll(ta, gut){ gut.scrollTop = ta.scrollTop; }

  
  function reportDetails(title, body){
    return '<details class="report-detail"><summary>' + esc(title) +
      '</summary><div class="report-body">' + body + '</div></details>';
  }
  function reportValues(pairs){
    return '<dl class="report-code">' + pairs.map(function(p){
      var value = p[1] == null ? '' : String(p[1]);
      return '<dt>' + esc(p[0]) + '</dt><dd><pre>' + esc(value || '（空）') + '</pre></dd>';
    }).join('') + '</dl>';
  }
  function reportTag(label, state){
    return '<span class="report-tag' + (state ? ' is-' + state : '') + '">' + esc(label) + '</span>';
  }
  function uniqueMessages(list){
    var seen = Object.create(null);
    return list.map(String).filter(function(text){
      if(!text || seen[text]) return false;
      seen[text] = true; return true;
    });
  }
  function compileReport(L2){
    var body = [];
    if(L2.reason) body.push('<p>' + esc(L2.reason) + '</p>');
    (L2.items || []).forEach(function(it){
      if(!it || it.category === 'tool' || it.category === 'env') return;
      body.push('<p class="' + (it.severity === 'error' ? 'bad' : 'muted') + '">' +
        (it.line ? '第 ' + esc(it.line) + ' 行：' : '') + esc(it.message || '') + '</p>');
    });
    if(!L2.ok && !L2.errorInfo && L2.verdict !== 'tool' && L2.verdict !== 'env' && !(L2.items || []).filter(function(it){return it && it.category !== 'tool';}).length && L2.diagnostics)
      body.push(reportValues([['编译信息', L2.diagnostics]]));
    if((L2.libcGaps || []).length)
      body.push('<p>运行库暂不支持：' + esc(L2.libcGaps.join('、')) + '</p>');
    if((L2.toolItems || []).length)
      body.push('<p>含 ' + L2.toolItems.length + ' 条编译器限制，详情不计为代码错误。</p>');
    if(!L2.ok && !body.length) body.push('<p>编译器未返回具体信息，请检查代码后重试。</p>');
    return body.length ? reportDetails('编译信息', body.join('')) : '';
  }
  function runtimeReport(L3, timeout){
    if(!L3) return '';
    if(L3.available === false || L3.toolLimited){
      return reportDetails('运行说明', '<p>' + esc(L3.reason || '运行未完成，当前结果不代表运行验证通过。') + '</p>');
    }
    var cases = L3.cases || [];
    if(!cases.length) return reportDetails('运行说明', '<p>本题没有预设运行测试。</p>');
    var body = cases.map(function(c, i){
      var state = c.pass ? '通过' : c.aborted ? '运行超时' : c.error ? '运行出错' : '输出不符';
      var note = c.aborted ? '运行超过 ' + timeout + ' ms。' : c.error || c.reason || '';
      return '<details class="report-case"><summary>测试 ' + (i + 1) +
        ' · <span class="' + (c.pass ? 'ok' : 'bad') + '">' + esc(state) + '</span></summary>' +
        (note ? '<p>' + esc(note) + '</p>' : '') +
        reportValues([['输入',c.stdin],['预期输出',c.expect],['实际输出',c.actual]]) + '</details>';
    }).join('');
    return reportDetails('运行测试 · ' + (L3.passed || 0) + '/' + (L3.total || cases.length) + ' 通过', body);
  }

  
  function reportHtml(r, fq, per){
    r = r || {};
    var L1 = r.L1 || {}, L2 = r.L2, L3 = r.L3;
    var waiting = !L2 && !r.tle;
    var warnings = uniqueMessages((L1.warnings || []).concat(r.warnings || []));
    var errors = uniqueMessages(L1.errors || []);
    var tone = r.score >= r.totalScore && r.totalScore ? 'ok' : 'bad';
    var h = ['<div class="report-score"><strong class="' + tone + '">' +
      esc(r.score == null ? '—' : r.score) + '<small> / ' + esc(r.totalScore == null ? '—' : r.totalScore) +
      ' 分</small></strong><span>修正 ' + (r.fixed || 0) + '/' + (r.total || 0) + ' 处</span></div>'];
    h.push('<div class="report-status">');
    h.push(reportTag(waiting ? '正在编译运行' : !L2 ? '编译未完成' : L2.verdict === 'tool' ? '编译器限制' :
      L2.ok ? '编译通过' : '编译未通过', waiting || !L2 || L2.verdict === 'tool' ? 'warning' : L2.ok ? 'ok' : 'bad'));
    if(r.tle) h.push(reportTag('运行超时','warning'));
    else if(L3) h.push(reportTag(L3.available === false || L3.toolLimited || !L3.total ? '运行未验证' :
      '运行 ' + (L3.passed || 0) + '/' + L3.total, L3.available === false || L3.toolLimited || !L3.total ?
      'warning' : L3.allPassed ? 'ok' : 'bad'));
    if(errors.length || warnings.length)
      h.push(reportTag((errors.length + warnings.length) + ' 条修改提醒','warning'));
    h.push('</div>');
    h.push('<p class="report-next">' + (waiting ? '逐处核对已完成，正在等待编译运行。' : r.tle ?
      '运行超时；逐处得分已保留，可展开详情检查。' : L2 && !L2.ok && L2.verdict !== 'tool' ?
      '编译未通过，展开编译信息定位错误。' : r.fixed >= r.total && r.total ?
      '本题各处已改对。' : '还有 ' + Math.max(0,(r.total || 0)-(r.fixed || 0)) + ' 处未改对，可展开核对。') + '</p>');
    var faults = (r.L4 || []).map(function(it){
      return '<div class="report-fault"><span class="' + (it.ok ? 'ok' : 'bad') + '">第 ' + esc(it.line) +
        ' 行 · ' + esc(it.why || (it.ok ? '正确' : '未改对')) + '</span>' +
        reportValues([['原题',String(it.original || '').replace(/^\s+/, '')],
          ['你的修改',String(it.student || '').replace(/^\s+/, '')]]) + '</div>';
    }).join('');
    if(faults) h.push(reportDetails('逐处核对 · ' + (r.fixed || 0) + '/' + (r.total || 0) + ' 正确', faults));
    if(L2) h.push(compileReport(L2));
    h.push(runtimeReport(L3, L3 && L3.runTimeoutMs || RUN_TIMEOUT));
    var lc = L1.lineCount || {}, changed = L1.changed || [];
    var form = '<p>代码行数 ' + esc(lc.student == null ? '—' : lc.student) + '/' +
      esc(lc.original == null ? '—' : lc.original) + '；改动行：' + esc(changed.length ? changed.join('、') : '无') + '。</p>';
    errors.concat(warnings).forEach(function(text){ form += '<p>' + esc(text) + '</p>'; });
    if(!errors.length && !warnings.length) form += '<p>修改要求已满足。</p>';
    h.push(reportDetails('修改要求' + (errors.length + warnings.length ? ' · ' + (errors.length + warnings.length) + ' 条提醒' : ''), form));
    var notes = uniqueMessages(r.notes || []).filter(function(text){ return warnings.indexOf(text) < 0 && errors.indexOf(text) < 0; });
    if(notes.length) h.push(reportDetails('补充说明', notes.map(function(text){return '<p>' + esc(text) + '</p>';}).join('')));
    return h.join('');
  }

  function runReportHtml(r, fq){
    r = r || {};
    var L2 = r.L2, L3 = r.L3;
    if(!L2 && !L3) return '<p class="bad">未能取得编译结果</p><p class="report-next">首次装载可能较慢，请稍后重试；若持续失败，请检查循环能否结束。</p>';
    var tool = L2 && L2.verdict === 'tool';
    var h = ['<div class="report-status">' + reportTag(tool ? '编译器限制' : L2 && L2.ok ?
      '编译通过' : '编译未通过', tool ? 'warning' : L2 && L2.ok ? 'ok' : 'bad')];
    if(L3) h.push(reportTag(L3.available === false || L3.toolLimited || !L3.total ? '运行未验证' :
      '运行 ' + (L3.passed || 0) + '/' + L3.total, L3.available === false || L3.toolLimited || !L3.total ?
      'warning' : L3.allPassed ? 'ok' : 'bad'));
    h.push('</div><p class="report-next">预览不计分，确认后可提交。</p>');
    if(L2) h.push(compileReport(L2));
    h.push(runtimeReport(L3, L3 && L3.runTimeoutMs || RUN_TIMEOUT_PREVIEW));
    return h.join('');
  }

  
  
  function renderShell(cur, fq, renderCards){
    
    return renderCards();
  }
  function appendPackFigures(parent,q){(q.imgs&&q.imgs.data||[]).forEach(function(src,i){var image=el('img');image.src=src;image.alt='题目插图 '+(i+1);image.style.maxWidth='100%';parent.appendChild(image);});}
  function renderFixCard(cur, fq){
    renderNav();
    
    var fnum = String(cur.num == null ? '' : cur.num).replace(/^x/, '');
    var kk = fxid(cur.pid, fnum);
    var per = fixPer(fq);
    var rec = SESSION().fix && SESSION().fix[kk];

    var left = el('div');
    var right = el('div');

    
    var full = fixScoreOf(fq);

    

    
    function chip(parts, focus){
      var c = el('span','chip');
      if(focus) c.className = 'chip focus';
      parts.forEach(function(x){
        
        if(typeof x === 'string') c.appendChild(el('span','muted', x));
        else c.appendChild(el('b', null, String(x)));
      });
      return c;
    }
    var bar0 = el('div','papermeta');
    bar0.appendChild(chip(['本题 ', fq.errorCount, ' 处错误']));
    
    bar0.appendChild(chip(['满分 ', full, ' 分'], true));
    if(fq.srcFile) bar0.appendChild(chip([fq.srcFile]));
    if(rec) bar0.appendChild(chip(['上次 ', rec.fixed + '/' + rec.total, ' 处'], true));
    if(MARKS()[kk]) bar0.appendChild(el('span','chip','已标记 ★'));
    left.appendChild(bar0);

    var stemBox = el('div','fix-stem');
    stemBox.textContent = fq.stem || '（本题没有题面文本，按代码里的功能要求修改）';
    appendPackFigures(left,fq);
    left.appendChild(stemBox);
    
    var caseBox = renderCaseBox(fq);
    if(caseBox) left.appendChild(caseBox);

    
    var quirks = fq.quirks || {};
    if(quirks.unjudgeable){
      left.appendChild(el('div','warnline',
        '本机限制：' + (quirks.unjudgeable.reason || quirks.unjudgeable) +
        '　—— 仍然可以改，判分以「逐处核对」为准。'));
    }
    if(quirks.encodingSensitive){
      left.appendChild(el('div','warnline',
        '编码提示：' + quirks.encodingSensitive));
    }
    if(quirks.droppedTests){
      
      var nDrop = (quirks.droppedTests.length != null)
        ? quirks.droppedTests.length : Number(quirks.droppedTests) || 0;
      left.appendChild(el('div','warnline',
        '本题有 ' + nDrop + ' 个测试点因上面的限制被移除，不计入对拍。'));
    }

    
    var stat = el('div','fix-stat');
    function updStat(){
      var n = ta.value.split('\n').length;
      var marked = ta.value.split('\n').filter(markerAt).length;
      
      stat.textContent = '行数 ' + n + '/' + fq.code.split('\n').length +
        '　已加标记 ' + marked + ' 行';
    }
    

    
    var fbar = el('div','fix-filebar');
    fbar.appendChild(el('span', null, fq.srcFile || (fq.id || 'program.c')));
    var bReset = el('button', null, '还原原题');
    bReset.onclick = function(){
      if(!confirm('把代码还原成题目原始（带错）版本？你改的内容会丢掉。')) return;
      ta.value = fq.code;
      dropCode(cur.pid, fnum);
      if(SESSION().fix) delete SESSION().fix[kk];
      save(LSKEY().session, SESSION());
      renderGutter(ta, gut); updStat();
    };
    fbar.appendChild(bReset);

    var bRun = el('button', null, '编译并运行');
    bRun.title = '先看看能不能编过、程序跑出来是什么。不判分、不记录成绩，可以反复点；' +
                 '看明白了再点「提交」。';
    fbar.appendChild(bRun);

    var bJudge = el('button','primary','提交');
    bJudge.title = '交卷：编译、按预设输入对拍、逐处核对，分数会记进复习排程。';
    fbar.appendChild(bJudge);
    left.appendChild(fbar);

    left.appendChild(stat);
    stat.classList.add('fix-statbar');

    var ta = document.createElement('textarea');
    ta.className = 'fix-ta';
    ta.spellcheck = false;
    ta.wrap = 'off';
    ta.value = getCode(cur.pid, fnum, fq.code);
    var gut = el('div','fix-gut');
    var wrap = el('div','fix-wrap');
    wrap.appendChild(gut); wrap.appendChild(ta);
    left.appendChild(wrap);
    renderGutter(ta, gut);
    updStat();          

    ta.addEventListener('input', function(){
      renderGutter(ta, gut);
      saveSoon(cur.pid, fnum, ta.value);
      updStat();
    });
    
    var io = el('div','fix-io');
    
    var cols = el('div','cols'), paneIn = el('div','pane'), paneOut = el('div','pane');
    var phIn = el('div','ph'), phOut = el('div','ph');
    phIn.appendChild(el('span', null, '输入'));
    phIn.appendChild(el('span','sp'));
    var bCase = el('button', null, '运行测试案例');
    bCase.title = '按原卷给的那组输入跑一遍，只看输出（不判分、不记录）';
    phIn.appendChild(bCase);
    var bIoRun = el('button','primary','运行');
    bIoRun.title = '用左边输入框里的内容当标准输入跑一次';
    phIn.appendChild(bIoRun);
    phOut.appendChild(el('span', null, '输出'));
    paneIn.appendChild(phIn); paneOut.appendChild(phOut);
    var taIn = document.createElement('textarea');
    taIn.className = 'fix-io-in';
    taIn.spellcheck = false;                       
    var ioSession = SESSION(), ioKey = cur.pid + '#' + fnum;
    ioSession.fixIO = ioSession.fixIO || {};
    
    taIn.value = Object.prototype.hasOwnProperty.call(ioSession.fixIO, ioKey)
      ? ioSession.fixIO[ioKey] : firstStdinOf(fq);
    paneIn.appendChild(taIn);
    var pre = el('pre','out');
    paneOut.appendChild(pre);
    cols.appendChild(paneIn); cols.appendChild(paneOut);
    io.appendChild(cols);
    left.appendChild(io);
    renderIoPlaceholder(pre);
    
    if(!firstExpectOf(fq)) bCase.style.display = 'none';
    taIn.addEventListener('input', function(){
      ioSession.fixIO[ioKey] = taIn.value;
      if(st.ioTimer) clearTimeout(st.ioTimer);
      st.ioTimer = setTimeout(function(){
        try{ if(SESSION() === ioSession) save(LSKEY().session, ioSession); }catch(e){}
      }, 500);
    });

    ta.addEventListener('scroll', function(){ syncScroll(ta, gut); });
    ta.addEventListener('keydown', function(e){
      if(e.key === 'Tab'){                       
        e.preventDefault();
        
        ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end');
        renderGutter(ta, gut); saveSoon(cur.pid, fnum, ta.value); updStat();
      }
    });

    
    right.appendChild(el('h2', null, '判题报告'));
    var rep = el('div','fix-rep');
    var repCard = el('div');
    right.appendChild(repCard);

    
    if(rec && rec.report){
      rep.innerHTML = reportHtml(rec.report,fq,fixPer(fq));
      repCard.appendChild(rep);
    }else{
      repCard.appendChild(el('div','tip',rec?'已恢复历史分数；详细报告可在重新提交后生成。':'未提交'));
    }

    var status = el('div','tip');
    right.appendChild(status);

    bRun.onclick = function(){
      if(st.judging === kk) return;
      run(cur, fq, ta, rep, repCard, status, bRun, bJudge, kk, fnum);
    };
    bCase.onclick = function(){
      if(st.judging === kk) return;
      taIn.value = firstStdinOf(fq);            
      ioSession.fixIO[ioKey] = taIn.value;
      save(LSKEY().session, ioSession);
      runCustom(cur, fq, ta, pre, status, bRun, bJudge, bCase, bIoRun, kk, 'case');
    };
    bIoRun.onclick = function(){
      if(st.judging === kk) return;
      runCustom(cur, fq, ta, pre, status, bRun, bJudge, bCase, bIoRun, kk, taIn.value);
    };
    bJudge.onclick = function(){
      if(st.judging === kk) return;
      judge(cur, fq, ta, rep, repCard, status, bRun, bJudge, gut, updStat, kk, 'submit', fnum);
    };
    return { main: left, side: right };
  }

  
  function run(cur, fq, ta, rep, repCard, status, bRun, bJudge, kk, fnum){
    var epoch = st.epoch, activeSession = SESSION();
    st.judging = kk;
    bRun.disabled = true; bJudge.disabled = true;
    putCode(cur.pid, fnum, ta.value);
    status.textContent = '正在编译并运行……（首次要装载 C 编译器，约 5～20 秒；之后再点就快了）';

    
    var nCase = (fq.tests && fq.tests.length) ? fq.tests.length : 1;
    var cold = !st.worker;
    var budget = cold ? COLD_BUDGET
                      : Math.max(30000, RUN_TIMEOUT_PREVIEW * nCase + 15000);
    var deadN = -1;
    var promise = ask({ type: 'judge', runOnly: true, q: fq, studentSrc: ta.value,
                        timeoutMs: RUN_TIMEOUT_PREVIEW }, budget, function(txt){
      
      var mm = /测试点\s*(\d+)\s*\/\s*\d+/.exec(String(txt || ''));
      if(mm) deadN = parseInt(mm[1], 10) - 1;
      if(st.judging === kk) status.textContent = txt;
    }, function(){
      
      var cases = [];
      var total = (fq.tests || []).length;
      var list = (fq.tests || []);
      if(deadN >= 0) list = list.slice(0, Math.min(deadN, total));
      list.forEach(function(t){
        cases.push({ stdin: (t && t.stdin) || '', expect: t && t.expect, actual: null,
                     aborted: true, error: '运行超时', pass: false });
      });
      return { runOnly: true,
               L2: { ok: true, diagnostics: '', verdict: 'ok', reason: '', items: [] },
               L3: { available: total > 0, allPassed: false, passed: 0,
                     total: total || cases.length, cases: cases,
                     runTimeoutMs: RUN_TIMEOUT_PREVIEW, toolLimited: false } };
    });

    promise.then(function(res){
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      var r = (res && res.result) || {};
      rep.innerHTML = runReportHtml(r, fq);
      repCard.innerHTML = ''; repCard.appendChild(rep);
      status.textContent = '引擎耗时 ' + res.ms + ' ms' +
        (res.killed ? '　（含被强杀前的等待）' : '') + '　这次没判分、没记录成绩';
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false;
      
      if(res.killed){
        FixEngine.debug(4000).then(function(d){
          var t = (d && d.dbg) || null, g = (t && t.guard) || null;
          if(t) rep.appendChild(el('div','note','诊断：引擎 ' +
            (t.hasRuntime ? '已就绪' : '未就绪') + '；WAT ' + (g && g.hasWat ? '在' : '不在') +
            '；可注入回边 ' + (g ? g.loops : '?') + '；护栏' + (g && g.used ? '已生效' : '未生效') +
            (g && g.error ? '（' + g.error + '）' : '') + '。'));
        }, function(){});
      }
    }, function(e){
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      repCard.innerHTML = '';
      repCard.appendChild(el('div','warnline','编译/运行失败：' + esc(e && e.message || e)));
      status.textContent = '出错';
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false;
    });
  }

  
  
  function firstStdinOf(fq){
    var ts = (fq && fq.tests) || [];
    for(var i = 0; i < ts.length; i++){
      if(ts[i] && ts[i].stdin != null && String(ts[i].stdin) !== '') return String(ts[i].stdin);
    }
    return '';
  }

  
  function renderIoPlaceholder(pre){
    pre.innerHTML = '';
    pre.appendChild(el('span','dim','未运行'));
  }

  
  function firstExpectOf(q){
    var ts = (q && q.tests) || [];
    for(var i = 0; i < ts.length; i++){
      if(ts[i] && ts[i].expect != null && String(ts[i].expect) !== '') return String(ts[i].expect);
    }
    return '';
  }
  function renderCaseBox(q){
    var sin = firstStdinOf(q), exp = firstExpectOf(q);
    if(!sin && !exp) return null;
    var box = el('div','fix-case');
    var head = el('div','ch');
    head.appendChild(el('span', null, '案例'));
    head.appendChild(el('span','sp'));
    head.appendChild(el('span', null, '原卷给的一组输入与应得输出'));
    box.appendChild(head);
    var b = el('div','cb'), a = el('div'), c = el('div');
    a.appendChild(el('span','cl','输入'));
    a.appendChild(document.createTextNode(sin || '（无）'));
    c.appendChild(el('span','cl','输出'));
    c.appendChild(document.createTextNode(exp || '（无）'));
    b.appendChild(a); b.appendChild(c);
    box.appendChild(b);
    return box;
  }

  
  function outLines(text, cls){
    var frag = document.createDocumentFragment();
    var s = String(text == null ? '' : text);
    if(s === ''){ frag.appendChild(el('span','dim','（没有输出）')); return frag; }
    var L = s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    L.forEach(function(ln, i){
      var row = el('div', null);
      var n = String(i + 1);
      while(n.length < String(L.length).length) n = ' ' + n;
      row.appendChild(el('span','dim', n + ' | '));
      if(cls) row.appendChild(el('span', cls, ln));
      else row.appendChild(document.createTextNode(ln));
      frag.appendChild(row);
    });
    return frag;
  }

  
  function ioReportHtml(r, fq, custom){
    var h = [];
    var L2 = (r && r.L2) || {}, L3 = (r && r.L3) || {};
    if(!r || (!r.L2 && !r.L3)){
      return '这次没能拿到结果　' +
        '（多半是首次装载编译器还没完，等几秒再点一次；或者程序里有停不下来的循环）';
    }
    if(!L2.ok){
      h.push('编译没通过　');
      var items = (L2.items || []).filter(function(x){ return x && x.category !== 'tool' && x.category !== 'env'; });
      if(items.length){
        items.slice(0, 12).forEach(function(x){
          h.push('  ' + (x.file || 'input.c') + ':' + (x.line || '?') + '  ' + (x.message || ''));
        });
      }else{
        h.push(String((L2.errorInfo || L2.verdict === 'tool' || L2.verdict === 'env' ? L2.reason : L2.diagnostics) || '（编译器没有给出诊断信息）').replace(/\n$/, ''));
      }
      h.push('');
      h.push('（这一步不判分、不记录成绩）');
      return h.join('\n');
    }
    
    var cu = L3.custom;
    if(cu){
      if(cu.aborted){
        h.push('运行超时（超过 ' + (L3.runTimeoutMs || RUN_TIMEOUT_PREVIEW) +
               ' ms），已强制结束');
      }else if(cu.error){
        h.push(String(cu.error));
      }else{
        h.push(String(cu.stdout == null ? '' : cu.stdout).replace(/\n$/, '') || '（没有输出）');
      }
      h.push('');
      h.push('用时 ' + (cu.ms == null ? '?' : cu.ms) + ' ms' +
             (cu.rc == null ? '' : '　退出码 ' + cu.rc) + '　不判分、不记录成绩');
      if(cu.stderr) { h.push(''); h.push('标准错误'); h.push(String(cu.stderr).replace(/\n$/, '')); }
      return h.join('\n');
    }
    
    var cases = L3.cases || [];
    if(!cases.length){
      h.push('这题没有可用的预设输入。把输入写在左边，点「运行」自己试。');
      return h.join('\n');
    }
    var c0 = cases[0];
    if(c0.aborted){
      h.push('运行超时（超过 ' + (L3.runTimeoutMs || RUN_TIMEOUT_PREVIEW) + ' ms），已强制结束');
      return h.join('\n');
    }
    if(c0.error){
      h.push(String(c0.error));
      return h.join('\n');
    }
    h.push(String(c0.actual == null ? '' : c0.actual).replace(/\n$/, '') || '（没有输出）');
    h.push('');
    h.push('用时 ' + (c0.ms == null ? '?' : c0.ms) + ' ms　不判分、不记录成绩');
    return h.join('\n');
  }

  
  function runCustom(cur, fq, ta, pre, status, bRun, bJudge, bCase, bIoRun, kk, custom){
    var epoch = st.epoch, activeSession = SESSION();
    st.judging = kk;
    
    if(custom === 'case') custom = firstStdinOf(fq);
    var inCustom = (typeof custom === 'string');
    bRun.disabled = true; bJudge.disabled = true; bIoRun.disabled = true;
    putCode(cur.pid, String(cur.num).replace(/^x/, ''), ta.value);
    status.textContent = inCustom ? '正在用你写的输入跑一次……' : '正在按预设输入跑一遍……';
    pre.innerHTML = '';
    pre.appendChild(el('span','dim','运行中……'));

    var nCase = 1;   
    var cold = !st.worker;
    var budget = cold ? COLD_BUDGET
                      : Math.max(30000, RUN_TIMEOUT_PREVIEW * nCase + 15000);
    var msg = { type: 'judge', runOnly: true, q: fq, studentSrc: ta.value,
                timeoutMs: RUN_TIMEOUT_PREVIEW };
    if(inCustom) msg.stdin = custom;

    var promise = ask(msg, budget, function(txt){
      if(st.judging === kk) status.textContent = txt;
    }, null);

    promise.then(function(res){
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      var r = (res && res.result) || {};
      pre.innerHTML = '';
      pre.appendChild(outLines(ioReportHtml(r, fq, custom), null));
      
      Array.prototype.forEach.call(pre.querySelectorAll('div'), function(row){
        var t = row.textContent;
        if(/✓/.test(t)) row.className = 'okText';
        else if(/✗|编译没通过/.test(t)) row.className = 'bad';
        else if(/^应该：|^输入：|^用时/.test(t)) row.className = 'dim';
      });
      status.textContent = '引擎耗时 ' + res.ms + ' ms' +
        (res.killed ? '　（含被强杀前的等待）' : '') + '　这次没判分、没记录成绩';
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false; bCase.disabled = false; bIoRun.disabled = false;
    }, function(e){
      pre.innerHTML = '';
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      pre.appendChild(el('span','err','运行失败：' + esc(e && e.message || e)));
      status.textContent = '出错';
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false; bCase.disabled = false; bIoRun.disabled = false;
    });
  }

  function judge(cur, fq, ta, rep, repCard, status, bRun, bJudge, gut, updStat, kk, mode, fnum){
    var epoch = st.epoch, activeSession = SESSION(), navToken=activeSession.jt||0;
    
    if(mode === 'submit'){
      var pre = null;
      try{
        var eng = window.JudgeEngine || null;
        if(eng && eng.precheck) pre = eng.precheck(fq, ta.value);
      }catch(e){ pre = null; }
      if(pre){
        var notFixed = pre.L4.filter(function(r){ return !r.ok; }).length;
        var l2ok = pre.L1 && pre.L1.ok;
        if(!l2ok && !confirm('形式检查还有不合规的地方（行数不对或改动行有误）。\n' +
                             '编译多半也过不了，交了拿不到分。\n\n仍然提交吗？\n' +
                             '（取消 → 先点「编译并运行」看看报什么错）')) return;
        if(notFixed === pre.L4.length && !confirm('你还没有改对任何一处。\n\n' +
                             '仍然提交吗？（取消 → 先点「编译并运行」自己验证一下）')) return;
      }
    }
    st.judging = kk;
    bRun.disabled = true; bJudge.disabled = true;
    putCode(cur.pid, fnum, ta.value);
    var per = fixPer(fq);
    var full = fixScoreOf(fq);
    status.textContent = '正在启动判题引擎……（首次判题要装载 C 编译器，约 5～20 秒；之后再判就快了）';

    
    var preset = null, partial = null;
    try{
      var eng = window.JudgeEngine || null;
      if(eng && eng.precheck){
        preset = eng.precheck(fq, ta.value);
        var fixedN = preset.L4.filter(function(r){ return r.ok; }).length;
        partial = {
          id: fq.id, verdict: 'unknown', verdictText: '运行结果未出',
          fixed: fixedN, total: fq.errorCount, score: fixedN * per, totalScore: full,
          L1: preset.L1, L4: preset.L4, L2: null, L3: null, notes: [], warnings: []
        };
        rep.innerHTML = reportHtml(partial, fq, per);
        repCard.innerHTML = ''; repCard.appendChild(rep);
      }
    }catch(e){ preset = null; partial = null; }

    
    var cold = !st.worker;
    var budget = cold ? COLD_BUDGET
                      : RUN_TIMEOUT * ((fq.tests ? fq.tests.length : 1) + 1) + 8000;

    
    var promise = ask({ type: 'judge', q: fq, studentSrc: ta.value,
                        timeoutMs: RUN_TIMEOUT, preset: preset }, budget, function(txt){
      if(st.judging === kk) status.textContent = txt;
    }, function(){
      if(!partial) return null;
      return Object.assign({}, partial, {
        tle: true,
        notes: ['整题运行超过 ' + budget + ' ms，判题引擎已被强制终止——' +
                '程序里很可能有死循环（原题本来就带这类错误，典型 for(i=0;i=n;i++)）。' +
                '上面「逐处核对」的结果不受影响。']
      });
    });

    promise.then(function(res){
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      var r = res && res.result;
      if(res.killed && !r){
        
        repCard.innerHTML = '';
        repCard.appendChild(el('div','warnline',
          '判题被强制中断（程序很像有死循环），这次没拿到报告。把程序改对再判一次。'));
        status.textContent = '运行超时，已强制结束';
      }else{
        rep.innerHTML = reportHtml(r, fq, per);
        repCard.innerHTML = ''; repCard.appendChild(rep);
        SESSION().fix = SESSION().fix || {};
        SESSION().fix[kk] = { fixed: r.fixed, total: r.total, score: r.score,
                            tle: !!r.tle, report: r, at: Date.now() };
        
        scheduleAfter(cur.pid, 'x' + fnum, r.fixed >= r.total);
        bumpDaily();
        save(LSKEY().session, SESSION());
        status.textContent = '引擎耗时 ' + res.ms + ' ms' +
          (res.killed ? '　（含被强杀前的等待）' : '') + ' · 已保存';
      }
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false;
      updStat();
      refreshProgress();   
      if(r)queueAutoNext(cur,r.total>0&&r.fixed>=r.total&&r.score>=full,navToken);
    }, function(e){
      if(epoch !== st.epoch || SESSION() !== activeSession){
        if(epoch === st.epoch && st.judging === kk) st.judging = null;
        return;
      }
      repCard.innerHTML = '';
      repCard.appendChild(el('div','warnline','判题失败：' + esc(e && e.message || e)));
      status.textContent = '出错';
      st.judging = null;
      bRun.disabled = false; bJudge.disabled = false;
    });
  }

  
  function renderExam(cur,fq){
    var session=SESSION(), locked=session.done, key=fxid(cur.pid,cur.num);
    var left=el('div'), right=el('div','exam-feedback');
    left.appendChild(el('div','fix-stem',fq.stem || '请修正程序中的错误。'));appendPackFigures(left,fq);
    var example=renderCaseBox(fq);if(example)left.appendChild(example);
    var bar=el('div','fix-filebar');bar.appendChild(el('span',null,fq.srcFile || 'program.c'));
    var reset=el('button',null,'还原原题');reset.disabled=locked;bar.appendChild(reset);left.appendChild(bar);
    var ta=el('textarea','fix-ta exam-code');ta.spellcheck=false;ta.wrap='off';ta.readOnly=locked;
    ta.setAttribute('aria-label','改错代码');ta.value=__cq().examCode(cur);
    var gutter=el('div','fix-gut'), wrap=el('div','fix-wrap');wrap.appendChild(gutter);wrap.appendChild(ta);left.appendChild(wrap);
    renderGutter(ta,gutter);
    function persist(){if(SESSION()!==session || !saveExamCode(cur,ta.value))return;renderGutter(ta,gutter);}
    ta.addEventListener('input',persist);ta.addEventListener('scroll',function(){syncScroll(ta,gutter);});
    ta.addEventListener('keydown',function(e){
      if(e.key==='Tab' && !locked){e.preventDefault();if(!examCanEdit())return;
        ta.setRangeText('    ',ta.selectionStart,ta.selectionEnd,'end');persist();}
    });
    reset.onclick=function(){if(SESSION()!==session || !examCanEdit())return;
      if(confirm('还原本题的带错代码？当前修改会被替换。')){ta.value=fq.code;persist();}};
    if(locked){
      var rec=session.fix && session.fix[key];
      right.appendChild(el('h3',null,rec ? '修正 '+rec.fixed+'/'+rec.total+' 处 · '+rec.score+' 分' : '未作答 · 0 分'));
      var result=rec && rec.examResult;
      if(result){
        (result.L4 || []).forEach(function(f){
          var d=el('details','report-detail');d.appendChild(el('summary',null,'第'+f.line+'行 · '+(f.ok ? '正确' : '未改对')));
          d.appendChild(el('pre',null,'你的修改：'+f.student+'\n参考改法：'+f.fixed));
          right.appendChild(d);
        });
        (result.L1.errors || []).concat(result.L1.warnings || []).forEach(function(w){right.appendChild(el('div','note',w));});
      }else{
        var details=el('details','report-detail');details.appendChild(el('summary',null,'查看参考改法'));
        (fq.faults || []).forEach(function(f){details.appendChild(el('pre',null,'第'+f.line+'行：'+f.fixed));});right.appendChild(details);
      }
      right.appendChild(el('div','note','按现有逐处核对规则计分；未作编译运行验证。'));
    }else{
      var io=el('div','fix-io'), input=el('textarea','fix-io-in'), pre=el('pre','out');
      session.fixIO=session.fixIO || {};var ioKey=cur.pid+'#'+String(cur.num).replace(/^x/,'');
      input.value=Object.prototype.hasOwnProperty.call(session.fixIO,ioKey) ? session.fixIO[ioKey] : firstStdinOf(fq);
      input.setAttribute('aria-label','自测输入');
      input.oninput=function(){if(SESSION()!==session || !examCanEdit())return;session.fixIO[ioKey]=input.value;save(LSKEY().session,session);};
      var runButton=el('button',null,'编译并运行自测'), busy=false;
      io.appendChild(el('div','ph','自测输入'));io.appendChild(input);io.appendChild(runButton);io.appendChild(pre);left.appendChild(io);
      runButton.onclick=function(){
        if(busy || SESSION()!==session || !examCanEdit())return;
        persist();busy=true;runButton.disabled=true;pre.textContent='正在编译运行，考试计时继续……';
        ask({type:'judge',runOnly:true,q:fq,studentSrc:ta.value,stdin:input.value,timeoutMs:RUN_TIMEOUT_PREVIEW},
          st.worker ? 30000 : COLD_BUDGET,null,null).then(function(reply){
          if(SESSION()===session && !session.done)pre.textContent=ioReportHtml(reply.result,fq,input.value);
        },function(error){if(SESSION()===session && !session.done)pre.textContent='运行未完成：'+String(error.message || error);})
          .then(function(){busy=false;runButton.disabled=false;});
      };
      right.appendChild(el('div','note','答案自动保存，交卷后统一判分。自测只显示编译信息和程序输出。'));
    }
    return {main:left,side:right};
  }

  
  return {
    renderExam:renderExam,
    
    render: function(cur, fq){
      return renderShell(cur, fq, function(){ return renderFixCard(cur, fq); });
    },
    preload: function(){ return startWorker().then(function(){ return true; },
                                                   function(e){ return String(e.message || e); }); },
    state: function(){ return { ready: st.ready, hasWorker: !!st.worker, err: st.initErr }; },
    takePending: takePending,
    resetUserData: resetUserData,
    pendingCount: function(){ return Object.keys(st.pending).length; },
    
    debug: function(ms){
      return startWorker().then(function(){
        return ask({ type: 'debug' }, ms || 5000, null, null);
      }).then(function(res){ return res && res.result ? res.result.dbg : null; },
              function(e){ return { __err: String(e && e.message || e) }; });
    },
    
    worker: function(){ return window.__CQUIZ_TEST__ ? st.worker : null; }
  };
})();
