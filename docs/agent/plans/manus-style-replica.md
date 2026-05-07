# Manus 风格工作台复刻实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐阶段实现此计划。每个阶段完成后必须更新 checkpoint、运行验证，并形成分段提交或至少保留分段 diff。

**目标：** 将 Intus 前端重塑为接近 Manus 的 agent-first 工作台体验，同时保留登录、License、报告、方案页直达能力和设置菜单内管理员中心的真实状态边界。

**架构：** 以现有 `web/index.html`、`web/styles.css`、`web/app.js` 和 `web/app_modules/*` 为落点，不引入第二套前端框架。视觉系统先统一 token、字体和布局壳层，再分阶段替换首页任务启动器、侧边导航、全局搜索、库页和 Agent 能力页。验证控制面使用 Intus 原生 harness、browser smoke 和阶段 checkpoint，不引入外部 `.harness` 或 managed block。

**技术栈：** Alpine.js、Tailwind CDN token、原生 CSS、现有 Intus 前端状态模块、Intus agent harness。

---

## 设计依据

- Manus `/app` 工作台基调：黑白灰低噪声、左侧导航、中心任务输入器、快捷能力 chip、模型/积分/头像入口。
- Manus `/app/agents` 基调：中心插图、能力卡片、单一强 CTA，整体留白充足。
- Manus `/app/library` 基调：顶部筛选、搜索、视图切换、轻量空状态和新建任务入口。
- Intus 必须保留：License gate、账号状态、报告生成状态、方案页直达能力、设置菜单内管理员中心、分享只读和 owner / instance 边界。
- 2026-05-07 审查收敛：顶部全局搜索、会话列表搜索、工作台快捷 chip、最近任务、主导航方案入口、报告详情查看方案入口、库页/Agents/全局搜索中的方案入口、侧栏管理员中心入口均不再展示；账号与外观设置固定在侧栏帮助下方，移动端仍保留顶部入口。

## 文件职责

- `docs/agent/plans/manus-style-replica.md`：长期阶段计划、checkpoint 和恢复规则。
- `resources/harness/tasks/product-ui-flow.json`：产品 UI 壳层类任务画像，让 harness 能识别这类迭代。
- `docs/agent/playbooks/product-ui-flow.md`：由 task profile 生成的执行 playbook。
- `docs/agent/playbooks/README.md`：登记新的 task-backed playbook。
- `docs/agent/README.md`：登记新的内置 task 和 playbook。
- `web/index.html`：页面结构、工作台首屏、侧边导航、搜索弹层、库页和 Agent 能力页。
- `web/styles.css`：Manus 风格 token、字体、布局、组件状态和响应式规则。
- `web/site-config.js`：展示配置中的品牌色与文案口径，避免蓝色品牌残留主导界面。
- `web/app.js`：视图切换、任务创建、全局搜索、库页和 UI shell 状态编排。
- `web/app_modules/session_list_state.js`：会话列表与库页数据入口。
- `web/app_modules/auth_license_state.js`：登录态与 License gate 状态展示。
- `web/app_modules/report_state.js`：报告入口和任务进度状态展示。
- `web/app_modules/admin_center_state.js`：管理员中心入口和状态摘要展示。
- `tests/harness_scenarios/browser/browser-smoke-extended.json`：必要时补浏览器级 UI 场景。

## 连续执行协议

每个阶段必须按同一套节奏推进：

- 开始前运行 `git status --short`，确认没有未解释的无关变更。
- 阶段开始时更新本文件的「阶段 checkpoint」表。
- 阶段内只改当前阶段文件，不顺手做跨阶段重构。
- 阶段完成后至少运行 `python3 scripts/agent_static_guardrails.py`。
- UI 结构或交互变化阶段必须补跑 `python3 scripts/agent_browser_smoke.py --suite extended`。
- 高风险状态受影响时补跑对应专项测试，例如 `tests.test_security_regression` 或 `tests.test_solution_payload`。
- 阶段完成后记录 diff、验证命令、截图路径或浏览器 smoke artifact。
- 阶段完成后优先单独提交；如果暂不提交，必须在 checkpoint 写清楚未提交文件和原因。

## 恢复规则

意外中断后先执行：

```bash
git status --short
git log --oneline -8
python3 scripts/agent_ops.py status
python3 scripts/agent_ops.py task-gap
```

然后按以下顺序判断恢复点：

- 如果最新提交标题包含阶段编号，优先从下一阶段继续。
- 如果有未提交改动，先用 `git diff --stat` 和本文件 checkpoint 判断属于哪个阶段。
- 如果 `artifacts/harness-runs/latest.json` 或 browser smoke artifact 晚于最近提交，读取对应 `progress.md` / `failure-summary.md`。
- 如果 planner / mission 指针存在，优先读取 `artifacts/planner/by-task/product-ui-flow/latest.json` 和 `artifacts/planner/missions/by-task/product-ui-flow/latest.json`。
- 如果 checkpoint 与 git 状态冲突，以 git diff 和真实文件内容为准，再修正文档。

## 阶段计划

### Phase 0：基线、计划与 harness 接线

**完成定义：**

- 长期计划文档进入 `docs/agent/plans/`。
- 新增 `product-ui-flow` task profile。
- 生成并登记 `product-ui-flow` playbook。
- 物化本地 planner / mission 指针，便于中断恢复。
- `agent_playbook_sync --check`、`agent_doc_gardener.py`、`agent_ops.py task-gap` 结果可解释。

**步骤：**

- [x] 创建 `docs/agent/plans/manus-style-replica.md`。
- [x] 创建 `resources/harness/tasks/product-ui-flow.json`。
- [x] 运行 `python3 scripts/agent_playbook_sync.py --task product-ui-flow`。
- [x] 更新 `docs/agent/playbooks/README.md` 与 `docs/agent/README.md`。
- [x] 运行 `python3 scripts/agent_planner.py --task product-ui-flow --goal "复刻 Manus agent-first 工作台并保留 Intus 高风险状态边界" --artifact-dir artifacts/planner`。
- [x] 运行 Phase 0 验证命令并提交。

### Phase 1：设计 token 与字体系统

**完成定义：**

- 近黑 CTA、黑白灰背景、细边框、低噪声阴影统一进入 `web/styles.css` 和 Tailwind token。
- UI 字体保持系统 sans；首屏标题使用中文衬线气质 fallback：`Noto Serif SC`、`Songti SC`、`STSong`、`serif`。
- 蓝色只用于链接、进度或状态，不再作为主品牌大面积色。
- 所有按钮、chip、输入框、侧栏项有稳定尺寸和移动端不溢出的文本规则。

**步骤：**

- [x] 审查 `web/index.html` Tailwind token、`web/styles.css` 和 `web/site-config.js` 的颜色与字体残留。
- [x] 在 `web/styles.css` 增加 `:root` 级 Manus 风格 token 和字体类。
- [x] 调整 Tailwind `brand` token 与 `site-config.js` 展示色。
- [x] 运行静态 guardrail。
- [x] 用浏览器截图核对登录前页面和当前会话页的基础色调。
- [ ] 提交 Phase 1。

### Phase 2：登录与 License gate 视觉统一

**完成定义：**

- 登录页低噪声、中心化、近黑主按钮。
- License 未绑定、绑定成功、账号等级和管理员入口仍清晰可见。
- 不改变任何鉴权、绑定、owner 或 enforcement 逻辑。

**步骤：**

- [x] 定位 `web/index.html` 登录页和 License gate 区块。
- [x] 只调整结构、文案密度和视觉层级。
- [x] 保留现有 `auth_license_state.js` 数据契约。
- [x] 运行 `python3 scripts/agent_browser_smoke.py --suite extended`。
- [x] 使用 `uv run --with ... python3 -m unittest tests.test_security_regression` 补齐本地依赖后运行 security regression。
- [ ] 提交 Phase 2。

### Phase 3：Manus 式任务启动器

**完成定义：**

- 登录后的默认工作台首屏以中心任务输入器为核心。
- 审查收敛后不再展示快捷 chip，任务启动器只保留中心输入器和开始访谈动作。
- 输入器提交仍复用现有 `createSession()` 或等价会话创建链路。
- 空状态不再以传统卡片列表为首屏主视觉。

**步骤：**

- [x] 定位 `currentView === 'sessions'` 页面结构和 `createSession()`。
- [x] 增加中心任务输入器 UI。
- [x] 将快捷 chip 接到现有视图切换或会话创建逻辑。
- [x] 保留最近会话与运行中报告的可见入口。
- [x] 按审查意见移除工作台快捷 chip 与最近任务块。
- [x] 运行 browser smoke extended。
- [ ] 提交 Phase 3。

### Phase 4：侧边导航与最近任务

**完成定义：**

- 左侧导航成为桌面主导航，移动端收敛为顶部或抽屉式入口。
- 导航包含工作台、库、Agents、报告、帮助和帮助下方的设置入口；方案与管理员中心不再作为侧栏直达入口展示。
- 当前 License / 账号状态在侧栏或顶部紧凑展示。
- 原顶部导航不会与侧栏重复制造噪声。

**步骤：**

- [x] 定位 `switchView()`、`getHeaderNavClass()` 和导航模板。
- [x] 新增 shell 布局容器和侧栏项。
- [x] 调整移动端断点，确保不遮挡主内容。
- [x] 补最近任务入口与运行状态摘要。
- [x] 按审查意见移除最近任务侧栏块，将设置入口移到帮助下方。
- [x] 运行 browser smoke extended。
- [ ] 提交 Phase 4。

### Phase 5：全局搜索弹层

**完成定义：**

- 提供 Manus 式搜索弹层，可搜索会话、报告和帮助入口；方案结果不再展示。
- 搜索结果点击复用现有视图切换和详情入口。
- 空结果与加载状态低噪声、可恢复。

**步骤：**

- [x] 盘点现有会话、报告、方案数据源。
- [x] 在 `web/app.js` 增加搜索弹层状态与结果聚合。
- [x] 在 `web/index.html` 增加弹层模板。
- [x] 在 `web/styles.css` 增加弹层和键盘焦点样式。
- [x] 按审查意见从搜索结果中移除方案入口。
- [x] 运行 browser smoke extended。
- [x] 提交 Phase 5。

### Phase 6：库页

**完成定义：**

- 库页承载会话、报告和导入资料入口；方案入口不再展示。
- 顶部提供筛选、搜索、排序或视图切换。
- 空状态采用 Manus 式小图标、简短提示和新建任务 CTA。
- 不削弱分享只读和报告 owner 边界。

**步骤：**

- [x] 将现有列表能力收口到库页视图。
- [x] 增加库页筛选与空状态。
- [x] 保留报告详情和公开分享只读能力。
- [x] 按审查意见移除库页方案条目与筛选。
- [x] 运行 browser smoke extended。
- [x] 运行 `python3 -m unittest tests.test_solution_payload`。
- [x] 提交 Phase 6。

### Phase 7：Agent 化能力页

**完成定义：**

- Agents 页展示 Intus 能力，而不是泛化产品营销页。
- 能力卡片覆盖访谈助手、报告生成、导出、License 管理和配置中心；方案页卡片不再展示。
- CTA 能进入对应真实流程。

**步骤：**

- [x] 增加或重塑 `currentView === 'agents'`。
- [x] 将能力卡片绑定现有视图和动作。
- [x] 控制视觉层级，避免营销式大卡堆叠。
- [x] 运行 browser smoke extended。
- [ ] 提交 Phase 7。

### Phase 8：报告、方案与管理员一致性

**完成定义：**

- 报告详情、方案页直达能力、设置菜单内管理员中心与新 shell 视觉一致。
- 高风险操作仍保持明确确认、权限提示和运行状态。
- 管理后台不被过度极简化到看不见风险。

**步骤：**

- [x] 审查报告页、方案入口、管理员中心的布局噪声。
- [x] 调整为同一 token 和按钮体系。
- [x] 保留高风险状态、错误提示、确认链路。
- [x] 按审查意见移除报告详情查看方案按钮和侧栏管理员中心按钮。
- [x] 运行 `python3 -m unittest tests.test_security_regression tests.test_solution_payload`。
- [x] 运行 browser smoke extended。
- [ ] 提交 Phase 8。

### Phase 9：全量回归与交付收口

**完成定义：**

- 自动化回归、浏览器截图和 harness artifact 完整。
- 工作区干净或只保留用户明确要求暂存的内容。
- 最终说明包含提交列表、验证结果、剩余风险和后续建议。

**步骤：**

- [x] 运行 `python3 scripts/agent_static_guardrails.py`。
- [x] 运行 `python3 scripts/agent_browser_smoke.py --suite extended`。
- [x] 运行 `python3 scripts/agent_harness.py --profile auto --browser-smoke --artifact-dir artifacts/harness-runs`。
- [x] 用浏览器检查桌面和移动端关键页面截图。
- [x] 更新最终 checkpoint。
- [ ] 提交或整理最终 diff。

## 阶段 checkpoint

| 阶段 | 状态 | 证据 | 提交 |
| --- | --- | --- | --- |
| Phase 0 | 已完成 | `agent_playbook_sync --check`、`agent_workflow --task product-ui-flow --execute plan`、`agent_ops.py task-gap`、`agent_doc_gardener.py`、`agent_static_guardrails.py`、`python3 -m unittest tests.test_version_manager tests.test_scripts_comprehensive`、`git diff --check`、`agent_heartbeat.py` | `38fa54c` |
| Phase 1 | 已完成 | `node --check scripts/agent_browser_smoke_runner.mjs`、`node --check web/site-config.js`、`node --check web/app.js`、`python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_workflow.py --task product-ui-flow --execute plan`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`python3 -m unittest tests.test_version_manager tests.test_scripts_comprehensive`（94 tests OK）、`git diff --check`、截图：`artifacts/manus-style-phase1/login.png` / `artifacts/manus-style-phase1/home.png` | `6146959` |
| Phase 2 | 已完成 | `python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`python3 scripts/agent_static_guardrails.py`、`/Users/hehai/.local/bin/uv run --with flask --with flask-cors --with anthropic --with requests --with reportlab --with pillow --with jdcloud-sdk --with 'psycopg[binary]' --with boto3 python3 -m unittest tests.test_security_regression`（131 tests OK）、`git diff --check`、截图：`artifacts/manus-style-phase2/login.png` / `artifacts/manus-style-phase2/license-gate.png` | `61a5ce4` |
| Phase 3 | 已完成 | `node --check web/app_modules/session_list_state.js`、`python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`git diff --check`、中心输入器 Playwright 验证 `create-session=PASS`、截图：`artifacts/manus-style-phase3/workbench-desktop.png` / `artifacts/manus-style-phase3/workbench-mobile.png` | `53592f7` |
| Phase 4 | 已完成 | `python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`git diff --check`、截图：`artifacts/manus-style-phase4/sidebar-desktop.png` / `artifacts/manus-style-phase4/sidebar-mobile.png` | `da9ca5b` |
| Phase 5 | 已完成 | `node --check web/app.js`、`node --check web/site-config.js`、`python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`git diff --check`、全局搜索 Playwright 验证 `global-search=PASS`、截图：`artifacts/manus-style-phase5/global-search-desktop.png` / `artifacts/manus-style-phase5/global-search-mobile.png` | `dd7b8f0` |
| Phase 6 | 已完成 | `node --check web/app.js`、`node --check web/site-config.js`、`python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`/Users/hehai/.local/bin/uv run --with ... python3 -m unittest tests.test_solution_payload`（32 tests OK）、`git diff --check`、库页 Playwright 验证 `library=PASS`、截图：`artifacts/manus-style-phase6/library-desktop.png` / `artifacts/manus-style-phase6/library-mobile.png` | `60cb131` |
| Phase 7 | 已完成 | `node --check web/app.js`、`node --check web/site-config.js`、`python3 scripts/agent_static_guardrails.py`、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`git diff --check`、Agents 专项 Playwright 验证 `interview-focus/report-view/admin-config=PASS`、截图：`artifacts/manus-style-phase7/agents-desktop.png` / `artifacts/manus-style-phase7/agents-mobile.png` | `ed508cb` |
| Phase 8 | 已完成 | `node --check web/app.js`、`node --check web/site-config.js`、`python3 scripts/agent_static_guardrails.py`、`/Users/hehai/.local/bin/uv run --with ... python3 -m unittest tests.test_security_regression tests.test_solution_payload`（163 tests OK）、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`git diff --check`、截图：`artifacts/manus-style-phase8/report-detail-desktop.png` / `report-detail-mobile.png` / `admin-config-desktop.png` / `admin-config-mobile.png` / `solution-desktop.png` / `solution-mobile.png` | `e7168f6` |
| Phase 9 | 已完成 | `python3 scripts/agent_static_guardrails.py`（PASS=13）、`python3 scripts/agent_browser_smoke.py --suite extended --json`（16/16 PASS）、`python3 scripts/agent_harness.py --profile auto --browser-smoke --artifact-dir artifacts/harness-runs`（READY_WITH_WARNINGS：仅 `SMS_PROVIDER=mock` 本地环境提示，PASS=4 WARN=1 FAIL=0）、截图：`artifacts/manus-style-phase9/workbench-desktop.png` / `artifacts/manus-style-phase9/workbench-mobile.png` | 本阶段提交 |

## 验证矩阵

- 文档与 task 接线：`python3 scripts/agent_playbook_sync.py --check`
- 文档园丁：`python3 scripts/agent_doc_gardener.py`
- task 覆盖：`python3 scripts/agent_ops.py task-gap`
- 静态 guardrail：`python3 scripts/agent_static_guardrails.py`
- 浏览器级 UI：`python3 scripts/agent_browser_smoke.py --suite extended`
- 安全与权限：`python3 -m unittest tests.test_security_regression`
- 方案页载荷：`python3 -m unittest tests.test_solution_payload`
- 最终聚合：`python3 scripts/agent_harness.py --profile auto --browser-smoke --artifact-dir artifacts/harness-runs`
