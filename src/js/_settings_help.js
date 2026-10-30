
function categoryDialog(title, caption, kind, items){
  var M=modalBox(title,true),box=M.box;emptyNode(box);
  box.className+=' category-dialog '+kind+'-panel';box.style.maxWidth='1040px';box.style.overflowY='hidden';animateCategoryClose(M);
  if(PREF.motion!==false && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)){
    M.m.classList.add('category-opening');
    function finishEntry(e){
      if(e.target!==box)return;
      M.m.classList.remove('category-opening');
      box.removeEventListener('animationend',finishEntry);box.removeEventListener('animationcancel',finishEntry);
    }
    box.addEventListener('animationend',finishEntry);box.addEventListener('animationcancel',finishEntry);
  }
  var head=el('div','category-head'),copy=el('div');copy.appendChild(el('small','category-eyebrow',kind==='settings'?'CONTROL PANEL':'FLIGHT MANUAL'));
  copy.appendChild(el('h2',null,title));copy.appendChild(el('p',null,caption));head.appendChild(copy);
  var close=btn('关闭',function(){M.m.requestClose();});close.setAttribute('aria-label','关闭'+title);head.appendChild(close);box.appendChild(head);
  var layout=el('div','category-layout'),nav=el('div','category-nav'),body=el('div','category-body'),tabs=[],panels=[];
  nav.setAttribute('role','tablist');nav.setAttribute('aria-label',title+'分类');nav.setAttribute('aria-orientation','vertical');
  items.forEach(function(item,i){
    var tab=btn(item[1],function(){activate(i);}),panel=el('section','category-section');tab.setAttribute('role','tab');
    tab.id=kind+'-tab-'+item[0];panel.id=kind+'-section-'+item[0];tab.setAttribute('aria-controls',panel.id);panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
    var num=el('small',null,('0'+(i+1)).slice(-2));num.setAttribute('aria-hidden','true');tab.insertBefore(num,tab.firstChild);
    tab.onkeydown=function(e){var at=i;if(e.key==='ArrowDown'||e.key==='ArrowRight')at=(i+1)%items.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')at=(i+items.length-1)%items.length;else if(e.key==='Home')at=0;else if(e.key==='End')at=items.length-1;else return;e.preventDefault();activate(at);tabs[at].focus();};
    tabs.push(tab);panels.push(panel);nav.appendChild(tab);body.appendChild(panel);
  });
  var activeIndex=-1;
  function activate(index){var animate=activeIndex>=0&&activeIndex!==index&&categoryMotionEnabled();activeIndex=index;tabs.forEach(function(t,i){t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;panels[i].classList.remove('category-section-enter');panels[i].hidden=i!==index;});body.scrollTop=0;if(animate){panels[index].classList.add('category-section-enter');}}
  panels.forEach(function(panel){panel.addEventListener('animationend',function(e){if(e.target===panel)panel.classList.remove('category-section-enter');});});
  layout.appendChild(nav);layout.appendChild(body);box.appendChild(layout);activate(0);
  return {m:M.m,box:box,panels:panels,select:function(id){var at=items.map(function(x){return x[0];}).indexOf(id);if(at>=0)activate(at);}};
}
function settingsToggle(ctl,label,get,set){
  var input=el('input');input.type='checkbox';input.checked=!!get();input.setAttribute('role','switch');input.setAttribute('aria-label',label);
  var wrap=el('label','settings-switch'),track=el('span','settings-switch-track'),state=el('span','settings-switch-state');track.setAttribute('aria-hidden','true');state.textContent=input.checked?'已开启':'已关闭';
  input.onchange=function(){set(input.checked);state.textContent=input.checked?'已开启':'已关闭';};wrap.appendChild(input);wrap.appendChild(track);wrap.appendChild(state);ctl.appendChild(wrap);return input;
}
function settingsNumber(row,get,set,min,max,step,unit){
  var input=el('input');input.type='number';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(get());input.setAttribute('aria-label',row.row.children[0].textContent);
  input.onchange=function(){var n=Number(input.value);if(!Number.isFinite(n)||input.value==='')n=get();n=Math.max(min,Math.min(max,Math.round(n/step)*step));set(n);input.value=String(get());};
  row.ctl.appendChild(input);if(unit)row.ctl.appendChild(el('span','settings-unit',unit));return input;
}
function openSettings(initial){
  var M=categoryDialog('设置','按分类调整，修改后自动保存。','settings',[['display','界面与阅读'],['practice','答题习惯'],['review','复习计划'],['data','题库与数据'],['help','帮助与关于']]);
  var s1=secOf(M.panels[0],'界面与阅读');
  var visual=rowOf(s1,'界面风格','默认界面侧重阅读；航天档案保留复古纸张、切面星球和轨道。');visual.ctl.classList.add('settings-style-options');
  function refreshView(){if(VIEW==='home')renderHome();else if(VIEW==='stats')renderStats();else if(VIEW==='review')renderReview();else if(VIEW==='result')renderResult();}
  segCtl(visual.ctl,[['classic','默认界面'],['nasa','航天档案']],function(v){return PREF.uiStyle===v;},function(v){PREF.uiStyle=v;save(LSKEY.pref,PREF);applyPref();refreshView();});
  var color=rowOf(s1,'深浅色','跟随当前界面风格调整配色。');segCtl(color.ctl,[['light','浅色'],['dark','深色']],function(v){return PREF.theme===v;},function(v){PREF.theme=v;save(LSKEY.pref,PREF);applyPref();});
  var font=rowOf(s1,'阅读字号','拖动滑杆预览，13—22 px。'),slider=el('input'),size=el('output');slider.type='range';slider.min='13';slider.max='22';slider.step='1';slider.value=String(PREF.fontSize);slider.setAttribute('aria-label','阅读字号');size.textContent=PREF.fontSize+' px';
  var preview=el('div','settings-reading-preview','代码航站 · 每一次练习，都是新的探索。');preview.appendChild(el('code',null,'int main(void) { return 0; }'));
  slider.oninput=function(){PREF.fontSize=Number(slider.value);save(LSKEY.pref,PREF);applyPref();size.textContent=PREF.fontSize+' px';};font.ctl.appendChild(slider);font.ctl.appendChild(size);font.row.appendChild(preview);
  var motion=rowOf(s1,'装饰动效','控制模块渐入和轨道动画；系统启用“减少动态效果”时自动减少动画。');settingsToggle(motion.ctl,'装饰动效',function(){return PREF.motion!==false;},function(v){PREF.motion=v;save(LSKEY.pref,PREF);applyPref();});
  var s2=secOf(M.panels[1],'答题习惯'),auto=rowOf(s2,'答对后自动跳题','仅在普通练习整题答对后生效；考试中不自动跳题。展开解析或继续输入会取消当次跳转。');
  auto.row.classList.add('auto-next-setting');
  var toggle=settingsToggle(auto.ctl,'答对后自动跳题',function(){return SET.autoNext===1;},function(v){SET.autoNext=v?1:0;saveSet();syncDelay();});
  var delay=rowOf(s2,'自动跳题等待秒数','默认 3 秒，关闭自动跳题后仍保留此数值。');delay.row.classList.add('auto-next-delay');var wait=settingsNumber(delay,function(){return SET.autoNextSec;},function(v){SET.autoNextSec=v;saveSet();},1,60,1,'秒');
  function syncDelay(){wait.disabled=!toggle.checked;delay.row.classList.toggle('setting-inactive',!toggle.checked);}syncDelay();
  var flash=rowOf(s2,'答对后闪烁几秒','仅控制单选正确选项的高亮反馈，与自动跳题的等待时间分开；0 表示不闪烁。');settingsNumber(flash,function(){return SET.flashSec;},function(v){SET.flashSec=v;saveSet();},0,60,1,'秒');
  var s3=secOf(M.panels[2],'复习计划');
  var correct=rowOf(s3,'连续答对几次移出复习池','默认 2 次；达到次数后标为已掌握，再次答错仍会返回复习池。');settingsNumber(correct,function(){return SET.needCorrect;},function(v){SET.needCorrect=v;saveSet();},1,5,1,'次');
  var daily=rowOf(s3,'今日复习每次最多题数','默认 20 题；按 5 题调整，也可在复习页选择本次做更多。');settingsNumber(daily,function(){return SET.dailyMax;},function(v){SET.dailyMax=v;saveSet();},5,500,5,'题');
  var schedule=el('div','settings-info');schedule.appendChild(el('h4',null,'复习节奏'));schedule.appendChild(el('p',null,'答错当天进入复习；再次答对后，间隔依次为 1 → 3 → 7 → 14 → 30 → 60 天。间隔固定，毕业所需次数可在上方调整。'));s3.appendChild(schedule);
  dataSection(M.panels[3]);
  var s5=secOf(M.panels[4],'帮助与关于');s5.appendChild(el('p',null,'代码航站 · 本机离线编程练习与学习档案。题目和分值以当前题包为准。'));
  s5.appendChild(btn('打开使用说明',function(){M.m.remove();openHelp();},true));
  var defaults=rowOf(s5,'恢复默认设置','恢复界面、答题及复习参数，保留题库、学习进度和历史成绩。');defaults.ctl.appendChild(btn('恢复默认设置',function(){if(!confirm('恢复界面、答题与复习参数为默认值？学习进度和题库保留。'))return;resetSettings();M.m.remove();openSettings('help');}));
  s5.appendChild(el('p','note','所有设置只保存在当前浏览器中。再次查看说明可点击顶部“?”，首次阅读提示不会在每次启动时重复弹出。'));
  var foot=el('div','category-foot');foot.appendChild(el('span',null,'即时生效 · 自动保存在本机'));foot.appendChild(btn('完成',function(){M.m.requestClose();},true));M.box.appendChild(foot);
  if(typeof initial==='string')M.select(initial);
}
function helpList(panel,items){var list=el('ul','guide-list');items.forEach(function(t){list.appendChild(el('li',null,t));});panel.appendChild(list);}
function helpBlock(panel,title,text){panel.appendChild(el('h4',null,title));panel.appendChild(el('p',null,text));}
function openHelp(initial){
  var M=categoryDialog('使用说明','从导入题库到备份记录，按需要查阅。','guide',[['start','快速开始'],['questions','题型与提交'],['exam','模拟考试'],['review','复习与统计'],['data','题库与备份'],['keys','操作与快捷键']]);
  var p=M.panels[0];p.appendChild(el('h3',null,'欢迎来到代码航站'));
  p.appendChild(el('p','guide-lead','这是一个在浏览器内离线运行的练习工具。题库可以单独导入；纯框架版不预装题目。'));
  var steps=el('ol','guide-steps');[['导入题库','首页左侧“导入 / 管理题包”中选择本地 JSON，检查预览后确认导入。已有题库时，从左侧总目录切换。'],['选择练习','保留试卷卡片选卷；可选整卷练习、题型专练或模拟考试。题型、题量和满分以当前试卷显示为准。'],['作答与回顾','题型专练即时反馈；整卷按所选批改方式执行。延后批改和模拟考试在交卷后查看成绩与解析。'],['保存自己的记录','浏览器会自动保存当前进度。换设备、清理浏览器或升级前，请分别备份题库、学习记录和需要保留的代码草稿。']].forEach(function(x){var li=el('li');li.appendChild(el('strong',null,x[0]));li.appendChild(el('p',null,x[1]));steps.appendChild(li);});p.appendChild(steps);
  helpBlock(p,'先记住这三点','题库与学习记录是两种备份；普通练习与考试的反馈时机不同；数据保存在当前浏览器，请定期导出。');
  p=M.panels[1];p.appendChild(el('h3',null,'按题型完成作答'));
  [['单选题','普通练习点击一个选项即记录本题答案并给出反馈，首次作答计入成绩。答过的题可用“撤销本题作答重做”重新练习。'],['多选题','可以反复勾选或取消，再点击“提交”。全部选对且无错选才得分；少选、多选或错选不得分。选项数量由题目决定，支持 A—H。'],['普通填空','按顺序填写各空，再点击“提交”。匹配方式、大小写、空格或数值容差由题包规定，按题面提示输入；各空按题目分值计分。'],['程序填空','在代码空位内输入后点击“提交”，逐空核对题包提供的答案及等价写法。使用英文半角符号。空数和每空分值看题目，部分正确可得部分分。'],['程序改错','按题面要求修改代码。“编译并运行”用于自测，不记分；“提交”生成报告并记录结果。成绩依据逐处核对，编译与运行结果帮助定位问题；当前工具无法处理的情况以报告提示为准。'],['编程题','已纳入普通整卷与题型专练。自定义输入后运行用于自测；点击“提交”核对题包公开用例，全部通过视为答对，有配置分值时计入练习。公开用例通过不代表覆盖所有可能输入。工具或环境限制不记为错答。'],['连续小问','同一材料可拆成多个独立小问，沿题序连续显示。题干可能重复，答题卡显示类似 7(1)、7(2)；各小问分别提交、计分和复习。']].forEach(function(x){helpBlock(p,x[0],x[1]);});
  helpBlock(p,'答案、解析与自动跳题','普通练习查看答案会按页面确认提示记为错答并加入复习。答对后自动跳题默认关闭，可在“设置 → 答题习惯”开启并选择等待秒数；只对整题答对生效，展开解析可取消当次跳转。');
  p=M.panels[2];p.appendChild(el('h3',null,'考试期间先作答，交卷后看成绩'));
  helpBlock(p,'整卷练习的批改方式','首页的整卷练习可选择“即时批改”或“交卷后批改”。即时批改逐题反馈；交卷后批改允许修改答案、隐藏答案解析，仅保留答题、交卷和放弃入口，不倒计时。编程题保留在整卷中，延后批改时自测只展示输出，交卷后统一核对公开用例。成绩可在统计中回顾。题型专练仍即时反馈。');
  helpList(p,['首页选择“模拟考试”，设置 1—180 分钟（默认 60 分钟），选择试卷后开始。考试按试卷所含的单选、多选、填空与改错组卷；当前不包含编程题。','考试中选项和输入会保存，可修改或清除；不提前显示对错和解析。标记为“待检查”方便交卷前回看。','答题卡：蓝色表示已作答，浅黄表示部分填写，★ 表示待检查。当前题另有边框标识；这些颜色不代表答对或答错。','倒计时按截止时间计算，打开设置、切到后台或关闭页面也继续。关闭期间到时，再次打开时自动收卷。','考试界面只保留答题操作；点击交卷或放弃考试结束。放弃不生成成绩，也不计入复习和统计。',
    '可手动交卷，也会在到时后收卷；未答计零分，交卷后该场答卷只读。改错考试分数按逐处核对规则计算，交卷时不重新编译运行。','在“统计 → 考试成绩”选择场次，默认最近一次。进入详情可回看各题、答案和用时，不覆盖正在进行的普通练习。']);
  helpBlock(p,'两种时间','考试剩余时间持续倒数；“本题用时”是当前题的活动阅读时间，切题、离开练习、打开弹窗或进入后台会暂停。两者用途不同。');
  p=M.panels[3];p.appendChild(el('h3',null,'把错题变成熟悉的知识'));
  helpList(p,['答错或查看答案的题当天进入复习池；再次答对后，间隔按 1 → 3 → 7 → 14 → 30 → 60 天逐步延长。','当前连续答对 '+SET.needCorrect+' 次后移出复习池、标为已掌握；以后答错会返回。次数可在“设置 → 复习计划”调整，固定间隔不可修改。','复习页可切换今日到期、全部未掌握、已掌握或我的标记，再按试卷选择本次复习；再次点击已选卡片可取消选择。','手动“标记待复习”便于收藏回看，不等同于题目已掌握。考试里的“待检查”仅用于该场考试。','统计记录累计作答、活跃天数、复习状态和近 7 天作答量；累计作答按提交次数计，同一题重做后再次提交会再次累计。']);
  helpBlock(p,'练习答题卡','绿色表示整题答对，红色表示答错，黄色表示部分正确；当前题有边框，★ 表示手动标记，小圆点表示已掌握。点击编号可直接跳题。考试采用单独的已作答配色。');
  p=M.panels[4];p.appendChild(el('h3',null,'题库独立管理，记录分别备份'));
  helpBlock(p,'导入与更新','从首页“导入 / 管理题包”或“设置 → 题库与数据 → 管理题库”进入。支持选择本地 JSON 或粘贴 JSON；先校验和预览，再确认保存。Word、PDF 和 ZIP 需先转换或解压成受支持的题包 JSON，不能直接当题库导入。校验在本机进行，不调用 AI 或产生模型 API 费用。');
  helpBlock(p,'启停、删除与修订','停用隐藏题库并保留关联记录；删除前会说明影响。更新需使用相同题包标识及更高修订号；若题干、答案、题序或判分规则发生变化且已有记录，须按页面提示确认清除关联数据。考试进行中不允许修改题库。');
  var backups=el('div','guide-backups');[['题库备份','在题库管理中导出，包含已导入题包、插图和启停状态。'],['学习记录','导出练习进度、复习档案、标记、统计、历史考试及答题/复习参数；不包含题包或显示偏好。'],['代码草稿','需要保留的改错代码在题目页导出；编程草稿使用编程页的导出功能另存。']].forEach(function(x){var card=el('div');card.appendChild(el('strong',null,x[0]));card.appendChild(el('p',null,x[1]));backups.appendChild(card);});p.appendChild(backups);
  helpBlock(p,'恢复顺序','先恢复题库，再导入学习记录，最后恢复需要的代码草稿。旧版学习记录仍支持导入，但必须先备齐记录所引用的题库。迁移前建议保留原始 JSON 和导出的备份文件。');
  helpBlock(p,'存储与清空','数据仅存在当前浏览器。换浏览器、无痕模式或清理浏览器数据可能无法找回进度，复制 HTML 不会带走记录。设置中的清空操作会删除当前版本的题库、成绩、草稿和设置；当前开发构建升级首次打开也会按约定清空应用数据。首次说明提示的“已展示”标记独立保留，重开或升级不会重复弹出；清除浏览器站点数据后会再次提示。');
  p=M.panels[5];p.appendChild(el('h3',null,'鼠标、键盘都可以操作'));
  var keys=el('dl','guide-keys');[['1—8 / A—H','按本题实际选项选择；多选为切换勾选。普通单选即时记录，考试可修改。'],['Enter / → / ←','下一题 / 下一题 / 上一题。'],['N','随机跳到本组另一题。'],['S','练习时切换待复习标记；考试时切换待检查标记。'],['R','仅选择题普通练习可查看答案，需确认并计为错答；考试禁用。'],['Esc','关闭弹窗。'],['Tab / 方向键','Tab 移动焦点；设置和说明的分类标签支持方向键、Home、End 切换。']].forEach(function(x){keys.appendChild(el('dt',null,x[0]));keys.appendChild(el('dd',null,x[1]));});p.appendChild(keys);
  helpBlock(p,'输入框内优先打字','光标在输入框、编辑器、按钮或其他可编辑控件中时，不触发全局切题快捷键。多选和填空仍需点击“提交”。图片可以点击放大；顶部“?”可随时重新打开本说明。');
  var foot=el('div','category-foot');foot.appendChild(el('span',null,'随时从顶部“?”重新查阅'));foot.appendChild(btn('开始使用',function(){M.m.requestClose();},true));M.box.appendChild(foot);if(typeof initial==='string')M.select(initial);
}
function showFirstVisitGuide(){
  try{if(localStorage.getItem(GUIDE_SEEN_KEY)==='1')return;localStorage.setItem(GUIDE_SEEN_KEY,'1');}catch(e){}
  var M=modalBox('欢迎来到代码航站',true);M.box.className+=' welcome-panel';
  M.box.appendChild(el('p','guide-lead','第一次使用，建议先读这份简短说明。'));
  helpList(M.box,['先导入题包，再选择练习或模拟考试。','题库、学习记录和代码草稿需要分别备份。','使用说明可随时在顶部“?”打开。']);
  M.box.appendChild(el('p','note','此提示只展示一次。'));
  var actions=el('div','footbar');actions.appendChild(btn('阅读使用说明',function(){M.m.remove();openHelp();},true));actions.appendChild(btn('稍后再看',function(){M.m.remove();}));M.box.appendChild(actions);
}
