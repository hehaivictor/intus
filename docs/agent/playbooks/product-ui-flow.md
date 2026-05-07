# 产品 UI 壳层改造核对

> 本文件由 `python3 scripts/agent_playbook_sync.py` 基于 task 画像自动生成。
> 关联任务画像：`product-ui-flow` | 来源：`resources/harness/tasks/product-ui-flow.json`

把工作台、导航、搜索、库页和能力页改动收口到固定顺序：先保留状态边界，再改视觉结构，最后用 browser smoke 和专项测试验证。

## 什么时候用

- 准备调整登录后工作台、顶部导航、侧边导航或任务启动入口
- 准备新增全局搜索、库页、Agents 能力页等产品壳层能力
- 需要判断 UI 极简化是否影响 License、报告、方案页或管理员中心状态可见性

## 先跑哪些命令

```bash
python3 scripts/agent_workflow.py --task product-ui-flow --execute plan
python3 scripts/agent_static_guardrails.py
python3 scripts/agent_browser_smoke.py --suite extended
```

如改动触达报告、方案页、分享或管理员中心，再补：

```bash
python3 -m unittest tests.test_solution_payload
python3 -m unittest tests.test_security_regression
```

阶段收口时落盘 harness 证据：

```bash
python3 scripts/agent_harness.py --task product-ui-flow --observe --profile auto --artifact-dir artifacts/harness-runs
```

## 看哪些 artifact

- `docs/agent/plans/manus-style-replica.md`
- `artifacts/harness-runs/latest.json`
- `artifacts/harness-runs/latest-progress.md`
- `artifacts/harness-runs/latest-failure-summary.md`
- `浏览器截图或 browser smoke 输出`

重点看：

- 登录、License gate、报告、方案页和管理员中心是否仍能直接识别状态
- 工作台任务输入器、侧边导航、搜索、库页和 Agents 页是否接入真实流程
- 移动端断点下侧栏、按钮、chip 和弹层文本是否溢出或遮挡
- 蓝色是否只用于链接、进度或状态，不再主导品牌视觉

## 哪些操作必须人工确认

- 移除或隐藏 License、管理员中心、报告生成状态、分享只读提示等高风险 UI
- 引入新的前端框架、构建链路或外部设计系统依赖
- 修改鉴权、owner、instance_scope、readonly 或 License enforcement 逻辑

## 相关文档

- `docs/agent/plans/manus-style-replica.md`
- `docs/agent/README.md`
- `web/AGENTS.md`
- `web/app_modules/AGENTS.md`
- `docs/agent/auth-identity.md`
- `docs/agent/report-solution.md`
- `docs/agent/admin-ops.md`
