# 代码航站开发约定

本工程独立构建，不引用私人开发目录，不加入第三方题库、用户记录或旧私人Git历史。examples/demo-bank是用户授权的独立外部示例，按该目录README和LICENSE交付；不得注入HTML。

- 修改src源码后用build.py构建，输入顺序和应用版本见build-manifest.json。
- 发行源码和根目录HTML使用public配置；私人开发环境可选择development。构建默认配置以清单为准。
- 修改后运行scripts/check.py，并按影响选择CHECKS.md列出的浏览器回归。
- 本机存储使用cqframe.*。构建编号变化不能清空记录；未知数据格式进入保留原数据的恢复页，清空需用户明确操作。
- 保留第三方原许可、修改告示和对应源码。修改vendor时更新资源指纹与来源材料，并验证真实编译运行。
- 自有可许可部分采用MIT，署名thelaon并附GitHub主页；具体范围见LICENSE-SCOPE.md，不能覆盖第三方条款或导入题库。
- 公开交付按release-files.json筛选。文件修改不自动授权推送、发布或改变仓库可见性，以用户具体指令为准。
