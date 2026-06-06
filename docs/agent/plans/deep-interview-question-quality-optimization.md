# 深度访谈问题质量优化实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复深度访谈中问题重复、追问浅、证据不足但过早完成的问题，并把模型切换降级为可观测的 A/B 配置项。

**架构：** 保留现有 question runtime 分层，不重写访谈主链路。先让 deep 模式从策略层避开 light/fast prompt，再补语义去重、证据槽位完成门槛和模型 A/B 观测字段。所有变更先由单元测试锁定，再用 harness / evaluator 复核主链路。

**技术栈：** Python `unittest`、现有 `web/server.py`、`web/server_modules/interview_runtime.py`、`web/config.py`、`tests/test_question_fast_strategy.py`、`tests/test_runtime_token_config.py`。

---

## 一、问题边界与完成定义

### 已确认根因

- `deep` 模式当前只放大 timeout/token，没有显式禁止 `fast/light` prompt。
- `light` prompt 只保留最近 1 轮上下文，并压缩主题、维度、关键方面和参考资料。
- 高证据强度问题仍允许走快档，导致“深度访谈”实际可能拿到“高效率短问题”。
- 重复保护只比较上一题与当前题字符串完全相同，无法识别同义重复。
- 维度完成 gate 在达到题数上限或预算耗尽时会强制完成，即使 `quality_warning=True`。

### 本轮优化完成定义

- deep 模式下，高证据问题和关键维度默认使用 full prompt，不再进入 `*_reference_light` / `*_light` profile。
- 同一维度内，语义相似问题会被识别并触发重试或 fallback。
- prompt 明确携带“已问问题摘要”和“本题必须补齐的证据槽位”。
- 维度质量不足时，不再仅因达到 `max_formal_questions_per_dim` 就静默完成，必须产生明确的“证据不足确认题”或阻塞标记。
- 模型切换只通过 `QUESTION_MODEL_NAME_DEEP` 做 A/B，summary/search/assessment/report 默认不动。

---

## 二、文件职责

- 修改：`web/config.py`
  - 增加 deep 模式质量策略开关，默认保守启用。
  - 保留模型默认值，不把真实网关或密钥写入代码。

- 修改：`web/server_modules/interview_runtime.py`
  - 在 runtime profile 选择阶段识别 deep 模式强制 full prompt。
  - 在 prompt 构建阶段注入去重提示和证据槽位提示。
  - 保留 quick/standard 的现有 fast/light 行为。

- 修改：`web/server.py`
  - 接入 deep runtime 开关。
  - 增加问题 fingerprint / 相似度判定。
  - 增强重复重试逻辑。
  - 调整维度完成 gate 的 `force_complete` 条件。
  - 在 runtime meta 中记录 deep full、duplicate guard、quality gate 触发原因。

- 修改：`tests/test_question_fast_strategy.py`
  - 覆盖 deep 模式禁用 light profile。
  - 覆盖 high evidence + reference docs 不再走 fast/light。
  - 覆盖同义重复触发重试。

- 修改：`tests/test_runtime_token_config.py`
  - 覆盖新增配置默认值和模型 A/B 只影响 question deep lane。

- 可选修改：`docs/agent/interview.md`
  - 补充深度访谈质量策略说明和运维排查方式。

---

## 三、实施任务

### 任务 1：锁定 deep 模式不走 light/fast 的失败测试

**文件：**
- 修改：`tests/test_question_fast_strategy.py`

- [x] **步骤 1：新增失败测试：deep + high evidence + reference docs 必须 full**

在 `QuestionFastStrategyTests` 内新增：

```python
def test_deep_high_evidence_reference_docs_uses_full_profile(self):
    profile = self.server._select_question_generation_runtime_profile(
        prompt="x" * 3200,
        truncated_docs=["需求文档A"],
        decision_meta={
            "interview_mode": "deep",
            "should_follow_up": False,
            "has_search": False,
            "has_reference_docs": True,
            "has_truncated_docs": True,
            "missing_aspects": ["角色分工"],
            "formal_questions_count": 2,
            "follow_up_round": 0,
            "answer_mode": "pick_with_reason",
            "requires_rationale": True,
            "evidence_intent": "high",
            "critical_dimension_hit": True,
        },
        base_call_type="question",
        allow_fast_path=True,
    )

    self.assertFalse(profile["allow_fast_path"])
    self.assertEqual(profile["fast_output_mode"], "full")
    self.assertIn("deep_full_required", profile["selection_reason"])
    self.assertNotIn("reference_light", profile["profile_name"])
```

- [x] **步骤 2：运行失败测试**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy.QuestionFastStrategyTests.test_deep_high_evidence_reference_docs_uses_full_profile -q
```

预期：失败，当前 profile 仍可能是 `question_probe_reference_light` 或 `question_evidence_reference_light`。

### 任务 2：实现 deep full runtime profile

**文件：**
- 修改：`web/config.py`
- 修改：`web/server_modules/interview_runtime.py`
- 修改：`web/server.py`

- [x] **步骤 1：增加配置开关**

在 `web/config.py` 问题生成链路配置附近新增：

```python
QUESTION_DEEP_FORCE_FULL_PROMPT = True
QUESTION_DEEP_FORCE_FULL_FOR_HIGH_EVIDENCE = True
QUESTION_DEEP_FORCE_FULL_FOR_CRITICAL_DIMENSION = True
QUESTION_DEEP_ALLOW_REFERENCE_LIGHT = False
```

- [x] **步骤 2：在 runtime profile 选择中读入 deep 策略**

在 `_select_question_generation_runtime_profile()` 中读取：

```python
normalized_mode = str(decision_meta.get("interview_mode") or "").strip().lower()
is_deep_mode = normalized_mode == "deep"
critical_dimension_hit = bool(decision_meta.get("critical_dimension_hit"))
deep_full_required = bool(
    is_deep_mode
    and QUESTION_DEEP_FORCE_FULL_PROMPT
    and (
        QUESTION_DEEP_FORCE_FULL_FOR_HIGH_EVIDENCE and high_evidence_intent
        or QUESTION_DEEP_FORCE_FULL_FOR_CRITICAL_DIMENSION and critical_dimension_hit
    )
)
```

- [x] **步骤 3：强制 full profile**

在 light/reference_light 分支之前插入：

```python
if deep_full_required:
    effective_fast_allowed = False
    fast_output_mode = "full"
    profile_name = f"{profile_prefix}_deep_evidence_full" if high_evidence_intent else f"{profile_prefix}_deep_full"
    fast_prompt_max_chars = None
    reasons.append("deep_full_required")
```

确保后续 `elif high_evidence_intent`、`elif can_use_light_prompt` 分支不会覆盖该结果。

- [x] **步骤 4：运行任务 1 测试确认通过**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy.QuestionFastStrategyTests.test_deep_high_evidence_reference_docs_uses_full_profile -q
```

预期：PASS。

### 任务 3：把 deep 模式上下文和 prompt 约束从“短问题”改为“证据补齐”

**文件：**
- 修改：`web/server_modules/interview_runtime.py`
- 修改：`tests/test_question_fast_strategy.py`

- [x] **步骤 1：新增 prompt 失败测试**

新增测试，构造 deep session 和多轮历史，断言 full prompt 包含历史摘要、已问问题、证据缺口，而不是 light prompt 的短选项约束：

```python
def test_deep_full_prompt_includes_question_history_and_evidence_slots(self):
    prompt, truncated_docs, fast_prompt = self.runtime.build_interview_prompt(
        session={
            "topic": "智能工艺访谈",
            "interview_mode": "deep",
            "interview_log": [
                {"dimension": "target_architecture", "question": "当前系统边界是什么？", "answer": "MES 和 PLM"},
                {"dimension": "target_architecture", "question": "哪些接口最不稳定？", "answer": "BOM 同步"},
            ],
            "dimensions": {"target_architecture": {"items": []}},
        },
        dimension="target_architecture",
        output_mode="full",
        reference_materials=[],
    )

    self.assertIn("已问问题", prompt)
    self.assertIn("当前系统边界是什么", prompt)
    self.assertIn("证据缺口", prompt)
    self.assertNotIn("每项尽量不超过 14 个字", prompt)
```

如果现有测试装载方式不直接暴露 `build_interview_prompt()`，按当前测试夹具把函数从 `web.server_modules.interview_runtime` 导入。

- [x] **步骤 2：实现已问问题摘要**

在 `build_interview_prompt()` 中从当前维度日志生成：

```python
asked_questions = [
    str(log.get("question") or "").strip()
    for log in recent_logs
    if str(log.get("dimension") or dimension) == dimension and str(log.get("question") or "").strip()
]
```

full prompt 增加：

```text
## 已问问题
- ...

生成下一题时必须避开上述问题的同义重复；如果必须回到同一主题，必须换成更具体的证据槽位。
```

- [x] **步骤 3：实现证据槽位提示**

复用 `preflight_plan.get("probe_slots")`、`blocked_sections`、`missing_aspects`，full prompt 增加：

```text
## 本题优先补齐的证据槽位
- ...

问题必须要求用户给出对象、范围、数量、责任人、系统边界、时间或决策依据中的至少一种。
```

- [x] **步骤 4：运行 prompt 测试**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy.QuestionFastStrategyTests.test_deep_full_prompt_includes_question_history_and_evidence_slots -q
```

预期：PASS。

### 任务 4：增加问题语义去重 guard

**文件：**
- 修改：`web/server.py`
- 修改：`tests/test_question_fast_strategy.py`

- [x] **步骤 1：新增 fingerprint 单元测试**

新增：

```python
def test_question_similarity_detects_semantic_duplicate(self):
    self.assertTrue(
        self.server.is_similar_interview_question(
            "当前最核心的业务痛点是什么？",
            "目前最大的业务问题主要是什么？",
        )
    )
    self.assertFalse(
        self.server.is_similar_interview_question(
            "当前最核心的业务痛点是什么？",
            "需要对接哪些外部系统？",
        )
    )
```

- [x] **步骤 2：实现规范化与相似度函数**

在 `web/server.py` 中新增小函数，避免引入新依赖：

```python
QUESTION_STOPWORDS = {"当前", "目前", "主要", "最", "核心", "请", "你", "贵司", "是什么", "哪些", "方面"}

def normalize_interview_question_text(text: object) -> str:
    raw = str(text or "").strip().lower()
    raw = re.sub(r"[\\s，。？！、；：,.?!;:（）()【】\\[\\]\"'“”‘’]", "", raw)
    for word in QUESTION_STOPWORDS:
        raw = raw.replace(word, "")
    return raw

def question_token_set(text: object) -> set[str]:
    normalized = normalize_interview_question_text(text)
    return {normalized[i:i + 2] for i in range(max(0, len(normalized) - 1)) if normalized[i:i + 2].strip()}

def is_similar_interview_question(left: object, right: object, threshold: float = 0.62) -> bool:
    left_tokens = question_token_set(left)
    right_tokens = question_token_set(right)
    if not left_tokens or not right_tokens:
        return False
    score = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    return score >= threshold
```

- [x] **步骤 3：把重复判断从上一题扩展到当前维度历史**

在 `generate_next_question` 当前精确比较位置改为：

```python
duplicate_logs = [
    log for log in all_dim_logs
    if is_similar_interview_question(log.get("question"), result.get("question"))
]
if duplicate_logs:
    ...
```

重试时把 `retry_runtime_profile["allow_fast_path"] = False` 保留，并把 `decision_meta["duplicate_guard_triggered"] = True` 写入结果。

- [x] **步骤 4：运行去重测试**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy.QuestionFastStrategyTests.test_question_similarity_detects_semantic_duplicate -q
```

预期：PASS。

- [x] **补充：缓存与预生成路径复用重复 guard**

实时生成之外，`question_result_cache` 和 `prefetch_cache` 命中时也必须先与当前维度历史做语义相似度检查；命中重复则丢弃缓存，继续实时生成或 fallback。新增 API 回归：

```bash
python3 -m unittest -q \
  tests.test_api_comprehensive.ComprehensiveApiTests.test_next_question_discards_semantic_duplicate_prefetch \
  tests.test_api_comprehensive.ComprehensiveApiTests.test_next_question_discards_semantic_duplicate_result_cache
```

预期：PASS。

### 任务 5：调整维度完成 gate，质量不足不能静默完成

**文件：**
- 修改：`web/server.py`
- 修改：`tests/test_question_fast_strategy.py`

- [x] **步骤 1：新增失败测试**

新增：

```python
def test_deep_dimension_does_not_force_complete_when_quality_missing(self):
    result = self.server.evaluate_dimension_completion_v2(
        session={"interview_mode": "deep"},
        dimension="target_architecture",
        formal_count=6,
        min_formal=4,
        max_formal=6,
        saturation={"coverage_score": 0.5, "depth_score": 0.4, "volume_score": 0.4},
        missing_aspects=["系统边界", "数据来源"],
        budget_status={"can_follow_up": True},
        pending_forced_follow_up=False,
        snapshot={},
    )

    self.assertFalse(result["can_complete"])
    self.assertEqual(result["action"], "evidence_gap_confirm")
```

如果函数当前签名不同，按实际签名构造 session 日志和配置，不新增仅供测试的参数。

- [x] **步骤 2：实现 deep 质量保护**

在 `evaluate_dimension_completion_v2()` 的 `reached_upper_bound or budget_exhausted` 分支前加入：

```python
is_deep_mode = normalize_interview_mode_key(session.get("interview_mode")) == "deep"
if is_deep_mode and not meets_quality and budget_status.get("can_follow_up", True):
    return {
        "can_complete": False,
        "reason": "深度模式质量门槛未达成，需要补齐证据缺口",
        "action": "evidence_gap_confirm",
        "quality_warning": True,
        "snapshot": snapshot,
    }
```

- [x] **步骤 3：预算耗尽时显式标记阻塞**

如果 `budget_exhausted=True` 且质量不足，仍允许结束，但 action 改为：

```python
"action": "blocked_by_budget_with_quality_gap"
```

并在返回结构里带出 `missing_aspects`，供前端或报告层提示证据不足。

- [x] **步骤 4：运行完成 gate 测试**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy.QuestionFastStrategyTests.test_deep_dimension_does_not_force_complete_when_quality_missing -q
```

预期：PASS。

### 任务 6：模型 A/B 只限制在 deep question lane

**文件：**
- 修改：`web/config.py`
- 修改：`web/server.py`
- 修改：`tests/test_runtime_token_config.py`

- [x] **步骤 1：新增配置测试**

新增：

```python
def test_deep_question_model_override_does_not_change_other_lanes(self):
    module = load_server_module({
        "QUESTION_MODEL_NAME": "deepseek-chat",
        "QUESTION_MODEL_NAME_DEEP": "glm-5.1",
        "REPORT_MODEL_NAME": "deepseek-reasoner",
        "SUMMARY_MODEL_NAME": "deepseek-chat",
        "ASSESSMENT_MODEL_NAME": "deepseek-chat",
    })

    overrides, fallback = module.resolve_interview_mode_lane_model_overrides("deep")

    self.assertFalse(fallback)
    self.assertEqual(overrides.get("question"), "glm-5.1")
    self.assertEqual(module.REPORT_MODEL_NAME, "deepseek-reasoner")
    self.assertEqual(module.SUMMARY_MODEL_NAME, "deepseek-chat")
    self.assertEqual(module.ASSESSMENT_MODEL_NAME, "deepseek-chat")
```

- [x] **步骤 2：保留现有默认模型**

默认仍保持：

```python
QUESTION_MODEL_NAME_DEEP = "deepseek-reasoner"
```

A/B 时只通过环境覆盖或临时配置覆盖为：

```env
QUESTION_MODEL_NAME_DEEP=glm-5.1
```

或：

```env
QUESTION_MODEL_NAME_DEEP=claude-sonnet-4-6
```

- [x] **步骤 3：记录 runtime meta**

在 deep runtime strategy meta 中增加：

```python
"deep_question_model": deep_model,
"deep_model_fallback": bool(deep_model_fallback),
```

便于后续从日志比对不同模型的重复率、fallback 率和质量 gate 命中率。

- [x] **步骤 4：运行配置测试**

运行：

```bash
python3 -m unittest tests.test_runtime_token_config.RuntimeTokenConfigTests.test_deep_question_model_override_does_not_change_other_lanes -q
```

预期：PASS。

### 任务 7：补齐回归与观测入口

**文件：**
- 修改：`docs/agent/interview.md`
- 修改：`tests/harness_scenarios/report-solution/report-solution-core.json`（仅当需要把该问题纳入 evaluator）

- [x] **步骤 1：文档补充深度访谈排查清单**

在 `docs/agent/interview.md` 增加：

```markdown
## 深度访谈问题质量排查

- 先看 `question_runtime_profile`：deep 模式关键维度不应出现 `reference_light` 或 `balanced_light`。
- 再看 `duplicate_guard_triggered`：如果频繁触发，说明 prompt 缺口或维度设计仍需调整。
- 再看 `dimension_completion.action`：`evidence_gap_confirm` 表示质量不足但仍可继续补问；`blocked_by_budget_with_quality_gap` 表示预算耗尽且报告层必须提示证据不足。
- 模型 A/B 只改 `QUESTION_MODEL_NAME_DEEP`，不要同时改 summary/search/assessment/report。
```

- [x] **步骤 2：增加 evaluator 场景**

已新增 `tests/harness_scenarios/report-solution/deep-interview-question-quality.json` 进入 nightly，用现有 unittest 执行器覆盖以下质量边界：

- deep 高取证问题不进入 `reference_light` / `balanced_light`。
- full prompt 注入已问问题和证据槽位。
- 语义重复题、预取缓存重复题、结果缓存重复题均会被拦截。
- deep 质量不足时返回 `evidence_gap_confirm`。
- `QUESTION_MODEL_NAME_DEEP` 只影响 deep question lane。

### 任务 8：验证矩阵

**文件：**
- 不修改业务文件。

- [x] **步骤 1：最小相关单测**

运行：

```bash
python3 -m unittest tests.test_question_fast_strategy tests.test_runtime_token_config -q
```

预期：PASS。

当前验证：PASS（本轮相关测试合计 82 条通过，覆盖 `tests.test_question_fast_strategy`、`tests.test_runtime_token_config` 和 `next-question` 缓存/预取回归）。

- [x] **步骤 2：主链路 smoke**

运行：

```bash
python3 scripts/agent_smoke.py
```

预期：PASS。

当前验证：PASS。已修复 License 校验关闭时标准版有效 License 被错误提升为专业版的问题；`python3 scripts/agent_smoke.py` 运行 7 个用例，结果 OK。

- [x] **步骤 3：关键不变量 gate**

运行：

```bash
python3 scripts/agent_guardrails.py --quiet
```

预期：PASS。

当前验证：PASS。`python3 scripts/agent_guardrails.py --quiet` 运行 10 个用例，结果 OK。

- [x] **步骤 4：聚合 harness**

运行：

```bash
python3 scripts/agent_harness.py --profile auto --artifact-dir artifacts/harness-runs
```

预期：PASS，并检查 `artifacts/harness-runs/latest-progress.md` 与 `latest-failure-summary.md`。

当前验证：PASS_WITH_WARNINGS。`python3 scripts/agent_harness.py --profile auto --artifact-dir artifacts/harness-runs` 输出 `PASS=3 WARN=1 FAIL=0`，整体 `READY_WITH_WARNINGS`；唯一 WARN 是本地 `SMS_PROVIDER=mock`。

- [x] **步骤 5：如果涉及前端展示或真实访谈链路**

运行：

```bash
python3 scripts/agent_browser_smoke.py --suite minimal
```

预期：PASS。若本机 Playwright 依赖未装，先按仓库说明安装，不把依赖产物提交。

当前验证：不适用。本轮没有修改前端展示或浏览器交互代码，未执行 browser smoke。

---

## 四、交付顺序建议

1. 先完成任务 1-2，解决 deep 模式仍走 light/fast 的主因。
2. 再完成任务 3-4，解决重复和浅问。
3. 再完成任务 5，避免质量不足时过早结束。
4. 最后完成任务 6-7，把模型 A/B 和观测补齐。
5. 每个任务通过对应单测后再进入下一任务，避免把策略、prompt、模型三类变量混在一起。

## 五、风险与回滚

- 风险：deep 模式问题生成耗时上升。回滚开关：`QUESTION_DEEP_FORCE_FULL_PROMPT=False`。
- 风险：语义去重过严导致有效追问被误杀。回滚方式：提高相似度阈值到 `0.72` 或只对最近 5 题启用。
- 风险：完成 gate 更严格导致访谈变长。回滚方式：只对 critical dimension 启用 `evidence_gap_confirm`。
- 风险：模型 A/B 与策略改动混淆。控制方式：先保持 `deepseek-reasoner`，策略验证稳定后再单独切 `QUESTION_MODEL_NAME_DEEP`。
