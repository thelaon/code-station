# 当前运行组件的对应源码

v0.2.3 的 TCC/libc 沿用 44670/tcc-wasm 固定上游并附本地修改，运行桥、头文件和 binary128 软件运算配套交付。Berkeley SoftFloat 3e 的原始许可和目标实现位于源码包 quad/。TCC Wasm 为 b59fc96d2aabf43c0f99abc5af21fd0ff26fc1541f61d20c0bb7f5811037e10e，libc Wasm 为 53392cc0db81b1b39570395b010f390f67b0bc18e50d1560d2dc64786d437018。

最新接口、帧对齐和可变参数改动见源码包 evidence/c-completeness.json；binary128 及此前修补的材料同包保留。生成容器现含29份头文件，13份修改头文件带告示；21份源文件标记的指纹以 ANNOTATIONS.json 为准。evidence/headers.json 等旧材料是对应日期的历史记录。两份 Wasm 已由对应源码独立重建并逐字节核对。

下列历次补丁说明按历史批次保留，其“本轮”“候选”和旧指纹不代表 v0.2.3 的当前资源。

本轮运行时精简与批量内存操作见 `patches/runtime-audit-2026-11-16.patch`。本轮源码及运行资源的指纹变化见 `evidence/runtime-audit.json`。

本候选包含 wasm32 变长数组和浮点输出分流。对应补丁见 `patches/wasm32-vla-2026-11-16.patch` 和 `patches/printf-split-2026-11-16.patch`，构建指纹见 `evidence/vla-printf-revision.json`。

前轮候选 libc.wasm 的 SHA-256 为 `5661d14b4bfb629e524762af3f84854a5e658baead345a1216fbdacd508672d4`。

本包的应用栈修订见 `patches/app-stack-2026-11-16.patch`。考生程序预留 2 MiB 栈，修改记录见 `evidence/app-stack-revision.json`。

本包包含 scanf 字节扫描集合、标准输入位置共享及前一轮文件刷新修复。该轮 libc.wasm SHA-256 为 97dbc85161681b76177f9da84415994292433eb2796da0d4350f46e9b9addb55。该轮补丁见 patches/scanf-scanset-2026-11-15.patch。

项目由thelaon（https://github.com/thelaon）发起维护，主要通过AI辅助开发。本项目依法有权授权的自有工具/表达采用MIT，原文和范围见project-notices；它不覆盖本包中的上游组件及派生修改。版权异议的先行暂停与核查流程见project-notices/COPYRIGHT.md，不作为许可证附加条件。

许可证及源文件中的原版权和例外声明应保留；仓库级README/COPYING为LGPL依据。源码包中包含源文件不表示其全部参与本次Wasm链接。WABT汇编器原样来自npm wabt@1.0.37，适用licenses/WABT-LICENSE.txt；其原始发布包及版本核对材料另在框架third_party/wabt-1.0.37中。

## 重建

解压到新目录。需要Python、Node和GCC（构建工具，应用运行不需要安装）：

    python tools/build_tcc_wasm.py --gcc <gcc路径> --node <node路径> --output-dir <新输出目录>

脚本会在解压副本内生成config.h，输出tcc.wasm、libc.wasm及构建记录。已在Windows/MinGW GCC环境实际重建并与冻结资源逐字节核对。其他工具版本和平台未作等同保证。

头文件容器重生：

    node _tcc_test/scripts/_patch_headers.js
    python tools/source_notices.py _tcc_test/wasm/_ide-resources-patched.js

生成结果位于_tcc_test/wasm/_ide-resources-patched.js。历史28份头文件的原字节与修改情况见evidence/headers.json；当前容器和修改告示以本说明开头及 ANNOTATIONS.json 为准。告示日期区分历史批次与整理日期。告示置于文件末尾以保留原行号和原许可。ANNOTATIONS.json记录标记前后指纹；去掉本次可逆告示后，运行桥和生成容器与冻结资源逐字节一致。Wasm二进制按标记后的源码重新构建核对。

## 修改与替换

在框架源码工程中，将修改后构建的组件放到vendor/c-runtime的对应文件，然后运行python build.py --output 做题器.html。运行桥与头文件容器同样可以替换后重新构建；没有校验签名或远程授权来阻止替换。开发者的资源基线pins.json需要同时记录新指纹，才能通过原版指纹检查；该文件不限制应用构建或使用修改后的组件。

允许适用许可证所保障的修改、个人使用及为调试修改而进行的逆向分析；自有部分后续条款不得排除第三方许可证已经授予的权利。修改后的版本应标明修改并履行相应许可条件。本说明不选择整个应用的统一开源许可证。

## 范围

本包按实际构建需要收录编译器源文件、头文件、运行桥、生成脚本、补丁及许可；排除了上游测试、示例网页和项目题库。WABT精确对应官方1.0.37原包，并附WABT-THIRD-PARTY-NOTICES.txt保守补充告示；不声称告示所列的每个可选库均已链接。历史构建使用Emsdk latest，精确工具编号保留为溯源限制，不猜填。本地来源核查、用户确认及逐文件标记均有对应记录；自有可许可部分已按MIT授权，具体范围见project-notices/LICENSE-SCOPE.md，不以重建成功替代整体权利判断。
