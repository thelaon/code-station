function setPracticeTimer(node,label,value){
  value=value===undefined?'':String(value);node.setAttribute('aria-label',label+(value?' '+value:''));
  if(!node._timerDigits||node._timerDigits.length!==value.length){
    emptyNode(node);var name=el('span','timer-name',label);name.setAttribute('aria-hidden','true');node.appendChild(name);node._timerName=name;node._timerDigits=[];
    var display=el('span','timer-display');display.setAttribute('aria-hidden','true');node.appendChild(display);
    value.split('').forEach(function(c){var digit=el('span',/\d/.test(c)?'tube-digit':'tube-separator',c);display.appendChild(digit);node._timerDigits.push(digit);});
  }
  node._timerName.textContent=label;node._timerDigits.forEach(function(d,i){if(d.textContent!==value[i])d.textContent=value[i];});
}
function fullPaperFeedbackControl(){
  var group=el('div','full-paper-feedback');group.setAttribute('role','group');group.setAttribute('aria-label','整卷批改方式');group.appendChild(el('span',null,'批改方式'));
  [['immediate','即时批改'],['deferred','交卷后批改']].forEach(function(item){var b=btn(item[1],function(){PICK.feedback=item[0];sync();});b.dataset.feedback=item[0];group.appendChild(b);});
  var hint=el('small');group.appendChild(hint);
  function sync(){Array.prototype.forEach.call(group.querySelectorAll('button'),function(b){b.setAttribute('aria-pressed',String(PICK.feedback===b.dataset.feedback));});hint.textContent=PICK.feedback==='immediate'?'逐题反馈，可随时查看解析。':'不倒计时，作答可修改；交卷后统一判分和查看解析。';}
  sync();return group;
}
function createProgressRuler(total){
  var target=Math.max(1,total/8),power=Math.pow(10,Math.floor(Math.log(target)/Math.LN10));
  var step=total<=12?1:[1,2,5,10].map(function(v){return v*power;}).filter(function(v){return v>=target;})[0];step=Math.max(1,Math.round(step));
  var ruler=el('div','progress-ruler');ruler.setAttribute('aria-hidden','true');ruler.dataset.step=String(step);ruler.dataset.total=String(total);
  function tick(n){var t=el('span','progress-tick'+(n===0||n===total||n%(step*2)===0?' major':''));t.style.left=(total?n/total*100:0)+'%';t.dataset.question=String(n);ruler.appendChild(t);}
  tick(0);for(var n=step;n<total;n+=step)tick(n);if(total)tick(total);return ruler;
}
function categoryMotionEnabled(){return PREF.motion!==false&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
function animateCategoryClose(M){
  var closing=false,timer=0,originalRemove=M.m.remove;
  M.m.remove=function(){clearTimeout(timer);M.box.removeEventListener('animationend',finish);M.box.removeEventListener('animationcancel',finish);originalRemove();};
  function finish(e){if(e&&(e.target!==M.box||e.animationName!=='category-panel-out'))return;M.m.remove();}
  M.m.requestClose=function(){if(closing)return;if(!categoryMotionEnabled()){M.m.remove();return;}closing=true;M.m.classList.remove('category-opening');M.m.classList.add('category-closing');M.box.inert=true;M.box.addEventListener('animationend',finish);M.box.addEventListener('animationcancel',finish);timer=setTimeout(function(){finish();},160);};
}
