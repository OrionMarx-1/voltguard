# AGENTS.md

每次执行任务前先阅读本文件。

## 强制工作规则

- 每次改动后，都必须创建对应的一个git commit，以便后续追踪和回滚。
- 每次改动后，都必须编写或更新相关测试，并在交付给用户之前，确保所有测试和验证全部通过。

## 执行方式

`node` 与 `git` 不在 PATH，在本目录（`voltguard-site/`）下使用完整路径：

```powershell
$node = "C:\Users\Admin1\AppData\Local\Programs\nodejs-v24.13.0\node.exe"
$git  = "C:\Users\Admin1\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
& $node --test (Get-ChildItem tests\*.test.mjs).FullName
```

1. **测试**：行为变化须在 `tests/*.test.mjs` 新增或更新测试；修 bug 先写复现测试。不得删除、跳过或放宽已有断言来让测试通过。
2. **验证**：改到界面时运行相关浏览器脚本，输出 `"ok":true` 才算通过：
   温度图／3D → `scripts/qa-thermal.mjs`；仿真 → `qa-simulation.mjs`；工作台 → `qa-workbench.mjs`；
   报告／交接 → `qa-evidence.mjs`；AI 助手／检索／前线模式 → `qa-copilot.mjs`；UX 通用 → `qa-ux.mjs`；跨模块 → `qa-browser.mjs`。
3. **提交**：每个独立改动一个 commit，测试未全部通过不得提交；提交前用 `& $git status --short` 确认不含 `.env`、密钥或 `.sites-runtime/`。不改写历史（`--amend`、`reset --hard`、强推），除非用户明确要求。
4. **交付**：向用户写明新增／更新的测试、实际运行的测试与 QA 结果、commit 哈希；有失败须如实说明，不得声称通过。

## 项目边界

- 运行：`& $node serve.mjs`，打开 http://127.0.0.1:4173 。
- 真实数据只有 NASA 实验室电芯记录；仿真必须明确标注且不得进入保存、导出或 AI。不得虚构量测、事故、车辆或 AI 调用结果。
- 工作区上一级目录不在本仓库内，其中的文件改动无法提交，改动前须提醒用户。
