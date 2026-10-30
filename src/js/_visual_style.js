
var NASA_PICK = {year:null, paper:null, initialized:false};
var NASA_BADGE_DISPOSE = null, NASA_BADGE_SYNC = null;
function stopNasaBadge(){
  if(NASA_BADGE_DISPOSE) NASA_BADGE_DISPOSE();
  NASA_BADGE_DISPOSE = null; NASA_BADGE_SYNC = null;
}
function nasaYearSummary(years){var dated=years.filter(function(y){return y!=='无年份';});return dated.length?dated[0]+(dated.length>1?'—'+dated[dated.length-1]:'')+(dated.length<years.length?' · 含无年份':''):'无年份';}
function nasaYear(p){ return String(p.year || (/^\d{4}/.exec(p.id) || ['无年份'])[0]); }

var PICK_ENTRY_FINISH=[],PICK_ENTRY_MEDIA=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function clearPickContentEntry(){(PICK_ENTRY_FINISH||[]).slice().forEach(function(finish){finish();});}
if(PICK_ENTRY_MEDIA && PICK_ENTRY_MEDIA.addEventListener)PICK_ENTRY_MEDIA.addEventListener('change',function(){if(PICK_ENTRY_MEDIA.matches)clearPickContentEntry();});
function revealPickContent(node,index){
  if(PREF.motion===false || (PICK_ENTRY_MEDIA && PICK_ENTRY_MEDIA.matches))return;
  node.style.setProperty('--pick-entry-delay',Math.min(index||0,6)*70+'ms');node.classList.add('pick-content-enter');
  function finish(e){
    if(e && (e.target!==node || e.animationName!=='pick-content-in'))return;
    node.classList.remove('pick-content-enter');
    node.removeEventListener('animationend',finish);node.removeEventListener('animationcancel',finish);
    var at=PICK_ENTRY_FINISH.indexOf(finish);if(at>=0)PICK_ENTRY_FINISH.splice(at,1);
  }
  PICK_ENTRY_FINISH.push(finish);
  node.addEventListener('animationend',finish);node.addEventListener('animationcancel',finish);
}
function nasaPaperSummary(pid){
  if(PICK.view !== 'split') return PICK.view==='exam'?{parts:paperParts(pid),score:paperTotal(pid)}:{parts:practiceParts(pid),score:practiceTotal(pid)};
  if(PICK.split==='program')return {parts:'编程 '+programQuestions(pid).length+' 题',score:programTotal(pid)};
  if(PICK.split === 'blank'){
    var bp=BPMAP[pid];return {parts:bp ? bp.count+' 题 · '+bp.blanks+' 空' : '暂无填空题',score:bp ? bp.total : 0};
  }
  if(PICK.split === 'fix'){
    var list=FXBY[pid] || [];return {parts:list.length+' 题 · '+list.reduce(function(n,q){return n+q.faults.length;},0)+' 处',score:fixTotal(pid)};
  }
  var p=homeChoicePapers(PICK.split).filter(function(p){return p.id===pid;})[0];return {parts:p ? (PICK.split==='multiple'?'多选 ':'单选 ')+p.count+' 题' : '暂无该题型',score:p ? p.total : 0};
}
function nasaAvailablePapers(){
  return homePapers().filter(function(p){
    if(PICK.view !== 'split') return PICK.view!=='exam'||fullOrder(p.id).length>0;
    if(PICK.split==='program')return programQuestions(p.id).length>0;
    if(PICK.split === 'blank') return !!(BPMAP[p.id] && BPMAP[p.id].count);
    if(PICK.split === 'fix') return !!(FXBY[p.id] && FXBY[p.id].length);
    return homeChoicePapers(PICK.split).some(function(q){return q.id===p.id;});
  });
}
function renderNasaHome(){
  var v=renderLibraryShell(emptyNode(viewEl())), years=[];
  homePapers().forEach(function(p){var y=nasaYear(p);if(years.indexOf(y)<0) years.push(y);});
  years.sort();
  var hero=el('section','nasa-hero'),copy=el('div'),label=el('div','nasa-caption','CODE STATION / PRACTICE');
  copy.appendChild(label);
  var title=el('h2',null,ACTIVE_LIBRARY==='builtin'?'C 语言':libraryTitle());title.appendChild(el('span',null,'练习档案。'));copy.appendChild(title);
  var intro=el('p',null,'从读懂程序，到独立解题。');intro.appendChild(el('br'));intro.appendChild(document.createTextNode('每一道真题，都是新的探索。'));copy.appendChild(intro);
  var heroMeta=el('div','nasa-hero-meta');heroMeta.appendChild(el('b',null,homePapers().length+' 套试卷'));
  heroMeta.appendChild(el('span',null,nasaYearSummary(years)));
  heroMeta.appendChild(el('span',null,'离线学习'));copy.appendChild(heroMeta);hero.appendChild(copy);
  var badge=el('div','nasa-badge');badge.setAttribute('aria-hidden','true');
  var canvas=el('canvas');canvas.width=800;canvas.height=640;badge.appendChild(canvas);
  var emblem=el('span','nasa-badge-c');emblem.appendChild(el('span','station-emblem'));badge.appendChild(emblem);
  badge.appendChild(el('span','nasa-badge-label top','CODE STATION'));
  badge.appendChild(el('span','nasa-badge-label bottom','LEARN · EXPLORE'));
  hero.appendChild(badge);hero.appendChild(el('div','nasa-scale'));v.appendChild(hero);

  var grid=el('div','grid nasa-home-grid'),left=el('main','card nasa-home-panel'),right=el('aside','card nasa-review-panel');
  var head=el('div','nasa-section-title');head.appendChild(el('h2',null,'选择练习'));head.appendChild(el('span','nasa-caption','PAPER ARCHIVE'));left.appendChild(head);
  if(!LS_OK) left.appendChild(el('div','warn','浏览器禁用了本地存储，进度无法保存。请更换支持本地存储的浏览器。'));
  var rp=resumeInfo();
  if(rp){
    var resume=el('div','warn');resume.appendChild(el('span',null,'上次练习：'+rp.paper+' · 已完成 '+rp.answered+'/'+rp.total));
    resume.appendChild(btn('继续练习',function(){go('practice');},true));
    resume.appendChild(btn('放弃这组',function(){if(confirm('放弃这一组的进度？已产生的记录仍保留在复习池里。')){SESSION=null;save(LSKEY.session,null);go('home');}}));
    left.appendChild(resume);
  }
  var modeButtons=[],typeButtons=[];
  var modes=el('div','nasa-mode-row');modes.setAttribute('role','group');modes.setAttribute('aria-label','练习模式');
  [['full','整卷练习','PRACTICE'],['split','题型专练','FOCUS'],['exam','模拟考试','EXAM']].forEach(function(row){
    var button=el('button',PICK.view===row[0] ? 'on' : null);button.type='button';button.dataset.mode=row[0];
    button.setAttribute('aria-pressed',String(PICK.view===row[0]));
    var english=el('small',null,row[2]);english.setAttribute('aria-hidden','true');button.appendChild(english);button.appendChild(el('span',null,row[1]));
    button.onclick=function(){if(PICK.view===row[0])return;PICK.view=row[0];refreshOptions(true);};modes.appendChild(button);modeButtons.push({value:row[0],node:button});
  });left.appendChild(modes);
  var types=el('div','toolbar nasa-type-row');types.setAttribute('role','group');types.setAttribute('aria-label','专练题型');
  [['choice','单选'],['multiple','多选'],['blank','填空'],['fix','改错'],['program','编程'],['random','随机单选']].forEach(function(row){
    if(!librarySupports(row[0])) return;
    var button=btn(row[1],function(){if(PICK.split===row[0])return;PICK.split=row[0];refreshOptions(true);});button.className='seg'+(PICK.split===row[0] ? ' on' : '');button.dataset.type=row[0];
    button.setAttribute('aria-pressed',String(PICK.split===row[0]));types.appendChild(button);typeButtons.push({value:row[0],node:button});
  });left.appendChild(types);
  var options=el('div','nasa-pick-content');left.appendChild(options);
  var instructions=el('details','nasa-instructions');instructions.appendChild(el('summary',null,'练习说明'));
  var instructionText=el('p');instructions.appendChild(instructionText);left.appendChild(instructions);
  
  function refreshOptions(animate){
    clearPickContentEntry();
    modeButtons.forEach(function(b){var active=PICK.view===b.value;b.node.className=active?'on':'';b.node.setAttribute('aria-pressed',String(active));});
    types.style.display=PICK.view==='split'?'':'none';
    typeButtons.forEach(function(b){var active=PICK.split===b.value;b.node.className='seg'+(active?' on':'');b.node.setAttribute('aria-pressed',String(active));});
    instructionText.textContent=PICK.view==='exam' ? '按当前试卷所含题型和标注分值计分，不含编程题；交卷后统一判分。倒计时在后台及关闭页面期间继续，到时收卷。改错按逐处核对计分，可自行编译自测。' : '整卷可选择即时批改或交卷后批改，包含编程题且不倒计时；题型专练逐题反馈。分值以当前试卷标注为准。';
    var left=emptyNode(options);
    if(PICK.view==='full')left.appendChild(fullPaperFeedbackControl());
    if(PICK.view==='split' && PICK.split==='random'){
      var random=el('div','nasa-random');random.appendChild(el('h3',null,'跨卷随机单选'));random.appendChild(el('p','tip','当前题库共 '+homeQuestionCount()+' 道单选题；超出总数时按总数抽取。'));
      var row=el('div','toolbar'),numLabel=el('label',null,'题量 '),num=el('input');num.type='number';num.min='1';num.max=String(homeQuestionCount());num.value=String(Math.max(1,Math.min(homeQuestionCount(),PICK.randN)));num.onchange=function(){PICK.randN=Math.max(1,Math.min(homeQuestionCount(),parseInt(num.value,10)||10));num.value=String(PICK.randN);};num.setAttribute('aria-label','随机单选题量');numLabel.appendChild(num);row.appendChild(numLabel);
      function startRandomPick(){PICK.randN=Math.max(1,Math.min(homeQuestionCount(),parseInt(num.value,10)||10));startRandom(PICK.randN);}
      row.appendChild(btn('开始随机练习',startRandomPick,true));
      row.appendChild(btn('随机 10 题',function(){PICK.randN=10;startRandom(10);}));
      row.appendChild(btn('随机 25 题',function(){PICK.randN=25;startRandom(25);}));random.appendChild(row);left.appendChild(random);if(animate)revealPickContent(random,0);
    }else{
      var available=nasaAvailablePapers(),pickYears=[];
      available.forEach(function(p){var y=nasaYear(p);if(pickYears.indexOf(y)<0)pickYears.push(y);});pickYears.sort();
      if(pickYears.indexOf(NASA_PICK.year)<0) NASA_PICK.year=pickYears[0] || null;
      var visible=available.filter(function(p){return nasaYear(p)===NASA_PICK.year;});
      if(!NASA_PICK.initialized){NASA_PICK.paper=visible.length ? visible[0].id : null;NASA_PICK.initialized=true;}
      if(NASA_PICK.paper && !visible.some(function(p){return p.id===NASA_PICK.paper;})) NASA_PICK.paper=null;
      var tools=el('div','nasa-paper-tools'),yearLabel=el('div','year-archive'),yearButtons=[];
      yearLabel.appendChild(el('span','year-archive-label','试卷归档'));var yearOptions=el('div','year-archive-options');yearOptions.setAttribute('role','group');yearOptions.setAttribute('aria-label','试卷年份');
      pickYears.forEach(function(y){var count=available.filter(function(p){return nasaYear(p)===y;}).length,button=btn(y==='无年份'?y:y+' 年',function(){if(NASA_PICK.year===y)return;NASA_PICK.year=y;NASA_PICK.paper=null;refreshPapers(true);});button.appendChild(el('small',null,count+' 套'));button.dataset.year=y;button.setAttribute('aria-label',y==='无年份'?'筛选无年份':'筛选'+y+'年');yearOptions.appendChild(button);yearButtons.push(button);});yearLabel.appendChild(yearOptions);tools.appendChild(yearLabel);
      if(PICK.view==='exam'){
        var examLabel=el('label',null,'考试时长'),minutes=el('input');minutes.type='number';minutes.min='1';minutes.max='180';minutes.step='1';minutes.value=String(EXAM_MINUTES);minutes.setAttribute('aria-label','考试时长（分钟）');
        minutes.oninput=function(){EXAM_MINUTES=Number(minutes.value);};examLabel.appendChild(minutes);examLabel.appendChild(el('span',null,'分钟'));tools.appendChild(examLabel);
      }else tools.appendChild(el('span','nasa-caption',PICK.view==='split' ? '专项练习 / 逐题反馈' : (ACTIVE_LIBRARY==='builtin'?'选择 · 填空 · 改错 · 编程':'混合题型练习')));
      left.appendChild(tools);
      var deck=el('div','nasa-paper-deck');deck.setAttribute('role','group');deck.setAttribute('aria-label','可选试卷');
      var selection=el('span','nasa-selection'),start=btn(PICK.view==='exam' ? '开始考试 →' : '开始练习 →',begin,true);start.classList.add('nasa-start');
      var cards=[];
      function syncSelection(){
        cards.forEach(function(c){var selected=c.pid===NASA_PICK.paper;c.node.setAttribute('aria-pressed',String(selected));c.node.setAttribute('aria-label',(selected?'取消选择 ':'选择 ')+papLabel(c.pid));c.status.textContent=selected?'已选择':'选择此卷';});
        selection.textContent=NASA_PICK.paper ? '已选择 '+papLabel(NASA_PICK.paper) : '尚未选择试卷';start.disabled=!NASA_PICK.paper;
      }
      function begin(){
        var pid=NASA_PICK.paper;if(!pid)return;
        if(PICK.view==='exam')startExam(pid,EXAM_MINUTES);
        else if(PICK.view==='full')startFullPaper(pid);
        else if(PICK.split==='blank')startBlankPaper(pid);
        else if(PICK.split==='fix')startFixPaper(pid);
        else if(PICK.split==='program')startProgramPaper(pid);
        else startChoiceType(pid,PICK.split);
      }
      function refreshPapers(animate){
        clearPickContentEntry();
        visible=available.filter(function(p){return nasaYear(p)===NASA_PICK.year;});
        yearButtons.forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.year===NASA_PICK.year));});
        emptyNode(deck);cards=[];
        visible.forEach(function(p,index){
          var summary=nasaPaperSummary(p.id),card=el('button','nasa-paper');card.type='button';card.dataset.paper=p.id;
          var file=paperCode(p);
          card.appendChild(el('span','nasa-paper-top',nasaYear(p)+' / FILE '+file));
          var body=el('span','nasa-paper-body');body.appendChild(el('span','nasa-paper-letter',file));body.appendChild(el('span','nasa-paper-title',papLabel(p.id)));
          body.appendChild(el('span','nasa-paper-desc',summary.parts));body.appendChild(el('span','nasa-paper-score','满分 '+fmtScore(summary.score)+' 分'));card.appendChild(body);
          var bottom=el('span','nasa-paper-bottom'),barcode=el('span','nasa-barcode'),status=el('span','nasa-paper-status');barcode.setAttribute('aria-hidden','true');bottom.appendChild(barcode);bottom.appendChild(status);card.appendChild(bottom);
          card.onclick=function(){NASA_PICK.paper=NASA_PICK.paper===p.id ? null : p.id;syncSelection();};
          deck.appendChild(card);cards.push({pid:p.id,node:card,status:status});if(animate)revealPickContent(card,index);
        });
        if(!visible.length) deck.appendChild(el('div','empty','此题型暂无可选试卷。'));
        syncSelection();
      }
      refreshPapers(animate);left.appendChild(deck);
      var action=el('div','nasa-actionbar');selection.setAttribute('aria-live','polite');action.appendChild(selection);action.appendChild(start);left.appendChild(action);syncSelection();
      if(PICK.view==='split' && (PICK.split==='fix'||PICK.split==='blank')){
        var extra=el('div','toolbar nasa-type-row'),fix=PICK.split==='fix',count=fix?homeFixCount():homeBlankCount();
        extra.appendChild(btn(fix?'随机 3 题':'随机 10 题',function(){if(fix)startFixRandom(3);else startBlanksRandom(10);}));
        extra.appendChild(btn('全部 '+count+' 题',function(){if(fix)startFixRandom(0);else startBlanksRandom(0);}));left.appendChild(extra);
      }
    }
    if(PICK.view==='split' && PICK.split==='choice')left.appendChild(renderTopicPicker());
  }
  refreshOptions();
  right.appendChild(el('div','nasa-caption','02 / REVIEW MODULE'));right.appendChild(el('h2',null,'温故，知新。'));
  var pool=poolActive().length,due=dueCount(),countEl=el('div','nasa-pool-count',String(pool).padStart(2,'0'));countEl.appendChild(el('small',null,'题待复习'));right.appendChild(countEl);
  right.appendChild(el('p','note',due ? '今日到期 '+due+' 题' : '今天没有到期题目'));
  var stack=el('div','stack'),today=btn('开始今日复习'+(due?' ('+due+')':''),function(){startReview('today',SET.dailyMax);},true);today.disabled=!due;stack.appendChild(today);
  stack.appendChild(btn('复习全部未掌握 ('+pool+')',function(){startReview('all',0);}));stack.appendChild(btn('重做全部错题',function(){startWrong();}));right.appendChild(stack);
  right.appendChild(el('hr','sep'));right.appendChild(el('p','note','完成练习后，错题会按复习安排回到这里。用法与快捷键见顶栏「?」。'));
  grid.appendChild(left);grid.appendChild(right);v.appendChild(grid);
  $('#foot').textContent=footText(libraryTitle()+' · '+librarySummary()+' · 数据仅保存在本机，不联网');
  createNasaBadge(canvas,badge);
}

function createNasaBadge(canvas,badge){
  if(!canvas.getContext) return;
  var ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(2,2);
  var tilt=-37*Math.PI/180,c=Math.cos(tilt),s=Math.sin(tilt),t=(1+Math.sqrt(5))/2;
  function unit(v){var d=Math.hypot.apply(Math,v);return v.map(function(n){return n/d;});}
  var vertices=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(unit);
  var base=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]],faces=[],midpoints={};
  function mid(a,b){var key=[Math.min(a,b),Math.max(a,b)].join(':');if(midpoints[key]!==undefined)return midpoints[key];var index=vertices.length;vertices.push(unit(vertices[a].map(function(n,i){return (n+vertices[b][i])/2;})));midpoints[key]=index;return index;}
  base.forEach(function(f){var a=f[0],b=f[1],d=f[2],ab=mid(a,b),bd=mid(b,d),da=mid(d,a);faces.push([a,ab,da],[b,bd,ab],[d,da,bd],[ab,bd,da]);});
  var alpha=26*Math.PI/180;
  function orbit(a){var x=155*Math.cos(a),y=61*Math.sin(a);return [200+x*Math.cos(alpha)-y*Math.sin(alpha),160+x*Math.sin(alpha)+y*Math.cos(alpha)];}
  function segment(start,end){ctx.beginPath();for(var i=0;i<=42;i++){var p=orbit(start+(end-start)*i/42);if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}ctx.stroke();}
  function tail(a,front){
    for(var i=0;i<18;i++){var start=a-.2+.2*i/18,end=a-.2+.2*(i+1)/18;if((Math.sin((start+end)/2)>=0)!==front)continue;
      var p=orbit(start),q=orbit(end);ctx.strokeStyle='rgba(246,234,202,'+(.75*Math.pow((i+1)/18,1.6))+')';ctx.lineWidth=1.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();}
    if((Math.sin(a)>=0)===front){var head=orbit(a);ctx.save();ctx.shadowColor='#f6eaca';ctx.shadowBlur=5;ctx.fillStyle='#f6eaca';ctx.beginPath();ctx.arc(head[0],head[1],3,0,Math.PI*2);ctx.fill();ctx.restore();}
  }
  var elapsed=0,last=null,raf=0,visible=true,lastDraw=-100,disposed=false;
  var reduced=window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
  function draw(){
    var a=elapsed/22000*2*Math.PI-.65;
    ctx.clearRect(0,0,400,320);ctx.lineWidth=.8;ctx.strokeStyle='rgba(220,93,73,.45)';segment(Math.PI,2*Math.PI);tail(a,false);
    var angle=-elapsed/48000*2*Math.PI,cp=Math.cos(angle),sp=Math.sin(angle);
    var rotated=vertices.map(function(v){var rx=v[0]*cp+v[2]*sp;return [rx*c-v[1]*s,rx*s+v[1]*c,-v[0]*sp+v[2]*cp];});
    var sorted=faces.map(function(f,index){var p=f.map(function(i){return rotated[i];}),u=p[1].map(function(n,i){return n-p[0][i];}),v=p[2].map(function(n,i){return n-p[0][i];});return {f:f,p:p,index:index,n:unit([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]),z:p.reduce(function(sum,n){return sum+n[2];},0)/3};}).filter(function(f){return f.n[2]>0;}).sort(function(a,b){return a.z-b.z;});
    sorted.forEach(function(face){var f=face.f,p=face.p,n=face.n,latitude=f.reduce(function(sum,i){return sum+vertices[i][1];},0)/3;
      var light=Math.max(.58,Math.min(1,.78-.13*n[0]-.16*n[1]+.14*n[2]+(face.index%3-1)*.035)),color=[236,231,211];
      if(latitude>.03&&latitude<.36)color=[[77,91,100],[122,126,79],[202,164,91],[177,73,53]][Math.min(3,Math.floor((latitude-.03)/.083))];
      ctx.fillStyle='rgb('+color.map(function(n){return Math.round(n*light);}).join(',')+')';ctx.beginPath();p.forEach(function(point,i){var x=200+point[0]*106,y=160+point[1]*106;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.closePath();ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.45;ctx.stroke();
    });ctx.lineWidth=.8;ctx.strokeStyle='rgba(220,93,73,.85)';segment(0,Math.PI);tail(a,true);
  }
  function tick(now){raf=0;if(disposed)return;if(last!==null)elapsed+=now-last;last=now;if(now-lastDraw>=40){draw();lastDraw=now;}raf=window.requestAnimationFrame(tick);}
  function sync(){
    var running=!disposed&&PREF.uiStyle==='nasa'&&PREF.motion!==false&&!reduced.matches&&visible&&!document.hidden;
    badge.dataset.motion=running?'running':'paused';
    if(running&&!raf&&window.requestAnimationFrame){last=null;raf=window.requestAnimationFrame(tick);}
    else if(!running&&raf){window.cancelAnimationFrame(raf);raf=0;last=null;}
  }
  var observer=window.IntersectionObserver ? new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;sync();}) : null;
  NASA_BADGE_SYNC=sync;
  NASA_BADGE_DISPOSE=function(){disposed=true;if(raf)window.cancelAnimationFrame(raf);if(observer)observer.disconnect();document.removeEventListener('visibilitychange',sync);if(reduced.removeEventListener)reduced.removeEventListener('change',sync);};
  draw();sync();if(observer)observer.observe(badge);document.addEventListener('visibilitychange',sync);if(reduced.addEventListener)reduced.addEventListener('change',sync);
}
