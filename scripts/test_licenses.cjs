const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require(process.env.CQUIZ_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.resolve(process.argv[2]||path.join(root,'做题器.html'))).href;
const isPublic=fs.readFileSync(path.resolve(process.argv[2]||path.join(root,'做题器.html')),'utf8').includes("var APP_PROFILE = 'public';");
(async()=>{
  const browser=await chromium.launch({channel:process.env.CQUIZ_BROWSER||'msedge',headless:true});
  const report={layouts:[],errors:[],requests:[]};
  try{
    const context=await browser.newContext();await context.addInitScript(()=>window.__CQUIZ_TEST__=true);
    await context.route(/^https?:/,r=>{report.requests.push(r.request().url());return r.abort();});
    const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.__cquiz);
    for(const style of ['classic','nasa'])for(const theme of ['light','dark'])for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:950});
      await page.evaluate(({style,theme})=>{__cquiz.setPREF({uiStyle:style,theme,motion:false});__cquiz.applyPref();__cquiz.openSettings('licenses');},{style,theme});
      assert.equal(await page.getByRole('tab',{name:'第三方许可',exact:false}).getAttribute('aria-selected'),'true');
      const tabVisible=await page.locator('.category-nav').evaluate(nav=>{const n=nav.getBoundingClientRect(),t=nav.querySelector('[aria-selected=true]').getBoundingClientRect();return t.left>=n.left-1&&t.right<=n.right+1;});assert.equal(tabVisible,true);
      assert.equal(await page.locator('.license-component').count(),5);
      const project=page.locator('.third-party-notices .project-notice');assert.match(await project.innerText(),/MIT.*自有部分/);assert.match(await project.innerText(),/AI.*辅助开发/);
      assert.equal(await project.getByRole('link',{name:'thelaon · GitHub 主页',exact:true}).getAttribute('href'),'https://github.com/thelaon');
      await project.locator('summary').click();assert.match(await project.innerText(),/立即.*先行下架/);assert.equal(await project.getByRole('link',{name:'项目版权反馈入口（Issues）',exact:true}).getAttribute('href'),'https://github.com/thelaon/code-station/issues');
      if(isPublic){
        assert.equal(await page.locator('.license-status,.license-fingerprint').count(),0);
        assert.equal(await page.getByText('来源与核实进度',{exact:true}).count(),0);
        assert.equal(await page.locator('.license-origin').count(),5);
        assert.doesNotMatch(await page.locator('#foot').textContent(),/构建|\d+B/);
        assert.doesNotMatch(await page.locator('.third-party-notices').innerText(),/已在线核对|逐行历史|私人试用阶段|核对说明/);
      }else assert.match(await page.locator('.license-status').innerText(),/未宣称全部分发条件已经满足/);
      for(const name of ['TCC-COPYING.txt','WABT-LICENSE.txt','WABT-THIRD-PARTY-NOTICES.txt']){
        const doc=page.locator('.license-document').filter({has:page.locator('summary',{hasText:name})});
        await doc.locator('summary').click();
        assert.equal(await doc.locator('pre').textContent(),fs.readFileSync(path.join(root,'licenses',name),'utf8'));
      }
      const mit=page.locator('.license-document').filter({has:page.locator('summary',{hasText:/^LICENSE$/})});await mit.locator('summary').click();assert.equal(await mit.locator('pre').textContent(),fs.readFileSync(path.join(root,'LICENSE'),'utf8'));
      if(!isPublic){await page.locator('.license-component').first().locator('summary').click();
      assert.match(await page.locator('.license-fingerprint').first().textContent(),/SHA-256 [a-f0-9]{64}/);}
      const overflow=await page.locator('.category-body').evaluate(e=>e.scrollWidth-e.clientWidth);assert.ok(overflow<=1,JSON.stringify({style,theme,width,overflow}));
      if(process.env.CQUIZ_SCREENSHOT_DIR&&theme==='light'&&width!==320){
        fs.mkdirSync(process.env.CQUIZ_SCREENSHOT_DIR,{recursive:true});await page.locator('.category-body').evaluate(e=>e.scrollTop=0);
        await page.screenshot({path:path.join(process.env.CQUIZ_SCREENSHOT_DIR,style+'-'+width+'.png')});
      }
      report.layouts.push({style,theme,width});await page.keyboard.press('Escape');assert.equal(await page.locator('.modal').count(),0);
    }
    await page.evaluate(()=>__cquiz.openSettings('help'));await page.getByRole('button',{name:'查看第三方组件与许可',exact:true}).click();assert.equal(await page.locator('.third-party-notices').isVisible(),true);await page.keyboard.press('Escape');
    await page.evaluate(()=>__cquiz.openSettings('licenses'));const pendingDownload=page.waitForEvent('download');await page.getByRole('button',{name:'保存运行组件对应源码包',exact:true}).click();const download=await pendingDownload;
    assert.deepEqual(fs.readFileSync(await download.path()),fs.readFileSync(path.join(root,'third_party/runtime-stable/runtime-corresponding-source.zip')));await page.keyboard.press('Escape');
    await page.evaluate(()=>__cquiz.openHelp('keys'));await page.getByRole('button',{name:'第三方组件与许可证',exact:true}).click();assert.equal(await page.locator('.third-party-notices').isVisible(),true);assert.equal(await page.locator('.modal').count(),1);
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);console.log(JSON.stringify(report));await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
