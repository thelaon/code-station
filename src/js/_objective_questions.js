
function isMultipleQuestion(q){return !!(q&&q.type==='multiple');}
function validChoicePick(q,pick){
  if(pick===undefined)return true;
  var keys=QuestionPackSchema.optionKeys(q);
  if(typeof pick!=='string'||!pick||pick.split('').some(function(k){return keys.indexOf(k)<0;}))return false;
  if(!isMultipleQuestion(q))return pick.length===1;
  return pick===Array.from(new Set(pick.split(''))).sort().join('');
}
function gradeObjectiveBlank(q,ans){
  return q.rules.map(function(rule,i){
    var raw=ans[i+1],text=typeof raw==='string'?raw.trim():'';
    if(!text)return false;
    if(rule.mode==='text')return rule.answers.some(function(a){return text===a;});
    var actual=QuestionPackSchema.decimalParts(text);if(!actual)return false;
    return rule.answers.some(function(a){
      var expected=QuestionPackSchema.decimalParts(a),tolerance=QuestionPackSchema.decimalParts(String(rule.tolerance));
      if(!expected||!tolerance)return false;
      var scale=Math.max(actual.scale,expected.scale,tolerance.scale);
      function units(p){return BigInt(p.digits)*BigInt(10)**BigInt(scale-p.scale);}
      var delta=units(actual)-units(expected);if(delta<BigInt(0))delta=-delta;
      return delta<=units(tolerance);
    });
  });
}
function startChoiceType(pid,type){
  var p=PMAP[pid],questions=p?p.questions.filter(function(q){return isMultipleQuestion(q)===(type==='multiple');}):[];
  if(!questions.length)return;
  SESSION=newSession(pid,questions.map(function(q){return {pid:pid,num:q.num};}),type==='multiple'?'multiplepaper':'paper');SESSION.choiceType=type||'choice';go2practice();
}
function toggleMultiple(letter){
  var o=SESSION.order[SESSION.idx],q=findQ(o.pid,o.num),key=qid(o.pid,o.num);
  if(!isMultipleQuestion(q)||QuestionPackSchema.optionKeys(q).indexOf(letter)<0)return;
  if(isExam()){if(!examCanEdit())return;}
  else if(SESSION.picks[key]||SESSION.reveal[key])return;
  var drafts=isExam()?SESSION.picks:(SESSION.multiDrafts=SESSION.multiDrafts||{}),current=drafts[key]||'';
  var next=current.indexOf(letter)<0?current+letter:current.replace(letter,'');next=next.split('').sort().join('');
  if(next)drafts[key]=next;else delete drafts[key];save(LSKEY.session,SESSION);
  if(isExam()){renderPractice();return;}
  var host=document.querySelector('.multiple-question');
  if(!host){renderPractice();return;}
  Array.prototype.forEach.call(host.querySelectorAll('button[data-letter]'),function(b){
    var selected=next.indexOf(b.dataset.letter)>=0;
    b.classList.toggle('exam-picked',selected);b.classList.toggle('chosen',selected);
    b.setAttribute('aria-pressed',String(selected));b.querySelector('.multi-check').textContent=selected?'☑':'☐';
  });
  var submit=document.querySelector('.multiple-actions button.primary');if(submit)submit.disabled=!next;
}
function revealMultiple(){
  var o=SESSION.order[SESSION.idx],key=qid(o.pid,o.num);
  if(isExam()||SESSION.picks[key]||SESSION.reveal[key])return;
  if(!confirm('查看答案会把这题计为做错并加入复习池，确认？'))return;
  SESSION.snap=SESSION.snap||{};SESSION.snap[key]=snapOf(key);SESSION.reveal[key]=true;
  scheduleAfter(o.pid,o.num,false);bumpDaily();save(LSKEY.session,SESSION);renderPractice();
}
function renderMultipleQuestion(o,q,exam){
  var key=qid(o.pid,o.num),settled=exam?SESSION.done:!!SESSION.picks[key]||!!SESSION.reveal[key];
  var pick=exam||settled?SESSION.picks[key]||'':(SESSION.multiDrafts||{})[key]||'';
  var left=el('div','multiple-question');left.appendChild(renderFigures(q,o));left.appendChild(renderStem(q.stem));
  left.appendChild(el('p','tip','多选题 · 选择所有正确选项。全选且无错选得分，少选、多选或错选均不得分。'));
  var opts=el('div','opts');opts.setAttribute('role','group');opts.setAttribute('aria-label','多选答案');
  QuestionPackSchema.optionKeys(q).forEach(function(letter){
    var selected=pick.indexOf(letter)>=0,button=el('button','opt'+(selected?' exam-picked chosen':''));button.type='button';button.disabled=settled;
    button.setAttribute('aria-pressed',String(selected));button.setAttribute('data-letter',letter);
    button.appendChild(el('span','lt',letter+'.'));button.appendChild(el('span','tx',optText(q.options[letter])));
    button.appendChild(el('span','multi-check',selected?'☑':'☐'));
    if(settled){if(q.answer.indexOf(letter)>=0)button.classList.add('right');else if(selected)button.classList.add('wrong');}
    button.onclick=function(){toggleMultiple(letter);};opts.appendChild(button);
  });left.appendChild(opts);
  if(settled){
    var correct=pick===q.answer,points=perOf(o.pid,o.num);
    left.appendChild(answerBrief(correct?'correct':'wrong',correct?points:0,points,correct?'所有选项均匹配。':'多选题须全选且无错选才得分。'));
    left.appendChild(answerComparison(pick,q.answer));
    left.appendChild(renderChoiceAnalysis(q));
  }
  return left;
}
function renderMultiplePractice(o,q){
  var key=qid(o.pid,o.num),settled=!!SESSION.picks[key]||!!SESSION.reveal[key],extra=el('span','multiple-actions');
  if(!settled){
    var submit=btn('提交',function(){
      var pick=(SESSION.multiDrafts||{})[key];if(!pick||SESSION.picks[key]||SESSION.reveal[key])return;
      SESSION.snap=SESSION.snap||{};SESSION.snap[key]=snapOf(key);SESSION.picks[key]=pick;
      scheduleAfter(o.pid,o.num,pick===q.answer);bumpDaily();save(LSKEY.session,SESSION);renderPractice();queueAutoNext(o,pick===q.answer);
    },true);submit.disabled=!(SESSION.multiDrafts||{})[key];extra.appendChild(submit);extra.appendChild(btn('查看答案',revealMultiple));
  }else extra.appendChild(btn('撤销本题作答重做',function(){
    if(!confirm('撤销本题作答及对应复习记录，重新作答？'))return;
    var snapshot=SESSION.snap&&SESSION.snap[key];if(snapshot){restoreSnap(key,snapshot);delete SESSION.snap[key];}
    delete SESSION.picks[key];delete SESSION.reveal[key];if(SESSION.multiDrafts)delete SESSION.multiDrafts[key];save(LSKEY.session,SESSION);renderPractice();
  }));
  var mark=btn(MARKS[key]?'★ 已标记':'☆ 标记待复习',function(){if(MARKS[key])delete MARKS[key];else MARKS[key]=true;save(LSKEY.marks,MARKS);renderPractice();});
  return renderPracticeShell(renderMultipleQuestion(o,q,false),null,{sub:'本题 '+fmtScore(perOf(o.pid,o.num))+' 分 · 多选全对得分',footExtra:extra,tools:mark});
}
function sampleObjectivePack(){return null;}

function sampleDynamicPack(){return null;}

function sampleSubquestionPack(){return null;}
