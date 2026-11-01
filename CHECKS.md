# v0.2.0检查记录

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
