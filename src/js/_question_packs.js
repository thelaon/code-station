
var PACK_KEY='cqframe.packs.v1',LIBRARY_KEY='cqframe.library.v1';
var PACKS=[],PACK_LOAD_ERRORS=[],PACK_EPOCH=0,ACTIVE_LIBRARY='builtin';
var PACK_META_KEY='cqframe.pack-meta.v1',PACK_STATES=load(PACK_META_KEY,{});
if(!PACK_STATES||typeof PACK_STATES!=='object'||Array.isArray(PACK_STATES))PACK_STATES={};
function packEnabled(id){return id==='builtin'||!PACK_STATES[id]||PACK_STATES[id].enabled!==false;}
function packQuestionEnabled(key){var pid=String(key).split('#')[0],p=PMAP[pid];return !p||!p.libraryId||packEnabled(p.libraryId);}
function registerQuestionPack(pack){
  QuestionPackSchema.papers(pack).forEach(function(p){
    PAPERS.push(p);PMAP[p.id]=p;TOTALQ+=p.count;
    if(p.fixQuestions&&p.fixQuestions.length){
      FPAPERS.push(p.id);FXBY[p.id]=p.fixQuestions;
      p.fixQuestions.forEach(function(q){FIXQ[q.key]=q;});TOTALF+=p.fixQuestions.length;HAS_FIX=TOTALF>0;
    }
    if(p.blankQuestions){
      var bp={id:p.id,libraryId:pack.id,count:p.blankQuestions.length,questions:p.blankQuestions,total:Math.round(p.blankQuestions.reduce(function(n,q){return n+q.total*100;},0))/100,blanks:p.blankQuestions.reduce(function(n,q){return n+q.blankNums.length;},0)};
      BPAPERS.push(bp);BPMAP[p.id]=bp;TOTALB+=bp.count;TOTALB_BLANK+=bp.blanks;
    }
  });
  PACKS.push(pack);
}
function libraryList(){
  return (typeof BANK!=='undefined'&&BANK.framework?[]:[{id:'builtin',title:'本地题库',subtitle:'C语言二级'}]).concat(PACKS.filter(function(p){return packEnabled(p.id);}).map(function(p){return {id:p.id,title:p.title,subtitle:p.subtitle||'本地题库'};}));
}
function homePapers(){return PAPERS.filter(function(p){return (p.libraryId||'builtin')===ACTIVE_LIBRARY&&packEnabled(p.libraryId||'builtin');});}
function homeChoicePapers(type){return homePapers().map(function(p){var qs=p.questions.filter(function(q){return (q.type==='multiple'?'multiple':'choice')===(type||'choice');});return Object.assign({},p,{questions:qs,count:qs.length,total:Math.round(qs.reduce(function(n,q){return n+(q.points===undefined?p.per:q.points)*100;},0))/100});}).filter(function(p){return p.count;});}
function homeQuestionCount(type){return homeChoicePapers(type).reduce(function(n,p){return n+p.count;},0);}
function homeBlankPapers(){return BPAPERS.filter(function(p){return (p.libraryId||'builtin')===ACTIVE_LIBRARY;});}
function homeBlankCount(){return homeBlankPapers().reduce(function(n,p){return n+p.count;},0);}
function libraryHasBlank(){return homeBlankCount()>0;}
function libraryHasFix(){return homePapers().some(function(p){return FXBY[p.id]&&FXBY[p.id].length;});}
function homeFixCount(){return homePapers().reduce(function(n,p){return n+(FXBY[p.id]||[]).length;},0);}
function homeProgramCount(){return homePapers().reduce(function(n,p){return n+(p.programQuestions||[]).length;},0);}
function libraryTitle(){var list=libraryList();return (list.filter(function(p){return p.id===ACTIVE_LIBRARY;})[0]||list[0]||{title:'本地题库'}).title;}
function librarySummary(){return homePapers().length+' 套'+(homeQuestionCount()?' · 单选 '+homeQuestionCount()+' 题':'')+(homeQuestionCount('multiple')?' · 多选 '+homeQuestionCount('multiple')+' 题':'')+(libraryHasBlank()?' · 填空 '+homeBlankCount()+' 题 / '+homeBlankPapers().reduce(function(n,p){return n+p.blanks;},0)+' 空':'')+(libraryHasFix()?' · 改错 '+homeFixCount()+' 题':'')+(homeProgramCount()?' · 编程 '+homeProgramCount()+' 题':'');}
function paperCode(p){return p.code||String(p.id).replace(/^\d{4}-?/,'').replace(/卷$/,'');}
function librarySupports(type){return type==='program'?homeProgramCount()>0:type==='blank'?libraryHasBlank():type==='fix'?libraryHasFix():type==='multiple'?homeQuestionCount('multiple')>0:homeQuestionCount()>0;}
function normalizeLibraryPick(){if(!librarySupports(PICK.split))PICK.split=['choice','multiple','blank','fix','program'].filter(librarySupports)[0]||'choice';}
function selectLibrary(id){
  if(id===ACTIVE_LIBRARY||!libraryList().some(function(p){return p.id===id;}))return;
  ACTIVE_LIBRARY=id;save(LIBRARY_KEY,id);normalizeLibraryPick();
  NASA_PICK={year:null,paper:null,initialized:false};renderHome();
}
function packConflict(pack){
  if(PACKS.some(function(p){return p.id===pack.id;}))return '此题包标识已存在。为保留历史答卷，当前版本不覆盖已有题包；新内容请使用新的题包标识。';
  if(PACKS.length>=20||PACKS.reduce(function(n,p){return n+p.papers.reduce(function(m,r){return m+r.questions.length;},0);},0)+pack.papers.reduce(function(n,p){return n+p.questions.length;},0)>10000)return '本机最多导入20个题包、合计10000题，请拆分到其他独立使用环境。';
  return '';
}
function installQuestionPack(input){return installQuestionPacks([input])[0];}
function resetQuestionPacks(){
  if(typeof FIXQ!=='undefined')Object.keys(FIXQ).forEach(function(k){if(k.indexOf('pack:')===0)delete FIXQ[k];});
  if(typeof FXBY!=='undefined')Object.keys(FXBY).forEach(function(k){if(k.indexOf('pack:')===0)delete FXBY[k];});
  if(typeof FPAPERS!=='undefined')for(var f=FPAPERS.length-1;f>=0;f--)if(String(FPAPERS[f]).indexOf('pack:')===0)FPAPERS.splice(f,1);
  if(typeof TOTALF!=='undefined'){TOTALF=Object.keys(FIXQ).length;HAS_FIX=TOTALF>0;}
  PACK_EPOCH++;PACKS=[];PACK_STATES={};PACK_LOAD_ERRORS=[];ACTIVE_LIBRARY='builtin';
  for(var i=PAPERS.length-1;i>=0;i--)if(PAPERS[i].libraryId){delete PMAP[PAPERS[i].id];PAPERS.splice(i,1);}
  TOTALQ=PAPERS.reduce(function(n,p){return n+p.count;},0);
  for(var j=BPAPERS.length-1;j>=0;j--)if(BPAPERS[j].libraryId){delete BPMAP[BPAPERS[j].id];BPAPERS.splice(j,1);}
  TOTALB=BPAPERS.reduce(function(n,p){return n+p.count;},0);TOTALB_BLANK=BPAPERS.reduce(function(n,p){return n+p.blanks;},0);
}

function assertPackReferences(data){
  function pid(id){if(typeof id==='string'&&id.indexOf('pack:')===0&&!PMAP[id.split(' · ')[0]])throw new Error('请先导入对应题包，再恢复学习记录：'+id);}
  ['review','wrong','marks'].forEach(function(name){Object.keys(data[name]||{}).forEach(function(k){pid(k.split('#')[0]);});});
  [data.session].concat(Array.isArray(data.exams)?data.exams:[]).forEach(function(s){if(!s)return;pid(s.pid);if(s.exam)pid(s.exam.paper);if(Array.isArray(s.order))s.order.forEach(function(o){if(o)pid(o.pid);});});
}
function downloadQuestionPack(pack,filename){
  var a=el('a'),url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json;charset=utf-8'}));
  a.href=url;a.download=filename||pack.id+'.json';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(url);a.remove();},500);
}
function sampleStudyPack(){return null;}
function sampleQuestionPack(){return null;}
function decodeQuestionPackImages(pack){
  var images=[];pack.papers.forEach(function(p){(p.groups||[]).forEach(function(g){g.images.forEach(function(im){images.push({name:p.title+' 共用题干'+g.num+'：'+im.name,data:im.data});});});p.questions.forEach(function(q){q.images.forEach(function(im){images.push({name:p.title+' 第'+q.num+'题：'+im.name,data:im.data});});});});
  return Promise.all(images.map(function(im){return new Promise(function(resolve){
    var image=new Image(),finished=false,timer=setTimeout(function(){finish(false);},5000);
    function finish(ok){if(finished)return;finished=true;clearTimeout(timer);image.onload=image.onerror=null;resolve(ok?null:{path:im.name,message:'浏览器无法解码此插图，请重新导出PNG/JPEG'});}
    image.onload=function(){finish(image.naturalWidth>0&&image.naturalHeight>0);};image.onerror=function(){finish(false);};image.src=im.data;
  });})).then(function(errors){return errors.filter(Boolean);});
}

function auditQuestionPack(pack){
  var warnings=[];
  pack.papers.forEach(function(p){
    var stems=Object.create(null);
    p.questions.forEach(function(q){
      var path=p.title+' 第'+q.num+'题',stem=q.stem.replace(/\s+/g,' ').trim();
      if(stems[stem]!==undefined)warnings.push({path:path,message:'与第'+stems[stem]+'题题干相同，请核对是否重复。'});else stems[stem]=q.num;
      if(q.options){var options=Object.create(null);QuestionPackSchema.optionKeys(q).forEach(function(k){var text=q.options[k].trim();if(options[text])warnings.push({path:path,message:k+'与'+options[text]+'选项文字相同，请核对。'});else options[text]=k;});}
    });
  });return warnings;
}
function inspectQuestionPackBatch(entries){
  var rows=entries.map(function(entry,i){
    var result=entry.result||QuestionPackSchema.check(entry.input),row={index:i,name:entry.name||'题包'+(i+1),state:'invalid',message:'未通过校验',errors:result.errors||[],warnings:[]};
    if(result.ok){row.pack=result.pack;row.summary=result.summary;row.state='ready';row.message='校验通过，待导入';row.warnings=auditQuestionPack(result.pack);}
    return row;
  }),groups=Object.create(null);
  rows.forEach(function(row){if(row.pack)(groups[row.pack.id]||(groups[row.pack.id]=[])).push(row);});
  Object.keys(groups).forEach(function(id){
    var group=groups[id],text=JSON.stringify(group[0].pack),different=group.some(function(row){return JSON.stringify(row.pack)!==text;});
    if(different){group.forEach(function(row){row.state='conflict';row.message='本批有相同标识、不同内容的题包。请移除冲突项后再检查；不会任选一个版本覆盖。';});return;}
    var installed=PACKS.filter(function(p){return p.id===id;})[0];
    group.forEach(function(row,i){
      if(installed){var same=JSON.stringify(installed)===text;row.state=same?'installed':'conflict';row.message=same?'已导入相同内容，无需重复导入。':'标识与已导入题包冲突（已有修订'+installed.revision+'，本次修订'+row.pack.revision+'）。较高修订可点击“查看更新”核对影响；其他内容请使用新的题包标识。';}
      else if(i){row.state='duplicate';row.message='本批重复文件，内容相同，仅导入第一份。';}
    });
  });return rows;
}
function questionPackBatchConflict(packs){
  if(!packs.length)return '请先勾选至少一个可导入题包。';
  var count=PACKS.reduce(function(n,p){return n+p.papers.reduce(function(m,r){return m+r.questions.length;},0);},0);
  count+=packs.reduce(function(n,p){return n+p.papers.reduce(function(m,r){return m+r.questions.length;},0);},0);
  if(PACKS.length+packs.length>20||count>10000)return '所选内容超过本机20个题包或合计10000题的限制，请减少勾选。';
  return '';
}
function installQuestionPacks(inputs){
  assertPackManagement();
  if(isExam()&&!SESSION.done)throw new Error('请先交卷，再导入题包。');
  var rows=inspectQuestionPackBatch(inputs.map(function(input){return {input:input};}));
  var blocked=rows.filter(function(row){return row.state!=='ready';})[0];
  if(blocked)throw new Error(blocked.errors.length?blocked.errors[0].path+'：'+blocked.errors[0].message:blocked.message);
  var packs=rows.map(function(row){return row.pack;}),conflict=questionPackBatchConflict(packs);if(conflict)throw new Error(conflict);
  
  try{var writes={};writes[PACK_KEY]=JSON.stringify(PACKS.concat(packs));commitPackStorage(writes);}catch(e){throw new Error('保存失败：本机存储不可用或空间不足。本批题包均未导入，原题库和答卷保留；请减少勾选、压缩图片或先导出备份。');}
  packs.forEach(registerQuestionPack);PACK_EPOCH++;return packs;
}
function makePackImportReport(entries,rows){
  var selected=rows.filter(function(row){return row.state==='ready'&&entries[row.index].checked!==false;}).map(function(row){return row.pack;});
  return {format:'cquiz-pack-import-report',version:1,checkedAt:new Date().toISOString(),saved:false,notice:'这是导入前的本地格式与重复检查，不证明答案、解析或题源正确，也不是题包或学习备份。',selectionIssue:questionPackBatchConflict(selected),items:rows.map(function(row){return {file:row.name,state:row.state,message:row.message,selected:row.state==='ready'&&entries[row.index].checked!==false,id:row.pack?row.pack.id:null,title:row.pack?row.pack.title:null,revision:row.pack?row.pack.revision:null,summary:row.summary||null,errors:row.errors,warnings:row.warnings};})};
}

function openQuestionPacks(){
  if(isExam()&&!SESSION.done){alert('请先交卷，再管理题包。');return;}
  var M=modalBox('题库管理',true),box=M.box,epoch=PACK_EPOCH,token=0,reader=null,entries=[],rows=[],active=-1,busy=false;
  box.classList.add('pack-manager','pack-workspace');box.style.maxWidth='1080px';
  var remove=M.m.remove;M.m.remove=function(){token++;if(reader&&reader.readyState===1)reader.abort();remove();};
  var shortcuts=el('div','toolbar pack-workspace-tabs');var manageTab=btn('管理已导入题库',function(){showPanel(true);}),importTab=btn('导入 / 更新题包',function(){showPanel(false);});shortcuts.appendChild(manageTab);shortcuts.appendChild(importTab);box.appendChild(shortcuts);
  box.appendChild(el('p','note','离线导入客观题和程序题包。先检查，再预览，最后保存；不调用AI或联网服务。格式通过仍需核对答案、解析和题源。'));
  var modes=el('div','toolbar pack-input-switch'),fileMode=btn('文件导入',function(){switchMode(false);}),pasteMode=btn('粘贴JSON',function(){switchMode(true);});modes.appendChild(fileMode);modes.appendChild(pasteMode);box.appendChild(modes);
  var fileArea=el('div','pack-file-area'),fileLabel=el('label','pack-input-label','选择本地题包JSON（可多选，最多20个文件）'),file=el('input');file.type='file';file.multiple=true;file.accept='.json,application/json';file.setAttribute('aria-label','选择本地题包JSON');fileLabel.appendChild(file);fileArea.appendChild(fileLabel);box.appendChild(fileArea);
  var pasteArea=el('div','pack-paste-area'),pasteLabel=el('label','pack-input-label','粘贴完整的题包JSON'),paste=el('textarea');paste.rows=8;paste.spellcheck=false;paste.setAttribute('aria-label','粘贴题包JSON');paste.placeholder='粘贴以 { 开始的完整JSON题包；Word原文需要先整理成题包。';pasteLabel.appendChild(paste);pasteArea.appendChild(pasteLabel);pasteArea.appendChild(btn('校验并预览',function(){validateText();}));pasteArea.hidden=true;box.appendChild(pasteArea);
  var examples=el('div','toolbar');examples.appendChild(btn('下载示例题包',function(){downloadQuestionPack(sampleQuestionPack());}));examples.appendChild(btn('下载混合题型示例',function(){downloadQuestionPack(sampleObjectivePack());}));examples.appendChild(btn('下载动态选项示例',function(){downloadQuestionPack(sampleDynamicPack());}));examples.appendChild(btn('下载连续小问示例',function(){downloadQuestionPack(sampleSubquestionPack());}));examples.appendChild(btn('下载程序题包示例',function(){downloadQuestionPack(sampleStudyPack());}));if(!BANK.framework)box.appendChild(examples);
  var status=el('p','pack-status','选择文件或粘贴JSON后先检查；确认导入才会保存。');status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.appendChild(status);
  var batch=el('div','pack-batch');box.appendChild(batch);
  var preview=el('div','pack-preview');box.appendChild(preview);
  var summary=el('p','pack-selection-summary');summary.setAttribute('role','status');box.appendChild(summary);
  var confirmImport=btn('确认导入',function(){
    if(busy)return;
    if(epoch!==PACK_EPOCH){clearDraft('题库状态已变化，请关闭后重新打开导入窗口。');return;}
    var packs=selected();var conflict=questionPackBatchConflict(packs);if(conflict){status.textContent=conflict;return;}
    try{var imported=installQuestionPacks(packs);M.m.remove();activate(imported[0].id);}
    catch(e){status.textContent=e.message;}
  },true),reportButton=btn('下载检查报告',function(){downloadQuestionPack(makePackImportReport(entries,rows),'题包导入检查报告.json');});
  confirmImport.disabled=true;reportButton.disabled=true;var bottom=el('div','toolbar pack-import-bottom');bottom.appendChild(confirmImport);bottom.appendChild(reportButton);bottom.appendChild(btn('关闭',function(){M.m.remove();}));box.appendChild(bottom);
  function activate(id){ACTIVE_LIBRARY=id;save(LIBRARY_KEY,id);NASA_PICK={year:null,paper:null,initialized:false};normalizeLibraryPick();go('home');}
  function alive(current){return current===token&&epoch===PACK_EPOCH&&M.m.isConnected;}
  function clearDraft(message){token++;if(reader&&reader.readyState===1)reader.abort();entries=[];rows=[];active=-1;busy=false;emptyNode(batch);emptyNode(preview);summary.textContent='';confirmImport.disabled=true;reportButton.disabled=true;status.textContent=message;}
  function switchMode(isPaste){file.value='';clearDraft('输入方式已切换，本次预览已清除。确认导入才会保存。');fileArea.hidden=isPaste;pasteArea.hidden=!isPaste;fileMode.setAttribute('aria-pressed',String(!isPaste));pasteMode.setAttribute('aria-pressed',String(isPaste));}
  fileMode.setAttribute('aria-pressed','true');pasteMode.setAttribute('aria-pressed','false');
  function selected(){return rows.filter(function(row){return row.state==='ready'&&entries[row.index].checked!==false;}).map(function(row){return row.pack;});}
  function updateSelection(){
    var packs=selected(),n=packs.reduce(function(n,p){return n+p.papers.reduce(function(n,p){return n+p.questions.length;},0);},0),conflict=questionPackBatchConflict(packs);
    summary.textContent=rows.length?'已勾选 '+packs.length+' 个新题包 / '+n+' 题。'+(conflict||'仅保存勾选且通过检查的新题包；重复及失败项不会写入。'):'';
    confirmImport.disabled=busy||!!conflict;reportButton.disabled=busy||!rows.length;
  }
  function issueList(title,issues,css){var section=el('details',css),head=el('summary',null,title+'（'+issues.length+'）');section.appendChild(head);var list=el('ul','pack-errors');issues.forEach(function(e){list.appendChild(el('li',null,e.path+'：'+e.message));});section.appendChild(list);return section;}
  function renderBatch(){
    rows=inspectQuestionPackBatch(entries);emptyNode(batch);
    rows.forEach(function(row,i){
      var item=el('section','pack-batch-item pack-state-'+row.state),head=el('div','pack-batch-head'),label=el('label','pack-batch-label'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=row.state==='ready'&&entries[i].checked!==false;checkbox.disabled=row.state!=='ready';checkbox.setAttribute('aria-label','导入 '+(row.pack?row.pack.title:row.name));checkbox.onchange=function(){entries[i].checked=checkbox.checked;updateSelection();};label.appendChild(checkbox);label.appendChild(el('strong',null,row.pack?row.pack.title:row.name));head.appendChild(label);
      var actions=el('div','toolbar');var view=btn('预览',function(){active=i;renderPreview(true);});view.disabled=!row.pack;view.setAttribute('aria-label','预览 '+(row.pack?row.pack.title:row.name));actions.appendChild(view);actions.appendChild(btn('移除',function(){entries.splice(i,1);active=-1;renderBatch();}));head.appendChild(actions);item.appendChild(head);item.appendChild(el('p','note',row.name+(row.pack?' · '+row.pack.id+' · 修订'+row.pack.revision:'')));item.appendChild(el('p','pack-row-message',row.message));
      if(row.pack&&row.state==='conflict'&&PACKS.some(function(p){return p.id===row.pack.id&&row.pack.revision>p.revision;})&&(groupsForUpdate(rows,row.pack.id)===1)){actions.appendChild(btn('查看更新',function(){M.m.remove();openPackUpdate(row.pack);}));}
      if(row.summary){var counts={single:0,multiple:0,blank:0,code_blank:0,fix:0,program:0};row.pack.papers.forEach(function(p){p.questions.forEach(function(q){counts[q.type||'single']++;});});item.appendChild(el('p','note',row.summary.papers+' 套 / '+row.summary.questions+' 题 / '+row.summary.images+' 张图 · 单选 '+counts.single+' · 多选 '+counts.multiple+' · 填空 '+counts.blank+' · 程序填空 '+counts.code_blank+' · 改错 '+counts.fix+' · 编程 '+counts.program));}
      if(row.errors.length){var errors=issueList('需要修正',row.errors,'pack-issues');errors.open=true;item.appendChild(errors);}
      if(row.warnings.length)item.appendChild(issueList('建议人工核对（不阻止导入）',row.warnings,'pack-warnings'));
      batch.appendChild(item);
    });
    var valid=rows.filter(function(row){return !!row.pack;});if(active<0||!rows[active]||!rows[active].pack)active=valid.length?valid[0].index:-1;renderPreview();updateSelection();
  }
  function renderPreview(expanded){
    emptyNode(preview);if(active<0||!rows[active]||!rows[active].pack)return;
    var pack=rows[active].pack;preview.appendChild(el('h3',null,'待核对内容 · '+pack.title));
    var disclosure=el('details','pack-preview-disclosure'),heading=el('summary'),caption=el('strong',null,'展开题目预览'),count=pack.papers.reduce(function(n,p){return n+p.questions.length;},0),body=el('div','pack-preview-body'),initialized=false;
    heading.appendChild(caption);heading.appendChild(el('span','note',pack.papers.length+' 套试卷 · '+count+' 题 · 含参考答案'));disclosure.appendChild(heading);disclosure.appendChild(body);preview.appendChild(disclosure);
    function updateDisclosure(){caption.textContent=disclosure.open?'收起题目预览':'展开题目预览';if(disclosure.open&&!initialized){initialized=true;renderContents();}}
    disclosure.ontoggle=updateDisclosure;disclosure.open=!!expanded;updateDisclosure();
    function renderContents(){
    body.appendChild(el('p','note',pack.source));if(pack.format==='cquiz-study-pack')body.appendChild(el('p','note','程序填空、改错可计入练习与考试；编程题进入普通练习、复习和统计；暂不计入模拟考试。'));
    var tools=el('div','pack-preview-tools'),label=el('label',null,'预览试卷 '),select=el('select');select.setAttribute('aria-label','预览试卷');pack.papers.forEach(function(p,i){var op=el('option',null,p.title+' · '+fmtScore(p.questions.reduce(function(n,q){return n+(q.type==='program'?0:QuestionPackSchema.points(p,q));},0))+'分（考试计分）');op.value=String(i);select.appendChild(op);});label.appendChild(select);tools.appendChild(label);
    var typeLabel=el('label',null,'题型 '),type=el('select');type.setAttribute('aria-label','预览题型');[['all','全部'],['single','单选'],['multiple','多选'],['blank','填空'],['code_blank','程序填空'],['fix','改错'],['program','编程']].forEach(function(a){var op=el('option',null,a[1]);op.value=a[0];type.appendChild(op);});typeLabel.appendChild(type);tools.appendChild(typeLabel);
    var queryLabel=el('label',null,'查找 '),query=el('input');query.type='search';query.placeholder='题干、选项、知识点或标签';query.setAttribute('aria-label','查找预览题目');queryLabel.appendChild(query);tools.appendChild(queryLabel);
    var jumpLabel=el('label',null,'题号 '),jump=el('input');jump.type='number';jump.min='1';jump.max='99999';jump.setAttribute('aria-label','定位预览题号');jumpLabel.appendChild(jump);tools.appendChild(jumpLabel);
    var locate=btn('定位',function(){var no=Number(jump.value),qs=filtered(),idx=qs.findIndex(function(q){return q.num===no;});if(!Number.isInteger(no)||idx<0){feedback.textContent='当前试卷和筛选条件下没有这个题号，请调整条件。';return;}pageNum=Math.floor(idx/5);showPage();var target=list.querySelector('[data-preview-num="'+no+'"]');if(target)target.scrollIntoView({block:'nearest'});});tools.appendChild(locate);body.appendChild(tools);
    var feedback=el('p','note pack-preview-feedback');feedback.setAttribute('role','status');body.appendChild(feedback);var list=el('div','pack-preview-list'),pager=el('div','toolbar pack-preview-pager'),pageNum=0;body.appendChild(list);body.appendChild(pager);
    function filtered(){var p=pack.papers[Number(select.value)||0],term=query.value.trim().toLowerCase();return p.questions.filter(function(q){return (type.value==='all'||(q.type||'single')===type.value)&&(!term||[q.stem,(QuestionPackSchema.groupOf(p,q)||{}).stem||'',q.topic,q.tags.join(' '),q.options?Object.keys(q.options).map(function(k){return q.options[k];}).join(' '):''].join(' ').toLowerCase().indexOf(term)>=0);});}
    function showPage(){
      emptyNode(list);emptyNode(pager);var p=pack.papers[Number(select.value)||0],qs=filtered(),total=Math.ceil(qs.length/5);pageNum=Math.min(pageNum,Math.max(0,total-1));feedback.textContent='当前 '+qs.length+' / '+p.questions.length+' 题；预览包含参考答案，请核对后再导入。';
      if(!qs.length){list.appendChild(el('p','note','没有符合条件的题目。'));return;}
      qs.slice(pageNum*5,pageNum*5+5).forEach(function(q){
        var item=el('section','pack-question');item.setAttribute('data-preview-num',String(q.num));item.appendChild(el('h4',null,'第'+QuestionPackSchema.questionNumber(q,p)+'题 · '+({blank:'填空',multiple:'多选',code_blank:'程序填空',fix:'改错',program:'编程'}[q.type]||'单选')+' · '+(q.type==='program'?'练习 '+fmtScore(QuestionPackSchema.points(p,q))+'分，不计考试分':fmtScore(QuestionPackSchema.points(p,q))+'分')));var group=QuestionPackSchema.groupOf(p,q);if(group){var material=el('section','shared-material');material.appendChild(el('div','shared-material-title','共用题干 · 第'+group.num+'题'));material.appendChild(el('pre','pack-text',group.stem));group.images.forEach(function(im){var img=el('img');img.src=im.data;img.alt=im.name;material.appendChild(img);});item.appendChild(material);}item.appendChild(el('pre','pack-text',q.stem));
        q.images.forEach(function(im){var img=el('img');img.src=im.data;img.alt=im.name;item.appendChild(img);});
        if(q.type==='code_blank'){item.appendChild(el('pre','pack-text',q.code));q.blanks.forEach(function(b){item.appendChild(el('p','note','第'+b.num+'空：'+b.answers.join(' / ')));});}
        else if(q.type==='fix'){item.appendChild(el('pre','pack-text',q.code));q.faults.forEach(function(f){item.appendChild(el('p','note','第'+f.line+'行：'+f.original+' → '+f.fixed));});item.appendChild(el('p','note','测试点 '+q.tests.length+' 组'));}
        else if(q.type==='program'){item.appendChild(el('pre','pack-text',q.starter));item.appendChild(el('p','note',q.input+'\n'+q.output+' · 公开测试 '+q.tests.length+' 组'));}
        else if(q.type==='blank')q.blanks.forEach(function(b,i){item.appendChild(el('p','note','第'+(i+1)+'空：'+b.answers.join(' / ')+' · '+(b.mode==='number'?'数值，绝对误差 '+b.tolerance:'文本，忽略首尾空白')));});else QuestionPackSchema.optionKeys(q).forEach(function(k){item.appendChild(el('pre','pack-text',k+'. '+q.options[k]));});
        item.appendChild(el('p','note',(q.type==='blank'?'普通填空':q.type==='multiple'?'多选 · 答案 '+q.answer.join('、'):q.type==='single'||!q.type?'单选 · 答案 '+q.answer:'程序题 · '+q.type)+' · '+q.topic+' · '+q.tags.join(' / ')));item.appendChild(el('pre','pack-text',q.analysis));list.appendChild(item);
      });
      var prev=btn('上一页',function(){pageNum--;showPage();}),next=btn('下一页',function(){pageNum++;showPage();});prev.disabled=pageNum===0;next.disabled=pageNum+1>=total;pager.appendChild(prev);pager.appendChild(el('span',null,(pageNum+1)+' / '+total));pager.appendChild(next);
    }
    select.onchange=type.onchange=function(){pageNum=0;showPage();};query.oninput=function(){pageNum=0;showPage();};jump.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();locate.click();}};showPage();
    }
  }
  function checkImages(result,current){
    if(!result.ok||!result.summary.images)return Promise.resolve(result);
    status.textContent='正在检查插图…';return decodeQuestionPackImages(result.pack).then(function(errors){if(!alive(current))return null;return errors.length?{ok:false,errors:errors}:result;});
  }
  function finish(current){if(!alive(current))return;busy=false;status.textContent='检查完成：'+entries.length+' 项。通过项可预览、勾选；失败及冲突项不会导入。';renderBatch();}
  function validateText(){
    clearDraft('正在检查粘贴的题包…');var current=token;busy=true;var result=QuestionPackSchema.parse(paste.value);checkImages(result,current).then(function(checked){if(!alive(current)||!checked)return;entries=[{name:'粘贴的JSON',result:checked,checked:true}];finish(current);});
  }
  paste.oninput=function(){clearDraft('内容已变更，请点击“校验并预览”重新检查。');};
  file.onchange=function(){
    clearDraft('正在读取本地题包…');var files=Array.prototype.slice.call(file.files||[]),current=token;if(!files.length){status.textContent='尚未选择文件。';return;}if(files.length>20){status.textContent='一次最多选择20个文件，请减少文件数。';return;}busy=true;
    function next(i){
      if(!alive(current))return;if(i>=files.length){finish(current);return;}var f=files[i];status.textContent='正在检查 '+(i+1)+' / '+files.length+'：'+f.name;
      function receive(result){if(!alive(current))return;checkImages(result,current).then(function(checked){if(!alive(current)||!checked)return;entries.push({name:f.name,result:checked,checked:true});next(i+1);});}
      if(f.size>QuestionPackSchema.MAX_BYTES){receive({ok:false,errors:[{path:'题包文件',message:'文件超过2MiB，请拆分或压缩插图。'}]});return;}
      reader=new FileReader();reader.onload=function(){receive(QuestionPackSchema.parse(reader.result));};reader.onerror=function(){receive({ok:false,errors:[{path:'题包文件',message:'文件读取失败，请重新选择。'}]});};reader.readAsText(f,'utf-8');
    }next(0);
  };
  var stored=renderPackManager(box,M,function(){epoch=PACK_EPOCH;file.value='';clearDraft('题库状态已更新，本次待导入预览已清除。请选择题包重新检查。');});
  box.appendChild(el('p','note','题包只存于本浏览器。迁移时分别导出题库备份和学习记录，恢复时先恢复题库。新构建首次打开或清空全部进度仍会清除导入包。Word/PDF原文暂不能直接识题。'));
  var topClose=btn('关闭题库管理',function(){M.m.remove();});topClose.classList.add('pack-workspace-close');shortcuts.appendChild(topClose);
  var intro=el('div','pack-workspace-heading');intro.appendChild(el('span','pack-workspace-kicker','LOCAL ARCHIVE'));intro.appendChild(el('h3',null,'你的题库工作台'));intro.appendChild(el('p',null,'整理本机题库，或检查并添加新的题包。'));box.insertBefore(intro,shortcuts);
  var importPanel=el('section','pack-import-panel');importPanel.setAttribute('aria-label','导入与更新题包');
  Array.prototype.slice.call(box.children).forEach(function(n){if(n!==box.firstChild && n!==intro && n!==shortcuts && n!==stored)importPanel.appendChild(n);});
  box.appendChild(importPanel);
  function showPanel(manage){stored.hidden=!manage;importPanel.hidden=manage;manageTab.setAttribute('aria-pressed',String(manage));importTab.setAttribute('aria-pressed',String(!manage));}
  showPanel(PACKS.length>0);

}
function groupsForUpdate(rows,id){return rows.filter(function(r){return r.pack&&r.pack.id===id;}).length;}


(function(){
  var stored=load(PACK_KEY,[]);if(!Array.isArray(stored)){PACK_LOAD_ERRORS.push('题包存储格式异常');return;}
  stored.forEach(function(input){var result=QuestionPackSchema.check(input);if(!result.ok){PACK_LOAD_ERRORS.push('有题包未通过校验');return;}var conflict=packConflict(result.pack);if(conflict){PACK_LOAD_ERRORS.push(conflict);return;}registerQuestionPack(result.pack);});
  var active=load(LIBRARY_KEY,'builtin');if(libraryList().some(function(p){return p.id===active;}))ACTIVE_LIBRARY=active;else if(libraryList().length)ACTIVE_LIBRARY=libraryList()[0].id;
})();
