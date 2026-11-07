// Runtime-only synthetic data; never bundled into the application.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CQUIZ_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..');
const app=path.resolve(process.env.CQUIZ_APP||path.join(root,'做题器.html')),url=pathToFileURL(app).href;
const fixture={format:'cquiz-choice-pack',version:1,id:'review-test',title:'Review test',source:'Synthetic UI test',revision:1,papers:[{
  id:'one',year:2026,title:'Test paper',code:'A',pointsPerQuestion:1,
  questions:Array.from({length:12},(_,i)=>({num:i+1,stem:'Question '+(i+1),options:{A:'One',B:'Two',C:'Three',D:'Four'},answer:'A',topic:'test',tags:['test'],analysis:'Synthetic analysis'}))
}]};
(async()=>{
 const browser=await chromium.launch({channel:process.env.CQUIZ_BROWSER||'msedge',headless:true});
 try{
  const context=await browser.newContext();
  await context.addInitScript(()=>window.__CQUIZ_TEST__=true);
  await context.route(/^https?:/,r=>r.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(url);
  await page.waitForFunction(()=>!!window.__cquiz);
  const button=name=>page.getByRole('button',{name,exact:true});
  const review=page.getByRole('dialog',{name:'审阅题目',exact:true});
  const field=name=>review.getByLabel(name,{exact:true});
  async function checkPack(pack){
   await page.evaluate(()=>__cquiz.questionPacks.open());
   await button('导入 / 更新题包').click();await button('粘贴JSON').click();
   await page.getByRole('textbox',{name:'粘贴题包JSON',exact:true}).fill(JSON.stringify(pack));
   await button('检查题包').click();
   await page.locator('.pack-state-ready').waitFor();
   assert.equal(await review.count(),0);
   assert.equal(await page.locator('.pack-review-field').count(),0);
   assert.match(await page.locator('.pack-import-panel .pack-status').innerText(),/使用前/);
  }
  for(const [style,theme,width] of [['classic','light',1440],['classic','dark',320],['nasa','light',320],['nasa','dark',1440]]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(({style,theme,width})=>{__cquiz.setPREF({uiStyle:style,theme,motion:false,fontSize:width===320?22:16});__cquiz.applyPref();},{style,theme,width});
   await checkPack(fixture);
   await button('审阅题目 Review test').focus();await page.keyboard.press('Enter');await review.waitFor();
   assert.equal(await field('题干').inputValue(),'Question 1');
   await button('下一题').click();assert.equal(await field('题干').inputValue(),'Question 2');
   await field('查找题目').fill('Question 12');assert.equal(await field('题干').inputValue(),'Question 12');
   await field('题型').selectOption('blank');assert.match(await review.locator('.pack-review-body').innerText(),/调整/);
   await field('题型').selectOption('all');
   const sizes=await review.evaluate(e=>[e.scrollWidth-e.clientWidth,e.querySelector('.pack-review-body').scrollWidth-e.querySelector('.pack-review-body').clientWidth]);
   assert.ok(sizes.every(n=>n<=1),JSON.stringify({style,theme,width,sizes}));
   await page.keyboard.press('Escape');await review.waitFor({state:'detached'});
   assert.equal(await button('审阅题目 Review test').evaluate(e=>document.activeElement===e),true);
   await button('返回选卷').click();
  }
  await checkPack(fixture);
  await button('审阅题目 Review test').click();
  await field('题干').fill('');
  await button('应用到待导入题包').click();
  await review.locator('.pack-review-status').filter({hasText:'题干'}).waitFor();
  await field('题干').fill('Reviewed stem');
  await field('选项 B').fill('Reviewed choice');
  await field('B 正确').check();
  await field('解析').fill('Reviewed explanation');
  await button('下一题').click();await button('上一题').click();
  assert.equal(await field('题干').inputValue(),'Reviewed stem');
  await button('应用到待导入题包').click();await review.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>__cquiz.questionPacks.installed().length),0);
  await button('确认导入').click();
  assert.equal(await page.locator('html').getAttribute('data-view'),'packs');
  assert.equal(await review.count(),0);
  assert.match(await page.locator('.pack-installed .pack-status').first().innerText(),/使用前/);
  const installed=()=>page.evaluate(()=>__cquiz.questionPacks.installed().find(p=>p.id==='review-test'));
  let saved=await installed(),q=saved.papers[0].questions[0];
  assert.deepEqual([q.stem,q.options.B,q.answer,q.analysis],['Reviewed stem','Reviewed choice','B','Reviewed explanation']);

  await page.evaluate(()=>__cquiz.scheduleAfter('pack:review-test:one',1,false));
  const records=await page.evaluate(()=>JSON.stringify(__cquiz.getREC()));
  await button('审阅题目 Review test').click();await field('A 正确').check();
  await button('保存修改').click();await button('确认更新').waitFor();
  assert.equal(await button('确认更新').isEnabled(),false);
  await page.keyboard.press('Escape');await review.waitFor();
  assert.equal(await field('A 正确').isChecked(),true);
  await page.keyboard.press('Escape');await review.waitFor({state:'detached'});
  assert.equal((await installed()).papers[0].questions[0].answer,'B');
  await button('审阅题目 Review test').click();await field('解析').fill('Retained records');
  await button('保存修改').click();await button('确认更新').click();
  saved=await installed();assert.equal(saved.revision,2);
  assert.equal(saved.papers[0].questions[0].analysis,'Retained records');
  assert.equal(await page.evaluate(()=>JSON.stringify(__cquiz.getREC())),records);

  const demo=JSON.parse(fs.readFileSync(path.join(root,'examples/demo-bank/示例题库.json'),'utf8'));
  await checkPack(demo);await button('审阅题目 '+demo.title).click();
  await field('试卷').selectOption('3');
  await field('题型').selectOption('code_blank');
  const code=await field('题目代码').inputValue();
  await field('题目代码').fill(code+'\n/* reviewed */');
  await field('题型').selectOption('fix');
  const fixed=await field('参考改法').first().inputValue();
  await field('参考改法').first().fill(fixed+' /* reviewed */');
  await field('题型').selectOption('program');
  await field('输出说明').fill('Reviewed output instructions');
  await button('应用到待导入题包').click();await review.waitFor({state:'detached'});
  await button('确认导入').click();
  const edited=await page.evaluate(id=>__cquiz.questionPacks.installed().find(p=>p.id===id),demo.id);
  assert.match(edited.papers[3].questions[0].code,/reviewed/);
  assert.match(edited.papers[3].questions[1].faults[0].fixed,/reviewed/);
  assert.equal(edited.papers[3].questions[2].output,'Reviewed output instructions');
  assert.deepEqual(errors,[]);
  console.log('PASS: on-demand review, mobile and keyboard, draft validation, persisted edits, safe installed updates and program fields.');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
