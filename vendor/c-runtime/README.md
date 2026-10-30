# 固定的离线C运行资源

包含tcc.wasm、libc.wasm、wabt.js、runtime.js及_ide-resources-patched.js（内嵌标准头文件）。取自当前已验证运行版本，保持文件原始字节和第三方许可注释，不包含题库或参考解答。

指纹见pins.json；构建时原样内嵌，WASM以base64存储，运行时无需下载。TCC/WABT许可原文在根目录licenses中。

配套libc、头文件和运行桥的完整来源/许可核对范围见第三方组件说明；本目录不是完整的编译器源码或编译器重建工具链。应用可独立构建不代表完成全部公开分发准备。
