/* Validate a detached candidate before touching application state or storage. */
function prepareRecordBackup(input){
  function fail(label){throw new Error('学习记录格式异常：'+label);}
  function map(v,label){if(!v||typeof v!=='object'||Array.isArray(v))fail(label);return v;}
  function number(v,label,max){if(!Number.isFinite(v)||v<0||v>(max===undefined?Number.MAX_SAFE_INTEGER:max))fail(label);}
  function key(k){if(!existsKey(k))fail('题目不存在 '+k);}
  function fields(v,fn){Object.keys(v).forEach(function(k){key(k);fn(v[k],k);});}
  var d=JSON.parse(JSON.stringify(input),function(k,v){if(['__proto__','constructor','prototype'].indexOf(k)>=0)fail('不支持的字段');return v;});map(d,'根对象');
  if(d.version!==2&&d.version!==1&&!(d.version===undefined&&d.wrong))fail('版本');
  assertPackReferences(d);
  function review(r){map(r,'复习条目');['total','wrong','last','stage','iv','due'].forEach(function(k){number(r[k],'复习 '+k);});if(r.ivIdx!==undefined)number(r.ivIdx,'复习间隔',IVS.length-1);if(typeof r.master!=='boolean')fail('掌握标记');}
  var records=Object.assign({},REC);
  if(d.review!==undefined)fields(map(d.review,'复习档案'),function(r,k){review(r);records[k]=r;});
  else if(d.wrong!==undefined)fields(map(d.wrong,'旧版错题'),function(r,k){map(r,'旧错题');number(r.n,'错次');number(r.ts,'日期');records[k]={total:r.n||1,wrong:r.n||1,last:r.ts,stage:0,ivIdx:0,iv:0,due:r.ts,master:false};});
  if(d.marks!==undefined)fields(map(d.marks,'标记'),function(v){if(typeof v!=='boolean')fail('标记值');});
  if(d.stats!==undefined){map(d.stats,'统计');map(d.stats.log,'每日统计');Object.keys(d.stats.log).forEach(function(k){if(!/^\d{4}-\d{2}-\d{2}$/.test(k))fail('统计日期');number(d.stats.log[k],'作答次数');});}
  var settings=Object.assign({},SET);
  if(d.set!==undefined){map(d.set,'设置');var limits={needCorrect:[1,5],dailyMax:[5,500],flashSec:[0,60],autoNext:[0,1],autoNextSec:[1,60]};Object.keys(DEF_SET).forEach(function(k){if(d.set[k]===undefined)return;var v=d.set[k],lim=limits[k];if(!Number.isInteger(v)||v<lim[0]||v>lim[1])fail('设置 '+k);settings[k]=v;});}
  function session(s){
    if(s===null)return s;map(s,'会话');if(typeof s.pid!=='string'||typeof s.kind!=='string'||typeof s.done!=='boolean'||!Array.isArray(s.order)||!s.order.length||s.order.length>10000||!Number.isInteger(s.idx)||s.idx<0||s.idx>=s.order.length)fail('会话结构');
    number(s.startAt,'开始时间');number(s.elapsed,'累计用时');
    function order(list){if(!Array.isArray(list)||!list.length||list.length>10000)fail('题目顺序');var seen=Object.create(null);list.forEach(function(o){map(o,'题目顺序');var k=qid(o.pid,o.num);key(k);if(seen[k])fail('重复题目');seen[k]=true;var num=String(o.num);if(!!o.program!==/^p/.test(num)||!!o.blank!==/^b/.test(num)||!!o.fix!==/^x/.test(num))fail('题型与题号不一致');});}
    order(s.order);if(s.all!==undefined)order(s.all);
    ['picks','reveal','bans','bsnap','fix','qtime','snap','programs','programSnaps','fixIO'].forEach(function(k){if(s[k]===undefined)s[k]={};else map(s[k],'会话 '+k);});
    fields(s.picks,function(v,k){var o=splitKey(k);if(!validChoicePick(findQ(o.pid,o.num),v))fail('选项');});
    fields(s.reveal,function(v){if(typeof v!=='boolean')fail('答案标记');});
    fields(s.bans,function(v){map(v,'填空输入');Object.keys(v).forEach(function(n){if(typeof v[n]!=='string'||v[n].length>65536)fail('填空输入');});});
    fields(s.qtime,function(v){number(v,'题目用时');});
    fields(s.fixIO,function(v){if(typeof v!=='string'||v.length>65536)fail('自测输入');});
    ['snap','programSnaps'].forEach(function(k){fields(s[k],function(v){if(v!==SNAP)review(v);});});
    fields(s.fix,function(v,k){map(v,'改错成绩');var o=splitKey(k),q=findF(o.pid,o.num);if(!q||!Number.isInteger(v.fixed)||v.fixed<0||v.fixed>q.errorCount||v.total!==q.errorCount||!Number.isFinite(v.score)||Math.abs(v.score-v.fixed*fixPer(q))>1e-6)fail('改错成绩');delete v.html;delete v.report;});
    fields(s.programs,function(v,k){map(v,'编程成绩');var o=splitKey(k),q=findP(o.pid,o.num);if(!q||typeof v.good!=='boolean'||!Number.isInteger(v.passed)||!Number.isInteger(v.total)||v.passed<0||v.passed>v.total||v.total!==q.tests.length||v.good!==(v.passed===v.total)||v.score!==(v.good?programPoints(q):0)||typeof v.code!=='string')fail('编程成绩');});
    assertBlankSnapshots(s);if(s.kind==='exam'&&!validExam(s))fail('考试会话');return s;
  }
  if(d.session!==undefined&&d.session!==null)session(d.session);
  if(d.exams!==undefined){if(!Array.isArray(d.exams)||d.exams.length>10000)fail('考试列表');d.exams.forEach(session);}
  var exams=checkedExamRecords(d.exams||[]);if(d.session&&d.session.kind==='exam'&&d.session.done){if(!validExamRecord(d.session))fail('已完成考试');if(!exams.some(function(s){return examRecordId(s)===examRecordId(d.session);}))exams.push(d.session);}
  var combined=EXAMS.slice();exams.forEach(function(s){if(!combined.some(function(old){return examRecordId(old)===examRecordId(s);}))combined.push(s);});combined.sort(function(a,b){return b.exam.finishedAt-a.exam.finishedAt;});
  var legacy={};Object.keys(records).forEach(function(k){var r=records[k];if(!r.master)legacy[k]={n:r.wrong,ts:r.last};});
  return {review:records,wrong:legacy,marks:d.marks===undefined?MARKS:d.marks,stats:d.stats===undefined?STATS:d.stats,set:settings,session:d.session||SESSION,hasSession:!!d.session,exams:combined};
}
function applyRecordBackup(input){
  CQStorage.assertWritable();if(CQStorage.hasPending())throw new Error('请先保存或导出尚未保存的更改，再导入。');
  var next=prepareRecordBackup(input),writes={};
  writes[LSKEY.review]=JSON.stringify(next.review);writes[LSKEY.wrongLegacy]=JSON.stringify(next.wrong);writes[LSKEY.marks]=JSON.stringify(next.marks);writes[LSKEY.stats]=JSON.stringify(next.stats);writes['cqframe.set.v1']=JSON.stringify(next.set);writes['cqframe.exams.v1']=JSON.stringify(next.exams);
  if(next.hasSession){writes[LSKEY.session]=JSON.stringify(next.session);writes[LSKEY.blanks]='null';}
  commitPackStorage(writes);cancelAutoNext();REC=next.review;WRONG=next.wrong;MARKS=next.marks;STATS=next.stats;SET=next.set;EXAMS=next.exams;if(next.hasSession){SESSION=next.session;BLANKS=null;}
  return Object.keys(input.review||input.wrong||{}).length;
}
