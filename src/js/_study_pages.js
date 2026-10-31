
var EXAMS = load('cqframe.exams.v1', []), STATS_EXAM_ID = null, RESULT_EXAM_ID = null;
function examRecordId(s){ return s.exam.paper + ':' + s.startAt + ':' + s.exam.deadline; }
function validExamRecord(s){
  if(!s || s.kind!=='exam' || !s.done || !validExam(s) || !Number.isFinite(s.exam.finishedAt) ||
    s.exam.finishedAt<s.startAt || (isTimedExam(s)&&s.exam.finishedAt>s.exam.deadline) || !Number.isFinite(s.elapsed) || s.elapsed<0) return false;
  function map(x){return !!x && typeof x==='object' && !Array.isArray(x);}
  if(!map(s.bsnap) || !map(s.fix) || !map(s.reveal) || !map(s.qtime)) return false;
  return s.order.every(function(o){
    var k=qid(o.pid,o.num), time=s.qtime[k];
    if(time!==undefined && (!Number.isFinite(time) || time<0)) return false;
    if(o.program){var pr=programVerdict(s,o),pq=findP(o.pid,o.num);return pr===null||!!pq&&map(pr)&&typeof pr.good==='boolean'&&Number.isInteger(pr.passed)&&pr.passed>=0&&pr.passed<=pr.total&&pr.total===pq.tests.length&&pr.good===(pr.passed===pr.total)&&pr.score===(pr.good?programPoints(pq):0)&&typeof pr.code==='string';}
    if(o.blank){
      var b=s.bsnap[k], q=examBlank(o);
      return b===undefined || (Number.isInteger(b) && b>=0 && b<=q.blankNums.length);
    }
    if(o.fix){
      var r=s.fix[fxid(o.pid,o.num)], f=findF(o.pid,o.num);
      return r===undefined || (map(r) && r.total===f.errorCount && Number.isInteger(r.fixed) &&
        r.fixed>=0 && r.fixed<=r.total && Number.isFinite(r.score) && Math.abs(r.score-r.fixed*fixPer(f))<0.000001);
    }
    return validChoicePick(findQ(o.pid,o.num),s.picks[k]);
  });
}
function checkedExamRecords(records){
  if(!Array.isArray(records)) throw new Error('Invalid exam history');
  var seen=Object.create(null);
  return records.map(function(s){
    if(!validExamRecord(s)) throw new Error('Invalid exam record');
    var id=examRecordId(s); if(seen[id]) throw new Error('Duplicate exam record'); seen[id]=true;
    return JSON.parse(JSON.stringify(s));
  }).sort(function(a,b){return b.exam.finishedAt-a.exam.finishedAt || b.startAt-a.startAt;});
}
try{EXAMS=checkedExamRecords(EXAMS);}catch(e){EXAMS=[];}
function archiveExam(s){
  if(!validExamRecord(s)) return false;
  var id=examRecordId(s);
  if(EXAMS.some(function(x){return examRecordId(x)===id;})) return false;
  EXAMS.push(JSON.parse(JSON.stringify(s)));
  EXAMS.sort(function(a,b){return b.exam.finishedAt-a.exam.finishedAt || b.startAt-a.startAt;});
  save('cqframe.exams.v1',EXAMS); return true;
}
function mergeExamRecords(records){
  records.forEach(function(s){archiveExam(s);});
}
function chosenExam(){
  return EXAMS.filter(function(s){return examRecordId(s)===STATS_EXAM_ID;})[0] || EXAMS[0] || null;
}
function resultSession(){
  return EXAMS.filter(function(s){return examRecordId(s)===RESULT_EXAM_ID;})[0] || SESSION;
}
function openExamReport(s){
  if(!s || (isExam() && !SESSION.done)) return;
  RESULT_EXAM_ID=examRecordId(s); STATS_EXAM_ID=RESULT_EXAM_ID; go('result');
}
function examDate(s){return new Date(s.exam.finishedAt).toLocaleString('zh-CN',{hour12:false});}
function studyArt(kind){
  var art=el('div','study-art study-'+kind+'-scene'); art.setAttribute('aria-hidden','true');
  function part(parent, cls){var n=el('span','study-'+cls);parent.appendChild(n);return n;}
  if(kind==='satellite'){
    var sat=part(art,'flat-sat');
    ['flat-crossbar','flat-panel study-west','flat-panel study-east','flat-bus','flat-neck',
      'flat-dish','flat-strut','flat-strut study-other','flat-feed'].forEach(function(c){part(sat,c);});
  }else if(kind==='board'){
    part(art,'board-back'); var board=part(art,'board');
    ['board-row study-done','board-row study-done','board-row'].forEach(function(c){part(board,c);});
    var facets=part(board,'facets');
    for(var i=1;i<=5;i++)part(facets,'facet study-f'+i);
  }else if(kind==='printout'){
    var print=part(art,'printout');part(print,'printer');part(print,'printer-indicator');
    var paper=part(print,'print-paper');part(paper,'paper-holes study-hleft');part(paper,'paper-holes study-hright');part(paper,'print-ink');
    part(print,'paper-fold');var tail=part(print,'paper-tail');part(tail,'paper-holes study-hleft');part(tail,'paper-holes study-hright');
  }else{
    var panel=part(art,'controls-art');part(panel,'control-rail');
    ['control-knob','control-knob study-k2','control-knob study-k3'].forEach(function(c){part(panel,c);});
  }
  return art;
}
function studyHeading(classic,nasa,english,desc,art){
  var head=el('div','study-heading'), copy=el('div','study-heading-copy');
  copy.appendChild(el('div','study-eyebrow',english));
  var title=el('h2');title.appendChild(el('span','study-classic-title',classic));title.appendChild(el('span','study-nasa-title',nasa));
  copy.appendChild(title);copy.appendChild(el('p',null,desc));head.appendChild(copy);head.appendChild(studyArt(art));return head;
}
function studyMetric(label,value,unit){
  var cell=el('div','study-metric'), number=el('div','study-number');
  number.appendChild(el('strong',null,String(value)));number.appendChild(el('span','study-unit',unit||''));
  cell.appendChild(number);cell.appendChild(el('span','study-metric-label',label));return cell;
}

function renderLibraryShell(view){
  var layout=el('div','library-layout'),side=el('aside','library-sidebar');
  side.appendChild(el('div','library-caption','QUESTION LIBRARY'));side.appendChild(el('h2',null,'题库总目录'));
  var nav=el('nav');nav.setAttribute('aria-label','题库总目录');
  libraryList().forEach(function(lib){
    var item=el('button','library-item');item.type='button';item.dataset.library=lib.id;item.setAttribute('aria-label',lib.title+lib.subtitle);
    if(lib.id===ACTIVE_LIBRARY)item.setAttribute('aria-current','page');
    var icon=el('span','library-icon');icon.dataset.icon='archive';icon.appendChild(el('span','library-archive'));icon.setAttribute('aria-hidden','true');item.appendChild(icon);
    var text=el('span','library-item-copy');var title=el('strong',null,lib.title),subtitle=el('span',null,lib.subtitle);title.title=lib.title;subtitle.title=lib.subtitle;text.appendChild(title);text.appendChild(subtitle);item.appendChild(text);
    item.onclick=function(){selectLibrary(lib.id);};nav.appendChild(item);
  });side.appendChild(nav);
  side.appendChild(el('p','library-stats',librarySummary()));
  var manage=btn('导入 / 管理题包',openQuestionPacks);manage.classList.add('library-import');side.appendChild(manage);
  if(PACK_LOAD_ERRORS.length)side.appendChild(el('p','note','有本地题包未能加载，请重新导入原文件。'));
  var content=el('div','library-content');layout.appendChild(side);layout.appendChild(content);view.appendChild(layout);return content;
}
function renderStudyStats(){
  renderNav();var v=emptyNode(viewEl()), page=el('div','study-page');
  page.appendChild(studyHeading('统计','学习遥测','LEARNING TELEMETRY','查看作答记录、复习进度和考试成绩。','satellite'));
  var days=Object.keys(STATS.log).sort(), act=poolActive(), mas=poolMastered();
  var total=days.reduce(function(n,d){return n+STATS.log[d];},0);
  var touched=PAPERS.filter(function(p){return paperPool(p.id).n>0;}).length;
  var console=el('section','card study-console');console.appendChild(el('h3',null,'学习概况'));
  var groups=el('div','study-metric-groups');
  [['练习记录',[['累计作答',total,'次'],['有记录天数',days.length,'天']]],
    ['复习进展',[['待复习',act.length,'题'],['已掌握',mas.length,'题']]],
    ['今日与试卷',[['今日到期',dueCount(),'题'],['待复习试卷',touched+' / '+PAPERS.length,'']]]].forEach(function(group){
    var g=el('div','study-metric-group');g.appendChild(el('h4',null,group[0]));
    group[1].forEach(function(m){g.appendChild(studyMetric(m[0],m[1],m[2]));});groups.appendChild(g);
  });
  console.appendChild(groups);page.appendChild(console);
  var columns=el('div','study-columns'), trend=el('section','card study-trend');trend.appendChild(el('h3',null,'最近 7 天作答量'));
  var last7=[];for(var i=6;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);last7.push([todayKey(d),STATS.log[todayKey(d)]||0]);}
  trend.appendChild(week7Chart(el('div'),last7));columns.appendChild(trend);
  var exams=el('section','card study-exams');exams.appendChild(el('h3',null,'考试成绩'));
  if(!EXAMS.length){exams.appendChild(el('div','empty','还没有成绩记录。完成模拟考试或交卷后批改的整卷练习后，可在这里选择场次、查看成绩。'));}
  else{
    var current=chosenExam();STATS_EXAM_ID=examRecordId(current);
    var label=el('label','study-select-label','选择考试场次'), select=el('select','study-exam-select');select.setAttribute('aria-label','选择考试场次');
    EXAMS.forEach(function(s,i){var op=el('option',null,(i===0?'最近 · ':'')+(isTimedExam(s)?'考试 · ':'整卷 · ')+papLabel(s.exam.paper)+' · '+examDate(s));op.value=examRecordId(s);select.appendChild(op);});
    select.value=STATS_EXAM_ID;select.onchange=function(){
      if(STATS_EXAM_ID===select.value)return;STATS_EXAM_ID=select.value;refreshExam();
    };label.appendChild(select);exams.appendChild(label);
    var result=el('div','study-exam-summary');exams.appendChild(result);
    function refreshExam(){
      current=chosenExam();emptyNode(result);if(result.parentNode)revealPickContent(result,0);
      result.appendChild(el('h4','study-exam-paper',papLabel(current.exam.paper)));
      var score=sessionStat(current);result.appendChild(studyMetric('本次得分',fmtScore(score.score),' / '+fmtScore(score.full)+' 分'));
      result.appendChild(el('p','tip',fmtTime(current.elapsed)+' · '+(current.exam.reason==='timeout'?'到时交卷':'主动交卷')+' · '+current.order.length+' 题'));
      var detail=el('button','primary','查看本次详情');detail.onclick=function(){openExamReport(current);};result.appendChild(detail);
    }
    refreshExam();
  }
  columns.appendChild(exams);page.appendChild(columns);
  var note=el('details','study-notes');note.appendChild(el('summary',null,'统计口径与记录管理'));
  note.appendChild(el('p','tip','累计作答按提交计次；改选不重复计数，重做后再次提交会累计。待复习指尚未连续答对 '+SET.needCorrect+' 次的题。考试成绩保存交卷时的答卷，查看不会重新计分或改变复习计划。'));
  var fb=el('div','footbar');fb.appendChild(btn('导出学习记录',exportData));fb.appendChild(btn('导入学习记录',importData));note.appendChild(fb);page.appendChild(note);
  v.appendChild(page);$('#foot').textContent=footText('学习记录与考试成绩保存在本机，可导出备份。');
}
function renderStudyReview(){
  renderNav();var v=emptyNode(viewEl()), page=el('div','study-page');
  page.appendChild(studyHeading('复习','任务队列','REVIEW OPERATIONS','选择试卷，复习到期题目或手动标记的题目。','board'));
  var card=el('section','card study-review'),summary=el('div','study-review-summary');card.appendChild(summary);
  var seg=el('div','toolbar'),filters=[],cards=[],keys=[],selectedKeys=[],limit=0;
  seg.setAttribute('role','group');seg.setAttribute('aria-label','复习范围');
  [['due','今日到期'],['all','全部未掌握'],['mastered','已掌握'],['marks','我的标记']].forEach(function(x){
    var b=el('button','seg',x[1]);b.onclick=function(){if(RV.mode===x[0])return;RV.mode=x[0];RV.paper=null;refreshPool(true);};
    filters.push({mode:x[0],node:b});seg.appendChild(b);
  });card.appendChild(seg);
  var deck=el('div','study-review-deck');deck.setAttribute('role','group');deck.setAttribute('aria-label','复习试卷');card.appendChild(deck);
  function launch(max){
    if(!selectedKeys.length)return;
    if(SESSION && !SESSION.done && !confirm('开始复习将替换当前未完成的练习，已记记录仍保留。继续吗？'))return;
    var order=shuffle(selectedKeys.slice());if(max>0)order=order.slice(0,max);
    SESSION=newSession((RV.paper?papLabel(RV.paper):'集中复习')+' · '+order.length+' 题',order.map(function(k){return toOrder(splitKey(k));}),RV.mode==='marks'?'mark':'review');go2practice();
  }
  var fb=el('div','footbar study-launch'),br=el('button','primary'),more=btn('',function(){launch(0);});
  br.onclick=function(){launch(limit);};fb.appendChild(br);fb.appendChild(more);fb.appendChild(btn('设置',openSettings));card.appendChild(fb);
  var tip=el('p','tip'),empty=el('div','empty');card.appendChild(tip);card.appendChild(empty);
  var listing=el('details','study-question-list'),listTitle=el('summary'),listBody=el('div');
  listing.appendChild(listTitle);listing.appendChild(listBody);card.appendChild(listing);
  var manage=el('details','study-notes');manage.appendChild(el('summary',null,'复习规则与记录管理'));manage.appendChild(el('p','tip','答对后按 1 → 3 → 7 → 14 → 30 → 60 天延长间隔，答错当天进入复习计划。'));
  var tools=el('div','footbar');tools.appendChild(btn('导出学习记录',exportData));
  var restore=btn('把已掌握的题全部放回复习池',function(){if(confirm('把所有已掌握的题放回复习池？')){resetAllMastered();refreshRecords();}});
  tools.appendChild(restore);manage.appendChild(tools);card.appendChild(manage);
  function refreshRecords(){
    renderNav();emptyNode(summary);
    [['今日到期',dueCount()],['待复习',poolActive().length],['已掌握',poolMastered().length],['今日已作答',STATS.log[todayKey()]||0]].forEach(function(m){summary.appendChild(studyMetric(m[0],m[1],'题'));});
    refreshPool();
  }
  
  function refreshPool(animate){
    filters.forEach(function(f){var active=RV.mode===f.mode;f.node.className='seg'+(active?' on':'');f.node.setAttribute('aria-pressed',String(active));});
    keys=(RV.mode==='all'?poolActive():RV.mode==='mastered'?poolMastered():RV.mode==='marks'?Object.keys(MARKS):poolDue()).filter(function(k){return existsKey(k)&&packQuestionEnabled(k);}).sort();
    var papers=PAPERS.filter(function(p){return keys.some(function(k){return splitKey(k).pid===p.id;});});
    if(!papers.some(function(p){return p.id===RV.paper;}))RV.paper=null;
    emptyNode(deck);cards=[];
    papers.forEach(function(p,index){
      var pk=keys.filter(function(k){return splitKey(k).pid===p.id;}),paper=el('button','study-paper');
      paper.type='button';paper.setAttribute('data-paper',p.id);
      var body=el('span','study-paper-body'),badge=el('span','study-paper-letter',paperCode(p));body.appendChild(badge);
      var text=el('span','study-paper-copy');text.appendChild(el('span','study-paper-code','PAPER / '+(p.label?nasaYear(p)+'-'+p.code:p.id)));text.appendChild(el('strong',null,papLabel(p.id)));
      var counts={c:0,m:0,b:0,f:0,p:0};pk.forEach(function(k){var o=splitKey(k);counts[o.program?'p':o.blank?'b':o.fix?'f':isMultipleQuestion(findQ(o.pid,o.num))?'m':'c']++;});
      text.appendChild(el('span','study-paper-count',[counts.c?'单选 '+counts.c:'',counts.m?'多选 '+counts.m:'',counts.b?'填空 '+counts.b:'',counts.f?'改错 '+counts.f:'',counts.p?'编程 '+counts.p:''].filter(Boolean).join(' · ')+' · 共 '+pk.length+' 题'));
      if(pk.some(function(k){return REC[k] && !REC[k].master && REC[k].due<=Date.now();}))text.appendChild(el('span','study-paper-due','今日到期'));
      body.appendChild(text);paper.appendChild(body);
      var bottom=el('span','study-paper-bottom'),status=el('span','study-paper-status');bottom.appendChild(el('span','study-barcode'));bottom.appendChild(status);paper.appendChild(bottom);
      paper.onclick=function(){RV.paper=RV.paper===p.id?null:p.id;refreshSelection();};
      cards.push({pid:p.id,node:paper,status:status});deck.appendChild(paper);if(animate)revealPickContent(paper,index);
    });
    refreshSelection();
  }
  function refreshSelection(){
    cards.forEach(function(c){var selected=RV.paper===c.pid;c.node.className='study-paper'+(selected?' selected':'');c.node.setAttribute('aria-pressed',String(selected));c.node.setAttribute('aria-label',papLabel(c.pid)+(selected?'，已选择，再次点击取消':'，选择本卷'));c.status.textContent=selected?'已选择':'选择本卷';});
    selectedKeys=keys.filter(function(k){return !RV.paper || splitKey(k).pid===RV.paper;});limit=RV.mode==='due'?SET.dailyMax:0;
    var count=limit?Math.min(limit,selectedKeys.length):selectedKeys.length;
    br.textContent='复习'+(RV.paper?'本卷':RV.mode==='due'?'今日':RV.mode==='mastered'?'已掌握':RV.mode==='marks'?'标记':'全部')+' '+count+' 题';
    br.appendChild(el('small','study-ignite',' IGNITE'));br.disabled=!count;
    more.textContent='本次做更多（'+selectedKeys.length+' 题）';more.style.display=limit && selectedKeys.length>limit?'':'none';
    tip.style.display=RV.mode==='due'?'':'none';tip.textContent='本次最多 '+SET.dailyMax+' 题，可在设置中调整。';
    empty.style.display=keys.length?'none':'';
    empty.textContent=RV.mode==='marks'?'还没有标记的题。可在答题时标记待复习。':RV.mode==='mastered'?'连续答对 '+SET.needCorrect+' 次后，题目会进入这里。':poolActive().length?'今天没有到期题目，可切换「全部未掌握」。':'还没有待复习的题，先选择一套题开始练习。';
    listing.style.display=keys.length?'':'none';listTitle.textContent='查看题目与管理（'+selectedKeys.length+' 题）';emptyNode(listBody);
    if(keys.length){
      var tb=el('table','study-review-table'),hr=el('tr');['试卷与题号','错次 / 下次复习','题干摘要','操作'].forEach(function(t){hr.appendChild(el('th',null,t));});tb.appendChild(hr);
      selectedKeys.forEach(function(k){var o=splitKey(k),q=orderQuestion(o),r=REC[k]||{},tr=el('tr');
        tr.appendChild(el('td',null,papLabel(o.pid)+' '+qLabel(o)));tr.appendChild(el('td',null,(r.wrong||0)+' 次 · '+(r.master?'已掌握':dueLabel(r))));
        tr.appendChild(el('td',null,String(q.stem||q.code||'').replace(/\s+/g,' ').slice(0,60)));
        var actions=el('td');actions.appendChild(btn('看原题',function(){if(SESSION&&!SESSION.done&&!confirm('查看此题将替换当前未完成练习，继续吗？'))return;startQuestion(o,'单题','review');}));
        actions.appendChild(btn('移出',function(){if(!confirm('把这一题移出复习池？（不影响其它记录）'))return;resetOne(o.pid,toOrder(o).num);delete MARKS[k];save(LSKEY.marks,MARKS);refreshRecords();}));tr.appendChild(actions);tb.appendChild(tr);
      });listBody.appendChild(scrollTable(tb));
    }
    restore.style.display=RV.mode==='mastered' && poolMastered().length?'':'none';
  }
  refreshRecords();page.appendChild(card);v.appendChild(page);$('#foot').textContent=footText('选择整张试卷卡片，再次点击可取消选择。');
}

function renderChoiceAnalysis(q){
  var section=el('details','choice-analysis');
  section.appendChild(el('summary',null,'知识点与解析'));
  section.appendChild(el('div','choice-knowledge',q.topic+' · '+(q.tags||[]).join(' / ')));
  section.appendChild(el('p','choice-explanation',q.analysis||'暂无解析'));
  if(q.review_note){
    var note=el('div','warn choice-review-note');note.appendChild(el('strong',null,'答案说明'));
    note.appendChild(el('p',null,q.review_note));note.appendChild(el('p','tip','当前计分保留题库答案 '+q.answer+'，以上疑点不自动改动原答案。'));section.appendChild(note);
  }
  if(VIEW==='practice' && SESSION && !isExam()){
    section.appendChild(el('p','tip','展开解析后停留本题，可手动点击下一题继续。'));
    section.ontoggle=function(){
      var cur=SESSION && SESSION.order[SESSION.idx];
      if(!section.open || VIEW!=='practice' || !cur || isExam() || findQ(cur.pid,cur.num)!==q)return;
      SESSION.jt=(SESSION.jt||0)+1;FLASH={key:null,until:0};save(LSKEY.session,SESSION);
      Array.prototype.forEach.call(viewEl().querySelectorAll('.opt.flash'),function(opt){opt.classList.remove('flash');});
    };
  }
  return section;
}

function renderBlankAnalysis(q){
  var section=el('details','choice-analysis blank-analysis');
  section.appendChild(el('summary',null,'知识点与逐空解析'));
  section.appendChild(el('div','choice-knowledge',q.topic+' · '+(q.tags||[]).join(' / ')));
  section.appendChild(el('p','choice-explanation',q.analysis));
  var list=el('ol','blank-explanations');
  (q.blank_analysis||[]).forEach(function(note){
    var item=el('li'),at=q.blankNums.indexOf(note.num),heading=el('div','blank-explanation-head');
    item.setAttribute('data-blank',String(note.num));heading.appendChild(el('strong',null,'第'+note.num+'空'));
    heading.appendChild(el('code',null,(q.answers[at]||[])[0]||''));item.appendChild(heading);
    item.appendChild(el('p','choice-explanation',note.explanation));list.appendChild(item);
  });section.appendChild(list);
  section.appendChild(el('p','tip blank-pitfall','易错点：'+q.pitfall));
  if(q.review_note){
    var warning=el('div','warn choice-review-note');warning.appendChild(el('strong',null,'答案说明'));
    warning.appendChild(el('p',null,q.review_note));warning.appendChild(el('p','tip','本题按题包提供的候选答案计分，解析中的建议不影响判分。'));section.appendChild(warning);
  }
  if(q.legacy_note){var legacy=el('details','blank-legacy');legacy.appendChild(el('summary',null,'旧题写法说明'));legacy.appendChild(el('p','choice-explanation',q.legacy_note));section.appendChild(legacy);}
  return section;
}
function renderTopicPicker(){
  var box=el('details','choice-topic-picker');box.appendChild(el('summary',null,'按知识点练习 · 全部'+homeQuestionCount()+'题'));
  var topics=topicStats(),names=Object.keys(topics).sort();
  if(names.indexOf(PICK.topic)<0)PICK.topic=names[0]||'';
  var row=el('div','toolbar'),label=el('label',null,'知识点 '),select=el('select');select.setAttribute('aria-label','选择单选知识点');
  names.forEach(function(t){var op=el('option',null,t+'（'+topics[t]+'题）');op.value=t;select.appendChild(op);});select.value=PICK.topic;
  select.onchange=function(){PICK.topic=select.value;};label.appendChild(select);row.appendChild(label);
  var numberLabel=el('label',null,'题量 '),number=el('input');number.type='number';number.min='0';number.max=String(homeQuestionCount());number.step='1';number.value=String(PICK.topicN||0);number.setAttribute('aria-label','知识点练习题量，0为全部');numberLabel.appendChild(number);row.appendChild(numberLabel);
  var start=btn('开始知识点练习',function(){
    var n=Number(number.value);if(!Number.isInteger(n)||n<0||n>homeQuestionCount()){alert('请输入0至'+homeQuestionCount()+'的整数题量，0为全部。');return;}
    if(SESSION && !SESSION.done && !confirm('开始知识点练习会替换当前未完成的练习，已记记录仍保留。继续吗？'))return;
    PICK.topic=select.value;PICK.topicN=n;startTopic(PICK.topic,n);
  },true);start.disabled=!names.length;row.appendChild(start);box.appendChild(row);box.appendChild(el('p','tip','0题表示所选知识点全部题目；按原卷分值计分，作答后可展开逐题解析。'));return box;
}

function openReportQuestion(s,index){
  if(!isExam(s)){reviewQuestion(index);return;}
  var o=s.order[index],q=findAny(o.pid,o.num),k=qid(o.pid,o.num),M=modalBox('答卷详情',true),box=M.box;
  box.className+=' study-answer-dialog';box.style.maxWidth='850px';
  box.appendChild(el('h3',null,papLabel(o.pid)+' · '+qLabel(o)));
  box.appendChild(el('div','tip','只读答卷 · 本题用时 '+questionTimeLabel(o,s)));
  box.appendChild(renderFigures(q,o));
  if(q.stem)box.appendChild(renderStem(q.stem));
  if(o.fix){
    box.appendChild(el('h4',null,'你的代码'));box.appendChild(el('pre',null,s.exam.codes[fxid(o.pid,o.num)]===undefined?q.code:s.exam.codes[fxid(o.pid,o.num)]));
    var faults=el('details');faults.appendChild(el('summary',null,'参考改法与本次得分'));
    var fr=s.fix[fxid(o.pid,o.num)];faults.appendChild(el('p',null,(fr?fmtScore(fr.score):'0')+' / '+fmtScore(fixScoreOf(q))+' 分；按逐处规则核对，未作编译运行验证。'));
    (q.faults||[]).forEach(function(f){faults.appendChild(el('pre',null,'第 '+f.line+' 行：'+f.fixed));});box.appendChild(faults);
  }else if(o.blank){
    box.appendChild(el('pre',null,q.code||''));var ans=blankAnsOf(k,s);
    q.blankNums.forEach(function(n,j){box.appendChild(el('p',null,'('+n+') 你的答案：'+(ans[n]||'—')+'；参考：'+((q.answers[j]||[]).join(' / '))));});
    box.appendChild(renderBlankAnalysis(q));
  }else{
    var opts=q.options||{};Object.keys(opts).forEach(function(key){box.appendChild(el('p',null,key+' · '+optText(opts[key])));});
    box.appendChild(el('p',null,'你的答案：'+(s.picks[k]||'未答')+'；正确答案：'+q.answer));
    box.appendChild(renderChoiceAnalysis(q));
  }
  var fb=el('div','footbar');
  if(index>0)fb.appendChild(btn('上一题',function(){M.m.remove();openReportQuestion(s,index-1);}));
  if(index<s.order.length-1)fb.appendChild(btn('下一题',function(){M.m.remove();openReportQuestion(s,index+1);}));
  fb.appendChild(btn('关闭',function(){M.m.remove();},true));box.appendChild(fb);
}


function answerBrief(state,score,full,detail){
  var box=el('div','answer-feedback');box.setAttribute('role','status');
  box.appendChild(el('span',null,'得分 '+fmtScore(score)+' / '+fmtScore(full)+' 分'));
  if(detail&&!/^(本题作答|所有选项均匹配)/.test(detail))box.appendChild(el('span','note',detail));return box;
}
function answerComparison(mine,key){
  var box=el('div','answer-comparison');[['你的答案',mine||'未答'],['参考答案',key]].forEach(function(pair){var col=el('div');col.appendChild(el('span',null,pair[0]));col.appendChild(el('strong',null,pair[1]));box.appendChild(col);});return box;
}
