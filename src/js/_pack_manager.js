
function packTxnKey(){return 'cqframe.pack-txn.v1';}
function packStorageKeys(){return ['cqframe.packs.v1','cqframe.pack-meta.v1','cqframe.library.v1','cqframe.review.v2','cqframe.wrong.v1','cqframe.marks.v1','cqframe.session.v1','cqframe.blanks.v1','cqframe.exams.v1','cqframe.programming.v1','cqframe.stats.v1','cqframe.set.v1'];}
function validPackStorageKey(k){var prefix='cqframe.fix.pack:';return packStorageKeys().indexOf(k)>=0||(k.indexOf(prefix)===0&&/^[a-z][a-z0-9-]*:/.test(k.slice(prefix.length)));}
function recoverPackTransaction(){
  var text;try{text=localStorage.getItem(packTxnKey());}catch(e){return;}if(!text)return;
  var journal=JSON.parse(text);
  if(!journal||journal.format!=='cquiz-pack-transaction'||!Array.isArray(journal.before)||journal.before.length>20000||journal.before.some(function(r){return !Array.isArray(r)||r.length!==2||typeof r[0]!=='string'||!validPackStorageKey(r[0])||(r[1]!==null&&typeof r[1]!=='string');}))throw new Error('题库变更恢复记录异常，原数据未覆盖。');
  journal.before.forEach(function(r){if(r[1]===null)localStorage.removeItem(r[0]);else localStorage.setItem(r[0],r[1]);});
  localStorage.removeItem(packTxnKey());
}
function commitPackStorage(writes){
  CQStorage.assertWritable();recoverPackTransaction();
  var keys=Object.keys(writes);if(keys.some(function(k){return !validPackStorageKey(k);}))throw new Error('题库写入范围异常。');keys=keys.filter(function(k){return localStorage.getItem(k)!==writes[k];});
  var before=keys.map(function(k){return [k,localStorage.getItem(k)];});
  try{
    localStorage.setItem(packTxnKey(),JSON.stringify({format:'cquiz-pack-transaction',before:before}));
    keys.forEach(function(k){if(writes[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,writes[k]);});
    localStorage.removeItem(packTxnKey());CQStorage.accept(writes);
  }catch(e){
    try{recoverPackTransaction();}catch(restore){throw new Error('保存中断，恢复记录已保留。请释放浏览器存储后刷新页面完成恢复。');}
    throw new Error('保存失败，原题库和学习记录已保留。请检查本机存储空间。');
  }
}
function packById(id){return PACKS.filter(function(p){return p.id===id;})[0]||null;}
function packOwns(id,value){return typeof value==='string'&&value.indexOf('pack:'+id+':')===0;}
function packSessionUses(id,s){return !!s&&(packOwns(id,s.pid)||packOwns(id,s.exam&&s.exam.paper)||(s.order||[]).some(function(o){return o&&packOwns(id,o.pid);}));}
function assertPackManagement(){
  CQStorage.assertWritable();if(CQStorage.hasPending())throw new Error('请先保存或导出未保存更改，再管理题库。');
  if(isExam()&&!SESSION.done)throw new Error('请先交卷，再管理题库。');
  var saved=localStorage.getItem(PACK_KEY),meta=localStorage.getItem(PACK_META_KEY);
  if(canonicalPack(JSON.parse(saved||'[]'))!==canonicalPack(PACKS)||canonicalPack(JSON.parse(meta||'{}'))!==canonicalPack(PACK_STATES))throw new Error('题库已在其他页面改变，请刷新后再管理。');
}
function packDraftState(){var text=localStorage.getItem('cqframe.programming.v1');if(!text)return null;try{var v=JSON.parse(text);if(!v||!v.drafts||typeof v.drafts!=='object'||Array.isArray(v.drafts))throw new Error();return v;}catch(e){throw new Error('编程草稿格式异常，请先从编程页导出原始备份，再处理题库。');}}
function packUsage(id){
  function count(map){return Object.keys(map||{}).filter(function(k){return packOwns(id,k);}).length;}
  var drafts=packDraftState(),fix=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('cqframe.fix.pack:'+id+':')===0)fix.push(k);}
  return {review:count(REC),marks:count(MARKS),legacy:count(WRONG),exams:EXAMS.filter(function(s){return packSessionUses(id,s);}).length,session:packSessionUses(id,SESSION)?1:0,fixDrafts:fix.length,programDrafts:drafts?count(drafts.drafts):0,fixKeys:fix};
}
function packHasUsage(u){return ['review','marks','legacy','exams','session','fixDrafts','programDrafts'].some(function(k){return u[k]>0;});}
function canonicalPack(value){if(Array.isArray(value))return '['+value.map(canonicalPack).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+canonicalPack(value[k]);}).join(',')+'}';return JSON.stringify(value);}
function packGradingShape(pack){return canonicalPack({format:pack.format,version:pack.version,papers:pack.papers.map(function(p){return {id:p.id,pointsPerQuestion:p.pointsPerQuestion,groups:p.groups||[],questions:p.questions.map(function(q){var r=Object.assign({},q);['analysis','topic','tags','provenance'].forEach(function(k){delete r[k];});return r;})};})});}
function inspectPackUpdate(input){
  var result=QuestionPackSchema.check(input);if(!result.ok)throw new Error(result.errors[0].path+'：'+result.errors[0].message);
  var next=result.pack,old=packById(next.id);if(!old)throw new Error('未找到待更新题库，请使用普通导入。');
  if(next.revision<=old.revision)throw new Error('更新修订号必须高于当前修订'+old.revision+'。');
  var usage=packUsage(old.id),changed=packGradingShape(old)!==packGradingShape(next);
  function entries(p){var m=Object.create(null);p.papers.forEach(function(r){r.questions.forEach(function(q){m[r.id+'#'+q.num]=q;});});return m;}
  var a=entries(old),b=entries(next),added=0,removed=0,edited=0;
  Object.keys(a).forEach(function(k){if(!b[k])removed++;else if(canonicalPack(a[k])!==canonicalPack(b[k]))edited++;});Object.keys(b).forEach(function(k){if(!a[k])added++;});
  var total=PACKS.reduce(function(n,p){return n+(p.id===next.id?next:p).papers.reduce(function(n,r){return n+r.questions.length;},0);},0);if(total>10000)throw new Error('更新后超过合计10000题的限制。');
  return {pack:next,old:old,usage:usage,changed:changed,requiresReset:changed&&packHasUsage(usage),added:added,removed:removed,edited:edited};
}
function packCatalogChanged(packs,states,extra){
  var active=ACTIVE_LIBRARY;if(!packs.some(function(p){return p.id===active&&(!states[p.id]||states[p.id].enabled!==false);})){active=typeof BANK!=='undefined'&&!BANK.framework?'builtin':((packs.filter(function(p){return !states[p.id]||states[p.id].enabled!==false;})[0]||{}).id||'builtin');}
  var writes=Object.assign({},extra||{});writes[PACK_KEY]=JSON.stringify(packs);writes[PACK_META_KEY]=JSON.stringify(states);writes[LIBRARY_KEY]=JSON.stringify(active);
  commitPackStorage(writes);
  if(typeof cancelAutoNext==='function')cancelAutoNext();
  resetQuestionPacks();PACK_STATES=states;packs.forEach(registerQuestionPack);ACTIVE_LIBRARY=active;
  if(typeof NASA_PICK!=='undefined')NASA_PICK={year:null,paper:null,initialized:false};
  if(typeof RV!=='undefined')RV.paper=null;
  if(typeof normalizeLibraryPick==='function')normalizeLibraryPick();
}
function setPackEnabled(id,enabled){
  assertPackManagement();if(!packById(id))throw new Error('只能管理已导入的题库。');
  if(!enabled&&SESSION&&!SESSION.done&&packSessionUses(id,SESSION))throw new Error('该题库有未完成练习，请先完成或在首页放弃这组。');
  var states=JSON.parse(JSON.stringify(PACK_STATES));states[id]={enabled:!!enabled};packCatalogChanged(PACKS.slice(),states);return enabled;
}
function packClearPlan(id){
  var writes={},maps={review:REC,wrong:WRONG,marks:MARKS};
  Object.keys(maps).forEach(function(name){var next={};Object.keys(maps[name]||{}).forEach(function(k){if(!packOwns(id,k))next[k]=maps[name][k];});maps[name]=next;});
  writes[LSKEY.review]=JSON.stringify(maps.review);writes[LSKEY.wrongLegacy]=JSON.stringify(maps.wrong);writes[LSKEY.marks]=JSON.stringify(maps.marks);
  var exams=EXAMS.filter(function(s){return !packSessionUses(id,s);}),session=packSessionUses(id,SESSION)?null:SESSION;
  writes['cqframe.exams.v1']=JSON.stringify(exams);writes[LSKEY.session]=JSON.stringify(session);
  if(session!==SESSION)writes[LSKEY.blanks]='null';
  packUsage(id).fixKeys.forEach(function(k){writes[k]=null;});
  var drafts=packDraftState();if(drafts){var changed=false;Object.keys(drafts.drafts).forEach(function(k){if(packOwns(id,k)){delete drafts.drafts[k];changed=true;}});if(packOwns(id,drafts.selected)){var remaining=Object.keys(drafts.drafts);drafts.selected=remaining[0]||'';changed=true;}if(changed)writes['cqframe.programming.v1']=Object.keys(drafts.drafts).length?JSON.stringify(drafts):null;}
  return {writes:writes,publish:function(){if(typeof FixEngine!=='undefined'&&FixEngine.resetUserData)FixEngine.resetUserData();if(typeof ProgrammingPage!=='undefined')ProgrammingPage.leave();REC=maps.review;WRONG=maps.wrong;MARKS=maps.marks;EXAMS=exams;if(SESSION!==session){SESSION=session;BLANKS=null;}STATS_EXAM_ID=null;RESULT_EXAM_ID=null;}};
}
function removeQuestionPack(id,clearRecords){
  assertPackManagement();if(!packById(id))throw new Error('只能删除已导入的题库。');
  var usage=packUsage(id);if(packHasUsage(usage)&&!clearRecords)throw new Error('此题库有关联记录，请先导出备份，并勾选清除关联记录。');
  var plan=packClearPlan(id),states=JSON.parse(JSON.stringify(PACK_STATES));delete states[id];
  packCatalogChanged(PACKS.filter(function(p){return p.id!==id;}),states,plan.writes);plan.publish();
}
function updateQuestionPack(input,clearRecords){
  assertPackManagement();var info=inspectPackUpdate(input);
  if(SESSION&&!SESSION.done&&packSessionUses(info.pack.id,SESSION))throw new Error('该题库有未完成练习，请先完成或放弃这组，再更新。');
  if(info.requiresReset&&!clearRecords)throw new Error('题目、顺序或判分内容已变化，需要确认清除本题库关联记录后更新；也可改用新题包标识另行导入。');
  var plan=info.requiresReset?packClearPlan(info.pack.id):null;
  packCatalogChanged(PACKS.map(function(p){return p.id===info.pack.id?info.pack:p;}),JSON.parse(JSON.stringify(PACK_STATES)),plan&&plan.writes);if(plan)plan.publish();return info;
}
function makePackLibraryBackup(){return {format:'cquiz-library-backup',version:1,exportedAt:new Date().toISOString(),packs:JSON.parse(JSON.stringify(PACKS)),states:JSON.parse(JSON.stringify(PACK_STATES)),notice:'含题包与启用状态；学习记录和代码草稿请另行导出。'};}
function inspectPackLibraryBackup(input){
  if(!input||input.format!=='cquiz-library-backup'||input.version!==1||!Array.isArray(input.packs)||input.packs.length>20||!input.states||typeof input.states!=='object'||Array.isArray(input.states))throw new Error('需要版本1的题库备份。');
  var seen=Object.create(null),packs=input.packs.map(function(p){var r=QuestionPackSchema.check(p);if(!r.ok)throw new Error(r.errors[0].message);if(seen[r.pack.id])throw new Error('备份含重复题包标识。');seen[r.pack.id]=true;return r.pack;}),states={};
  Object.keys(input.states).forEach(function(id){var s=input.states[id];if(!seen[id]||!s||typeof s.enabled!=='boolean')throw new Error('题库启用状态异常。');states[id]={enabled:s.enabled};});
  var next=PACKS.slice();packs.forEach(function(p){var old=packById(p.id);if(old&&canonicalPack(old)!==canonicalPack(p))throw new Error('备份与已安装题库冲突：'+p.title+'。请先查看更新，或在另一浏览器中恢复。');if(!old)next.push(p);});
  if(next.length>20||next.reduce(function(n,p){return n+p.papers.reduce(function(n,r){return n+r.questions.length;},0);},0)>10000)throw new Error('恢复后超过20包或10000题的限制。');
  return {packs:next,states:Object.assign({},PACK_STATES,states),incoming:packs};
}
function restorePackLibraryBackup(input){assertPackManagement();var checked=inspectPackLibraryBackup(input);if(SESSION&&!SESSION.done&&checked.packs.some(function(p){return checked.states[p.id]&&checked.states[p.id].enabled===false&&packSessionUses(p.id,SESSION);}))throw new Error('备份会停用当前练习题库，请先完成或放弃这组。');packCatalogChanged(checked.packs,checked.states);return checked.incoming.length;}
function packUsageText(u){return '复习档案 '+u.review+' · 标记 '+u.marks+' · 考试 '+u.exams+' 场 · 当前练习 '+u.session+' · 改错草稿 '+u.fixDrafts+' · 编程草稿 '+u.programDrafts;}
function packManagerAfterChange(){if(typeof VIEW!=='undefined'&&VIEW==='home')renderHome();else go('home');}
function openPackUpdate(input){
  var info;try{assertPackManagement();info=inspectPackUpdate(input);}catch(e){alert(e.message);return;}
  var M=modalBox('更新题库',true),box=M.box;box.classList.add('pack-manager');
  box.appendChild(el('h3',null,info.pack.title));box.appendChild(el('p',null,'修订 '+info.old.revision+' → '+info.pack.revision+' · 新增 '+info.added+' · 删除 '+info.removed+' · 内容修改 '+info.edited+' 题'));
  box.appendChild(el('p','note',info.changed?'题目、顺序或判分内容有变化。':'题目结构、内容及判分保持一致，解析或目录说明更新后保留学习记录。'));
  box.appendChild(el('p','note',packUsageText(info.usage)));var agreed=el('input');agreed.type='checkbox';
  var label=el('label','pack-confirm');label.appendChild(agreed);label.appendChild(el('span',null,'清除本题库的关联记录，更新后重新练习'));if(info.requiresReset)box.appendChild(label);
  if(info.requiresReset)box.appendChild(el('p','warn','涉及本题库的整场考试和混合练习将移除，其他题库的独立档案、标记和累计作答趋势保留。请先导出学习记录和代码草稿。'));
  var status=el('p','pack-status');status.setAttribute('role','status');box.appendChild(status);
  var apply=btn('确认更新',function(){try{updateQuestionPack(info.pack,agreed.checked);M.m.remove();packManagerAfterChange();openQuestionPacks();}catch(e){status.textContent=e.message;}},true);apply.disabled=info.requiresReset;agreed.onchange=function(){apply.disabled=info.requiresReset&&!agreed.checked;};
  var bar=el('div','toolbar');bar.appendChild(btn('导出旧题包',function(){downloadQuestionPack(info.old);}));bar.appendChild(btn('导出学习记录',exportData));bar.appendChild(apply);bar.appendChild(btn('取消',function(){M.m.remove();openQuestionPacks();}));box.appendChild(bar);
}
function openPackRemoval(id){
  var pack=packById(id),usage;try{assertPackManagement();if(!pack)throw new Error('题库已变化，请重新打开。');usage=packUsage(id);}catch(e){alert(e.message);return;}
  var M=modalBox('删除题库',true),box=M.box;box.classList.add('pack-manager');box.appendChild(el('h3',null,pack.title));box.appendChild(el('p','note',packUsageText(usage)));
  box.appendChild(el('p',null,'删除后将移除本机题包和对应草稿。若只想暂时从目录隐藏，请使用“停用”。'));
  var agreed=el('input');agreed.type='checkbox';var label=el('label','pack-confirm');label.appendChild(agreed);label.appendChild(el('span',null,'同时清除本题库的关联记录'));if(packHasUsage(usage))box.appendChild(label);
  if(packHasUsage(usage))box.appendChild(el('p','warn','涉及本题库的整场考试或当前混合练习也会删除；其他题库的独立档案、标记和累计作答趋势保留。代码草稿请先在做题页另行导出。'));
  var status=el('p','pack-status');status.setAttribute('role','status');box.appendChild(status);
  var remove=btn('确认删除',function(){try{removeQuestionPack(id,agreed.checked);M.m.remove();packManagerAfterChange();openQuestionPacks();}catch(e){status.textContent=e.message;}},true);remove.disabled=packHasUsage(usage);agreed.onchange=function(){remove.disabled=packHasUsage(usage)&&!agreed.checked;};
  var bar=el('div','toolbar');bar.appendChild(btn('导出题包',function(){downloadQuestionPack(pack);}));bar.appendChild(btn('导出学习记录',exportData));bar.appendChild(remove);bar.appendChild(btn('取消',function(){M.m.remove();openQuestionPacks();}));box.appendChild(bar);
}
function renderPackManager(box,modal,onChanged){
  var stored=el('details','pack-installed');stored.open=true;stored.appendChild(el('summary',null,'已导入题包（'+PACKS.length+'）'));var tools=el('div','pack-manager-tools'),find=el('input');find.type='search';find.placeholder='题库名称、标识或来源';find.setAttribute('aria-label','查找已导入题包');tools.appendChild(find);
  var filter=el('select');filter.setAttribute('aria-label','题库状态筛选');[['all','全部状态'],['on','已启用'],['off','已停用']].forEach(function(v){var op=el('option',null,v[1]);op.value=v[0];filter.appendChild(op);});tools.appendChild(filter);var sort=el('select');sort.setAttribute('aria-label','题库排序');[['recent','导入顺序'],['title','按名称'],['count','题量最多']].forEach(function(v){var o=el('option',null,v[1]);o.value=v[0];sort.appendChild(o);});tools.appendChild(sort);stored.appendChild(tools);
  var overview=el('div','pack-overview'),matched=el('p','pack-match-count');matched.setAttribute('aria-live','polite');stored.insertBefore(overview,tools);stored.appendChild(matched);
  var status=el('p','pack-status');status.setAttribute('role','status');status.textContent='停用会隐藏练习入口并保留记录；考试历史仍可查看。';stored.appendChild(status);var list=el('div','pack-catalog');stored.appendChild(list);
  function draw(){emptyNode(list);emptyNode(overview);var total=PACKS.reduce(function(n,p){return n+p.papers.reduce(function(n,r){return n+r.questions.length;},0);},0);[['已导入',PACKS.length,'个题库'],['已启用',PACKS.filter(function(p){return packEnabled(p.id);}).length,'个题库'],['题目总数',total,'题']].forEach(function(m){var cell=el('div');cell.appendChild(el('span',null,m[0]));cell.appendChild(el('strong',null,String(m[1])));cell.appendChild(el('small',null,m[2]));overview.appendChild(cell);});var term=find.value.trim().toLowerCase(),packs=PACKS.filter(function(p){return (p.title+' '+p.id+' '+p.source).toLowerCase().indexOf(term)>=0&&(filter.value!=='on'||packEnabled(p.id))&&(filter.value!=='off'||!packEnabled(p.id));});function size(p){return p.papers.reduce(function(n,r){return n+r.questions.length;},0);}if(sort.value==='title')packs.sort(function(a,b){return a.title.localeCompare(b.title,'zh-CN');});else if(sort.value==='count')packs.sort(function(a,b){return size(b)-size(a);});matched.textContent='显示 '+packs.length+' / '+PACKS.length+' 个题库';if(!packs.length)list.appendChild(el('p','pack-empty',PACKS.length?'没有符合条件的题库，试试其他关键词或状态。':'还没有导入题库。切换到“导入 / 更新题包”开始添加。'));
    packs.forEach(function(pack){var row=el('section','pack-installed-row pack-catalog-card');row.dataset.packId=pack.id;var copy=el('div','pack-catalog-copy');var heading=el('div','pack-card-heading');heading.appendChild(el('h3',null,pack.title));heading.appendChild(el('span','pack-state-badge '+(packEnabled(pack.id)?'is-on':'is-off'),packEnabled(pack.id)?'已启用':'已停用'));copy.appendChild(heading);copy.appendChild(el('p','note',pack.id+' · 修订'+pack.revision+' · '+(packEnabled(pack.id)?'已启用':'已停用')));var counts={};pack.papers.forEach(function(p){p.questions.forEach(function(q){var t=q.type||'single';counts[t]=(counts[t]||0)+1;});});var names={single:'单选',multiple:'多选',blank:'填空',code_blank:'程序填空',fix:'改错',program:'编程'};copy.appendChild(el('p',null,pack.papers.length+' 套 · '+Object.keys(counts).map(function(k){return names[k]+' '+counts[k]+' 题';}).join(' · ')));var source=el('details','pack-source');source.appendChild(el('summary',null,'来源与说明'));source.appendChild(el('p','note',pack.source));copy.appendChild(source);row.appendChild(copy);
      try{copy.appendChild(el('p','note pack-record-summary',packUsageText(packUsage(pack.id))));}catch(e){copy.appendChild(el('p','note',e.message));}
      var actions=el('div','toolbar pack-card-actions');var enter=btn('进入题库',function(){modal.m.remove();selectLibrary(pack.id);go('home');});enter.classList.add('pack-enter');enter.disabled=!packEnabled(pack.id);actions.appendChild(enter);
      actions.appendChild(btn('导出题包',function(){downloadQuestionPack(pack);}));actions.appendChild(btn(packEnabled(pack.id)?'停用':'启用',function(){try{setPackEnabled(pack.id,!packEnabled(pack.id));if(onChanged)onChanged();packManagerAfterChange();draw();status.textContent='已'+(packEnabled(pack.id)?'启用':'停用')+'：'+pack.title+'。学习记录保留。';}catch(e){status.textContent=e.message;}}));
      var removeButton=btn('删除',function(){modal.m.remove();openPackRemoval(pack.id);});removeButton.classList.add('pack-danger');actions.appendChild(removeButton);row.appendChild(actions);list.appendChild(row);
    });}
  find.oninput=filter.onchange=sort.onchange=draw;draw();
  var bar=el('div','toolbar pack-backup-actions');bar.appendChild(btn('导出题库备份',function(){downloadQuestionPack(makePackLibraryBackup(),'题库备份-'+todayKey()+'.json');}));bar.appendChild(btn('导出学习记录',exportData));
  var restore=el('input');restore.type='file';restore.accept='.json,application/json';restore.setAttribute('aria-label','恢复题库备份');var label=el('label','pack-input-label','恢复题库备份');label.appendChild(restore);bar.appendChild(label);stored.appendChild(bar);
  var restoreToken=0;restore.onchange=function(){var file=restore.files[0],token=++restoreToken;restore.value='';if(!file)return;if(file.size>40*1024*1024){status.textContent='题库备份不能超过40MiB。';return;}var reader=new FileReader();status.textContent='正在检查题库备份…';reader.onload=function(){if(token!==restoreToken||!modal.m.isConnected)return;var input,checked;try{input=JSON.parse(reader.result.replace(/^\uFEFF/,''));checked=inspectPackLibraryBackup(input);}catch(e){status.textContent=e.message;return;}Promise.all(checked.incoming.map(decodeQuestionPackImages)).then(function(errors){if(token!==restoreToken||!modal.m.isConnected)return;if(errors.some(function(a){return a.length;})){status.textContent='备份含无法解码的图片，未恢复。';return;}status.textContent='检查通过：'+checked.incoming.length+' 个题包。确认后恢复题包与启用状态，现有学习记录保留。';var confirmRestore=btn('确认恢复题库',function(){try{restorePackLibraryBackup(input);modal.m.remove();packManagerAfterChange();openQuestionPacks();}catch(e){status.textContent=e.message;}},true);status.appendChild(confirmRestore);});};reader.onerror=function(){status.textContent='备份读取失败。';};reader.readAsText(file,'utf-8');};
  stored.appendChild(el('p','note','题库备份包含题目、插图与启用状态。学习记录与编程草稿分别导出；恢复时先恢复题库，再恢复记录。更新题库请在上方选择较高修订的JSON，点击“查看更新”。'));box.appendChild(stored);return stored;
}
