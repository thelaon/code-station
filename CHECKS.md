# 发布检查

## v0.2.1 限时编程并入测试

公开配置成品检查 113 项、构建 10 组通过。离线 Edge 验证了新限时卷纳入编程题、手动交卷、到期锁定、批改失败后刷新重试、逐题得分与失败明细、只读代码和备份恢复。真实一分钟考试关页至到期，重开后按原答卷得到 22/22，只生成一条历史记录。使用公开 v0.2.0 页面实际升级，已存在的限时答卷保留原题单、作答、截止时间和历史。

整卷练习两种批改方式、正式题包导入、放弃后刷新、普通编程与改错均复测。随附示例的 27 道题全部复验，含编程题的示例限时卷三题得 6/6。8 项运行资源与 v0.2.0 的成品指纹一致。

## v0.2.0 检查记录

已完成：公众成品112项、构建保护9组、公开页面综合7组/206项布局、六题型和整卷批改8组/12布局、存储异常7组、升级保数据6组、许可12布局、UI12布局及折叠预览4配置。包含真实WASM编译运行、考试交卷与放弃、记录备份和刷新恢复。示例题库27题已逐题验证，整数求和及GBK中文用例实际运行通过。

已在Windows桌面Edge检查，320/390宽度为桌面模拟。测试结果不等于所有浏览器、C程序和输入均已验证。来源与许可边界见第三方组件说明和LICENSE-SCOPE.md。

## 复验

构建只需要Python标准库。成品语法检查需要Node；浏览器脚本需要Playwright及Edge，允许用CQUIZ_PLAYWRIGHT指定模块路径、CQUIZ_BROWSER指定浏览器。

```text
python build.py --profile public --output 做题器.html
python scripts/check.py --html 做题器.html --node node
python scripts/test_build.py
node scripts/test_ui.cjs 做题器.html
node scripts/test_licenses.cjs 做题器.html
node scripts/test_public_release.cjs 做题器.html
node scripts/test_demo_bank.cjs 做题器.html
node scripts/regression.cjs 做题器.html
```

scripts/test_full_feedback.cjs、test_pack_preview.cjs和test_upgrade.cjs可通过CQUIZ_APP指定当前待检HTML。升级脚本允许额外指定旧HTML；没有旧文件时使用旧行为夹具，不把夹具冒称为真实旧版。

scripts/audit_release.py --history只读检查公开清单、递归源码包和Git对象。scripts/prepare_release.py按清单导出并核对发行源码与单独发行页面一致，不包含Git目录、私人取证或第三方真题。脚本不会自动上传或公开发布。
