
function programQuestions(pid){var p=PMAP[pid];return p&&p.programQuestions||[];}
function findP(pid,num){return programQuestions(pid).filter(function(q){return q.num===Number(String(num).replace(/^p/,''));})[0]||null;}
function programPoints(q){return q&&Number.isFinite(q.points)&&q.points>0?q.points:0;}
function programTotal(pid){return programQuestions(pid).reduce(function(n,q){return n+programPoints(q);},0);}
function practiceOrder(pid){
  var p=PMAP[pid];if(p&&p.practiceOrder)return p.practiceOrder.map(function(o){return Object.assign({pid:pid},o);});
  return fullOrder(pid).concat(programQuestions(pid).map(function(q){return {pid:pid,num:'p'+q.num,program:true};}));
}
function practiceTotal(pid){return paperTotal(pid)+programTotal(pid);}
function practiceParts(pid){var parts=paperParts(pid),n=programQuestions(pid).length;return parts+(n?(parts?' + ':'')+n+' 编程':'');}
function startProgramPaper(pid){
  var order=programQuestions(pid).map(function(q){return {pid:pid,num:'p'+q.num,program:true};});
  if(!order.length){alert('这套卷没有编程题。');return;}
  SESSION=newSession(pid+' · 编程',order,'program');go2practice();
}
function startProgramLibrary(){
  if(isExam()&&!SESSION.done){go('practice');return;}
  var order=[];homePapers().forEach(function(p){programQuestions(p.id).forEach(function(q){order.push({pid:p.id,num:'p'+q.num,program:true});});});
  if(!order.length){PICK.view='split';PICK.split='program';go('home');return;}
  SESSION=newSession(libraryTitle()+' · 编程',order,'program');go2practice();
}
function renderProgramPicker(host,animate){
  host.appendChild(el('p','tip','编写代码后提交，公开用例全部通过视为答对。编程题沿用普通练习的答题卡、计时、复习与统计。'));
  var table=el('table'),head=el('thead'),hr=el('tr'),body=el('tbody');
  ['试卷','题量','练习分值','复习池','操作'].forEach(function(t){hr.appendChild(el('th',null,t));});head.appendChild(hr);table.appendChild(head);
  homePapers().filter(function(p){return programQuestions(p.id).length;}).forEach(function(p,i){
    var tr=el('tr','clickable');tr.dataset.classicPaper=p.id;
    tr.appendChild(el('td',null,papLabel(p.id)));tr.appendChild(el('td',null,programQuestions(p.id).length+' 题'));
    tr.appendChild(el('td',null,programTotal(p.id)?fmtScore(programTotal(p.id))+' 分':'按用例检查'));
    var n=programQuestions(p.id).filter(function(q){var r=REC[qid(p.id,'p'+q.num)];return r&&!r.master;}).length;
    tr.appendChild(el('td',null,n?n+' 题':'—'));var td=el('td'),b=btn('开始',function(e){if(e)e.stopPropagation();startProgramPaper(p.id);},true);td.appendChild(b);tr.appendChild(td);tr.onclick=function(){startProgramPaper(p.id);};body.appendChild(tr);if(animate)revealPickContent(tr,i);
  });table.appendChild(body);host.appendChild(scrollTable(table));
}
function programVerdict(s,o){return s&&s.programs&&s.programs[qid(o.pid,o.num)]||null;}
function renderDeferredProgram(cur,q){
  var owner=SESSION,key=qid(cur.pid,cur.num),main=el('div','deferred-program');
  main.appendChild(renderFigures(q,cur));main.appendChild(renderStem(q.statement||q.stem));
  [['输入说明',q.input],['输出说明',q.output],['数据范围',q.rangeNote]].forEach(function(pair){if(pair[1]){main.appendChild(el('h4',null,pair[0]));main.appendChild(el('pre','pack-text',pair[1]));}});
  (q.examples||[]).forEach(function(example,i){var d=el('details');d.appendChild(el('summary',null,'样例 '+(i+1)));d.appendChild(el('pre','pack-text','输入：\n'+example.stdin+'\n输出：\n'+example.stdout));main.appendChild(d);});
  var label=el('label','pack-input-label','C 程序代码'),code=el('textarea','program-code deferred-code');code.setAttribute('aria-label','C程序代码');code.spellcheck=false;code.wrap='off';code.value=Object.prototype.hasOwnProperty.call(owner.exam.codes,key)?owner.exam.codes[key]:q.starter;code.readOnly=owner.done;label.appendChild(code);main.appendChild(label);
  var note=el('p','note',owner.done?'已交卷，代码只读。':'代码自动保存在本场答卷，交卷后统一核对公开用例。');main.appendChild(note);
  code.oninput=function(){if(!examCanEdit())return;if(new TextEncoder().encode(code.value).length>65536){note.textContent='代码超过64KiB，尚未保存，请缩短代码。';return;}owner.exam.codes[key]=code.value;save(LSKEY.session,owner);refreshProgress();note.textContent='代码已保存到本场答卷；交卷后批改。';};
  if(owner.done){var verdict=programVerdict(owner,cur);main.appendChild(el('p','note',verdict?'公开用例 '+verdict.passed+' / '+verdict.total+' 通过 · 得分 '+fmtScore(verdict.score)+' 分':'未作答 · 0 分'));return main;}
  var input=el('textarea','program-stdin');input.rows=3;input.setAttribute('aria-label','自测输入');input.value=q.examples&&q.examples.length?q.examples[0].stdin:'';main.appendChild(el('h4',null,'自测输入'));main.appendChild(input);
  var output=el('pre','pack-text'),run=btn('运行输入',async function(){
    if(!examCanEdit())return;run.disabled=true;output.textContent='正在运行…';
    try{if(new TextEncoder().encode(code.value).length>65536||new TextEncoder().encode(input.value).length>16384)throw new Error('代码或输入超限，请缩短后重试。');var request={protocol:1,requestId:'paper-run-'+Date.now(),kind:'run',code:code.value,tests:[{id:'custom',stdin:input.value}]},response=await CQuizProgrammingRuntime.execute(request);
      if(owner!==SESSION||owner.order[owner.idx]!==cur||owner.done)return;
      output.textContent=response.status==='completed'?response.cases.map(function(c){return c.stdout+(c.stderr?'\n'+c.stderr:'');}).join('\n'):response.diagnostics||'运行未完成';
    }catch(e){output.textContent=e.message;}finally{run.disabled=false;}
  });main.appendChild(run);main.appendChild(el('small','note','自测仅展示输出，不提前批改。'));main.appendChild(output);return main;
}
async function gradeDeferredPrograms(owner){
  var results={};
  for(var i=0;i<owner.order.length;i++){
    var o=owner.order[i];if(!o.program)continue;var key=qid(o.pid,o.num),q=findP(o.pid,o.num),code=owner.exam.codes[key];if(code===undefined||code===q.starter)continue;
    var request={protocol:1,requestId:'paper-grade-'+Date.now()+'-'+i,questionId:q.id,kind:'submit',code:code,tests:q.tests.map(function(t){var test={id:t.id,stdin:t.stdin,expected:t.stdout};if(t.stdoutAlternatives)test.expectedAlternatives=t.stdoutAlternatives.slice();return test;})};
    var response=await CQuizProgrammingRuntime.execute(request),result=ProgrammingPage.inspectResponse(request,response);
    if(result.status==='tool_error'||result.items.some(function(item){return item.kind==='tool_error';}))throw new Error(result.diagnostics||'运行环境暂时不可用');
    var good=result.status==='completed'&&result.total>0&&result.passed===result.total;results[key]={good:good,passed:result.passed,total:result.total,score:good?programPoints(q):0,code:code,at:Date.now()};
  }
  return results;
}
function programSheetCls(s,o){var r=programVerdict(s,o);return !r?null:r.good?'ok':'bad';}
function recordProgramAttempt(cur,q,event,owner){
  if(SESSION!==owner||owner.done||VIEW!=='practice'||!owner.order[owner.idx]||qid(owner.order[owner.idx].pid,owner.order[owner.idx].num)!==qid(cur.pid,cur.num))return;
  if(event.request.kind!=='submit')return;
  var result=event.result;
  if(result.status==='tool_error'||result.items.some(function(c){return c.kind==='tool_error';}))return;
  var key=qid(cur.pid,cur.num),old=programVerdict(owner,cur),good=result.status==='completed'&&result.total>0&&result.passed===result.total;
  owner.programSnaps=owner.programSnaps||{};
  if(!Object.prototype.hasOwnProperty.call(owner.programSnaps,key))owner.programSnaps[key]=snapOf(key);
  else restoreSnap(key,JSON.parse(JSON.stringify(owner.programSnaps[key])));
  owner.programs=owner.programs||{};
  owner.programs[key]={good:good,passed:result.passed,total:result.total,score:good?programPoints(q):0,code:event.request.code,at:Date.now()};
  scheduleAfter(cur.pid,cur.num,good);if(!old)bumpDaily();save(LSKEY.session,owner);refreshProgress();queueAutoNext(cur,good);
}
function renderProgramPractice(cur,q){
  var owner=SESSION,key=qid(cur.pid,cur.num),parts=ProgrammingPage.renderPractice(cur,q,function(e){recordProgramAttempt(cur,q,e,owner);});
  var mark=btn(MARKS[key]?'★ 已标记':'☆ 标记待复习',function(){if(MARKS[key])delete MARKS[key];else MARKS[key]=true;save(LSKEY.marks,MARKS);renderPractice();});
  var status=programVerdict(owner,cur);
  if(status)parts.main.insertBefore(el('p','note','上次提交：'+status.passed+' / '+status.total+' 个用例通过'+(status.good?' · 答对':' · 待改进')),parts.main.firstChild);
  return renderPracticeShell(parts.main,parts.side,{sub:'公开用例 '+q.tests.length+' 组 · '+(programPoints(q)?'本题 '+fmtScore(programPoints(q))+' 分':'本题按用例检查，不设分值'),tools:mark});
}
function programResultRow(report,o,i,samePaper){
  var q=findP(o.pid,o.num);if(!q)return null;
  var r=programVerdict(report,o),row=el('tr','clickable');row.appendChild(el('td',null,(samePaper?'':papLabel(o.pid)+' ')+qLabel(o)));
  row.appendChild(el('td',null,!r?'未提交':r.good?'✔ 对':'✘ 错'));row.appendChild(el('td',null,r?r.passed+' / '+r.total+' 个用例通过':'—'));
  row.appendChild(el('td',null,programPoints(q)?'满分 '+fmtScore(programPoints(q))+' 分':'按用例检查'));
  var rec=REC[qid(o.pid,o.num)];row.appendChild(el('td',null,rec?dueLabel(rec):'—'));row.appendChild(el('td','time-cell',questionTimeLabel(o,report)));
  var td=el('td'),b=btn('看原题',function(e){if(e)e.stopPropagation();openReportQuestion(report,i);});td.appendChild(b);row.appendChild(td);row.onclick=function(){openReportQuestion(report,i);};return row;
}

(function(){
  var dataNode=document.getElementById('programming-data');var source=dataNode&&dataNode.textContent?JSON.parse(dataNode.textContent):{questions:[]};
  (source.questions||[]).forEach(function(q){var m=/^(.*?)#p(\d+)$/.exec(q.id);if(!m||!PMAP[m[1]])return;var p=PMAP[m[1]];p.programQuestions=p.programQuestions||[];
    p.programQuestions.push(Object.assign({},q,{num:Number(m[2]),stem:q.statement,points:0,topic:'编程',tags:['编程']}));
  });
})();
