
var StudyPackSchema=(function(){
  var TYPES=['code_blank','fix','program'];
  function codeType(t){return TYPES.indexOf(t)>=0;}
  function check(input,baseCheck){
    var errors=[];function fail(p,m){if(errors.length<100)errors.push({path:p,message:m});}
    function object(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
    function fields(v,keys,p){if(!object(v)){fail(p,'需要对象');return false;}Object.keys(v).forEach(function(k){if(keys.indexOf(k)<0)fail(p+'.'+k,'不支持此字段');});return true;}
    function text(v,p,max,empty){if(typeof v!=='string'||(max===65536||max===16384?new TextEncoder().encode(v).length:v.length)>max||(!empty&&!v.trim())){fail(p,'文本缺失或超出长度限制');return '';}return v;}
    function list(v,p,max,min){if(!Array.isArray(v)||v.length<(min===undefined?1:min)||v.length>max){fail(p,'数组数量不符合限制');return [];}return v;}
    if(input.version!==1)fail('题包.version','study-pack仅支持版本1');
    if(new TextEncoder().encode(JSON.stringify(input)).length>2*1024*1024)fail('题包大小','题包超过2MiB限制');
    var synthetic=JSON.parse(JSON.stringify(input)),normalized=[];synthetic.format='cquiz-objective-pack';synthetic.version=3;
    if(Array.isArray(synthetic.papers))synthetic.papers.forEach(function(p,i){
      var raw=input.papers[i];normalized[i]=[];if(!p||typeof p!=='object')return;
      if(!Array.isArray(p.questions))return;
      p.questions=p.questions.map(function(q,j){
        if(!q||!codeType(q.type))return q;
        var at='试卷'+(i+1)+'第'+(j+1)+'题',kind=q.type;
        var allowed=['num','type','stem','topic','tags','analysis','images','points'];
        allowed=allowed.concat(kind==='code_blank'?['code','blanks','pitfall','legacy_note','blank_analysis']:kind==='fix'?['code','faults','tests','quirks']:['input','output','rangeNote','starter','examples','tests','provenance','title']);
        fields(q,allowed,at);if(q.group!==undefined)fail(at,'程序类题目本版不支持小问分组');
        var item={type:kind};
        if(kind==='code_blank'||kind==='fix')item.code=text(q.code,at+'代码',65536,false).replace(/\r\n?/g,'\n');
        if(kind==='code_blank'){
          item.blanks=[];var seen=Object.create(null);
          list(q.blanks,at+'空位',20).forEach(function(b,k){var p=at+'空位'+(k+1);if(!fields(b,['num','answers'],p))return;
            if(!Number.isInteger(b.num)||b.num<1||b.num>999||seen[b.num])fail(p,'空位编号须为1至999的唯一整数');seen[b.num]=true;
            var answers=list(b.answers,p+'候选',20).map(function(a){return text(a,p+'答案',1000,false);});item.blanks.push({num:b.num,answers:answers});
          });
          var markers=Array.from(new Set((item.code.match(/___\d+___/g)||[]).map(function(s){return Number(s.slice(3,-3));})));
          if(JSON.stringify(markers)!==JSON.stringify(item.blanks.map(function(b){return b.num;})))fail(at+'代码','___编号___须按首次出现顺序与blanks编号完整对应');
          if(q.blank_analysis!==undefined)item.blank_analysis=list(q.blank_analysis,at+'逐空解析',20,0).map(function(a){if(!fields(a,['num','explanation'],at+'逐空解析'))return {};if(!seen[a.num])fail(at,'逐空解析编号不存在');return {num:a.num,explanation:text(a.explanation,at+'逐空解析',20000,false)};});
          ['pitfall','legacy_note'].forEach(function(k){if(q[k]!==undefined)item[k]=text(q[k],at+k,20000,true);});
        }else if(kind==='fix'){
          item.faults=[];var lines=item.code.split('\n'),seen=Object.create(null);
          list(q.faults,at+'错处',30).forEach(function(f,k){var p=at+'错处'+(k+1);if(!fields(f,['line','original','fixed','reason','alternatives'],p))return;
            var original=text(f.original,p+'原行',10000,false),fixed=text(f.fixed,p+'参考行',10000,false);
            if(!Number.isInteger(f.line)||f.line<1||f.line>lines.length||seen[f.line]||lines[f.line-1]!==original)fail(p,'错行须唯一且与代码指定行完全对应');seen[f.line]=true;
            if(/[\r\n]/.test(original)||/[\r\n]/.test(fixed))fail(p,'参考改法须保持单行');
            var fault={line:f.line,original:original,fixed:fixed,reason:text(f.reason,p+'原因',4000,false)};
            if(f.alternatives!==undefined)fault.alternatives=list(f.alternatives,p+'等价行',20,0).map(function(a){if(!fields(a,['code','reason','category'],p+'等价行'))return {};var code=text(a.code,p+'等价代码',10000,false);if(/[\r\n]/.test(code))fail(p,'等价行不能换行');return {code:code,reason:text(a.reason,p+'等价依据',4000,false),category:a.category===undefined?'':text(a.category,p+'分类',100,true)};});
            item.faults.push(fault);
          });
          item.tests=list(q.tests,at+'测试点',200,0).map(function(t){if(!fields(t,['stdin','expect','source','compare'],at+'测试点'))return {};var compare=t.compare===undefined?'exact':t.compare;if(['exact','contains'].indexOf(compare)<0)fail(at,'测试比较仅支持exact或contains');return {stdin:text(t.stdin,at+'输入',16384,true),expect:text(t.expect,at+'预期输出',65536,true),source:t.source===undefined?'题包提供':text(t.source,at+'测试来源',200,true),compare:compare};});
          if(q.quirks!==undefined&&q.quirks!==null){
            var v=q.quirks;fields(v,['encodingSensitive','executionEncoding','unjudgeable','droppedTests'],at+'限制');item.quirks={};
            if(v.executionEncoding!==undefined){
              if(['gbk','utf-8'].indexOf(v.executionEncoding)<0)fail(at+'执行编码','仅支持gbk或utf-8');
              else item.quirks.executionEncoding=v.executionEncoding;
            }
            if(v.encodingSensitive!==undefined)item.quirks.encodingSensitive=text(v.encodingSensitive,at+'编码限制',10000,false);
            if(v.unjudgeable!==undefined){fields(v.unjudgeable,['reason','scope'],at+'运行限制');if(v.unjudgeable.scope!=='run')fail(at,'限制scope仅支持run');item.quirks.unjudgeable={reason:text(v.unjudgeable.reason,at+'限制原因',10000,false),scope:'run'};}
            if(v.droppedTests!==undefined)item.quirks.droppedTests=list(v.droppedTests,at+'历史测试记录',200,0).map(function(t){if(!fields(t,['stdin','expect','source','paperExpect'],at+'历史测试'))return {};return {stdin:text(t.stdin,at+'历史输入',16384,true),expect:text(t.expect,at+'历史输出',65536,true),source:text(t.source,at+'来源',200,true),paperExpect:t.paperExpect==null?null:text(t.paperExpect,at+'原稿输出',65536,true)};});
          }else item.quirks=null;
        }else{
          if(q.title!==undefined)item.title=text(q.title,at+'标题',100,false);
          item.starter=text(q.starter,at+'初始代码',65536,true);item.input=text(q.input,at+'输入说明',10000,false);item.output=text(q.output,at+'输出说明',10000,false);item.rangeNote=q.rangeNote===undefined?'':text(q.rangeNote,at+'范围',10000,true);
          item.examples=list(q.examples,at+'样例',10,0).map(function(t){if(!fields(t,['stdin','stdout','id','kind'],at+'样例'))return {};var meta={};['id','kind'].forEach(function(k){if(t[k]!==undefined)meta[k]=text(t[k],at+'样例'+k,120,false);});return Object.assign(meta,{stdin:text(t.stdin,at+'输入',16384,true),stdout:text(t.stdout,at+'输出',65536,true)});});
          var seen=Object.create(null);item.tests=list(q.tests,at+'测试点',32).map(function(t){if(!fields(t,['id','stdin','stdout','stdoutAlternatives','kind','tags','basis'],at+'测试点'))return {};var id=text(t.id,at+'测试标识',120,false);if(seen[id])fail(at,'测试标识重复');seen[id]=true;var meta={};if(t.stdoutAlternatives!==undefined)meta.stdoutAlternatives=list(t.stdoutAlternatives,at+'候选输出',3).map(function(value){return text(value,at+'候选输出',65536,true);});if(t.tags!==undefined)meta.tags=list(t.tags,at+'测试标签',20,0).map(function(x){return text(x,at+'标签',100,false);});if(t.basis!==undefined)meta.basis=text(t.basis,at+'测试依据',10000,true);return Object.assign(meta,{id:id,stdin:text(t.stdin,at+'输入',16384,true),stdout:text(t.stdout,at+'输出',65536,true),kind:t.kind===undefined?'derived':text(t.kind,at+'测试类别',100,false)});});
          if(q.provenance!==undefined)item.provenance=text(q.provenance,at+'溯源',20000,true);
          delete item.code;
        }
        normalized[i][j]=item;
        var placeholder={};['num','stem','topic','tags','analysis','images','points'].forEach(function(k){if(q[k]!==undefined)placeholder[k]=q[k];});
        placeholder.type='single';placeholder.options={A:'格式校验占位',B:'格式校验占位'};placeholder.answer='A';return placeholder;
      });
    });
    var result=baseCheck(synthetic);if(!result.ok)return result;
    result.pack.format='cquiz-study-pack';result.pack.version=1;
    result.pack.papers.forEach(function(p,i){p.questions=p.questions.map(function(q,j){var code=normalized[i][j];if(!code)return q;delete q.options;delete q.answer;return Object.assign(q,code);});});
    result.summary.programQuestions=0;result.summary.total=0;result.pack.papers.forEach(function(p){p.questions.forEach(function(q){if(q.type==='program')result.summary.programQuestions++;else result.summary.total+=Math.round((q.points===undefined?p.pointsPerQuestion:q.points)*100);});});result.summary.total/=100;
    return errors.length?{ok:false,errors:errors}:result;
  }
  function papers(pack,basePapers){
    var objective=Object.assign({},pack,{format:'cquiz-objective-pack',version:3,papers:pack.papers.map(function(p){return Object.assign({},p,{questions:p.questions.filter(function(q){return !codeType(q.type);})});})});
    var out=basePapers(objective);
    out.forEach(function(p,i){var source=pack.papers[i];p.codeBlankQuestions=[];p.fixQuestions=[];p.programQuestions=[];
      source.questions.forEach(function(q){if(!codeType(q.type))return;var points=q.points===undefined?source.pointsPerQuestion:q.points,imgs={names:q.images.map(function(im){return im.name;}),data:q.images.map(function(im){return im.data;})};
        var item={num:q.num,stem:q.stem,topic:q.topic,tags:q.tags,analysis:q.analysis,imgs:imgs};
        if(q.type==='code_blank'){Object.assign(item,{code:q.code,blankNums:q.blanks.map(function(b){return b.num;}),answers:q.blanks.map(function(b){return b.answers.slice();}),per:points/q.blanks.length,total:points,pitfall:q.pitfall||'',legacy_note:q.legacy_note||'',blank_analysis:q.blank_analysis||[]});p.codeBlankQuestions.push(item);}
        else if(q.type==='fix'){Object.assign(item,{paper:p.id,key:p.id+'#x'+q.num,id:source.title+' 改错'+q.num,no:q.num,code:q.code,original:q.code,codeStart:1,faults:q.faults,tests:q.tests,quirks:q.quirks,errorCount:q.faults.length,fixScore:points,fixPer:points/q.faults.length});p.fixQuestions.push(item);}
        else {Object.assign(item,{id:p.id+'#p'+q.num,points:points,title:q.title||source.title+' · '+q.stem,statement:q.stem,input:q.input,output:q.output,rangeNote:q.rangeNote,starter:q.starter,examples:q.examples,tests:q.tests});p.programQuestions.push(item);}
      });
      if(p.codeBlankQuestions.length)p.blankQuestions=(p.blankQuestions||[]).concat(p.codeBlankQuestions);
      p.practiceOrder=source.questions.map(function(q){return q.type==='program'?{num:'p'+q.num,program:true}:q.type==='code_blank'||q.type==='blank'?{num:'b'+q.num,blank:true}:q.type==='fix'?{num:'x'+q.num,fix:true}:{num:q.num};});
      p.questionOrder=source.questions.filter(function(q){return q.type!=='program';}).map(function(q){return q.type==='code_blank'||q.type==='blank'?{num:'b'+q.num,blank:true}:q.type==='fix'?{num:'x'+q.num,fix:true}:{num:q.num};});
    });return out;
  }
  return {check:check,papers:papers,codeType:codeType};
})();
if(typeof module==='object'&&module.exports)module.exports=StudyPackSchema;
