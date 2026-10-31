const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.CQUIZ_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),current=fs.readFileSync(process.env.CQUIZ_APP||path.join(root,'做题器.html'),'utf8'),previous=process.argv[2]||path.join(root,'dist/upgrade-check/previous.html');
const actualOld=fs.existsSync(previous),old=actualOld?fs.readFileSync(previous,'utf8'):current.replace('// A different build identifies an upgrade, never permission to delete user data.',"if(DATA_BUILD!=='dev'&&localStorage.getItem(DATA_BUILD_KEY)!==DATA_BUILD)clearStoredUserData();").replace('CQStorage.checkSchema();recoverPackTransaction();CQStorage.adoptSchema(DATA_BUILD);','recoverPackTransaction();');
const url='http://upgrade-test.invalid/app.html';
const pack={format:'cquiz-choice-pack',version:1,id:'upgrade',title:'Upgrade fixture',source:'Synthetic',revision:1,papers:[{id:'p',title:'Test',year:2026,code:'A',pointsPerQuestion:1,questions:[{num:1,stem:'One',options:{A:'a',B:'b',C:'c',D:'d'},answer:'A',topic:'test',tags:['test'],analysis:'test'}]}]};
(async()=>{const browser=await chromium.launch({channel:process.env.CQUIZ_BROWSER||'msedge',headless:true});const checks=[];try{
  async function setup(html=old){let body=html;const c=await browser.newContext({acceptDownloads:true});await c.addInitScript(()=>window.__CQUIZ_TEST__=true);await c.route('**/*',route=>route.request().url()===url?route.fulfill({contentType:'text/html',body}):route.abort());const p=await c.newPage();p.on('dialog',d=>d.accept());await p.goto(url);await p.waitForFunction(()=>window.__cquiz);return {c,p,set:v=>body=v};}
  {
    const {c,p,set}=await setup();await p.evaluate(pack=>__cquiz.questionPacks.install(pack),pack);await p.evaluate(()=>__cquiz.startExam('pack:upgrade:p',60));await p.locator('.opt').first().click();await p.getByRole('button',{name:'交卷',exact:true}).click();
    const before=await p.evaluate(()=>{localStorage.setItem('cqframe.guide.seen.v1','1');localStorage.setItem('cqframe.fix.pack:upgrade:p#x1','opaque draft');localStorage.setItem('cqframe.programming.v1',JSON.stringify({drafts:{'pack:upgrade:p#p1':{code:'int main(void){return 0;}'}}}));localStorage.setItem('unrelated.app','keep');return Object.fromEntries(Object.keys(localStorage).filter(k=>k!=='cqframe.build.v1').map(k=>[k,localStorage.getItem(k)]));});
    set(current);await p.reload();await p.waitForFunction(()=>window.__cquiz);
    const after=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
    for(const [k,v]of Object.entries(before))assert.equal(after[k],v,k);assert.equal(after['cqframe.storage-schema.v1'],'1');assert.equal(await p.evaluate(()=>__cquiz.getEXAMS().length),1);
    await p.reload();await p.waitForFunction(()=>window.__cquiz);assert.equal(await p.evaluate(()=>__cquiz.questionPacks.installed().length),1);
    set(current.replace(/var DATA_BUILD = '[^']+';/,"var DATA_BUILD = 'another-compatible-build';"));await p.reload();await p.waitForFunction(()=>window.__cquiz);assert.equal(await p.evaluate(()=>__cquiz.getEXAMS().length),1);
    checks.push((actualOld?'actual previous build':'legacy-reset fixture')+' upgrade preserves every stored data key; reload and compatible build change retain records');await c.close();
  }
  {
    const {c,p,set}=await setup();await p.evaluate(pack=>__cquiz.questionPacks.install(pack),pack);await p.evaluate(()=>__cquiz.startExam('pack:upgrade:p',60));await p.locator('.opt').first().click();const before=await p.evaluate(()=>__cquiz.getSESSION().exam.deadline||__cquiz.getSESSION().exam);set(current);await p.reload();await p.waitForFunction(()=>window.__cquiz);assert.equal(await p.evaluate(()=>__cquiz.getSESSION().done),false);assert.equal(await p.locator('.exam-sheet .answered').count(),1);assert.deepEqual(await p.evaluate(()=>__cquiz.getSESSION().exam.deadline||__cquiz.getSESSION().exam),before);checks.push('active exam retains answers and original deadline across upgrade');await c.close();
  }
  for(const marker of ['2','invalid']){
    const {c,p}=await setup(current);await p.evaluate(marker=>{localStorage.setItem('cqframe.storage-schema.v1',marker);localStorage.setItem('cqframe.packs.v1','original raw data');},marker);await p.reload();await p.locator('#storage-recovery').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.packs.v1')),'original raw data');assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.storage-schema.v1')),marker);checks.push('unsupported schema '+marker+' stops safely without deleting stored data');await c.close();
  }
  {
    const {c,p,set}=await setup();await p.evaluate(()=>{localStorage.setItem('cqframe.marks.v1','{"keep":true}');localStorage.setItem('cqframe.pack-txn.v1',JSON.stringify({format:'cquiz-pack-transaction',before:[['cqframe.marks.v1','{}']]}));});set(current);await p.reload();await p.waitForFunction(()=>window.__cquiz);assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.marks.v1')),'{}');assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.pack-txn.v1')),null);checks.push('interrupted pack transaction recovers before upgrade metadata is committed');await c.close();
  }
  {
    const {c,p,set}=await setup();await p.evaluate(pack=>__cquiz.questionPacks.install(pack),pack);const before=await p.evaluate(()=>localStorage.getItem('cqframe.packs.v1'));await c.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cqframe.storage-schema.v1')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v);};});set(current);await p.reload();await p.locator('#storage-recovery').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.packs.v1')),before);assert.equal(await p.evaluate(()=>localStorage.getItem('cqframe.storage-schema.v1')),null);checks.push('failed upgrade marker write retains original data and never pretends migration completed');await c.close();
  }
  console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
