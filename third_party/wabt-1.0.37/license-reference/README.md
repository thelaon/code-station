# WABT内嵌依赖告示核对材料

后续收尾：已将原许可与保守补充告示编入licenses/WABT-THIRD-PARTY-NOTICES.txt，随HTML和对应源码包分发。补充了compiler-rt、分配器及PicoSHA2/可选OpenSSL路径的告示；不是断言所有可选库都存在。见docs/WABT-dependency-notices-2026-10-31.md。下文“不加入已确认组件”的早期说明保留其参考版本边界；当前实际交付以合并告示为准。

2026-10-31从Emscripten官方仓库4.0.4固定ref获取：LICENSE、system/lib/libc/musl/COPYRIGHT、system/lib/libcxx/LICENSE.TXT、system/lib/libcxxabi/LICENSE.TXT。文件名仅为便于本地查阅而调整，许可正文保留。

来源前缀：https://github.com/emscripten-core/emscripten/blob/4.0.4/ 。Emscripten官方许可文档说明生成运行支持代码使用MIT/NCSA许可，且其musl和其他组件须查看各自文本：https://emscripten.org/docs/introducing_emscripten/emscripten_license.html 。

**本目录是补证参考，不能作为当前WABT确实由4.0.4构建的证明，也不表示当前文件必然包含列出的每个库。** 历史工作流使用Emsdk latest，实际构建日志尚未取得。发布前应核对实际链接/保留的运行库片段及必要告示；不要把整个SDK或仅用于构建的工具都当作应用内嵌依赖。

参考许可已收齐不等于当前分发告示已闭环。故这些材料不冒充当前运行组件已确认的许可，不将其加入已确认组件的统一许可字段；原WABT包的Apache 2.0及版权行继续保留。
