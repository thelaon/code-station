# 代码航站 · Code Station

离线运行的编程练习工具。支持导入题包、练习、模拟考试、复习、统计和本机C程序运行，无需账号、服务器或模型API。

## 下载与使用

当前版本：**v0.2.0**。

1. 从[Releases](https://github.com/thelaon/code-station/releases/tag/v0.2.0)下载`code-station-v0.2.0.zip`并解压。
2. 双击“做题器.html”。在“导入 / 管理题包”中选择JSON题包，预览后确认导入。
3. 可先导入随附“示例题包/示例题库.json”体验；顶部“?”提供完整说明。

页面不预装题目。随附示例由本项目独立编写，共5卷27题，含六种题型、两张插图和连续小问，不是考试真题；详见[示例说明](examples/demo-bank/README.md)。Word、PDF和ZIP不能直接作为题包导入。

## 功能与数据

- 单选、多选、普通填空、程序填空、改错和编程；题库支持启停、更新、删除及备份。
- 整卷练习可选即时批改或交卷后批改，模拟考试交卷后统一判分；当前模拟考试不含编程题。
- 复习计划、统计、历史答卷、代码草稿和本机C程序自测。
- 默认/航天两套界面、字号和动效设置、可选答对自动跳题。

数据保存在当前浏览器。题库、学习记录、代码草稿需要分别备份；恢复时先恢复题库。升级保留数据，移动HTML、换浏览器或清理浏览器数据前请先备份。复制HTML不会带走浏览器记录。

已在Windows桌面Edge验证；窄屏检查使用桌面模拟。更多用法见[使用说明](docs/发行版使用说明.md)，功能边界见[版本说明](docs/RELEASE-NOTES-v0.2.0.md)。

## 从源码构建

Python 3.9+，只使用标准库：

```text
python build.py
```

输出`dist/代码航站.html`及同名构建清单。发行源码默认使用`public`配置，根目录“做题器.html”也是公众界面。需要完整诊断信息时，可显式指定`--profile development`；本地私人开发目录可使用不同默认配置，以build-manifest.json为准。

```text
python build.py --profile public --output 做题器.html
python scripts/prepare_release.py
```

后者生成用户发行包、独立示例包及源码包，不推送仓库或改变仓库可见性。构建依赖顺序和版本号在build-manifest.json维护；修改src后重新构建，不要只改生成HTML。[开发说明](docs/DEVELOPMENT.md)介绍模块与维护入口。

## 检查

成品检查需要Node；浏览器检查另需可选Playwright和桌面浏览器，不属于应用运行依赖。

```text
python scripts/check.py --html 做题器.html --node node
python scripts/test_build.py
node scripts/test_public_release.cjs 做题器.html
node scripts/test_demo_bank.cjs 做题器.html
```

运行环境、回归范围和其他检查见[CHECKS.md](CHECKS.md)。浏览器检查使用隔离的合成数据，不修改使用者记录。

## 许可与版权反馈

项目由[thelaon](https://github.com/thelaon)发起和维护，主要通过生成式AI辅助开发，不宣称全部代码为手写或整个项目全部原创。

依法可授权的自有部分采用[MIT](LICENSE)，范围见[LICENSE-SCOPE.md](LICENSE-SCOPE.md)。第三方组件及派生修改保留各自许可，见[第三方组件说明](第三方组件说明.md)；对应源码可从Release下载，或从“设置 → 第三方许可”离线保存。其他导入题库不因使用本工具取得授权。

维护者知悉能定位具体内容的版权异议后，将立即启动相关内容的先行暂停分发或下架，再核查、移除或替换。这不构成免责或对MIT的附加限制。反馈方式和处理范围见[COPYRIGHT.md](COPYRIGHT.md)，其他问题可提交[Issue](https://github.com/thelaon/code-station/issues)。
