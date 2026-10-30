# 独立工程结构

| 路径 | 用途 |
| --- | --- |
| src/template.html | 页面外壳、练习、考试、记录；四处题库插槽只注入空数据 |
| src/js/ | 题包校验/管理、动态选项、小问、界面、统计、设置说明、编程与运行桥、改错界面 |
| src/css/ | 默认与航天主题、题库管理、学习页、编程和设置说明样式 |
| src/judge/ | 逐处核对、形式检查、诊断、输出比较及两个Worker |
| vendor/c-runtime/ | 固定的编译器/运行库二进制、WABT、运行桥和头文件容器 |
| build-manifest.json | CSS/JS依赖顺序及资源块映射；唯一构建输入清单 |
| build.py | 仅使用本工程文件的单HTML构建器 |
| scripts/check.py | 无题源依赖的成品、语法及指纹检查 |
| dist/ | 默认输出，不纳入Git |
| 做题器.html | 为现有入口保留的生成文件 |

## 修改入口

- 设置、说明与首次提示：src/js/_settings_help.js、src/css/_settings_help.css；首次标记在template.html维护。
- 首页与航天徽章：_visual_style.js/.css；目前固定发射箭羽。
- 默认界面：_classic_ui.js、_classic_style.css。
- 题库生命周期：_pack_manager.js、_question_packs.js；格式校验在_question_pack_schema.js、_study_pack_schema.js。
- 选择/填空：_objective_questions.js和template.html；连续小问由题包元数据驱动。
- 编程：_programming.js、_program_practice.js、_programming_runtime.js和judge/programming-worker.js。
- 改错：_fix_code.js及judge目录，沿用window.__cq公共桥；逐处参考由外部题包提供。

修改源码后构建、检查，再按影响做浏览器和真实提交验证。不要只编辑生成HTML。源码保持可读模块，未压缩混淆。

## 题库边界

构建器没有题库文件参数，不扫描题包目录，不读上级工程，不加载私人构建模块。四块数据固定为空。题库仅通过运行时JSON导入进入当前浏览器，不会自动打入HTML。

旧题号迁移、每题分值和原格式兼容逻辑保留，不包含原题原文。历史示例函数为空，界面不展示示例下载。原协议标识保留，便于导入现有题包和备份。

## 运行库边界

本工程能够重建应用HTML；TCC/libc为固定的已构建二进制，未宣称已包含从完整编译器源码重建所有二进制的工具链。修改编译器时，应先在编译器工程重建和验证，再替换vendor资源并更新指纹及来源说明。

公开分发所需的完整来源和许可核对仍按第三方组件说明处理。本次不改私人原工程的维护入口，不复制原题库、历史证据或Git历史；后续纯框架开发可直接在此进行。
