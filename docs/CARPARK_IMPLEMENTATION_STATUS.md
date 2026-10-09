# 车位监控 MVP 实施进度

依据：[MVP_PRD.md](MVP_PRD.md)、[TECH_DESIGN.md](TECH_DESIGN.md)（2026-10-09 已确认版本）。按技术文档第 11 部分逐轮交付，完成本轮后确认下一轮。

## 第 1 轮：布局、区域与仿真帧

- `dist/data/carpark-b2.json`：B2 层 2 × 6 个车位、首排充电位、摄像头朝向、互不重叠的车头／车轮／车底区域。
- `dist/carpark/layout.mjs`：前后端共用的区域查询、繁中／英文名称、最高温格子的热点归属；同温取行列顺序第一个，坏点不补值。
- `backend/sim/scenarios.mjs`：确定性 24 × 32 仿真矩阵、A/B 热点与时间表、正常背景固定起伏、各车位占用与充电配置；B2-11 不产生帧。
- `tests/carpark-layout.test.mjs`、`tests/sim-scenarios.test.mjs`：布局覆盖与边界、热点定位、逐秒规则结果、正常车位一个完整起伏周期、场景开始的历史重置契约、目标车位路由。
- `scripts/check-carpark-scenarios.mjs`：控制台展示关键秒的规则结果，加 `--all` 显示逐秒结果。仅在内存计算，不写数据库或报告、不调用 AI。

### 查看本轮效果

在仓库目录运行：

```powershell
$node = 'C:\Users\Admin1\AppData\Local\Programs\nodejs-v24.13.0\node.exe'
& $node scripts/check-carpark-scenarios.mjs
& $node scripts/check-carpark-scenarios.mjs --all
& $node --test (Get-ChildItem tests\*.test.mjs).FullName
```

预期结果（原型阈值，不是车辆验证结论）：

| 场景 | 首帧 | 第 28 秒 | 第 42 秒 | 结束后 |
|---|---|---|---|---|
| A：B2-08 前轮余热仿真 | 68°C，警告，无速率 | 65.2°C，警告 | 63.8°C，警告 | 第 60 秒后固定 62°C，警告 |
| B：B2-02 车底异常仿真 | 38°C，unknown（界面应显示正在接入） | 60.4°C，警告 | 80°C，危险 | 第 46 秒起固定 86°C，危险 |

### 边界与下一轮

本轮交付纯函数与控制台效果，尚未接入服务端或首页。仿真值不是实测或物理模型结果，不进入现有 NASA 实测流程。

场景开始必须由第 2 轮的播放器清空目标车位帧历史。本轮测试与控制台从 `previous = null` 开始，并复现了沿用旧背景帧会误报危险的问题；没有把纯函数测试描述为已实现服务端重置。

下一轮：服务端仿真播放器、车位状态机、WS 摘要与演示控制接口。车位总览界面在第 3 轮，AI 编排与真实模型验证分别在第 6、7 轮。
