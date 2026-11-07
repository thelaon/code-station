
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
  NASA_PICK={year:null,paper:null,initialized:false};
  if(VIEW==='home')renderHome();
}
function packConflict(pack){
  if(PACKS.some(function(p){return p.id===pack.id;}))return '题包标识已存在。请在题库管理中更新；不同题库应使用新的标识。';
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

var packPageCleanup=null;
function leaveQuestionPacks(){
  if(packPageCleanup)packPageCleanup();
  packPageCleanup=null;
}
function openQuestionPacks(){
  if(isExam()&&!SESSION.done){alert('请先交卷，再管理题包。');return;}
  if(VIEW!=='packs')go('packs');
}
function renderQuestionPacks(){
  renderNav();
  var view=emptyNode(viewEl()),box=el('section','card pack-manager pack-workspace'),epoch=PACK_EPOCH,token=0,reader=null,entries=[],rows=[],busy=false;
  view.appendChild(box);
  packPageCleanup=function(){token++;if(reader&&reader.readyState===1)reader.abort();};
  function backToHome(){
    go('home');
    var homeButton=document.querySelector('#nav button');
    if(homeButton)homeButton.focus({preventScroll:true});
  }
  var intro=el('header','pack-workspace-heading');
  var copy=el('div'),title=el('h2',null,'题库管理');
  title.tabIndex=-1;
  copy.appendChild(el('span','pack-workspace-kicker','LOCAL ARCHIVE'));
  copy.appendChild(title);
  copy.appendChild(el('p',null,'导入、更新和备份本机题库。'));
  intro.appendChild(copy);
  intro.appendChild(btn('返回选卷',backToHome));
  box.appendChild(intro);
  var importPanel=el('section','pack-import-panel');importPanel.setAttribute('aria-label','导入与更新题包');
  var shortcuts=el('div','toolbar pack-workspace-tabs');var manageTab=btn('管理已导入题库',function(){showPanel(true);}),importTab=btn('导入 / 更新题包',function(){showPanel(false);});shortcuts.appendChild(manageTab);shortcuts.appendChild(importTab);box.appendChild(shortcuts);
  importPanel.appendChild(el('p','note','选择本地 JSON 题包。通过格式检查后，可打开审阅界面核对和修改题目。'));
  var modes=el('div','toolbar pack-input-switch'),fileMode=btn('文件导入',function(){switchMode(false);}),pasteMode=btn('粘贴JSON',function(){switchMode(true);});modes.appendChild(fileMode);modes.appendChild(pasteMode);importPanel.appendChild(modes);
  var fileArea=el('div','pack-file-area');
  var filePicker=createPackFilePicker({title:'导入本地题包',hint:'支持 JSON，每次最多选 20 个文件，每个不超过 2 MiB。',action:'选择题包',inputLabel:'选择本地题包JSON',multiple:true});
  var file=filePicker.input;fileArea.appendChild(filePicker.control);importPanel.appendChild(fileArea);
  var pasteArea=el('div','pack-paste-area'),pasteLabel=el('label','pack-input-label','粘贴完整的题包JSON'),paste=el('textarea');paste.rows=8;paste.spellcheck=false;paste.setAttribute('aria-label','粘贴题包JSON');paste.placeholder='粘贴以 { 开始的完整JSON题包；Word原文需要先整理成题包。';pasteLabel.appendChild(paste);pasteArea.appendChild(pasteLabel);pasteArea.appendChild(btn('检查题包',function(){validateText();}));pasteArea.hidden=true;importPanel.appendChild(pasteArea);
  var examples=el('div','toolbar');examples.appendChild(btn('下载示例题包',function(){downloadQuestionPack(sampleQuestionPack());}));examples.appendChild(btn('下载混合题型示例',function(){downloadQuestionPack(sampleObjectivePack());}));examples.appendChild(btn('下载动态选项示例',function(){downloadQuestionPack(sampleDynamicPack());}));examples.appendChild(btn('下载连续小问示例',function(){downloadQuestionPack(sampleSubquestionPack());}));examples.appendChild(btn('下载程序题包示例',function(){downloadQuestionPack(sampleStudyPack());}));if(!BANK.framework)importPanel.appendChild(examples);
  var status=el('p','pack-status','选择文件或粘贴 JSON 后先做格式检查。使用前请审阅题目。');status.setAttribute('role','status');status.setAttribute('aria-live','polite');importPanel.appendChild(status);
  var batch=el('div','pack-batch');importPanel.appendChild(batch);
  var summary=el('p','pack-selection-summary');summary.setAttribute('role','status');importPanel.appendChild(summary);
  var confirmImport=btn('确认导入',function(){
    if(busy)return;
    if(epoch!==PACK_EPOCH){clearDraft('题库状态已变化，请重新进入题库管理。');return;}
    var packs=selected();var conflict=questionPackBatchConflict(packs);if(conflict){status.textContent=conflict;return;}
    try{var imported=installQuestionPacks(packs);selectLibrary(imported[0].id);go('packs');
      viewEl().querySelector('.pack-installed .pack-status').textContent='已导入 '+imported.length+' 个题包。使用前请先点「审阅题目」，核对题干、答案和解析。';}
    catch(e){status.textContent=e.message;}
  },true),reportButton=btn('下载检查报告',function(){downloadQuestionPack(makePackImportReport(entries,rows),'题包导入检查报告.json');});
  confirmImport.disabled=true;reportButton.disabled=true;var bottom=el('div','toolbar pack-import-bottom');bottom.appendChild(confirmImport);bottom.appendChild(reportButton);importPanel.appendChild(bottom);
  function alive(current){return current===token&&epoch===PACK_EPOCH&&box.isConnected;}
  function clearDraft(message){token++;if(reader&&reader.readyState===1)reader.abort();entries=[];rows=[];busy=false;emptyNode(batch);summary.textContent='';confirmImport.disabled=true;reportButton.disabled=true;status.textContent=message;}
  function switchMode(isPaste){filePicker.reset();clearDraft('输入方式已切换，本次预览已清除。确认导入才会保存。');fileArea.hidden=isPaste;pasteArea.hidden=!isPaste;fileMode.setAttribute('aria-pressed',String(!isPaste));pasteMode.setAttribute('aria-pressed',String(isPaste));}
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
      var actions=el('div','toolbar');if(row.pack){var review=btn('审阅题目',function(){reviewEntry(i,entries[i],row.pack);});review.classList.add('pack-review-open');review.setAttribute('aria-label','审阅题目 '+row.pack.title);actions.appendChild(review);}actions.appendChild(btn('移除',function(){entries.splice(i,1);renderBatch();}));head.appendChild(actions);item.appendChild(head);item.appendChild(el('p','note',row.name+(row.pack?' · '+row.pack.id+' · 修订'+row.pack.revision:'')));item.appendChild(el('p','pack-row-message',row.message));
      if(row.pack&&row.state==='conflict'&&PACKS.some(function(p){return p.id===row.pack.id&&row.pack.revision>p.revision;})&&(groupsForUpdate(rows,row.pack.id)===1)){actions.appendChild(btn('查看更新',function(){openPackUpdate(row.pack);}));}
      if(row.summary){var counts={single:0,multiple:0,blank:0,code_blank:0,fix:0,program:0};row.pack.papers.forEach(function(p){p.questions.forEach(function(q){counts[q.type||'single']++;});});item.appendChild(el('p','note',row.summary.papers+' 套 / '+row.summary.questions+' 题 / '+row.summary.images+' 张图 · 单选 '+counts.single+' · 多选 '+counts.multiple+' · 填空 '+counts.blank+' · 程序填空 '+counts.code_blank+' · 改错 '+counts.fix+' · 编程 '+counts.program));}
      if(row.errors.length){var errors=issueList('需要修正',row.errors,'pack-issues');errors.open=true;item.appendChild(errors);}
      if(row.warnings.length)item.appendChild(issueList('建议人工核对（不阻止导入）',row.warnings,'pack-warnings'));
      batch.appendChild(item);
    });
    updateSelection();
  }
  function reviewEntry(index,entry,pack){
    var current=token;
    openPackQuestionReview(pack,{apply:function(checked,dialog){
      if(!alive(current)||entries[index]!==entry)throw new Error('待导入题包已变化，请重新选择。');
      entry.result=checked;
      dialog.m.remove();
      status.textContent='审阅修改已应用，请确认导入后再使用题包。';
      renderBatch();
      var button=batch.children[index].querySelector('.pack-review-open');
      if(button)button.focus();
    }});
  }
  function checkImages(result,current){
    if(!result.ok||!result.summary.images)return Promise.resolve(result);
    status.textContent='正在检查插图…';return decodeQuestionPackImages(result.pack).then(function(errors){if(!alive(current))return null;return errors.length?{ok:false,errors:errors}:result;});
  }
  function finish(current){if(!alive(current))return;busy=false;status.textContent='检查完成，共 '+entries.length+' 项。使用前请点「审阅题目」，核对题干、答案和解析。';renderBatch();}
  function validateText(){
    clearDraft('正在检查粘贴的题包…');var current=token;busy=true;var result=QuestionPackSchema.parse(paste.value);checkImages(result,current).then(function(checked){if(!alive(current)||!checked)return;entries=[{name:'粘贴的JSON',result:checked,checked:true}];finish(current);});
  }
  paste.oninput=function(){clearDraft('内容已变更，请点击“检查题包”重新检查。');};
  file.onchange=function(){
    clearDraft('正在读取本地题包…');var files=Array.prototype.slice.call(file.files||[]),current=token;if(!files.length){status.textContent='尚未选择文件。';return;}if(files.length>20){status.textContent='一次最多选择20个文件，请减少文件数。';return;}busy=true;
    function next(i){
      if(!alive(current))return;if(i>=files.length){finish(current);return;}var f=files[i];status.textContent='正在检查 '+(i+1)+' / '+files.length+'：'+f.name;
      function receive(result){if(!alive(current))return;checkImages(result,current).then(function(checked){if(!alive(current)||!checked)return;entries.push({name:f.name,result:checked,checked:true});next(i+1);});}
      if(f.size>QuestionPackSchema.MAX_BYTES){receive({ok:false,errors:[{path:'题包文件',message:'文件超过2MiB，请拆分或压缩插图。'}]});return;}
      reader=new FileReader();reader.onload=function(){receive(QuestionPackSchema.parse(reader.result));};reader.onerror=function(){receive({ok:false,errors:[{path:'题包文件',message:'文件读取失败，请重新选择。'}]});};reader.readAsText(f,'utf-8');
    }next(0);
  };
  var stored=renderPackManager(box,function(){epoch=PACK_EPOCH;filePicker.reset();clearDraft('题库状态已更新，本次待导入预览已清除。请选择题包重新检查。');});
  importPanel.appendChild(el('p','note','题包保存在当前浏览器。迁移前分别备份题库、学习记录和代码草稿；恢复时先恢复题库。Word、PDF需先转换为题包JSON。'));
  box.appendChild(importPanel);
  function showPanel(manage){stored.hidden=!manage;importPanel.hidden=manage;manageTab.setAttribute('aria-pressed',String(manage));importTab.setAttribute('aria-pressed',String(!manage));}
  showPanel(PACKS.length>0);
  $('#foot').textContent=footText('题库保存在本机，可导出备份。');
  title.focus({preventScroll:true});
}
function groupsForUpdate(rows,id){return rows.filter(function(r){return r.pack&&r.pack.id===id;}).length;}


(function(){
  var stored=load(PACK_KEY,[]);if(!Array.isArray(stored)){PACK_LOAD_ERRORS.push('题包存储格式异常');return;}
  stored.forEach(function(input){var result=QuestionPackSchema.check(input);if(!result.ok){PACK_LOAD_ERRORS.push('有题包未通过校验');return;}var conflict=packConflict(result.pack);if(conflict){PACK_LOAD_ERRORS.push(conflict);return;}registerQuestionPack(result.pack);});
  var active=load(LIBRARY_KEY,'builtin');if(libraryList().some(function(p){return p.id===active;}))ACTIVE_LIBRARY=active;else if(libraryList().length)ACTIVE_LIBRARY=libraryList()[0].id;
})();
