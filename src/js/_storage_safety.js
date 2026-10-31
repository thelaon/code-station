/* Single writer where Web Locks is available; snapshot protection otherwise. */
window.CQStorage=(function(){
  'use strict';
  var known=Object.create(null),pending=Object.create(null),stale=false,started=false;
  function node(tag,text){var n=document.createElement(tag);if(text)n.textContent=text;return n;}
  function button(label,fn){var b=node('button',label);b.onclick=fn;return b;}
  function rawBackup(){var stored={},errors=[];try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('cqframe.')===0){try{stored[k]=localStorage.getItem(k);}catch(e){errors.push(k);}}}}catch(e){errors.push(String(e));}return {format:'cquiz-recovery-storage',version:1,stored:stored,pendingWrites:pending,errors:errors};}
  function download(){var url=URL.createObjectURL(new Blob([JSON.stringify(rawBackup(),null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='代码航站-故障备份.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  function recovery(error,locked){
    var view=document.getElementById('view');view.replaceChildren();view.inert=false;var box=node('section');box.className='card';box.id='storage-recovery';box.appendChild(node('h2',locked?'此页面尚未连接学习数据':'学习数据暂时无法恢复'));
    box.appendChild(node('p',locked?'另一个页面正在使用本地数据。请关闭该页面后重新连接，避免互相覆盖。':'原数据尚未清除。可先导出故障备份，再释放浏览器存储空间并重试。故障备份用于恢复排查，不是普通学习记录。'));
    box.appendChild(node('p',String(error&&error.message||error)));var exported=false;box.appendChild(button('导出故障备份',function(){download();exported=true;}));box.appendChild(button('重新连接',function(){location.reload();}));
    if(!locked)box.appendChild(button('备份后重置本应用',function(){if(!exported){alert('请先导出并保存故障备份。');return;}if(!confirm('将清空本应用题库、成绩、草稿和设置。仅在已保存故障备份后继续。')||!confirm('再次确认清空本应用数据？'))return;var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('cqframe.')===0&&k!=='cqframe.guide.seen.v1')keys.push(k);}keys.forEach(function(k){localStorage.removeItem(k);});location.reload();}));view.appendChild(box);
    ['nav','btnSet','btnHelp'].forEach(function(id){var n=document.getElementById(id);if(n)n.inert=true;});
  }
  function notice(message){
    var n=document.getElementById('storage-notice');if(!n){n=node('section');n.id='storage-notice';n.className='warn';n.setAttribute('role','alert');n.appendChild(node('p'));n.appendChild(button('重试保存',flush));n.appendChild(button('导出当前学习记录',function(){if(window.__cq&&window.__cq.exportData)window.__cq.exportData();}));n.appendChild(button('导出故障备份',download));document.querySelector('.wrap').insertBefore(n,document.getElementById('view'));}
    n.hidden=false;n.querySelector('p').textContent=message;
    var foot=document.getElementById('foot');if(foot)foot.textContent=foot.textContent.replace('进度自动保存',stale?'此页面已停止保存':'存在未保存更改');
  }
  function assertWritable(){if(stale)throw new Error('数据已在其他页面改变，请先导出当前记录，再刷新。');}
  function checkSchema(){
    var raw=read('cqframe.storage-schema.v1');
    if(raw!==null&&raw!=='1')throw new Error('本机数据版本无法由当前应用安全读取，请使用匹配的新版或先导出故障备份。原数据未清除。');
  }
  function adoptSchema(build){
    checkSchema();
    // Legacy framework keys already use the supported v1 layout. Adopt without rewriting user data.
    if(read('cqframe.storage-schema.v1')===null&&!write('cqframe.storage-schema.v1','1'))throw new Error('数据版本标记暂时无法保存，原数据已保留。');
    if(build!=='dev'&&read('cqframe.build.v1')!==build&&!write('cqframe.build.v1',build))throw new Error('升级标记暂时无法保存，原数据已保留。');
  }
  function read(k){var value=localStorage.getItem(k);if(!Object.prototype.hasOwnProperty.call(known,k))known[k]=value;return value;}
  function accept(writes){Object.keys(writes).forEach(function(k){known[k]=writes[k];delete pending[k];});}
  function write(k,value){
    pending[k]=value;
    try{assertWritable();var old=read(k);if(old!==known[k]){stale=true;throw new Error('数据已在其他页面改变，请先导出当前记录，再刷新。');}if(value===null)localStorage.removeItem(k);else localStorage.setItem(k,value);known[k]=value;delete pending[k];if(!Object.keys(pending).length){var n=document.getElementById('storage-notice');if(n)n.hidden=true;var foot=document.getElementById('foot');if(foot)foot.textContent=foot.textContent.replace('存在未保存更改','进度自动保存');}return true;}
    catch(e){notice(stale?e.message:'尚有未保存的更改，请释放浏览器存储空间后重试，或先导出当前记录。');return false;}
  }
  function flush(){Object.keys(pending).forEach(function(k){write(k,pending[k]);});}
  function start(fn){
    function run(){started=true;try{fn();}catch(e){recovery(e,false);}}
    window.addEventListener('beforeunload',function(e){if(Object.keys(pending).length){e.preventDefault();e.returnValue='';}});
    window.addEventListener('storage',function(e){if(started&&e.key&&e.key.indexOf('cqframe.')===0&&['cqframe.guide.seen.v1','cqframe.probe'].indexOf(e.key)<0&&e.oldValue!==e.newValue){stale=true;notice('学习数据已在其他页面改变。请先导出当前记录，再刷新；此页面停止保存以防覆盖。');}});
    if(navigator.locks&&navigator.locks.request){navigator.locks.request('cqframe.application.writer',{ifAvailable:true},function(lock){if(!lock){recovery('等待其他页面关闭。',true);return;}run();return new Promise(function(){});}).catch(function(e){recovery(e,false);});}
    else run();
  }
  return {start:start,read:read,setRaw:write,remove:function(k){return write(k,null);},accept:accept,assertWritable:assertWritable,checkSchema:checkSchema,adoptSchema:adoptSchema,recovery:recovery,flush:flush,reset:function(){known=Object.create(null);pending=Object.create(null);var n=document.getElementById('storage-notice');if(n)n.hidden=true;},hasPending:function(){return Object.keys(pending).length>0;}};
}());
