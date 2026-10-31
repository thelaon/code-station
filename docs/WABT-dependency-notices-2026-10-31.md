# WABT依赖告示交付收尾

<!-- release-status-0.2v -->
> 记录说明：本文保留编写时的状态、测试数据与指纹；其中待办或升级行为可能已由后续工作更新。当前发布状态以[0.2v发布准备](RELEASE-NOTES-0.2v.md)、根目录README及第三方组件说明为准。旧报告中的未完成项不自动代表当前仍未完成。

## 本轮处理结论

本项按“固定官方发布包的许可、保留必要归属、对可能的生成支持代码采用保守告示集合”的方式完成交付整理，不再把无法取得的历史Emscripten精确版本号本身列为重复阻断项。该结论是发布材料的工程收尾，不是未知链接细节已经被重建，也不是整个软件的法律认证。

原始WABT不修改：官方npm wabt@1.0.37，index.js SHA-256为021f7a1f3609d46af0254404bba6d8ea1061904df9a687c650dc1416e46f59c9；原包完整性和Git提交映射保留。原Apache 2.0及版权行仍在licenses/WABT-LICENSE.txt。

新增licenses/WABT-THIRD-PARTY-NOTICES.txt，保留Emscripten MIT/NCSA及其Node派生路径代码告示、musl版权和许可、libc++/libc++abi/compiler-rt完整许可与LLVM例外、分配器告示，以及PicoSHA2和可选OpenSSL路径的原许可。可选路径保守收录不表示所有库实际链接，也没有引入这些库运行。

## 依据及范围

WABT包装版本提交a4bccfd9332d02f296d9db8b860fa448308aba0f，核心提交5e81f6aeddf94fd7743c8c2049f5084c74ff6ab1。固定版本工作流显示Emscripten生成JS；libwabtjs目标仅链接wabt，SHA-256源码提供PicoSHA2/OpenSSL替代。来源文件保存在third_party/wabt-1.0.37/upstream中。

Emscripten许可参考取自官方4.0.4固定快照，**不声称该版本就是实际历史构建工具链**；项目官方许可说明确认其MIT/NCSA许可及musl等单独告示。原文包含LLVM编译输出例外，故没有机械地把SDK所有工具、测试或源码仓库子模块都宣布为本应用的运行组件。额外保留许可原文也不增加对用户的统一授权限制。

- Emscripten：https://github.com/emscripten-core/emscripten/blob/4.0.4/LICENSE
- musl：https://github.com/emscripten-core/emscripten/blob/4.0.4/system/lib/libc/musl/COPYRIGHT
- LLVM运行支持：同ref下system/lib/libcxx、libcxxabi、compiler-rt各自LICENSE.TXT。
- 分配器：同ref下system/lib/dlmalloc.c和emmalloc.c，保留来源告示。
- PicoSHA2：https://github.com/okdshin/PicoSHA2/blob/27fcf6979298949e8a462e16d09a0351c18fcaf2/LICENSE
- 可选OpenSSL许可参考：openssl/openssl的OpenSSL_1_1_1w/LICENSE和openssl-3.0.15/LICENSE.txt；不据此宣称用了某个OpenSSL版本。
- Apache许可交付规则：https://www.apache.org/licenses/LICENSE-2.0.html

历史精确Emscripten编号保留为可复现性/来源限制，不伪造为已知值。若未来发现不同的实际依赖或上游补充告示，应更新清单；更换WABT时必须重新核对，不能沿用本结论。

## 实际交付

补充告示随HTML离线展示，并与内嵌对应源码包共同保存。notice-delivery.json绑定当前WABT指纹、各许可参考文件和合并告示指纹。脚本核对告示原文是否完整纳入，阻止换了组件仍沿用旧声明。

本轮未选择自有代码的许可证，也未公开仓库或发布网站。自有部分许可证是接下来的独立决策。

## 验证结果

成品98项、构建保护8组、许可页12种配置通过。界面内原文与文件逐字节一致，源码下载与最终包一致，不发起网络请求。对应源码包105项，SHA-256为cf4314b6603eb0030a1916dc6c4435c2c2f707426eb5799a30e08e82e79db863。合并告示原文包含9部分；构建同时检查WABT本体、各参考原文与合并告示的指纹及完整包含关系。根入口与dist入口相同，运行资源及原始许可证未改写。
