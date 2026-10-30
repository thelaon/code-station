# 代码航站纯框架开发约定

本目录为独立工程。只依赖本目录内的源码、运行资源和Python 3.9+标准库进行构建，不引用原私人项目，不增加题库、题图、答案解析、个人记录或旧Git历史。

- 修改src/下源码，执行python build.py；不要只修改生成HTML。
- 构建输入顺序见build-manifest.json；每次变更同步运行python scripts/check.py --node <Node路径>。浏览器检查按改动影响选择。
- dist/为忽略的构建目录；根目录做题器.html为兼容入口，交付前使用python build.py --output 做题器.html更新。
- 运行时存储使用cqframe.*，保留旧学习记录协议和题包格式。开发重建默认生成新DATA_BUILD，首开清本应用数据，guide.seen.v1首次提示标记除外。
- 保留第三方注释和licenses，vendor资源变更同步校验指纹并进行真实编译运行检查。
- 当前仓库私有，文件修改不自动授权推送、发布网站或选择统一开源许可。
