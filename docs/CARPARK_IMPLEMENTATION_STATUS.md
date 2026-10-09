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

### 第 1 轮交付边界

本轮交付纯函数与控制台效果，尚未接入服务端或首页。仿真值不是实测或物理模型结果，不进入现有 NASA 实测流程。

场景开始必须由第 2 轮的播放器清空目标车位帧历史。本轮测试与控制台从 `previous = null` 开始，并复现了沿用旧背景帧会误报危险的问题；没有把纯函数测试描述为已实现服务端重置。

第 2 轮现已接入上述纯函数，见下文。

## 第 2 轮：服务端播放器与车位状态

- `backend/sim/player.mjs`：启动即产生 11 个车位的仿真首帧，每秒推进；B2-11 永不发帧。时钟与定时器可注入，重复推进同一秒不重复发帧；采样时间遵循逻辑时钟，避免定时器抖动制造危险速率。
- `backend/bays.mjs`：复用共享规则引擎，严格校验 24 × 32 帧，每个车位只在内存保留最近 60 帧；首帧温度未达阈值时显示正在接入；超过 5 秒无新帧才断线；创建／升级规则告警，断线或降温不解除待处理告警。
- `backend/carpark.mjs`：仿真会话、独立 SQLite `demo_sessions` / `bay_alerts` 表、重置与场景启动。所有仿真接口带来源与不可导出标识；不写入原 `telemetry` / `events` / `audit` 表。
- `backend/server.mjs`：新增车位读取与演示控制 API，沿用本机来源与 CSRF 检查；WS `bays` 只发送 12 个车位的摘要，`alert` 发送新建／升级事件，完整矩阵仅通过车位详情 API 获取。
- NASA 工作台仅响应 `telemetry` / `events` 消息，避免每秒的车位摘要触发实测记录刷新；浏览器回归新增此检查。

### 已接入的接口

| 方法／路径 | 内容 |
|---|---|
| `GET /api/carpark` | 布局、会话、12 个车位摘要 |
| `GET /api/bays/B2-02` | 最新完整帧、规则结果、热点区域、60 帧最高温序列、当前告警 |
| `GET /api/alerts` | 当前规则告警，危险优先，再按创建时间排序 |
| `POST /api/demo/scenario` | `{ "name": "A", "ai": false }` 或场景 B；先清空当前会话，再从场景第 0 秒播放 |
| `POST /api/demo/reset` | JSON 空对象 `{}`；删除当前演示会话及告警，开始新会话 |

写接口需 `Content-Type: application/json` 与 `/api/health` 返回的 `X-Voltguard-Csrf`。输入无效返回 422，来源／CSRF 不符返回 403，未知车位返回 404。`POST /api/frames` 仍未实现。

WS 沿用 `{ type, report }` 包装：`bays.report` 为 `{ session, bays, sourceType, exportable }`，`alert.report` 为 `{ event, alert }`。每批仅一次摘要；帧处理与推送在同一事件循环内完成。

场景或重置后，11 个有帧车位的正常首帧仍短暂显示「正在接入」，下一秒收到可比较帧才显示正常；这是缺少速率证据时的设计行为。A 的超温首帧直接警告，B2-11 始终无数据。

### 查看第 2 轮效果

```powershell
$node = 'C:\Users\Admin1\AppData\Local\Programs\nodejs-v24.13.0\node.exe'
& $node scripts/check-carpark-server.mjs
```

该脚本以独立内存数据库启动真实 HTTP / WS 服务，用注入时钟跳至关键秒，输出 A/B 车位状态、重置结果和 WS 摘要检查。不使用用户数据库或真实 AI；不是实时性能基准。

也可运行 `& $node serve.mjs` 后在浏览器打开 `http://127.0.0.1:4173/api/carpark` 或 `/api/bays/B2-02` 查看实时 JSON。启动场景 B 的本地示例：

```powershell
$base = 'http://127.0.0.1:4173'
$health = Invoke-RestMethod "$base/api/health"
$headers = @{ 'X-Voltguard-Csrf' = $health.csrf }
Invoke-RestMethod "$base/api/demo/scenario" -Method Post -ContentType 'application/json' -Headers $headers -Body '{"name":"B","ai":false}'
Invoke-RestMethod "$base/api/bays/B2-02"
```

### 测试与交付边界

新增 `tests/bays.test.mjs`、`tests/sim-player.test.mjs`、`tests/carpark-server.test.mjs`：覆盖无数据边界、首帧告警、危险不自动降低、未处理告警保留、60 帧缓冲、输入校验、场景重接入、完整 A/B 时间表、定时器、独立持久化与重置、本机来源／CSRF、WS 摘要与本机推送延迟。`scripts/qa-browser.mjs` 新增车位 WS 不刷新 NASA 记录的浏览器检查。

第 2 轮没有车位网页界面、保安决定接口或 AI 调用。待处理告警没有人工处理入口，因此不会自动结束；处理中／已降级／重新告警与决定记录将在第 5 轮实现。

演示控制的 `ai` 选择暂存为 `session.aiRequested`；`aiEnabled` / `aiConfigured` 均为 false，详情明确返回 `BAY_AI_NOT_IMPLEMENTED` 或 `AI_DISABLED`，不伪造 AI 结果。第 6 轮再接入编排，第 7 轮才做真实服务商验证。

第 3 轮界面现已接入，见下文。

## 第 3 轮：可操作的车位总览网页

### 打开演示

运行本机服务后打开 **http://127.0.0.1:4173/?view=carpark**；英文地址加 `&lang=en`。原 NASA 首页仍保留，顶部增加「车位监控」入口；默认首页与「规则验证（NASA 电芯）」两级导航的最终调整留在第 8 轮。

```powershell
$node = 'C:\Users\Admin1\AppData\Local\Programs\nodejs-v24.13.0\node.exe'
& $node serve.mjs
```

- B2 平面图保持 2 × 6：6 个充电位、6 个普通位。卡片显示车位号、规则状态（颜色、文字与图标）、最高温及是否充电；B2-11 固定无资料。
- 页面常驻「仿真演示 · 演示时间已压缩」，注明合成帧非实测，不进入实测记录或导出。页头的数据来源也切换为仿真，避免沿用 NASA 已核验标记。
- 「场景 A / 场景 B / 重置演示」调用第 2 轮接口；场景 B 约第 28 秒变警告、第 42 秒变危险。每次场景开始清空上一次演示告警；首帧短暂「正在接入」是设计行为。
- 右侧为只读告警列表和选中车位摘要；可点选卡片／告警，或用方向键在实际车位布局中移动。每秒更新保留键盘焦点，告警列表使用 `aria-live`。
- 浏览器连接中断或连续超过 5 秒未收到摘要时，正常车位不再显示正常；已有警告／危险保留并加无资料提示。单个车位断帧时，平面图与告警列表同步标示无资料。
- 失败的控制请求保留原状态并显示错误；重置后忽略旧演示会话的迟到 WS 摘要。
- 双语沿用原语言按钮。手机平面图在自身区域横向滚动，保留实际 2 × 6 布局和可读文字，整页不横向溢出。
- 公开静态模式显示「需运行本地服务」，不在浏览器伪造车位帧，场景控制禁用；NASA 页面仍可使用。静态资源可离线缓存，API 与仿真状态不缓存。

### 本轮验证

- `tests/carpark-ui.test.mjs`：断线后的四种状态、缺失资料不显示正常、状态计数、告警无资料标记、方向键边界。
- `scripts/qa-carpark.mjs`：真实本机 HTTP / WS 与独立内存数据库；注入时钟推进 A/B 关键秒；检查 12 格、固定无资料、重置、双语、手机、键盘与焦点、断线保留危险、单车位断帧、旧会话消息、失败写操作、静态无服务与 NASA 导航。失败与断帧使用明确的测试替身，不生成 AI 结果或新温度值。
- 浏览器 QA 截图保存在忽略目录 `.sites-runtime/qa-carpark-v13/`，`AGENTS.md` 已增加车位监控 QA 命令。

### 范围与下一轮

本轮只展示最高温与状态摘要，未绘制热成像或趋势曲线，未提供保安决定按钮。AI 尚未接入，界面明确标示未配置，AI 开关禁用；场景请求固定 `ai: false`，不发出真实 AI 调用。

下一轮：第 4 轮车位热成像详情与规则区。
