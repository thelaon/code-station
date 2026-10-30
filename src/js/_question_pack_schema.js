
var QuestionPackSchema=(function(){
  var MAX_BYTES=2*1024*1024, OPTION_KEYS='ABCDEFGH'.split('');
  function optionKeys(q){return OPTION_KEYS.filter(function(k){return q&&q.options&&Object.prototype.hasOwnProperty.call(q.options,k);});}
  function bytes(text){
    var n=0;for(var i=0;i<text.length;i++){var c=text.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;
  }
  function points(p,q){return q.points===undefined?p.pointsPerQuestion:q.points;}
  function groupOf(p,q){return q.group&&p&&p.groups?(p.groups.filter(function(g){return g.id===q.group.id;})[0]||null):null;}
  function questionNumber(q,p){var g=q&&q.group&&(q.group.num?q.group:groupOf(p,q));return g?String(g.num)+'('+q.group.part+')':String(q.num);}
  function object(x){return !!x && typeof x==='object' && !Array.isArray(x);}
  function imageDimensions(s,png){
    function n(i){return s.charCodeAt(i);}function u16(i){return n(i)*256+n(i+1);}function u32(i){return n(i)*16777216+n(i+1)*65536+n(i+2)*256+n(i+3);}
    if(png){
      if(s.length<45||u32(8)!==13||s.slice(12,16)!=='IHDR')return null;
      var size={width:u32(16),height:u32(20)},pos=8,idat=false;
      while(pos+12<=s.length){var len=u32(pos),kind=s.slice(pos+4,pos+8);if(len>s.length-pos-12)return null;if(kind==='IDAT')idat=true;pos+=len+12;if(kind==='IEND')return idat&&len===0&&pos===s.length?size:null;}
      return null;
    }
    if(s.slice(-2)!=='\xff\xd9')return null;
    var at=2;
    while(at+4<s.length){
      if(n(at++)!==255)return null;while(n(at)===255)at++;var marker=n(at++);
      if(marker===0xda||marker===0xd9)return null;
      if(marker===1||marker>=0xd0&&marker<=0xd7)continue;
      var length=u16(at);if(length<2||at+length>s.length)return null;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].indexOf(marker)>=0)return length>=8?{width:u16(at+5),height:u16(at+3)}:null;
      at+=length;
    }
    return null;
  }
  function studySchema(){return typeof StudyPackSchema!=='undefined'?StudyPackSchema:typeof require==='function'?require('./_study_pack_schema.js'):null;}
  function check(input){
    if(input&&input.format==='cquiz-study-pack'){var extension=studySchema();return extension?extension.check(input,check):{ok:false,errors:[{path:'题包格式',message:'程序题包加载器不可用，请更新代码航站'}]};}
    var errors=[],count=0,images=0,nums=Object.create(null),pack,mixed=input&&input.format==='cquiz-objective-pack',grouped=mixed&&input.version===3,dynamic=mixed&&(input.version===2||grouped);
    function fail(path,message){if(errors.length<100)errors.push({path:path,message:message});}
    function fields(x,allowed,path){if(!object(x)){fail(path,'需要一个对象');return false;}Object.keys(x).forEach(function(k){if(allowed.indexOf(k)<0)fail(path+'.'+k,'不支持此字段，请核对模板');});return true;}
    function string(x,path,max){if(typeof x!=='string'||!x.trim()||x.length>max){fail(path,'请填写1至'+max+'字的文本');return '';}return x.trim();}
    function slug(x,path){if(typeof x!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(x)||/^(constructor|prototype)$/.test(x)){fail(path,'标识须为小写字母开头，使用字母、数字或短横线，最长60字符');return '';}return x;}
    function validPoints(v){return Number.isFinite(v)&&v>0&&v<=100&&Math.abs(v*100-Math.round(v*100))<0.000001;}
    function readImages(raw,at){
      var result=[];if(raw===undefined)return result;
      if(!Array.isArray(raw)||raw.length>4){fail(at+'插图','最多4张内嵌PNG/JPEG图片');return result;}
      raw.forEach(function(im,k){
        var ip=at+'插图'+(k+1);if(!fields(im,['name','data'],ip))return;
        var name=string(im.name,ip+'名称',120),data=im.data;
        if(typeof data!=='string'||data.length>360000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)){fail(ip,'需要有效的PNG/JPEG内嵌图片，每张不超过约256KB');return;}
        var decoded;try{decoded=atob(data.split(',')[1]);}catch(e){fail(ip,'图片Base64无法解码');return;}
        var png=data.indexOf('data:image/png;')===0;
        if(png?decoded.slice(0,8)!=='\x89PNG\r\n\x1a\n':decoded.slice(0,3)!=='\xff\xd8\xff'){fail(ip,'图片内容与PNG/JPEG格式不一致');return;}
        var size=imageDimensions(decoded,png);if(!size||!size.width||!size.height||size.width>4096||size.height>4096){fail(ip,'图片结构不完整或尺寸过大，长宽须为1至4096像素');return;}
        result.push({name:name,data:data});images++;
      });return result;
    }
    if(!fields(input,['format','version','id','title','subtitle','revision','source','papers'],'题包'))return {ok:false,errors:errors};
    if((input.format!=='cquiz-choice-pack'&&!mixed)||(input.version!==1&&!dynamic))fail('题包.format/version','题包格式或版本不受支持：支持choice-pack版本1、objective-pack版本1/2/3；较新题包请更新代码航站');
    pack={format:mixed?'cquiz-objective-pack':'cquiz-choice-pack',version:input.version,id:slug(input.id,'题包.id'),title:string(input.title,'题库名称',100),subtitle:input.subtitle===undefined||input.subtitle===''?'':string(input.subtitle,'题库副标题',100),revision:input.revision,source:string(input.source,'来源说明',500),papers:[]};
    if(pack.id==='builtin')fail('题包.id','builtin为内置题库保留标识');
    if(!Number.isInteger(pack.revision)||pack.revision<1||pack.revision>1000000)fail('题包.revision','修订号须为1至1000000的整数');
    if(!Array.isArray(input.papers)||!input.papers.length||input.papers.length>100)fail('题包.papers','需要1至100套试卷');
    else input.papers.forEach(function(p,i){
      var path='试卷'+(i+1)+(p&&typeof p.title==='string'?'「'+p.title+'」':'');
      if(!fields(p,['id','title','year','code','pointsPerQuestion','questions'].concat(grouped?['groups']:[]),path))return;
      var paper={id:slug(p.id,path+'.id'),title:string(p.title,path+'名称',100),year:p.year==null?null:p.year,code:string(p.code,path+'代号',12),pointsPerQuestion:p.pointsPerQuestion,questions:[]};
      if(nums[paper.id])fail(path+'.id','试卷标识重复');nums[paper.id]=true;
      if(p.year!=null&&(!Number.isInteger(p.year)||p.year<1900||p.year>2199))fail(path+'年份','年份须为1900至2199的整数；无年份可省略或填null');
      if(!Number.isFinite(p.pointsPerQuestion)||p.pointsPerQuestion<=0||p.pointsPerQuestion>100||Math.abs(p.pointsPerQuestion*100-Math.round(p.pointsPerQuestion*100))>0.000001)fail(path+'每题分值','须为大于0且不超过100的数，最多两位小数');
      var seen=Object.create(null),groups=Object.create(null),uses=Object.create(null);
      if(grouped){
        paper.groups=[];
        if(p.groups!==undefined&&(!Array.isArray(p.groups)||p.groups.length>1000))fail(path+'共用题干','groups须为最多1000组的数组');
        else (p.groups||[]).forEach(function(g,i){
          var at=path+'题组'+(i+1);if(!fields(g,['id','num','stem','images','points'],at))return;
          var item={id:slug(g.id,at+'.id'),num:g.num,stem:string(g.stem,at+'共用题干',20000),points:g.points,images:readImages(g.images,at)};
          if(groups[item.id])fail(at+'.id','题组标识重复');
          if(!Number.isInteger(item.num)||item.num<1||item.num>99999)fail(at+'原题号','须为1至99999的整数');
          if(paper.groups.some(function(a){return a.num===item.num;}))fail(at+'原题号','题组原题号重复');
          if(!validPoints(item.points))fail(at+'总分','总分须大于0且不超过100，最多两位小数');
          groups[item.id]=item;uses[item.id]=[];paper.groups.push(item);
        });
      }
      if(!Array.isArray(p.questions)||!p.questions.length||p.questions.length>2000){fail(path+'.questions','需要1至2000道选择题');return;}
      p.questions.forEach(function(q,j){
        count++;var at=path+'第'+(j+1)+'题';
        var kind=mixed&&q?q.type:'single';
        if(mixed&&['single','multiple','blank'].indexOf(kind)<0)fail(at+'题型','type须为single、multiple或blank');
        if(!fields(q,(kind==='blank'?['num','stem','blanks','topic','tags','analysis','images']:['num','stem','options','answer','topic','tags','analysis','images']).concat(mixed?['type']:[]).concat(grouped?['points','group']:[]),at))return;
        if(!Number.isInteger(q.num)||q.num<1||q.num>99999)fail(at+'题号','须为1至99999的整数');
        if(seen[q.num])fail(at+'题号','同一试卷内题号重复');seen[q.num]=true;
        var question={num:q.num,stem:string(q.stem,at+'题干',20000),topic:string(q.topic,at+'知识点',80),tags:[],analysis:string(q.analysis,at+'解析',20000),images:[]};
        if(mixed)question.type=kind;
        if(grouped){
          if(q.points!==undefined){if(!validPoints(q.points))fail(at+'分值','须大于0且不超过100，最多两位小数');else question.points=q.points;}
          if(q.group!==undefined&&fields(q.group,['id','part'],at+'小问关联')){
            var gid=slug(q.group.id,at+'题组标识');question.group={id:gid,part:q.group.part};
            if(!groups[gid])fail(at+'题组标识','引用的共用题干不存在');
            if(!Number.isInteger(q.group.part)||q.group.part<1||q.group.part>20)fail(at+'小问序号','须为1至20的整数');
            if(q.points===undefined)fail(at+'分值','小问必须明确填写points，不自动使用整题默认分值');
            if(uses[gid])uses[gid].push({index:j,part:q.group.part,points:q.points});
          }
        }
        if(kind==='blank'){
          question.blanks=[];
          if(!Array.isArray(q.blanks)||!q.blanks.length||q.blanks.length>20)fail(at+'空位','需要1至20个空位');
          else q.blanks.forEach(function(b,k){
            var where=at+'第'+(k+1)+'空';if(!fields(b,['mode','answers','tolerance'],where))return;
            var blank={mode:b.mode,answers:[]};
            if(b.mode!=='text'&&b.mode!=='number')fail(where+'匹配方式','mode须为text或number');
            if(!Array.isArray(b.answers)||!b.answers.length||b.answers.length>20)fail(where+'候选','需要1至20个非空答案文本');
            else b.answers.forEach(function(a,j){var answer=string(a,where+'候选'+(j+1),1000);blank.answers.push(answer);if(b.mode==='number'&&!numeric(answer))fail(where+'候选','数值答案须为有限十进制数，可用科学计数法，不含单位或表达式');});
            if(b.mode==='number'){
              blank.tolerance=b.tolerance===undefined?0:b.tolerance;
              if(!Number.isFinite(blank.tolerance)||blank.tolerance<0)fail(where+'误差','tolerance须为有限非负绝对误差');
            }else if(b.tolerance!==undefined)fail(where+'误差','文本空不能设置数值误差');
            question.blanks.push(blank);
          });
        }else{
          question.options={};question.answer=q.answer;
          var keys=dynamic?optionKeys(q):OPTION_KEYS.slice(0,4);
          if(fields(q.options,dynamic?OPTION_KEYS:keys,at+'选项')){
            if(dynamic&&(keys.length<2||keys.length>8||keys.join('')!=='ABCDEFGH'.slice(0,keys.length)))fail(at+'选项','版本2须有2至8个连续选项，从A开始，不可跳号');
            keys.forEach(function(k){question.options[k]=string(q.options[k],at+'选项'+k,10000);});
          }
          if(kind==='multiple'){
            if(!Array.isArray(q.answer)||q.answer.length<(dynamic?1:2)||q.answer.length>keys.length||q.answer.some(function(v){return typeof v!=='string'||keys.indexOf(v)<0;})||new Set(q.answer).size!==q.answer.length)fail(at+'正确答案',dynamic?'多选答案须为本题实际选项中1至8个不重复大写字母的数组':'多选答案须为2至4个不重复的大写A—D字母组成的数组');
            else question.answer=q.answer.slice().sort();
          }else if(typeof q.answer!=='string'||keys.indexOf(q.answer)<0)fail(at+'正确答案','单选答案必须是本题实际存在的一个大写选项字母');
        }
        if(!Array.isArray(q.tags)||!q.tags.length||q.tags.length>20)fail(at+'标签','需要1至20个标签');
        else q.tags.forEach(function(t,k){question.tags.push(string(t,at+'标签'+(k+1),80));});
        question.images=readImages(q.images,at);
        paper.questions.push(question);
      });
      if(grouped)paper.groups.forEach(function(g){
        var list=uses[g.id]||[],at=path+'题组「'+g.id+'」';
        if(list.length<2||list.length>20)fail(at,'每组必须有2至20个独立小问');
        if(list.some(function(x,i){return x.part!==i+1||(i>0&&x.index!==list[i-1].index+1);}))fail(at,'同组小问必须在questions中连续出现，part按1开始连续排列');
        if(list.reduce(function(n,x){return n+Math.round(x.points*100);},0)!==Math.round(g.points*100))fail(at+'分值','小问分值之和必须等于题组总分');
        if(paper.questions.some(function(q){return !q.group&&q.num===g.num;}))fail(at+'原题号','原题号与独立题的显示题号冲突');
      });
      pack.papers.push(paper);
    });
    if(count>2000)fail('题包总题数','第一版每个题包最多2000题');
    if(bytes(JSON.stringify(input))>MAX_BYTES)fail('题包大小','题包超过2MB限制，请拆分或压缩插图');
    return errors.length?{ok:false,errors:errors}:{ok:true,errors:[],pack:pack,summary:{papers:pack.papers.length,questions:count,images:images,total:Math.round(pack.papers.reduce(function(n,p){return n+p.questions.reduce(function(n,q){return n+Math.round(points(p,q)*100);},0)/100;},0)*100)/100}};
  }
  function parse(text){
    if(typeof text!=='string'||bytes(text)>MAX_BYTES)return {ok:false,errors:[{path:'题包文件',message:'文件过大或不是文本，最多2MB'}]};
    try{return check(JSON.parse(text.replace(/^\uFEFF/,'')));}catch(e){return {ok:false,errors:[{path:'题包文件',message:'无法读取JSON，请检查括号、逗号和引号'}]};}
  }
  function decimalParts(s){
    if(typeof s!=='string'||s.length>1000)return null;
    s=s.trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)||!Number.isFinite(Number(s)))return null;
    var negative=s[0]==='-',parts=s.replace(/^[+-]/,'').split(/[eE]/),mantissa=parts[0],dot=mantissa.indexOf('.'),digits=mantissa.replace('.','').replace(/^0+/,'');
    if(!digits)return {digits:'0',scale:0};
    var exponent=parts[1]?Number(parts[1]):0;if(!Number.isSafeInteger(exponent)||Math.abs(exponent)>4000||Number(s)===0)return null;
    var scale=(dot<0?0:mantissa.length-dot-1)-exponent;
    while(digits.slice(-1)==='0'){digits=digits.slice(0,-1);scale--;}
    return {digits:(negative?'-':'')+digits,scale:scale};
  }
  function numeric(s){return !!decimalParts(s);}
  function papers(pack){if(pack.format==='cquiz-study-pack')return studySchema().papers(pack,papers);return pack.papers.map(function(p){
    var choice=[],blanks=[];
    p.questions.forEach(function(q){
      var item={num:q.num,stem:q.stem,topic:q.topic,tags:q.tags,analysis:q.analysis,imgs:{names:q.images.map(function(i){return i.name;}),data:q.images.map(function(i){return i.data;})}};
      if(pack.version===3){
        item.points=points(p,q);var g=groupOf(p,q);
        if(g)item.group={id:g.id,num:g.num,part:q.group.part,count:p.questions.filter(function(x){return x.group&&x.group.id===g.id;}).length,stem:g.stem,imgs:{names:g.images.map(function(i){return i.name;}),data:g.images.map(function(i){return i.data;})}};
      }
      if(q.type==='blank'){
        item.normal=true;item.rules=q.blanks;item.blankNums=q.blanks.map(function(b,i){return i+1;});item.answers=q.blanks.map(function(b){return b.answers.slice();});
        item.per=points(p,q)/q.blanks.length;item.total=points(p,q);item.code=item.blankNums.map(function(n){return '第'+n+'空：___'+n+'___';}).join('\n');
        item.pitfall='文本仅忽略首尾空白，保留大小写和内部空格；数值须为十进制数，不填写单位或计算式。';
        item.blank_analysis=q.blanks.map(function(b,i){return {num:i+1,explanation:b.mode==='number'?'按数值比较，允许的绝对误差为'+b.tolerance+'。':'按文本比较，仅忽略首尾空白。'};});blanks.push(item);
      }else{item.options=q.options;item.answer=Array.isArray(q.answer)?q.answer.join(''):q.answer;if(q.type==='multiple')item.type='multiple';choice.push(item);}
    });
    var result={id:'pack:'+pack.id+':'+p.id,label:p.title,code:p.code,year:p.year,libraryId:pack.id,count:choice.length,per:p.pointsPerQuestion,total:Math.round(choice.reduce(function(n,q){return n+(q.points===undefined?p.pointsPerQuestion:q.points)*100;},0))/100,questions:choice};
    if(pack.version===3)result.questionOrder=p.questions.map(function(q){return q.type==='blank'?{num:'b'+q.num,blank:true}:{num:q.num};});
    if(blanks.length)result.blankQuestions=blanks;return result;
  });}
  return {parse:parse,check:check,papers:papers,optionKeys:optionKeys,points:points,groupOf:groupOf,questionNumber:questionNumber,decimalParts:decimalParts,MAX_BYTES:MAX_BYTES};
})();
if(typeof module==='object'&&module.exports)module.exports=QuestionPackSchema;
