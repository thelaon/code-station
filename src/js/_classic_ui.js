
var CLASSIC_YEARS = Object.create(null);
function classicSheetLegend(){
  var box=el('div','classic-sheet-legend');box.setAttribute('aria-label','答题卡状态说明');
  [['ok','正确'],['bad','错误'],['part','部分得分'],['empty','未答'],['current','当前题']].forEach(function(item){
    var span=el('span'),swatch=el('i','classic-legend-'+item[0]);swatch.setAttribute('aria-hidden','true');span.appendChild(swatch);span.appendChild(document.createTextNode(item[1]));box.appendChild(span);
  });box.appendChild(el('span',null,'★ 已标记'));return box;
}
function setupClassicHome(view,grid,left,right,modes,types,options,resumeSource){
  
  if(PREF.uiStyle!=='classic'||!view.ownerDocument)return;
  view.classList.add('classic-home');grid.classList.add('classic-home-grid');left.classList.add('classic-paper-panel');
  modes.classList.add('classic-home-modes');types.classList.add('classic-home-types');options.classList.add('classic-home-options');
  if(modes.children[0])modes.children[0].textContent='整卷练习';if(modes.children[1])modes.children[1].textContent='题型专练';
  var oldTitle=left.querySelector('h2');if(oldTitle)oldTitle.remove();
  var meta=left.querySelector('.meta');if(meta)meta.classList.add('classic-home-meta');
  var heading=el('header','classic-home-heading'),copy=el('div');copy.appendChild(el('h2',null,'选卷 / 组卷'));
  var lib=libraryList().filter(function(item){return item.id===ACTIVE_LIBRARY;})[0];copy.appendChild(el('p',null,libraryTitle()+(lib&&lib.subtitle?' · '+lib.subtitle:'')));heading.appendChild(copy);
  var count=homeQuestionCount()+homeQuestionCount('multiple')+homeBlankCount()+homeFixCount()+homeProgramCount(),metrics=el('div','classic-home-counts');
  metrics.appendChild(el('span',null,homePapers().length+' 套试卷'));metrics.appendChild(el('span',null,count+' 道题'));heading.appendChild(metrics);view.insertBefore(heading,grid);
  var tools=el('div','classic-paper-controls');left.insertBefore(tools,left.firstChild);tools.appendChild(modes);tools.appendChild(types);
  var feedback=el('div','classic-feedback-slot');tools.appendChild(feedback);
  var description=el('div','classic-mode-description');tools.appendChild(description);
  var filter=el('div','classic-year-filter'),label=el('span','classic-filter-label','年份'),buttons=el('div','classic-year-buttons');
  buttons.setAttribute('role','group');buttons.setAttribute('aria-label','试卷年份');filter.appendChild(label);filter.appendChild(buttons);tools.appendChild(filter);
  var summary=el('div','classic-list-summary');summary.setAttribute('aria-live','polite');left.insertBefore(summary,options);
  var sidebar=el('aside','classic-study-sidebar');grid.removeChild(right);grid.appendChild(sidebar);
  var rp=resumeInfo();
  if(rp&&resumeSource){
    var sourceButtons=Array.prototype.slice.call(resumeSource.querySelectorAll('button')),resume=el('section','card classic-resume-card');
    resume.appendChild(el('div','classic-side-eyebrow',isExam()?'上次未完成的考试':'上次未完成'));
    resume.appendChild(el('h3',null,rp.paper));
    var progress=el('div','classic-resume-progress'),pct=rp.total?Math.round(rp.answered/rp.total*100):0;
    progress.appendChild(el('span',null,'已完成 '+rp.answered+' / '+rp.total+' 题'));progress.appendChild(el('span',null,pct+'%'));resume.appendChild(progress);
    var bar=el('div','classic-resume-bar'),fill=el('i');fill.style.width=pct+'%';bar.appendChild(fill);resume.appendChild(bar);
    var actions=el('div','classic-resume-actions');if(sourceButtons[0]){sourceButtons[0].textContent='继续'+(isExam()?'考试':'练习')+' →';actions.appendChild(sourceButtons[0]);}
    if(sourceButtons[1]){sourceButtons[1].classList.add('classic-discard');actions.appendChild(sourceButtons[1]);}resume.appendChild(actions);sidebar.appendChild(resume);resumeSource.remove();
  }else if(!Object.keys(REC).length){
    var starter=el('section','card classic-first-use');starter.appendChild(el('h3',null,'从一套试卷开始'));starter.appendChild(el('p',null,'先选练习方式，再选择试卷。整卷可即时批改，也可交卷后查看成绩。'));sidebar.appendChild(starter);
  }
  var reviewButtons=Array.prototype.slice.call(right.querySelectorAll('.stack > button')),dn=dueCount(),active=poolActive().length;emptyNode(right);right.classList.add('classic-review-card');
  right.appendChild(el('h3',null,'今日复习'));
  if(dn){var number=el('div','classic-due-number',String(dn));number.appendChild(el('small',null,'题到期'));right.appendChild(number);right.appendChild(el('p','classic-review-description','按复习排程，巩固之前练过的题。'));}
  else right.appendChild(el('p','classic-review-description',active?'今天没有到期的题目，可练习全部未掌握题或重做错题。':'完成练习后，需要巩固的题目会按排程出现在这里。'));
  if(reviewButtons[0]&&dn){reviewButtons[0].classList.remove('primary');reviewButtons[0].classList.add('classic-review-start');reviewButtons[0].textContent='开始今日复习';right.appendChild(reviewButtons[0]);}
  if(active||Object.keys(REC).length){var links=el('div','classic-review-links');reviewButtons.slice(1).forEach(function(b){links.appendChild(b);});right.appendChild(links);}
  sidebar.appendChild(right);
  var hint=el('p','classic-home-hint');hint.appendChild(el('strong',null,'进度保存在本机'));hint.appendChild(el('br'));hint.appendChild(document.createTextNode('更换设备前，可在设置中导出学习记录。'));sidebar.appendChild(hint);
  options.__classicHome={filter:filter,buttons:buttons,summary:summary,description:description,feedback:feedback,library:ACTIVE_LIBRARY,signature:null};refreshClassicHomePick(options);
}
function refreshClassicHomePick(options){
  var state=options&&options.__classicHome;if(!state||PREF.uiStyle!=='classic')return;
  var feedback=options.querySelector(':scope > .full-paper-feedback');if(feedback){emptyNode(state.feedback);state.feedback.appendChild(feedback);}else if(PICK.view!=='full')emptyNode(state.feedback);
  state.feedback.hidden=PICK.view!=='full';state.description.hidden=PICK.view==='full';
  var instruction=options.querySelector(':scope > .tip');if(instruction){emptyNode(state.description);state.description.appendChild(instruction);}
  var table=Array.prototype.slice.call(options.querySelectorAll('table')).filter(function(t){var h=t.querySelector('th');return h&&h.textContent==='试卷';})[0];
  state.filter.hidden=!table;state.summary.hidden=!table;if(!table)return;
  table.classList.add('classic-paper-table');table.parentNode.classList.add('classic-paper-scroll');
  var headers=Array.prototype.map.call(table.querySelectorAll('thead th'),function(th){return th.textContent;}),rows=Array.prototype.slice.call(table.querySelectorAll('tbody tr')),years=[];
  table.dataset.columns=String(headers.length);
  rows.forEach(function(row){
    var paper=homePapers().filter(function(p){return p.id===row.dataset.classicPaper;})[0]||{id:row.dataset.classicPaper||''};
    row.dataset.classicYear=nasaYear(paper);if(years.indexOf(row.dataset.classicYear)<0)years.push(row.dataset.classicYear);
    Array.prototype.forEach.call(row.children,function(td,index){
      var label=headers[index];td.dataset.label=label;td.dataset.classicColumn=label==='试卷'?'paper':label==='操作'?'action':label==='满分'?'score':label==='复习池'?'pool':'detail';
      if(label==='操作')Array.prototype.forEach.call(td.querySelectorAll('button'),function(b){b.classList.remove('primary');b.classList.add('classic-row-start');});
    });
  });
  years.sort();var selected=CLASSIC_YEARS[state.library]||'all';if(selected!=='all'&&years.indexOf(selected)<0)selected='all';CLASSIC_YEARS[state.library]=selected;
  var signature=years.join('|');if(signature!==state.signature){
    emptyNode(state.buttons);['all'].concat(years).forEach(function(y){var b=el('button',null,y==='all'?'全部':y);b.type='button';b.dataset.year=y;b.onclick=function(){CLASSIC_YEARS[state.library]=y;refreshClassicHomePick(options);};state.buttons.appendChild(b);});state.signature=signature;
  }
  Array.prototype.forEach.call(state.buttons.children,function(b){b.setAttribute('aria-pressed',String(b.dataset.year===selected));});
  var visible=0;rows.forEach(function(row){row.hidden=selected!=='all'&&row.dataset.classicYear!==selected;if(!row.hidden)visible++;});
  state.summary.textContent=(selected==='all'?'全部年份':selected==='无年份'?'无年份':selected+' 年')+' · '+visible+' 套试卷';
}
