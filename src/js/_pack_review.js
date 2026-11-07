var PACK_REVIEW_TYPES={single:'单选',multiple:'多选',blank:'填空',code_blank:'程序填空',fix:'改错',program:'编程'};

function packReviewText(parent,label,record,key,rows,code){
  var wrap=el('label','pack-review-field');
  wrap.appendChild(el('span',null,label));
  var input=el(rows?'textarea':'input',code?'pack-review-code':null);
  input.setAttribute('aria-label',label);
  if(rows)input.rows=rows;
  if(code){input.spellcheck=false;input.wrap='off';}
  input.value=record[key]===undefined?'':record[key];
  input.oninput=function(){record[key]=input.value;};
  wrap.appendChild(input);parent.appendChild(wrap);
  return input;
}
function packReviewSection(parent,title,folded){
  var section=el(folded?'details':'section','pack-review-section');
  section.appendChild(el(folded?'summary':'h4',null,title));
  parent.appendChild(section);return section;
}
function packReviewImages(parent,images){
  if(!images.length)return;
  var area=el('div','pack-review-images');
  images.forEach(function(image){
    var figure=el('figure'),img=el('img');
    img.src=image.data;img.alt=image.name;
    figure.appendChild(img);figure.appendChild(el('figcaption','note',image.name));area.appendChild(figure);
  });
  parent.appendChild(area);
}
function packReviewAnswers(parent,answers){
  var area=el('div','pack-review-answers');
  parent.appendChild(area);
  function draw(focusIndex){
    emptyNode(area);
    answers.forEach(function(value,i){
      var row=el('div','pack-review-answer-row');
      var input=packReviewText(row,'可接受答案 '+(i+1),answers,i,2);
      var remove=btn('移除',function(){answers.splice(i,1);draw(Math.min(i,answers.length-1));});
      remove.disabled=answers.length===1;
      remove.setAttribute('aria-label','移除可接受答案 '+(i+1));
      row.appendChild(remove);area.appendChild(row);
      if(i===focusIndex)input.focus();
    });
    var add=btn('添加答案',function(){answers.push('');draw(answers.length-1);});
    add.disabled=answers.length>=20;area.appendChild(add);
  }
  draw();
}
function packReviewChoices(parent,q){
  var section=packReviewSection(parent,'选项与正确答案'),keys=QuestionPackSchema.optionKeys(q);
  var multiple=q.type==='multiple',group=el('fieldset');
  group.appendChild(el('legend',null,multiple?'勾选所有正确选项':'勾选一个正确选项'));
  keys.forEach(function(key){
    var row=el('div','pack-review-choice'),label=el('label','pack-review-correct'),check=el('input');
    check.type=multiple?'checkbox':'radio';
    check.name='pack-review-answer';
    check.checked=multiple?q.answer.indexOf(key)>=0:q.answer===key;
    check.onchange=function(){
      if(!multiple){q.answer=key;return;}
      q.answer=keys.filter(function(k){return k===key?check.checked:q.answer.indexOf(k)>=0;});
    };
    label.appendChild(check);label.appendChild(el('span',null,key+' 正确'));
    row.appendChild(label);
    var rows=Math.min(4,q.options[key].split('\n').length);
    packReviewText(row,'选项 '+key,q.options,key,rows);
    group.appendChild(row);
  });
  section.appendChild(group);
}
function packReviewBlanks(parent,q){
  var section=packReviewSection(parent,'填空答案');
  q.blanks.forEach(function(blank,i){
    var slot=packReviewSection(section,'第 '+(blank.num||i+1)+' 空',q.blanks.length>1);
    if(q.type==='blank'){
      var wrap=el('label','pack-review-field'),mode=el('select');
      wrap.appendChild(el('span',null,'答案匹配方式'));
      mode.setAttribute('aria-label','答案匹配方式');
      [['text','文本'],['number','数值']].forEach(function(pair){
        var option=el('option',null,pair[1]);option.value=pair[0];mode.appendChild(option);
      });
      mode.value=blank.mode;wrap.appendChild(mode);slot.appendChild(wrap);
      var tolerance=el('div');
      var input=packReviewText(tolerance,'允许的绝对误差',blank,'tolerance');
      input.type='number';input.min='0';input.step='any';
      input.oninput=function(){blank.tolerance=input.valueAsNumber;};
      tolerance.hidden=blank.mode!=='number';slot.appendChild(tolerance);
      mode.onchange=function(){
        blank.mode=mode.value;
        tolerance.hidden=blank.mode!=='number';
        if(tolerance.hidden)delete blank.tolerance;
        else {blank.tolerance=0;input.value='0';}
      };
    }
    packReviewAnswers(slot,blank.answers);
  });
}
function packReviewCases(parent,title,cases,outputKey){
  var section=packReviewSection(parent,title+'（'+cases.length+'）',true);
  cases.forEach(function(test,i){
    var row=packReviewSection(section,'第 '+(i+1)+' 组',cases.length>1);
    packReviewText(row,'输入',test,'stdin',2,true);
    packReviewText(row,'预期输出',test,outputKey,2,true);
    (test.stdoutAlternatives||[]).forEach(function(value,index){
      packReviewText(row,'等价输出 '+(index+1),test.stdoutAlternatives,index,2,true);
    });
  });
}
function packReviewQuestion(parent,paper,q){
  var group=QuestionPackSchema.groupOf(paper,q);
  if(group){
    var shared=packReviewSection(parent,'共用题干 · 第 '+group.num+' 题');
    shared.appendChild(el('p','note','修改共用题干会影响本题组的所有小问。'));
    packReviewText(shared,'共用题干',group,'stem',4);
    packReviewImages(shared,group.images);
  }
  if(q.title!==undefined)packReviewText(parent,'题目标题',q,'title');
  packReviewText(parent,'题干',q,'stem',4);
  packReviewImages(parent,q.images);
  if(q.options)packReviewChoices(parent,q);
  if(q.code!==undefined)packReviewText(parent,'题目代码',q,'code',9,true);
  if(q.blanks)packReviewBlanks(parent,q);
  if(q.type==='fix'){
    var faults=packReviewSection(parent,'参考改法');
    q.faults.forEach(function(fault,i){
      var row=packReviewSection(faults,'错处 '+(i+1),q.faults.length>1);
      var line=packReviewText(row,'错行行号',fault,'line');
      line.type='number';line.min='1';line.oninput=function(){fault.line=line.valueAsNumber;};
      packReviewText(row,'原行',fault,'original',0,true);
      packReviewText(row,'参考改法',fault,'fixed',0,true);
      packReviewText(row,'修改原因',fault,'reason',2);
      (fault.alternatives||[]).forEach(function(a,j){
        packReviewText(row,'等价改法 '+(j+1),a,'code',0,true);
      });
    });
    packReviewCases(parent,'改错测试',q.tests,'expect');
  }
  if(q.type==='program'){
    packReviewText(parent,'输入说明',q,'input',2);
    packReviewText(parent,'输出说明',q,'output',2);
    packReviewText(parent,'数据范围',q,'rangeNote',2);
    packReviewText(parent,'初始代码',q,'starter',7,true);
    packReviewCases(parent,'题面样例',q.examples,'stdout');
    packReviewCases(parent,'公开用例',q.tests,'stdout');
  }
  packReviewText(parent,'解析',q,'analysis',4);
  var meta=packReviewSection(parent,'知识点与标签',true);
  packReviewText(meta,'知识点',q,'topic');
  var tags={value:q.tags.join('\n')};
  var input=packReviewText(meta,'标签（每行一个）',tags,'value',3);
  input.oninput=function(){q.tags=input.value.split('\n').map(function(tag){return tag.trim();}).filter(Boolean);};
  if(q.points!==undefined){
    var points=packReviewText(meta,'分值',q,'points');
    points.type='number';points.min='0.01';points.step='.01';
    points.oninput=function(){q.points=points.valueAsNumber;};
  }
}

function openPackQuestionReview(pack, options){
  var original=JSON.stringify(pack),draft=JSON.parse(JSON.stringify(options.draft||pack));
  var M=modalBox('审阅题目',true),box=M.box;
  emptyNode(box);box.classList.add('pack-review-dialog');
  box.style.maxWidth='1100px';
  var head=el('header','pack-review-head'),copy=el('div');
  copy.appendChild(el('h2',null,'审阅题目'));
  copy.appendChild(el('p','note',pack.title+' · '+pack.papers.length+' 套试卷'));
  head.appendChild(copy);head.appendChild(btn('关闭',function(){M.m.requestClose();}));box.appendChild(head);
  M.m.requestClose=function(){
    if(JSON.stringify(draft)!==original&&!confirm('有尚未应用的修改，确定关闭？'))return;
    M.m.remove();
  };
  var workspace=el('div','pack-review-workspace'),nav=el('div','pack-review-nav'),body=el('div','pack-review-body');
  var paperSelect=el('select'),questionSelect=el('select'),typeSelect=el('select'),query=el('input');
  function control(label,input){
    var wrap=el('label','pack-review-field');
    input.setAttribute('aria-label',label);
    wrap.appendChild(el('span',null,label));wrap.appendChild(input);nav.appendChild(wrap);
  }
  function option(select,label,value){
    var node=el('option',null,label);node.value=String(value);select.appendChild(node);
  }
  draft.papers.forEach(function(paper,index){option(paperSelect,paper.title,index);});
  control('试卷',paperSelect);
  option(typeSelect,'全部题型','all');
  Object.keys(PACK_REVIEW_TYPES).forEach(function(kind){option(typeSelect,PACK_REVIEW_TYPES[kind],kind);});
  control('题型',typeSelect);
  query.type='search';query.placeholder='题号、题干或知识点';control('查找题目',query);
  control('选择题目',questionSelect);
  var pager=el('div','toolbar pack-review-pager');
  var prev=btn('上一题',function(){questionSelect.selectedIndex--;showQuestion();});
  var next=btn('下一题',function(){questionSelect.selectedIndex++;showQuestion();});
  pager.appendChild(prev);pager.appendChild(next);nav.appendChild(pager);
  var progress=el('p','note');progress.setAttribute('role','status');nav.appendChild(progress);
  workspace.appendChild(nav);workspace.appendChild(body);box.appendChild(workspace);
  var foot=el('footer','pack-review-foot'),status=el('div','pack-review-status');status.setAttribute('role','status');
  var apply=btn(options.installed?'保存修改':'应用到待导入题包',save,true);
  foot.appendChild(status);foot.appendChild(apply);box.appendChild(foot);
  function currentPaper(){return draft.papers[Number(paperSelect.value)];}
  function updateQuestions(){
    var paper=currentPaper(),term=query.value.trim().toLowerCase(),wanted=questionSelect.value;
    emptyNode(questionSelect);
    paper.questions.forEach(function(q,index){
      var number=QuestionPackSchema.questionNumber(q,paper),kind=q.type||'single';
      var group=QuestionPackSchema.groupOf(paper,q);
      var text=[number,q.num,q.stem,q.topic,q.tags.join(' '),group?group.stem:'',q.options?Object.values(q.options).join(' '):''].join(' ').toLowerCase();
      if((typeSelect.value==='all'||typeSelect.value===kind)&&(!term||text.indexOf(term)>=0)){
        option(questionSelect,number+' · '+q.stem.replace(/\s+/g,' ').slice(0,42),index);
      }
    });
    if(Array.from(questionSelect.options).some(function(item){return item.value===wanted;}))questionSelect.value=wanted;
    showQuestion();
  }
  function showQuestion(){
    var index=questionSelect.selectedIndex;
    prev.disabled=index<=0;next.disabled=index<0||index>=questionSelect.options.length-1;
    progress.textContent=index<0?'没有匹配的题目':(index+1)+' / '+questionSelect.options.length+' 题';
    emptyNode(body);body.scrollTop=0;
    if(index<0){body.appendChild(el('p','empty','请调整题型或搜索条件。'));return;}
    var paper=currentPaper(),q=paper.questions[Number(questionSelect.value)];
    body.appendChild(el('h3',null,'第 '+QuestionPackSchema.questionNumber(q,paper)+' 题 · '+PACK_REVIEW_TYPES[q.type||'single']));
    packReviewQuestion(body,paper,q);
  }
  function save(){
    var checked=QuestionPackSchema.check(draft);
    if(!checked.ok){status.textContent=checked.errors[0].path+'：'+checked.errors[0].message;return;}
    var changed=canonicalPack(checked.pack)!==canonicalPack(pack);
    if(options.installed&&!changed){M.m.remove();return;}
    apply.disabled=true;
    status.textContent='正在检查题包…';
    var snapshot=JSON.stringify(draft);
    decodeQuestionPackImages(checked.pack).then(function(errors){
      if(!M.m.isConnected)return;
      apply.disabled=false;
      if(snapshot!==JSON.stringify(draft)){status.textContent='检查期间内容有变化，请重新保存。';return;}
      if(errors.length){status.textContent=errors[0].path+'：'+errors[0].message;return;}
      try{options.apply(checked,M);}
      catch(e){status.textContent=e.message;}
    });
  }
  paperSelect.onchange=typeSelect.onchange=query.oninput=updateQuestions;
  questionSelect.onchange=showQuestion;
  status.textContent=options.installed?'修改后会先核对对已有记录的影响。':'修改先应用到待导入题包，确认导入后才会保存。';
  updateQuestions();
}
