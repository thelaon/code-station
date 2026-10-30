# 代码航站

可独立维护和构建的离线编程练习框架，支持题包导入、普通练习、模拟考试、复习、统计、题库管理和本机C程序运行。

不预装题目、答案解析、题图、示例题库或个人记录。双击根目录“做题器.html”使用，另外导入有权使用的JSON题包；无需账号、服务器或模型API。Word/PDF/ZIP不能直接识题。

## 独立构建

只需要Python 3.9+，构建仅使用标准库，不需要Node、Babel、npm或原私人工程。

```text
python build.py
```

输出dist/代码航站.html及同名.build.json输入/资源指纹清单。可从任意工作目录调用build.py，所有输入相对本工程解析；顺序统一在build-manifest.json维护。

更新根目录兼容入口：

```text
python build.py --output 做题器.html
```

逐字复现（同源码、同参数）：

```text
python build.py --build-id verify-1 --stamp "2026-10-29 12:00"
```

默认每次构建生成新DATA_BUILD。按当前开发约定，新构建首次打开清空本应用cqframe.*记录、题包和草稿，guide.seen.v1首次提示标记除外；同版刷新保留。构建前备份需要的数据。固定标识仅供复现检查，实际修改应使用新标识。

## 检查

构建不依赖Node；检查JS语法时需要本机Node：

```text
python scripts/check.py --node node
python scripts/check.py --html 做题器.html --node node
```

检查空题库、独立存储、资源、字节戳、脚本/Worker语法及构建指纹；浏览器及真实运行范围见CHECKS.md。

## 开发与使用

[开发入口](docs/DEVELOPMENT.md)说明模块边界与修改流程。题库、学习记录、代码草稿分别备份；迁移时先恢复题库，再恢复记录与草稿。复制HTML不会带走浏览器记录。顶部“?”可查阅完整使用说明。

当前保持私有归档状态，未自动公开网站或设置整个项目的统一开源许可。组件来源及许可见第三方组件说明、vendor和licenses目录。

## 异常保护与回归

新版浏览器支持Web Locks时同一数据空间只允许一个页面写入；第二页关闭旧页面后重新连接。不支持该API时使用快照冲突检测，请避免并行编辑。保存失败有待保存提示和重试/导出入口；恢复日志损坏时可从恢复页导出故障备份。

旧备份中的改错报告HTML不会执行，只恢复可验证分数；详细报告重新提交生成。学习记录导入经过完整校验及成组提交，失败不修改原有记录。

```text
python scripts/test_build.py
node scripts/regression.cjs
```

浏览器回归需自行安装可选Playwright开发依赖；可用CQUIZ_PLAYWRIGHT指定模块路径，CQUIZ_BROWSER指定浏览器（默认msedge）。不会进入应用运行或Python构建依赖。测试仅合成最小数据，不分发实际题库。

构建中断产生的隐藏transaction.json与.cquiz-build目录应保留，再次构建会恢复。勿手工删除未恢复的日志。详细修复范围见docs/审查修复-2026-10-29.md。

界面更新：年份可省略或填null，显示“无年份”；航天首页使用年份分组。模拟考试隐藏离场导航，交卷统一评分，放弃不生成成绩。题型专练仍即时反馈，整卷可选择即时或交卷后批改。新增UI检查：node scripts/test_ui.cjs。

整卷批改选择与玻璃管计时、紧凑得分和折叠导入预览：见docs/整卷批改与折叠预览-2026-10-29.md。新增回归：node scripts/test_full_feedback.cjs；node scripts/test_pack_preview.cjs。测试采用隔离浏览器和合成数据。

默认界面排版与朋友试用验收：见docs/默认界面与朋友试用-2026-10-29.md。默认界面优化单独维护于src/css/_classic_polish.css。
