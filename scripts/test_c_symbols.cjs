'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {chromium}=require('./browser-tools.cjs'),root=path.resolve(__dirname,'..');
const html=path.resolve(process.env.CQUIZ_APP||path.join(root,'做题器.html')),channel=process.argv[2]||'msedge';
const report={channel,htmlSha256:crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),rows:[],errors:[],network:[]};
const jobs=[];
for(const type of ['float','double','long double'])for(const nested of [false,true])for(const pointer of [false,true]){
 let body=`${type} f(${type});${type} x=2.5;`;
 if(pointer)body+=`${type} (*p)(${type})=f;`;
 body+=`if(${pointer?'p':'f'}(x)!=3.75)return 1;puts("ok");`;
 jobs.push({id:`${type}-${nested}-${pointer}`,code:'#include <stdio.h>\nint main(void){'+(nested?'{'+body+'}':body)+'return 0;}'+type+' f('+type+' x){return x+1.25;}'});
}
(async()=>{let browser;try{
 browser=await chromium.launch({channel,headless:true});const context=await browser.newContext({offline:true}),page=await context.newPage();
 context.on('request',r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>window.CQuizProgrammingRuntime);
 for(const j of jobs){const result=await page.evaluate(j=>CQuizProgrammingRuntime.execute({protocol:1,requestId:j.id,code:j.code,tests:[{id:'a',stdin:''}]}),j);
  const c=result.cases?.[0];const passed=result.status==='completed'&&c?.status==='completed'&&c.exitCode===0&&c.stdout==='ok\n'&&!c.stderr;
  report.rows.push({id:j.id,passed,result});assert.ok(passed,j.id+' '+result.diagnostics);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.ok=true;
}catch(e){report.error=e.stack;process.exitCode=1;}finally{await browser?.close();
 if(process.env.CQUIZ_REPORT_DIR){fs.mkdirSync(process.env.CQUIZ_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.CQUIZ_REPORT_DIR,'c-symbols-'+channel+'.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));}
})();
