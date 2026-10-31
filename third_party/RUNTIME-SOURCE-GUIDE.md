# 当前运行组件的对应源码

本包针对 382dc48c… 的 tcc.wasm、f488f4d4… 的 libc.wasm、038ec200… 的头文件容器及39d40f58…的运行桥。完整指纹见evidence/source-map.json及源码清单；没有采用后续整数转换候选。上游为44670/tcc-wasm提交8bff9fbc019a3008395eec4cda6e90752fb88ed9，加保留在源码及patches中的本地变更。修改版本整理日期2026-10-31，不能将本包冒充未修改的上游版本。

项目由thelaon（https://github.com/thelaon）发起维护，主要通过AI辅助开发。本项目依法有权授权的自有工具/表达采用MIT，原文和范围见project-notices；它不覆盖本包中的上游组件及派生修改。版权异议的先行暂停与核查流程见project-notices/COPYRIGHT.md，不作为许可证附加条件。

许可证及源文件中的原版权和例外声明应保留；仓库级README/COPYING为LGPL依据。源码包中包含源文件不表示其全部参与本次Wasm链接。WABT汇编器原样来自npm wabt@1.0.37，适用licenses/WABT-LICENSE.txt；其原始发布包及版本核对材料另在框架third_party/wabt-1.0.37中。

## 重建

解压到新目录。需要Python、Node和GCC（构建工具，应用运行不需要安装）：

    python tools/build_tcc_wasm.py --gcc <gcc路径> --node <node路径> --output-dir <新输出目录>

脚本会在解压副本内生成config.h，输出tcc.wasm、libc.wasm及构建记录。已在Windows/MinGW GCC环境实际重建并与冻结资源逐字节核对。其他工具版本和平台未作等同保证。

头文件容器重生：

    node _tcc_test/scripts/_patch_headers.js
    python tools/source_notices.py _tcc_test/wasm/_ide-resources-patched.js

生成结果位于_tcc_test/wasm/_ide-resources-patched.js。对应28份头文件的原字节与修改情况见evidence/headers.json。当前源码交付版在修改文件及7份修改头文件内补有显著告示；日期明确区分历史批次记录与2026-10-31的标记整理日期，未伪造每一行的原编辑日。告示置于文件末尾以保留原行号和原许可。ANNOTATIONS.json记录标记前后指纹；去掉本次可逆告示后，运行桥和生成容器与冻结资源逐字节一致。Wasm二进制按标记后的源码重新构建核对。

## 修改与替换

在框架源码工程中，将修改后构建的组件放到vendor/c-runtime的对应文件，然后运行python build.py --output 做题器.html。运行桥与头文件容器同样可以替换后重新构建；没有校验签名或远程授权来阻止替换。开发者的资源基线pins.json需要同时记录新指纹，才能通过原版指纹检查；该文件不限制应用构建或使用修改后的组件。

允许适用许可证所保障的修改、个人使用及为调试修改而进行的逆向分析；自有部分后续条款不得排除第三方许可证已经授予的权利。修改后的版本应标明修改并履行相应许可条件。本说明不选择整个应用的统一开源许可证。

## 范围

本包按实际构建需要收录编译器源文件、头文件、运行桥、生成脚本、补丁及许可；排除了上游测试、示例网页和项目题库。WABT精确对应官方1.0.37原包，并附WABT-THIRD-PARTY-NOTICES.txt保守补充告示；不声称告示所列的每个可选库均已链接。历史构建使用Emsdk latest，精确工具编号保留为溯源限制，不猜填。本地来源核查、用户确认及逐文件标记均有对应记录；自有可许可部分已按MIT授权，具体范围见project-notices/LICENSE-SCOPE.md，不以重建成功替代整体权利判断。
