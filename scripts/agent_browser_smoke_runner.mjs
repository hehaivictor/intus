#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';


const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = normalize(join(dirname(__filename), '..'));
const WEB_DIR = join(ROOT_DIR, 'web');
const LIVE_AUTH_PHONE = '13800138000';
const LIVE_SMS_CODE = '666666';
const LIVE_UV_WITH_ARGS = [
  '--with',
  'flask',
  '--with',
  'flask-cors',
  '--with',
  'anthropic',
  '--with',
  'requests',
  '--with',
  'reportlab',
  '--with',
  'pillow',
  '--with',
  'jdcloud-sdk',
  '--with',
  'psycopg[binary]',
  '--with',
  'boto3',
];
const LIVE_REPORT_TITLE = '真实浏览器方案验证报告';
const LIVE_REPORT_GENERATION_SESSION_TITLE = '真实浏览器报告生成恢复会话';
const LIVE_HELPER_SCRIPT = String.raw`#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
import sys
import uuid
from pathlib import Path

ROOT_DIR = Path(os.environ["INTUS_ROOT_DIR"]).resolve()
SERVER_PATH = ROOT_DIR / "web" / "server.py"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def load_server():
    spec = importlib.util.spec_from_file_location("dv_browser_live_helper", SERVER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载服务模块: {SERVER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def build_report_content(title: str) -> str:
    return (
        f"# {title}\n\n"
        "## 一、需求摘要\n\n"
        "当前需要验证真实后端下的报告详情、方案页和公开分享边界。\n\n"
        "## 二、结论建议\n\n"
        "建议按回访入口、闭环时效和复盘节奏三条主线推进试点，并保留可公开分享的只读方案页。\n\n"
        "## 附录：完整访谈记录\n\n"
        "### 问题 1：这次真链路要验证什么？\n\n"
        "<div><strong>回答：</strong></div>\n"
        "<div>验证登录、License、报告详情、方案页和公开分享只读链路。</div>\n"
    )


def run_generate_license(args):
    server = load_server()
    payload = server.generate_license_batch(
        count=int(args.count),
        duration_days=int(args.duration_days),
        note=str(args.note or "").strip(),
        level_key=str(args.level_key or "professional").strip(),
        actor_user_id=None,
    )
    print(json.dumps(payload, ensure_ascii=False))


def run_seed_report(args):
    server = load_server()
    owner_user_id = int(args.owner_user_id)
    title = str(args.title or "").strip() or "真实浏览器方案验证报告"
    slug = server.normalize_topic_slug(title) or "browser-live-report"
    report_name = f"{slug}-{uuid.uuid4().hex[:8]}.md"
    report_path = server.REPORTS_DIR / report_name
    report_path.write_text(build_report_content(title), encoding="utf-8")
    server.set_report_owner_id(report_name, owner_user_id)
    payload = {
        "report_name": report_name,
        "title": title,
        "report_path": str(report_path),
    }
    print(json.dumps(payload, ensure_ascii=False))


def run_lookup_user(args):
    server = load_server()
    row = server.query_user_by_account(str(args.account or "").strip())
    if not row:
        print(json.dumps({"found": False, "account": str(args.account or "").strip()}, ensure_ascii=False))
        return
    print(json.dumps({
        "found": True,
        "user": {
            "id": int(row["id"]),
            "phone": str(row["phone"] or ""),
            "email": str(row["email"] or ""),
        },
    }, ensure_ascii=False))


def run_seed_session(args):
    server = load_server()
    owner_user_id = int(args.owner_user_id)
    title = str(args.title or "").strip() or "真实浏览器报告生成恢复会话"
    now = server.get_utc_now()
    session_id = server.generate_session_id()
    dimensions = {
        "customer_needs": {
            "coverage": 100,
            "items": [{"name": "刷新后继续跟踪报告生成"}],
            "score": None,
        },
        "business_process": {
            "coverage": 100,
            "items": [{"name": "生成中切页后仍保留会话上下文"}],
            "score": None,
        },
        "tech_constraints": {
            "coverage": 100,
            "items": [{"name": "依赖状态接口轮询恢复生成进度"}],
            "score": None,
        },
        "project_constraints": {
            "coverage": 100,
            "items": [{"name": "不要求用户手动重新触发生成"}],
            "score": None,
        },
    }
    interview_log = [
        {
            "question": "这轮真链路恢复的目标是什么？",
            "answer": "刷新页面后仍要保留正在生成的报告进度。",
            "dimension": "customer_needs",
            "is_follow_up": False,
            "answer_mode": "pick_with_reason",
            "requires_rationale": True,
            "evidence_intent": "high",
            "answer_evidence_class": "explicit",
            "quality_score": 0.92,
            "needs_follow_up": False,
            "user_skip_follow_up": False,
        },
        {
            "question": "业务上最关键的恢复行为是什么？",
            "answer": "切页或刷新后仍回到当前会话，而不是退回列表。",
            "dimension": "business_process",
            "is_follow_up": False,
            "answer_mode": "pick_with_reason",
            "requires_rationale": True,
            "evidence_intent": "high",
            "answer_evidence_class": "explicit",
            "quality_score": 0.9,
            "needs_follow_up": False,
            "user_skip_follow_up": False,
        },
        {
            "question": "技术上依赖什么来恢复生成状态？",
            "answer": "依赖报告生成状态接口和 app shell 恢复目标协同工作。",
            "dimension": "tech_constraints",
            "is_follow_up": False,
            "answer_mode": "pick_with_reason",
            "requires_rationale": True,
            "evidence_intent": "high",
            "answer_evidence_class": "explicit",
            "quality_score": 0.91,
            "needs_follow_up": False,
            "user_skip_follow_up": False,
        },
        {
            "question": "这轮验证最重要的约束是什么？",
            "answer": "用户刷新后不需要重新发起报告生成。",
            "dimension": "project_constraints",
            "is_follow_up": False,
            "answer_mode": "pick_with_reason",
            "requires_rationale": True,
            "evidence_intent": "high",
            "answer_evidence_class": "explicit",
            "quality_score": 0.9,
            "needs_follow_up": False,
            "user_skip_follow_up": False,
        },
    ]
    session = {
        "session_id": session_id,
        "owner_user_id": owner_user_id,
        server.INSTANCE_SCOPE_FIELD: server.get_active_instance_scope_key(),
        "topic": title,
        "description": "真实浏览器 smoke 报告生成恢复验证夹具",
        "interview_mode": "standard",
        "created_at": now,
        "updated_at": now,
        "status": "in_progress",
        "scenario_id": "",
        "scenario_config": {"name": title},
        "dimensions": dimensions,
        "reference_materials": [],
        "interview_log": interview_log,
        "requirements": [],
        "summary": None,
        "depth_v2": {
            "enabled": True,
            "mode": "standard",
            "skip_followup_confirm": False,
        },
    }
    if hasattr(server, "refresh_session_evidence_ledger"):
        try:
            server.refresh_session_evidence_ledger(session)
        except Exception:
            pass
    session_path = server.SESSIONS_DIR / f"{session_id}.json"
    server.save_session_json_and_sync(session_path, session)
    print(json.dumps({
        "session_id": session_id,
        "title": title,
        "session_path": str(session_path),
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Intus browser live helper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_generate = subparsers.add_parser("generate-license")
    p_generate.add_argument("--count", type=int, default=1)
    p_generate.add_argument("--duration-days", type=int, default=30)
    p_generate.add_argument("--level-key", default="professional")
    p_generate.add_argument("--note", default="")
    p_generate.set_defaults(func=run_generate_license)

    p_seed = subparsers.add_parser("seed-report")
    p_seed.add_argument("--owner-user-id", required=True, type=int)
    p_seed.add_argument("--title", default="")
    p_seed.set_defaults(func=run_seed_report)

    p_lookup = subparsers.add_parser("lookup-user")
    p_lookup.add_argument("--account", required=True)
    p_lookup.set_defaults(func=run_lookup_user)

    p_seed_session = subparsers.add_parser("seed-session")
    p_seed_session.add_argument("--owner-user-id", required=True, type=int)
    p_seed_session.add_argument("--title", default="")
    p_seed_session.set_defaults(func=run_seed_session)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
`;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const suiteIndex = args.indexOf('--suite');
const suiteName = suiteIndex >= 0 ? String(args[suiteIndex + 1] || 'minimal').trim() || 'minimal' : 'minimal';

function nowIso() {
  return new Date().toISOString();
}

function buildSummary(results) {
  return results.reduce(
    (acc, item) => {
      const key = item.status === 'PASS' ? 'PASS' : item.status === 'WARN' ? 'WARN' : 'FAIL';
      acc[key] += 1;
      return acc;
    },
    { PASS: 0, WARN: 0, FAIL: 0 },
  );
}

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseRgbValue(value) {
  const match = String(value || '').match(/rgba?\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1]
    .split(',')
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (parts.length < 3) return null;
  return {
    r: Math.max(0, Math.min(255, parts[0])),
    g: Math.max(0, Math.min(255, parts[1])),
    b: Math.max(0, Math.min(255, parts[2])),
    a: parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1,
  };
}

function colorChannel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function colorLuminance(color) {
  if (!color) return 0;
  return 0.2126 * colorChannel(color.r) + 0.7152 * colorChannel(color.g) + 0.0722 * colorChannel(color.b);
}

function isBlueAccent(color) {
  if (!color || color.a <= 0.05) return false;
  return color.b > color.r + 35 && color.b > color.g + 14;
}

async function expectNeutralControl(locator, label, options = {}) {
  const backgroundColor = await locator.evaluate((element) => window.getComputedStyle(element).backgroundColor);
  const color = parseRgbValue(backgroundColor);
  if (!color) {
    throw new Error(`${label} 背景色无法解析: ${backgroundColor}`);
  }
  if (isBlueAccent(color)) {
    throw new Error(`${label} 不应继续使用蓝色选中态: ${backgroundColor}`);
  }
  if (options.expectDark && colorLuminance(color) > 0.08) {
    throw new Error(`${label} 选中态应为黑色或深中性色，当前为 ${backgroundColor}`);
  }
  if (options.expectLight && colorLuminance(color) < 0.64) {
    throw new Error(`${label} 深色模式按钮应使用浅色中性底，当前为 ${backgroundColor}`);
  }
}

async function assertNoVisibleBrandAccentMismatch(page, rootSelector, label) {
  const issues = await page.evaluate(({ selector, pageLabel }) => {
    const root = document.querySelector(selector) || document.body;
    const parseColor = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1]
        .split(',')
        .map((part) => Number.parseFloat(part.trim()))
        .filter((part) => Number.isFinite(part));
      if (parts.length < 3) return null;
      return {
        r: Math.max(0, Math.min(255, parts[0])),
        g: Math.max(0, Math.min(255, parts[1])),
        b: Math.max(0, Math.min(255, parts[2])),
        a: parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1,
      };
    };
    const distance = (a, b) => {
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
    };
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0.01
        && rect.width > 0
        && rect.height > 0;
    };
    const isBlueAccentColor = (color) => color
      && color.a > 0.25
      && color.b > color.r + 35
      && color.b > color.g + 8;
    const describeNode = (node) => {
      if (!(node instanceof HTMLElement)) return '';
      if (node.id) return `#${node.id}`;
      const className = String(node.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 4).join('.');
      const text = String(node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
      return `${node.tagName.toLowerCase()}${className ? `.${className}` : ''}${text ? `:${text}` : ''}`;
    };
    const rootStyle = window.getComputedStyle(document.documentElement);
    const brand = parseColor(rootStyle.getPropertyValue('--dv-color-brand'));
    const brandHover = parseColor(rootStyle.getPropertyValue('--dv-color-brand-hover'));
    const allowedDistance = 24;
    const problems = [];
    const properties = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
    const nodes = Array.from(root.querySelectorAll('*')).filter(isVisible);
    for (const node of nodes) {
      const style = window.getComputedStyle(node);
      for (const property of properties) {
        const color = parseColor(style[property]);
        if (!isBlueAccentColor(color)) continue;
        if (distance(color, brand) <= allowedDistance || distance(color, brandHover) <= allowedDistance) continue;
        problems.push(`${pageLabel}: ${describeNode(node)} ${property}=${style[property]} 未跟随品牌色`);
        break;
      }
      for (const shadowColor of String(style.boxShadow || '').match(/rgba?\([^)]+\)/g) || []) {
        const color = parseColor(shadowColor);
        if (!isBlueAccentColor(color)) continue;
        if (distance(color, brand) <= allowedDistance || distance(color, brandHover) <= allowedDistance) continue;
        problems.push(`${pageLabel}: ${describeNode(node)} box-shadow=${shadowColor} 未跟随品牌色`);
        break;
      }
    }
    return problems.slice(0, 12);
  }, { selector: rootSelector, pageLabel: label });
  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
}

function cloneJsonValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function json(body) {
  return JSON.stringify(body);
}

function isIgnorableConsoleError(text) {
  const normalized = safeText(text);
  return normalized.includes('net::ERR_CONNECTION_CLOSED');
}

function buildSolutionPayload() {
  return {
    report_name: 'demo-report.md',
    source_mode: 'degraded',
    title: '售后回访闭环试点方案',
    subtitle: '先围绕高频售后回访问题建立归因、分发和复盘闭环。',
    viewer_capabilities: { solution_share: true },
    hero: {
      eyebrow: '真实信息摘要',
      summary: '当前优先验证入口归因、分发动作和复盘节奏三件事。',
      metrics: [
        { label: '试点范围', value: '1 条业务线' },
        { label: '闭环节奏', value: '48h' },
        { label: '复盘周期', value: '每周' },
      ],
    },
    sections: [
      {
        id: 'why-now',
        label: '为什么现在做',
        title: '先把高信号反馈闭环跑通',
        description: '当前重复分发和漏处理已经影响试点判断。',
        layout: 'text',
        paragraphs: [
          '售后回访的核心问题不是数据不够，而是归因和分发不统一。',
          '先围绕一个业务线建立闭环，才能沉淀出可复制流程。',
        ],
      },
      {
        id: 'delivery',
        label: '落地路径',
        title: '按两阶段推进试点',
        description: '先验证入口与归因，再验证执行与复盘。',
        layout: 'timeline',
        items: [
          { title: '阶段一：锁定入口', summary: '统一回访问题标签与分发规则', detail: '第 1 周' },
          { title: '阶段二：闭环复盘', summary: '跟踪执行反馈并复盘处理质量', detail: '第 2 周' },
        ],
      },
    ],
  };
}

function buildReportsPayload() {
  return [
    {
      name: 'demo-report',
      title: '售后回访闭环试点报告',
      display_title: '售后回访闭环试点报告',
      scenario_name: '售后回访试点',
      created_at: '2026-04-01T08:00:00Z',
      session_id: 'session-demo-001',
      report_profile: 'balanced',
    },
  ];
}

function buildSessionsPayload() {
  return [
    {
      session_id: 'session-demo-001',
      topic: '售后回访试点会话',
      description: '验证访谈刷新恢复与当前问题保持一致。',
      created_at: '2026-04-01T08:00:00Z',
      updated_at: '2026-04-01T08:05:00Z',
      status: 'in_progress',
      interview_count: 1,
      scenario_config: {
        name: '售后回访试点',
      },
      dimensions: {
        customer_needs: {
          coverage: 45,
          items: [{ name: '缩短回访闭环时长' }],
        },
        business_process: {
          coverage: 20,
          items: [{ name: '统一分发入口' }],
        },
        tech_constraints: {
          coverage: 0,
          items: [],
        },
        project_constraints: {
          coverage: 0,
          items: [],
        },
      },
      interview_log: [
        {
          question: '目前试点阶段最主要的目标是什么？',
          answer: '先验证售后回访闭环的归因和分发效率。',
          dimension: 'customer_needs',
        },
      ],
    },
    {
      session_id: 'session-report-001',
      topic: '报告生成恢复验证会话',
      description: '验证报告生成中刷新页面后仍能恢复进度。',
      created_at: '2026-04-01T09:00:00Z',
      updated_at: '2026-04-01T09:06:00Z',
      status: 'in_progress',
      interview_count: 4,
      scenario_config: {
        name: '报告生成恢复验证',
      },
      dimensions: {
        customer_needs: {
          coverage: 100,
          items: [{ name: '确保刷新后生成进度不丢失' }],
        },
        business_process: {
          coverage: 100,
          items: [{ name: '生成中切页后可继续跟踪' }],
        },
        tech_constraints: {
          coverage: 100,
          items: [{ name: '前端通过状态接口恢复' }],
        },
        project_constraints: {
          coverage: 100,
          items: [{ name: '不要求用户手动重新发起生成' }],
        },
      },
      interview_log: [
        {
          question: '这次恢复链路最关键的目标是什么？',
          answer: '刷新页面后不要丢失报告生成进度。',
          dimension: 'customer_needs',
        },
      ],
    },
  ];
}

function buildSessionDetailPayload() {
  return {
    ...buildSessionsPayload()[0],
    reference_materials: [
      {
        name: '售后回访试点纪要.md',
        source: 'upload',
      },
    ],
    documents: [
      {
        name: '售后回访试点纪要.md',
        type: 'markdown',
      },
    ],
  };
}

function buildReportGenerationSessionDetailPayload() {
  const summary = buildSessionsPayload().find((item) => item.session_id === 'session-report-001') || {};
  return {
    ...summary,
    reference_materials: [
      {
        name: '报告恢复专项纪要.md',
        source: 'upload',
      },
    ],
    documents: [
      {
        name: '报告恢复专项纪要.md',
        type: 'markdown',
      },
    ],
  };
}

function buildNextQuestionPayload() {
  return {
    question: '目前最影响售后回访闭环效率的环节是什么？',
    options: [
      '问题归因不统一',
      '线索分发过慢',
      '复盘节奏不稳定',
      '系统记录不完整',
    ],
    multiSelect: false,
    ai_generated: true,
    question_generation_tier: 'primary',
    question_selected_lane: 'primary',
    question_runtime_profile: 'balanced',
    question_hedge_triggered: false,
    question_fallback_triggered: false,
    decision_meta: {
      lane: 'primary',
      planner_mode: 'standard',
    },
  };
}

function buildReportDetailPayload() {
  return {
    session_id: 'session-demo-001',
    title: '售后回访闭环试点报告',
    report_profile: 'balanced',
    report_variant_label: '普通版',
    source_report_name: '',
    content: [
      '# 售后回访闭环试点报告',
      '',
      '## 核心判断',
      '',
      '- 当前首要问题是回访归因与分发规则不统一。',
      '- 先围绕一个业务线验证闭环，再扩大到更多场景。',
      '',
      '## 下一步动作',
      '',
      '1. 对齐回访问题标签。',
      '2. 建立 48 小时闭环机制。',
    ].join('\n'),
  };
}

function buildStatusPayload() {
  return {
    authenticated: true,
    user: {
      id: 1,
      phone: '13800138000',
      account: 'admin',
      name: 'Admin',
      is_admin: true,
    },
    level: {
      key: 'professional',
      name: '专业版',
      description: '支持方案页与高级导出能力',
      sort_order: 30,
    },
    capabilities: {
      'report.generate': true,
      'report.profile.quality': true,
      'report.export.basic': true,
      'report.export.docx': true,
      'report.export.appendix': true,
      'solution.view': true,
      'solution.share': true,
      'presentation.generate': false,
      'interview.mode.quick': true,
      'interview.mode.standard': true,
      'interview.mode.deep': true,
    },
    allowed_report_profiles: ['balanced', 'quality'],
    report_profile_default: 'balanced',
    allowed_interview_modes: ['quick', 'standard', 'deep'],
    interview_mode_default: 'standard',
    has_valid_license: true,
    status: 'active',
    license_enforcement_enabled: true,
    license: {
      has_valid_license: true,
      status: 'active',
      license: {
        code: 'LIC-DEMO-001',
        level: 'professional',
      },
    },
    ai_available: false,
    sms_login_enabled: false,
    wechat_login_enabled: false,
  };
}

function buildLicenseCurrentPayload(statusPayload) {
  const statusLicensePayload = statusPayload?.license && typeof statusPayload.license === 'object'
    ? statusPayload.license
    : {};
  return {
    enforcement_enabled: Boolean(statusPayload?.license_enforcement_enabled),
    has_valid_license: Boolean(
      statusLicensePayload?.has_valid_license ?? statusPayload?.has_valid_license,
    ),
    status: safeText(statusLicensePayload?.status ?? statusPayload?.status, 'missing'),
    license: statusLicensePayload?.license ?? null,
  };
}

function buildConfigPayload() {
  return {
    meta: {
      restart_hint: '配置写入文件后通常需要重启服务。',
      source_meta: {
        env: { hint: '环境变量会写入 .env.local。' },
        config: { hint: '运行配置会写入 config.py。' },
        site: { hint: '前端共享配置会写入 site-config.js。' },
      },
    },
    env: {
      file: { path: '.env.local', exists: true },
      groups: [
        {
          id: 'ai',
          title: 'AI 配置',
          description: '模型与服务开关',
          items: [
            { key: 'MODEL_NAME', label: '模型名称', value: 'claude-sonnet-4', description: '默认模型' },
          ],
        },
      ],
    },
    config: {
      file: { path: 'config.py', exists: true },
      groups: [
        {
          id: 'runtime',
          title: '运行配置',
          description: '服务运行与调试开关',
          items: [
            { key: 'DEBUG_MODE', label: '调试模式', value: 'False', description: '生产关闭' },
          ],
        },
      ],
    },
    site: {
      file: { path: 'web/site-config.js', exists: true },
      groups: [
        {
          id: 'brand',
          title: '前端品牌',
          description: '站点标题与品牌文案',
          items: [
            { key: 'site_title', label: '站点标题', value: 'Intus', description: '默认标题' },
          ],
        },
      ],
    },
  };
}

async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const incomingUrl = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = incomingUrl.pathname || '/';
      if (pathname === '/') pathname = '/index.html';
      const relativePath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
      const filePath = join(WEB_DIR, relativePath);
      if (!filePath.startsWith(WEB_DIR)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('forbidden');
        return;
      }
      const body = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch (error) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  return await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveTcpPort() {
  const server = createServer(() => {});
  return await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address?.port);
      });
    });
  });
}

function attachProcessLog(stream, target, prefix) {
  if (!stream) return;
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    for (const rawLine of String(chunk || '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      target.push(`${prefix}${line}`);
      if (target.length > 120) {
        target.splice(0, target.length - 120);
      }
    }
  });
}

function recentLines(lines, limit = 8) {
  return lines.slice(-limit);
}

function liveCommandEnv(context) {
  return {
    ...process.env,
    INTUS_ROOT_DIR: ROOT_DIR,
    INTUS_ENV_FILE: context.envFilePath,
    INTUS_DATA_DIR: context.dataDir,
    PYTHONUNBUFFERED: '1',
  };
}

async function stopChildProcess(child, timeoutMs = 8000) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(timeoutMs),
  ]);
  if (child.exitCode === null && !child.signalCode) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('exit', resolve));
  }
}

async function runCommand(command, args, options = {}) {
  const {
    cwd = ROOT_DIR,
    env = process.env,
    timeoutMs = 120000,
  } = options;
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill('SIGKILL');
      resolve({ code: 124, stdout, stderr: `${stderr}\ncommand timed out after ${timeoutMs}ms`.trim() });
    }, timeoutMs);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk || '');
    });
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk || '');
    });
    child.once('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ code: Number(code ?? 1), stdout, stderr });
    });
  });
}

async function ensureLiveHelperScript(context) {
  if (context.liveHelperPath) return context.liveHelperPath;
  const helperPath = join(context.runtimeRoot, 'agent_browser_live_helper.py');
  await writeFile(helperPath, LIVE_HELPER_SCRIPT, 'utf8');
  context.liveHelperPath = helperPath;
  return helperPath;
}

function parseCommandJson(result, label) {
  try {
    const rawStdout = String(result.stdout || '').trim();
    const jsonStart = rawStdout.indexOf('{');
    const jsonEnd = rawStdout.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new Error('stdout 中未找到 JSON 片段');
    }
    return JSON.parse(rawStdout.slice(jsonStart, jsonEnd + 1));
  } catch (error) {
    throw new Error(`解析 ${label} 输出失败: ${safeText(error?.message, String(error))}`);
  }
}

async function runLiveHelper(context, args, options = {}) {
  const helperPath = await ensureLiveHelperScript(context);
  return await runCommand(
    'uv',
    [
      'run',
      ...LIVE_UV_WITH_ARGS,
      'python3',
      helperPath,
      ...args,
    ],
    {
      cwd: ROOT_DIR,
      env: liveCommandEnv(context),
      timeoutMs: options.timeoutMs || 120000,
    },
  );
}

async function waitForServerReady(baseUrl, logs, timeoutMs = 45000) {
  const startedAt = Date.now();
  let lastError = '';
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/status`);
      if (response.ok) {
        return;
      }
      lastError = `status=${response.status}`;
    } catch (error) {
      lastError = safeText(error?.message, String(error));
    }
    await sleep(500);
  }
  const logHint = recentLines(logs, 10).join('\n');
  throw new Error(
    [
      `真实后端启动超时: ${safeText(lastError, '未收到 /api/status 响应')}`,
      logHint,
    ].filter(Boolean).join('\n'),
  );
}

function buildLiveEnvFile(port) {
  return [
    'DEBUG_MODE=true',
    'ENABLE_AI=false',
    'ENABLE_DEBUG_LOG=false',
    'SUPPRESS_STATUS_POLL_ACCESS_LOG=true',
    'FOCUS_GENERATION_ACCESS_LOG=false',
    'SECRET_KEY=browser-live-secret',
    'INSTANCE_SCOPE_KEY=browser-live-instance',
    'SMS_PROVIDER=mock',
    `SMS_TEST_CODE=${LIVE_SMS_CODE}`,
    'LICENSE_ENFORCEMENT_ENABLED=true',
    'INTUS_TEST_REPORT_GENERATION_DELAY_SECONDS=5',
    'SERVER_HOST=127.0.0.1',
    `SERVER_PORT=${port}`,
  ].join('\n') + '\n';
}

async function generateLiveLicense(context) {
  const result = await runLiveHelper(
    context,
    [
      'generate-license',
      '--count',
      '1',
      '--duration-days',
      '30',
      '--level-key',
      'professional',
      '--note',
      'browser-live-smoke',
    ],
    { timeoutMs: 120000 },
  );

  if (result.code !== 0) {
    throw new Error(
      [
        '生成 live License 失败',
        safeText(result.stderr),
        safeText(result.stdout),
      ].filter(Boolean).join('\n'),
    );
  }

  const payload = parseCommandJson(result, 'live License');
  const licenseCode = safeText(payload?.licenses?.[0]?.code);
  if (!licenseCode) {
    throw new Error('live License 输出中缺少可用 code');
  }
  return licenseCode;
}

async function startLiveBackend() {
  const runtimeRoot = await mkdtemp(join(tmpdir(), 'intus-browser-live-'));
  const dataDir = join(runtimeRoot, 'data');
  const envFilePath = join(runtimeRoot, '.env.browser-live');
  const authDbPath = join(dataDir, 'auth', 'users.db');
  const licenseDbPath = join(dataDir, 'auth', 'licenses.db');
  const logs = [];
  await mkdir(join(dataDir, 'auth'), { recursive: true });

  const port = await reserveTcpPort();
  await writeFile(envFilePath, buildLiveEnvFile(port), 'utf8');

  const child = spawn('uv', ['run', 'web/server.py'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      INTUS_ENV_FILE: envFilePath,
      INTUS_DATA_DIR: dataDir,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  attachProcessLog(child.stdout, logs, '[stdout] ');
  attachProcessLog(child.stderr, logs, '[stderr] ');

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForServerReady(baseUrl, logs);
    const licenseCode = await generateLiveLicense({
      runtimeRoot,
      envFilePath,
      dataDir,
      authDbPath,
      licenseDbPath,
    });
    return {
      mode: 'live',
      baseUrl,
      runtimeRoot,
      dataDir,
      envFilePath,
      authDbPath,
      licenseDbPath,
      licenseCode,
      authPhone: LIVE_AUTH_PHONE,
      smsCode: LIVE_SMS_CODE,
      cleanup: async () => {
        await stopChildProcess(child);
        await rm(runtimeRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await stopChildProcess(child);
    await rm(runtimeRoot, { recursive: true, force: true });
    throw new Error(
      [
        safeText(error?.message, String(error)),
        ...recentLines(logs, 10),
      ].filter(Boolean).join('\n'),
    );
  }
}

function buildApiHandler(baseUrl, options = {}) {
  const solutionPayload = options.solutionPayload || buildSolutionPayload();
  const reportsPayload = options.reportsPayload || buildReportsPayload();
  const sessionsPayload = options.sessionsPayload || buildSessionsPayload();
  const sessionDetailPayload = options.sessionDetailPayload || buildSessionDetailPayload();
  const reportGenerationSessionDetailPayload = options.reportGenerationSessionDetailPayload || buildReportGenerationSessionDetailPayload();
  const nextQuestionPayload = options.nextQuestionPayload || buildNextQuestionPayload();
  const reportDetailPayload = options.reportDetailPayload || buildReportDetailPayload();
  let reportGenerationStatusBySession = {
    'session-demo-001': { active: false, state: 'idle' },
    'session-report-001': { active: false, state: 'idle' },
  };
  const initialStatusPayload = cloneJsonValue(options.statusPayload || buildStatusPayload());
  let currentStatusPayload = cloneJsonValue(initialStatusPayload);
  let currentLicenseCurrentPayload = cloneJsonValue(
    options.licenseCurrentPayload || buildLicenseCurrentPayload(currentStatusPayload),
  );
  const licenseActivatePayload = cloneJsonValue(options.licenseActivatePayload || null);
  const configPayload = buildConfigPayload();
  return async (route) => {
    const url = new URL(route.request().url());
    if (!url.href.startsWith(`${baseUrl}/api/`)) {
      await route.continue();
      return;
    }

    const { pathname, searchParams } = url;
    const method = route.request().method().toUpperCase();

    if (method === 'GET' && pathname === '/api/status') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(currentStatusPayload),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/licenses/current') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(currentLicenseCurrentPayload),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/licenses/activate' && licenseActivatePayload) {
      const nextLicenseCurrentPayload = cloneJsonValue(licenseActivatePayload);
      currentLicenseCurrentPayload = nextLicenseCurrentPayload;
      currentStatusPayload = {
        ...currentStatusPayload,
        authenticated: true,
        has_valid_license: Boolean(nextLicenseCurrentPayload?.has_valid_license),
        status: safeText(nextLicenseCurrentPayload?.status, currentStatusPayload?.status || 'active'),
        license_enforcement_enabled: Boolean(
          nextLicenseCurrentPayload?.enforcement_enabled ?? currentStatusPayload?.license_enforcement_enabled,
        ),
        license: {
          has_valid_license: Boolean(nextLicenseCurrentPayload?.has_valid_license),
          status: safeText(nextLicenseCurrentPayload?.status, currentStatusPayload?.status || 'active'),
          license: cloneJsonValue(nextLicenseCurrentPayload?.license || null),
        },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(licenseActivatePayload),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/scenarios') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json([]) });
      return;
    }
    if (method === 'GET' && pathname === '/api/sessions') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(sessionsPayload),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/sessions/draft-from-input') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          topic: '工作台新建访谈验证',
          description: '',
          description_generated: false,
          confidence: 0.52,
          reason: 'mock 输入只用于验证弹框链路',
          source: 'mock',
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/sessions/session-demo-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(sessionDetailPayload),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/sessions/session-report-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(reportGenerationSessionDetailPayload),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/sessions/session-demo-001/submit-answer') {
      let payload = {};
      try {
        payload = route.request().postDataJSON();
      } catch (_error) {
        payload = {};
      }
      const submittedSession = cloneJsonValue(sessionDetailPayload);
      submittedSession.updated_at = nowIso();
      submittedSession.interview_count = Math.max(Number(submittedSession.interview_count || 0), 2);
      submittedSession.interview_log = [
        ...(Array.isArray(submittedSession.interview_log) ? submittedSession.interview_log : []),
        {
          question: safeText(payload?.question, '目前最影响售后回访闭环效率的环节是什么？'),
          answer: safeText(payload?.answer, '问题归因不统一'),
          dimension: safeText(payload?.dimension, 'customer_needs'),
          is_follow_up: Boolean(payload?.is_follow_up),
        },
      ];
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(submittedSession),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/sessions/session-demo-001/next-question') {
      if (Number(options?.nextQuestionDelayMs || 0) > 0) {
        await sleep(Number(options.nextQuestionDelayMs));
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(nextQuestionPayload),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/sessions/session-report-001/report-readiness') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          ready: true,
          can_generate: true,
          message: '',
          report_profile: 'balanced',
        }),
      });
      return;
    }
    if (method === 'POST' && pathname === '/api/sessions/session-report-001/generate-report') {
      const now = nowIso();
      reportGenerationStatusBySession['session-report-001'] = {
        active: true,
        state: 'generating',
        action: 'generate',
        progress: 42,
        stage_index: 3,
        total_stages: 6,
        started_at: '2026-04-01T09:06:00Z',
        updated_at: now,
        message: '正在生成访谈报告',
        report_profile: 'balanced',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(reportGenerationStatusBySession['session-report-001']),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/status/report-generation/session-demo-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          active: false,
          state: 'idle',
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/status/report-generation/session-report-001') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json(reportGenerationStatusBySession['session-report-001'] || { active: false, state: 'idle' }),
      });
      return;
    }
    if (method === 'GET' && pathname.startsWith('/api/status/thinking/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({ active: false, state: 'idle' }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/status/web-search') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({ active: false, state: 'idle' }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/reports') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json(reportsPayload) });
      return;
    }
    if (method === 'GET' && pathname === '/api/reports/demo-report') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json(reportDetailPayload) });
      return;
    }
    if (method === 'GET' && pathname === '/api/metrics') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({ total: 12, last_n: Number(searchParams.get('last_n') || 200), failures: 0, items: [] }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/summaries') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          enabled: true,
          cache_enabled: true,
          cached_count: 0,
          cache_size_bytes: 0,
          threshold: 6,
          target_length: 800,
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/admin/ownership-migrations') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json({ items: [] }) });
      return;
    }
    if (method === 'GET' && pathname === '/api/admin/licenses/summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          totals: { active: 1, revoked: 0, expired: 0 },
          enforcement: { enabled: true, follow_default: false },
          presentation_feature: { enabled: true, follow_default: false },
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/admin/usage/summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          filters: { range: '30d', from: '', to: '', query: '', scope: '' },
          summary: {
            total_users: 2,
            matched_users: 2,
            active_users: 1,
            session_count: 3,
            report_count: 2,
            document_count: 1,
            document_size_total: 3072,
            license_status_counts: { active: 1, missing: 1 },
            license_level_counts: { professional: 1, missing: 1 },
            instance_scope_counts: { 'cloud-a': 1 },
            active_definition: '统计周期内有业务活动',
            login_tracking_available: false,
          },
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/admin/usage/users') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          filters: { range: '30d', from: '', to: '', query: '', scope: '' },
          summary: {
            total_users: 2,
            matched_users: 2,
            active_users: 1,
            session_count: 3,
            report_count: 2,
            document_count: 1,
            document_size_total: 3072,
          },
          pagination: { page: 1, page_size: 20, count: 2, total_pages: 1 },
          items: [
            {
              user: { id: 1, account: '运营测试用户', phone: '13800000000', email: '', wechat_bound: true },
              license: { status: 'active', level_key: 'professional', level_name: '专业版', expires_at: '' },
              usage: {
                active: true,
                session_count: 3,
                report_count: 2,
                document_count: 1,
                document_size_total: 3072,
                answer_count: 8,
                instance_scope_keys: ['cloud-a'],
                last_activity_at: '2026-04-29T00:00:00Z',
                last_activity_in_range_at: '2026-04-29T00:00:00Z',
                last_login_at: '',
                login_tracking_available: false,
              },
            },
          ],
        }),
      });
      return;
    }
    if (method === 'GET' && pathname.startsWith('/api/admin/usage/users/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          filters: { range: '30d', from: '', to: '', query: '', scope: '' },
          summary: {},
          detail: {
            user_id: 1,
            found: true,
            profile: {
              user: { id: 1, account: '运营测试用户', phone: '13800000000', email: '', wechat_bound: true },
              license: { status: 'active', level_key: 'professional', level_name: '专业版' },
              usage: { active: true, session_count: 1, report_count: 1, document_count: 1 },
            },
            sessions: [{ session_id: 'demo-session', topic: '运营统计会话', status: 'completed', updated_at: '2026-04-29T00:00:00Z' }],
            reports: [{ file_name: 'demo-report.md', topic: '运营统计报告', created_at: '2026-04-29T00:00:00Z' }],
            documents: [{ doc_id: 'demo-doc', name: '需求文档.docx', parse_status: 'parsed', original_size: 3072, uploaded_at: '2026-04-29T00:00:00Z' }],
          },
        }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/admin/config-center') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json(configPayload) });
      return;
    }
    if (method === 'GET' && pathname === '/api/reports/demo-report/solution') {
      await route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: json(solutionPayload) });
      return;
    }
    if (method === 'POST' && pathname === '/api/reports/demo-report/solution/share') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({ share_url: `${baseUrl}/solution.html?share=demo-public-token` }),
      });
      return;
    }
    if (method === 'GET' && pathname === '/api/public/solutions/demo-public-token') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: json({
          ...solutionPayload,
          share_mode: 'public',
          report_name: '',
          viewer_capabilities: { solution_share: false },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json; charset=utf-8',
      body: json({ error: `unmocked api: ${method} ${pathname}` }),
    });
  };
}

async function runWithPage(browser, baseUrl, initScript, callback, initArg = undefined, apiOptions = undefined, apiMode = 'mock', contextOptions = undefined, runtimeOptions = undefined) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    ...(contextOptions || {}),
  });
  await context.addInitScript(() => {
    localStorage.setItem('intus_intro_seen', 'true');
  });
  if (initScript) {
    await context.addInitScript(initScript, initArg);
  }
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${safeText(error?.message, String(error))}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = safeText(message.text());
      if (isIgnorableConsoleError(text)) {
        return;
      }
      const ignoredConsolePatterns = Array.isArray(runtimeOptions?.ignoredConsolePatterns)
        ? runtimeOptions.ignoredConsolePatterns
        : [];
      if (ignoredConsolePatterns.some((pattern) => pattern instanceof RegExp && pattern.test(text))) {
        return;
      }
      errors.push(`console.error: ${text}`);
    }
  });
  if (apiMode === 'mock') {
    await page.route('**/api/**', buildApiHandler(baseUrl, apiOptions));
  }
  try {
    await callback(page);
    if (errors.length) {
      throw new Error(errors.slice(0, 6).join('\n'));
    }
  } finally {
    await context.close();
  }
}

async function fetchPageJson(page, path, options = {}) {
  return await page.evaluate(
    async ({ targetPath, requestOptions }) => {
      const response = await fetch(targetPath, {
        credentials: 'same-origin',
        ...requestOptions,
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch (_error) {
        payload = null;
      }
      return {
        ok: response.ok,
        status: response.status,
        text,
        payload,
      };
    },
    {
      targetPath: path,
      requestOptions: options,
    },
  );
}

async function waitForLiveAppState(page, timeoutMs = 20000) {
  const stateHandle = await page.waitForFunction(() => {
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(node);
      return !node.hidden
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && node.getClientRects().length > 0;
    };
    const licenseInput = document.querySelector('#license-code-input');
    if (isVisible(licenseInput)) return 'license';
    const titleHit = Array.from(document.querySelectorAll('h2, h3')).some(
      (node) => isVisible(node) && String(node.textContent || '').includes('访谈会话'),
    );
    const primaryActionHit = Array.from(document.querySelectorAll('button')).some(
      (button) => isVisible(button) && String(button.textContent || '').includes('开始访谈'),
    );
    if (titleHit || primaryActionHit) return 'home';
    return '';
  }, { timeout: timeoutMs });
  return safeText(await stateHandle.jsonValue(), 'unknown');
}

async function waitForLiveHomeReady(page, timeoutMs = 25000) {
  await page.waitForFunction(() => {
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(node);
      return !node.hidden
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && node.getClientRects().length > 0;
    };
    const titleHit = Array.from(document.querySelectorAll('h2, h3')).some(
      (node) => isVisible(node) && String(node.textContent || '').includes('访谈会话'),
    );
    const primaryActionHit = Array.from(document.querySelectorAll('button')).some((button) => {
      const text = String(button.textContent || '');
      return isVisible(button) && (text.includes('开始访谈') || text.includes('报告'));
    });
    const gateVisible = isVisible(document.querySelector('#license-code-input'));
    return (titleHit || primaryActionHit) && !gateVisible;
  }, { timeout: timeoutMs });
}

async function performLiveLoginAndLicense(page, baseUrl, liveContext) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  let initialState = '';
  try {
    initialState = await waitForLiveAppState(page, 5000);
  } catch (_error) {
    initialState = '';
  }

  if (initialState === 'home') {
    await waitForLiveHomeReady(page, 10000);
    liveContext.storageState = await page.context().storageState();
    return await lookupLiveUserRecord(liveContext);
  }

  if (initialState === 'license') {
    const activateResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/licenses/activate') && response.request().method() === 'POST',
      { timeout: 20000 },
    );
    await page.fill('#license-code-input', liveContext.licenseCode);
    await page.getByRole('button', { name: '绑定 License', exact: true }).click({ timeout: 20000 });
    const activateResponse = await activateResponsePromise;
    if (!activateResponse.ok()) {
      throw new Error(`License 绑定失败: status=${activateResponse.status()}`);
    }
    await waitForLiveHomeReady(page, 25000);
    liveContext.storageState = await page.context().storageState();
    return await lookupLiveUserRecord(liveContext);
  }

  await page.waitForSelector('#auth-account', { timeout: 20000 });
  await page.fill('#auth-account', liveContext.authPhone);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => String(button.textContent || '').includes('获取验证码'));
    return Boolean(target && !target.disabled);
  }, { timeout: 20000 });
  await page.locator('button:visible').filter({ hasText: '获取验证码' }).first().click({ timeout: 20000 });
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some((button) => /后重发|发送中/.test(String(button.textContent || '')));
  }, { timeout: 15000 });

  await page.fill('#auth-code', liveContext.smsCode);
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((button) => String(button.textContent || '').trim() === '登录');
    return Boolean(target && !target.disabled);
  }, { timeout: 20000 });
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login/code') && response.request().method() === 'POST',
    { timeout: 20000 },
  );
  await page.getByRole('button', { name: '登录', exact: true }).click({ timeout: 20000 });
  const loginResponse = await loginResponsePromise;
  if (!loginResponse.ok()) {
    throw new Error(`验证码登录失败: status=${loginResponse.status()}`);
  }

  let nextState = 'unknown';
  try {
    nextState = await waitForLiveAppState(page, 20000);
  } catch (_error) {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    try {
      nextState = await waitForLiveAppState(page, 10000);
    } catch (retryError) {
      throw new Error(`登录后未进入预期状态: ${safeText(retryError?.message, String(retryError))}`);
    }
  }

  if (nextState === 'license') {
    const activateResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/licenses/activate') && response.request().method() === 'POST',
      { timeout: 20000 },
    );
    await page.fill('#license-code-input', liveContext.licenseCode);
    await page.getByRole('button', { name: '绑定 License', exact: true }).click({ timeout: 20000 });
    const activateResponse = await activateResponsePromise;
    if (!activateResponse.ok()) {
      throw new Error(`License 绑定失败: status=${activateResponse.status()}`);
    }
  }

  try {
    await waitForLiveHomeReady(page, 25000);
  } catch (_error) {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await waitForLiveHomeReady(page, 12000);
  }
  liveContext.storageState = await page.context().storageState();
  return await lookupLiveUserRecord(liveContext);
}

async function ensureLiveReportFixture(page, liveContext) {
  if (liveContext.reportFixture) {
    return liveContext.reportFixture;
  }
  let currentUser = liveContext.userRecord || null;
  if (!currentUser?.id) {
    await performLiveLoginAndLicense(page, liveContext.baseUrl, liveContext);
    currentUser = await lookupLiveUserRecord(liveContext);
  }
  const result = await runLiveHelper(
    liveContext,
    [
      'seed-report',
      '--owner-user-id',
      String(currentUser.id),
      '--title',
      LIVE_REPORT_TITLE,
    ],
    { timeoutMs: 120000 },
  );
  if (result.code !== 0) {
    throw new Error(
      [
        'seed live report 失败',
        safeText(result.stderr),
        safeText(result.stdout),
      ].filter(Boolean).join('\n'),
    );
  }
  const payload = parseCommandJson(result, 'live report fixture');
  const reportName = safeText(payload?.report_name);
  if (!reportName) {
    throw new Error('live report fixture 缺少 report_name');
  }
  liveContext.reportFixture = {
    report_name: reportName,
    title: safeText(payload?.title, LIVE_REPORT_TITLE),
    report_path: safeText(payload?.report_path),
  };
  return liveContext.reportFixture;
}

async function ensureLiveReportGenerationSessionFixture(page, liveContext) {
  if (liveContext.reportGenerationSessionFixture) {
    return liveContext.reportGenerationSessionFixture;
  }
  let currentUser = liveContext.userRecord || null;
  if (!currentUser?.id) {
    await performLiveLoginAndLicense(page, liveContext.baseUrl, liveContext);
    currentUser = await lookupLiveUserRecord(liveContext);
  }
  const result = await runLiveHelper(
    liveContext,
    [
      'seed-session',
      '--owner-user-id',
      String(currentUser.id),
      '--title',
      LIVE_REPORT_GENERATION_SESSION_TITLE,
    ],
    { timeoutMs: 120000 },
  );
  if (result.code !== 0) {
    throw new Error(
      [
        'seed live report generation session 失败',
        safeText(result.stderr),
        safeText(result.stdout),
      ].filter(Boolean).join('\n'),
    );
  }
  const payload = parseCommandJson(result, 'live report generation session fixture');
  const sessionId = safeText(payload?.session_id);
  if (!sessionId) {
    throw new Error('live report generation session fixture 缺少 session_id');
  }
  liveContext.reportGenerationSessionFixture = {
    session_id: sessionId,
    title: safeText(payload?.title, LIVE_REPORT_GENERATION_SESSION_TITLE),
    session_path: safeText(payload?.session_path),
  };
  return liveContext.reportGenerationSessionFixture;
}

async function lookupLiveUserRecord(liveContext) {
  if (liveContext.userRecord?.id) {
    return liveContext.userRecord;
  }
  const result = await runLiveHelper(
    liveContext,
    [
      'lookup-user',
      '--account',
      liveContext.authPhone,
    ],
    { timeoutMs: 60000 },
  );
  if (result.code !== 0) {
    throw new Error(
      [
        '查询 live 用户失败',
        safeText(result.stderr),
        safeText(result.stdout),
      ].filter(Boolean).join('\n'),
    );
  }
  const payload = parseCommandJson(result, 'live user lookup');
  if (!payload?.found || !payload?.user?.id) {
    throw new Error(`未找到 live 用户: ${liveContext.authPhone}`);
  }
  liveContext.userRecord = payload.user;
  return liveContext.userRecord;
}

async function scenarioHelpDocs(browser, baseUrl) {
  for (const mode of ['light', 'dark']) {
    await runWithPage(
      browser,
      baseUrl,
      (themeMode) => {
        localStorage.setItem('intus_theme_mode', themeMode);
      },
      async (page) => {
        await page.goto(`${baseUrl}/help.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('text=帮助文档', { timeout: 10000 });
        const title = await page.title();
        if (!title.includes('帮助文档')) {
          throw new Error(`帮助页标题异常: ${title}`);
        }
        const progressCardCount = await page.locator('.sidebar-card:visible', { hasText: '阅读进度' }).count();
        if (progressCardCount > 0) {
          throw new Error('帮助页侧栏不应继续显示阅读进度卡片');
        }
        const topActionCount = await page.locator('.top-actions:visible, a:visible', { hasText: /产品介绍|返回工作台/ }).count();
        if (topActionCount > 0) {
          throw new Error(`帮助页顶部不应继续展示产品介绍或返回工作台按钮: ${topActionCount}`);
        }
      },
      mode,
    );
  }
  return '标题与帮助文档主文案可见，侧栏阅读进度和顶部操作按钮已移除';
}

async function scenarioSolutionShare(browser, baseUrl) {
  await runWithPage(browser, baseUrl, null, async (page) => {
    await page.goto(`${baseUrl}/solution.html?report=demo-report`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('#btn-share', { timeout: 10000 });
    await page.click('#btn-share');
    await page.waitForSelector('#solution-share-panel:not([hidden])', { timeout: 10000 });
    const shareValue = await page.inputValue('#solution-share-input');
    if (!shareValue.includes('share=demo-public-token')) {
      throw new Error(`分享链接异常: ${shareValue}`);
    }
  });
  return '方案页成功渲染，分享面板可打开并写入匿名只读链接';
}

async function scenarioWorkbenchComposerEntry(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      const taskInput = page.locator('[data-workbench-task-input]');
      await taskInput.waitFor({ timeout: 15000 });

      const legacyTitleCount = await page.locator('h2:has-text("访谈会话")').count();
      if (legacyTitleCount > 0) {
        throw new Error('工作台首屏不应继续显示“访谈会话”旧标题');
      }

      const placeholder = await taskInput.getAttribute('placeholder');
      if (String(placeholder || '').includes('例如')) {
        throw new Error(`工作台主题占位文案不应包含“例如”: ${placeholder}`);
      }

      await page.getByText('所有会话', { exact: true }).waitFor({ timeout: 15000 });
      const sessionListOptionsButton = page.getByRole('button', { name: '会话显示与排序', exact: true });
      await sessionListOptionsButton.click({ timeout: 15000 });
      const activeGroupButton = page.locator('.dv-sidebar-session-options button', { hasText: '不分组' }).first();
      await activeGroupButton.waitFor({ timeout: 15000 });
      await expectNeutralControl(activeGroupButton, '侧栏会话显示方式选中按钮');

      await page.locator('.dv-workbench-quote-carousel:visible').waitFor({ timeout: 15000 });
      const carouselBox = await page.locator('.dv-workbench-quote-carousel:visible').boundingBox();
      const viewportSize = page.viewportSize();
      if (!carouselBox || !viewportSize || carouselBox.y + carouselBox.height < viewportSize.height - 96) {
        throw new Error(`工作台底部名言轮播应贴近首屏底部: box=${JSON.stringify(carouselBox)} viewport=${JSON.stringify(viewportSize)}`);
      }
      const quoteTextAlign = await page.locator('.dv-workbench-quote-text:visible').evaluate((el) => getComputedStyle(el).textAlign);
      if (quoteTextAlign !== 'center') {
        throw new Error(`名言正文应居中展示: ${quoteTextAlign}`);
      }
      const quoteSourceAlign = await page.locator('.dv-workbench-quote-source:visible').evaluate((el) => getComputedStyle(el).textAlign);
      if (quoteSourceAlign !== 'right') {
        throw new Error(`名言出处应在正文下方偏右展示: ${quoteSourceAlign}`);
      }
      const quoteDotCount = await page.locator('.dv-workbench-quote-dot').count();
      if (quoteDotCount !== 10) {
        throw new Error(`工作台底部名言轮播应展示 10 个滚动点: ${quoteDotCount}`);
      }
      await page.locator('.dv-workbench-quote-card:visible', { hasText: '知人者智，自知者明' }).waitFor({ timeout: 15000 });
      await page.getByRole('tab', { name: '切换名言 2', exact: true }).click({ timeout: 15000 });
      await page.locator('.dv-workbench-quote-card:visible', { hasText: '凡事预则立，不预则废' }).waitFor({ timeout: 15000 });

      const topic = '数字化营销战略';
      const expectedDraftTopic = '工作台新建访谈验证';
      await taskInput.fill(topic);
      await page.getByRole('button', { name: '开始访谈', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-guide="guide-modal"]:visible', { timeout: 15000 });
      await page.waitForFunction((expected) => {
        const input = document.querySelector('[data-guide="guide-topic"]');
        return input && input.value === expected;
      }, expectedDraftTopic, { timeout: 15000 });
      const modalTopic = await page.locator('[data-guide="guide-topic"]').inputValue();
      if (modalTopic !== expectedDraftTopic) {
        throw new Error(`新建访谈弹框未应用整理后的工作台主题: ${modalTopic}`);
      }
      const draftStatus = await page.locator('.dv-session-draft-status:visible').textContent({ timeout: 15000 });
      if (!String(draftStatus || '').includes('已整理为访谈主题')) {
        throw new Error(`新建访谈弹框应提示草稿整理状态: ${draftStatus}`);
      }
    },
  );
  return '工作台开始访谈会打开新建访谈弹框，并自动应用整理后的主题草稿';
}

async function scenarioSidebarLibraryAgentsTrim(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-workbench-task-input]', { timeout: 15000 });
      const sidebarBox = await page.locator('.dv-app-sidebar:visible').first().boundingBox();
      if (!sidebarBox || sidebarBox.x > 2) {
        throw new Error(`侧栏应贴近窗口左侧展示: ${JSON.stringify(sidebarBox)}`);
      }
      await page.locator('.dv-app-sidebar .dv-sidebar-brand-row:visible').waitFor({ timeout: 15000 });
      await page.locator('.dv-app-sidebar .dv-sidebar-brand-row:visible').getByText('Intus', { exact: true }).waitFor({ timeout: 15000 });
      const collapseButton = page.getByRole('button', { name: '收起侧边栏', exact: true });
      await collapseButton.click({ timeout: 15000 });
      await page.waitForTimeout(260);
      const collapsedSidebarBox = await page.locator('.dv-app-sidebar:visible').first().boundingBox();
      if (!collapsedSidebarBox || collapsedSidebarBox.width >= sidebarBox.width - 80) {
        throw new Error(`侧栏折叠后宽度应明显收窄: before=${JSON.stringify(sidebarBox)} after=${JSON.stringify(collapsedSidebarBox)}`);
      }
      const collapsedBrandButton = page.getByRole('button', { name: '展开侧边栏', exact: true });
      const collapsedToggleCount = await page.locator('.dv-app-shell.is-sidebar-collapsed .dv-sidebar-collapse-toggle:visible').count();
      if (collapsedToggleCount > 0) {
        throw new Error('折叠后不应继续显示独立侧栏收起按钮，应由 logo hover 切换为展开入口');
      }
      await collapsedBrandButton.hover({ timeout: 15000 });
      await page.locator('.dv-app-shell.is-sidebar-collapsed .dv-sidebar-brand-open-icon:visible').waitFor({ timeout: 15000 });
      await collapsedBrandButton.click({ timeout: 15000 });
      await page.waitForTimeout(260);
      await page.getByText('所有会话', { exact: true }).waitFor({ timeout: 15000 });
      await page.locator('.dv-sidebar-session-item', { hasText: '售后回访试点会话' }).first().waitFor({ timeout: 15000 });

      const sidebarSearchCount = await page.locator('.dv-app-sidebar .dv-sidebar-search:visible').count();
      if (sidebarSearchCount > 0) {
        throw new Error('侧栏不应继续显示搜索入口');
      }

      const sidebarAccountCount = await page.locator('.dv-app-sidebar .dv-sidebar-account:visible').count();
      if (sidebarAccountCount > 0) {
        throw new Error('侧栏不应继续显示账号卡片');
      }

      await page.locator('.dv-app-sidebar:visible').getByText('© Intus 见真', { exact: true }).waitFor({ timeout: 15000 });
      await page.locator('.dv-app-sidebar:visible').getByText(/^v\d+\.\d+\.\d+$/).waitFor({ timeout: 15000 });
      const poweredFeedbackCount = await page.locator('.dv-sidebar-powered:visible').getByRole('link', { name: '产品反馈', exact: true }).count();
      if (poweredFeedbackCount > 0) {
        throw new Error('产品反馈不应继续显示在侧栏底部版权行');
      }
      const sidebarSettingsButton = page.locator('.dv-app-sidebar button[aria-label="账号与外观设置"]:visible').first();
      const settingsRowBox = await page.locator('.dv-sidebar-settings:visible').first().boundingBox();
      const settingsButtonBox = await sidebarSettingsButton.boundingBox();
      const settingsIconBox = await sidebarSettingsButton.locator('svg').first().boundingBox();
      if (!settingsIconBox || settingsIconBox.width < 19 || settingsIconBox.height < 19) {
        throw new Error(`侧栏设置 icon 尺寸偏小: ${JSON.stringify(settingsIconBox)}`);
      }
      const poweredBox = await page.locator('.dv-sidebar-powered:visible').first().boundingBox();
      const poweredFirstTextBox = await page.locator('.dv-sidebar-powered:visible > span').first().boundingBox();
      const poweredLastTextBox = await page.locator('.dv-sidebar-powered:visible > span').last().boundingBox();
      if (!settingsRowBox || !settingsButtonBox || !poweredBox || !poweredFirstTextBox || !poweredLastTextBox) {
        throw new Error('无法读取侧栏底部版权版本布局');
      }
      const poweredContentRightGap = settingsRowBox.x + settingsRowBox.width - poweredLastTextBox.x - poweredLastTextBox.width;
      if (poweredFirstTextBox.x <= settingsButtonBox.x + settingsButtonBox.width + 16 || poweredContentRightGap > 4) {
        throw new Error('侧栏版权版本应贴菜单栏右侧展示，并与左侧设置按钮分布均衡');
      }
      await sidebarSettingsButton.click({ timeout: 15000 });
      const sidebarAccountMenu = page.locator('.dv-app-sidebar .account-menu:visible').first();
      await sidebarAccountMenu.getByRole('button', { name: '管理员中心', exact: true }).waitFor({ timeout: 15000 });
      const adminCenterBox = await sidebarAccountMenu.getByRole('button', { name: '管理员中心', exact: true }).boundingBox();
      const feedbackBox = await sidebarAccountMenu.getByRole('link', { name: '产品反馈', exact: true }).boundingBox();
      if (!adminCenterBox || !feedbackBox || feedbackBox.y <= adminCenterBox.y) {
        throw new Error('产品反馈应显示在账号菜单的管理员中心下方');
      }
      await page.keyboard.press('Escape');

      await page.locator('.dv-side-nav button:has-text("库")').click({ timeout: 15000 });
      await page.waitForSelector('.dv-library-shell', { timeout: 15000 });
      const libraryHeroCount = await page.locator('.dv-library-hero:visible').count();
      if (libraryHeroCount > 0) {
        throw new Error('库页不应继续显示顶部 hero 区');
      }
      const librarySearchCount = await page.locator('.dv-library-search:visible').count();
      if (librarySearchCount > 0) {
        throw new Error('库页不应继续显示搜索框');
      }
      const libraryDocumentFilterCount = await page.locator('.dv-library-segment button:has-text("资料"):visible').count();
      if (libraryDocumentFilterCount > 0) {
        throw new Error('库页不应继续显示资料筛选入口');
      }
      const libraryDocumentItemCount = await page.locator('.dv-library-item:visible .dv-library-type:has-text("资料")').count();
      if (libraryDocumentItemCount > 0) {
        throw new Error('库页不应继续显示资料资源模块');
      }
      const libraryImportItemCount = await page.locator('.dv-library-item:has-text("导入资料"):visible').count();
      if (libraryImportItemCount > 0) {
        throw new Error('库页不应继续显示导入资料入口');
      }

      await page.locator('.dv-side-nav button:has-text("Agents")').click({ timeout: 15000 });
      await page.waitForSelector('.dv-agents-shell', { timeout: 15000 });
      const agentsHeroCount = await page.locator('.dv-agents-hero:visible').count();
      if (agentsHeroCount > 0) {
        throw new Error('Agents 页不应继续显示顶部 hero 区');
      }
      const agentCards = page.locator('.dv-agent-card:visible');
      const agentCardCount = await agentCards.count();
      if (agentCardCount !== 3) {
        throw new Error(`Agents 页应只显示 3 张业务能力卡片，当前为 ${agentCardCount}`);
      }
      const agentsText = await page.locator('.dv-agents-shell').innerText();
      for (const hiddenText of ['License 管理', '配置中心', 'License', '配置', '访谈助手', '报告生成', '导出与归档', '开始访谈', '查看报告', '选择报告']) {
        if (agentsText.includes(hiddenText)) {
          throw new Error(`Agents 页不应继续显示“${hiddenText}”`);
        }
      }
      for (const expectedText of ['🌱报告发芽', '另一个角度去审视访谈报告', '⭕️圆桌会议', '让全球顶级大佬为你的访谈报告建言献策', '📄方案生成', '将访谈报告一键生成可演示的方案 PPT']) {
        if (!agentsText.includes(expectedText)) {
          throw new Error(`Agents 页缺少“${expectedText}”`);
        }
      }
      const beforeAgentCardClickUrl = page.url();
      await agentCards.first().click({ timeout: 15000 });
      await page.waitForTimeout(250);
      if (page.url() !== beforeAgentCardClickUrl) {
        throw new Error(`Agents 卡片不应继续点击跳转: ${beforeAgentCardClickUrl} -> ${page.url()}`);
      }
      const agentsStillVisible = await page.locator('.dv-agents-shell:visible').count();
      if (agentsStillVisible <= 0) {
        throw new Error('Agents 卡片点击后不应离开 Agents 页');
      }
      const comingSoonCount = await page.locator('.dv-agent-card-foot:visible', { hasText: '即将上线' }).count();
      if (comingSoonCount !== 2) {
        throw new Error(`Agents 页应显示 2 个“即将上线”状态，当前为 ${comingSoonCount}`);
      }
      const categoryBadgeCount = await page.locator('.dv-agents-shell .dv-library-type:visible').count();
      if (categoryBadgeCount > 0) {
        throw new Error('Agents 卡片不应继续显示顶部类型标签');
      }
      const footActionCount = await page.locator('.dv-agent-card-foot strong:visible').count();
      if (footActionCount > 0) {
        throw new Error('Agents 卡片脚部不应继续显示右侧动作文案');
      }
    },
  );
  return '侧栏、库页和 Agents 页冗余展示已收敛';
}

async function scenarioReportListTrim(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '报告', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('.dv-report-surface-shell', { timeout: 15000 });
      await page.waitForSelector('[data-report-key="demo-report"]', { timeout: 15000 });

      const reportIntroTitleCount = await page.locator('.dv-report-surface-shell h2:has-text("访谈报告"):visible').count();
      if (reportIntroTitleCount > 0) {
        throw new Error('报告列表页不应继续显示顶部“访谈报告”介绍标题');
      }
      const reportSearchInputCount = await page.locator('input[placeholder*="搜索报告"]:visible').count();
      if (reportSearchInputCount > 0) {
        throw new Error('报告列表页不应继续显示报告搜索框');
      }
      const activeReportGroupButton = page.getByRole('button', { name: '不分组', exact: true }).first();
      await activeReportGroupButton.waitFor({ timeout: 15000 });
      await expectNeutralControl(activeReportGroupButton, '报告列表显示方式选中按钮', { expectDark: true });
      await page.getByRole('button', { name: '批量管理', exact: true }).waitFor({ timeout: 15000 });
      const listSummaryText = await page.locator('.dv-report-surface-shell').innerText();
      if (!listSummaryText.includes('共 1 条')) {
        throw new Error(`报告列表页应保留统计信息，当前文本: ${safeText(listSummaryText)}`);
      }
    },
  );
  return '报告列表页顶部说明与搜索入口已移除，列表工具区保留';
}

async function openAdminCenterFromAccountMenu(page) {
  await page.locator('button[aria-label="账号与外观设置"]:visible').first().click({ timeout: 15000 });
  await page.locator('.account-menu:visible button:has-text("管理员中心")').first().click({ timeout: 15000 });
}

async function scenarioAdminConfigEntry(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await openAdminCenterFromAccountMenu(page);
      await page.waitForSelector('h2:has-text("管理员中心")', { timeout: 15000 });
    },
  );
  return '管理员账号可从侧栏设置菜单进入管理员中心';
}

async function scenarioSolutionPublicReadonly(browser, baseUrl) {
  await runWithPage(browser, baseUrl, null, async (page) => {
    await page.goto(`${baseUrl}/solution.html?share=demo-public-token`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('text=外部分享 · 只读方案', { timeout: 10000 });
    const actionBarHidden = await page.locator('#solution-action-bar').evaluate((element) => element.hidden);
    if (!actionBarHidden) {
      throw new Error('公开分享模式下不应显示分享动作栏');
    }
    const shareButtonCount = await page.locator('#btn-share:visible').count();
    if (shareButtonCount > 0) {
      throw new Error('公开分享模式下不应暴露分享按钮');
    }
  });
  return '公开分享模式可渲染，并保持只读边界';
}

async function scenarioSolutionPublicReadonlyRefresh(browser, baseUrl) {
  await runWithPage(browser, baseUrl, null, async (page) => {
    await page.goto(`${baseUrl}/solution.html?share=demo-public-token`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('text=外部分享 · 只读方案', { timeout: 10000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 10000 });
    await page.waitForSelector('text=外部分享 · 只读方案', { timeout: 10000 });
    const actionBarHidden = await page.locator('#solution-action-bar').evaluate((element) => element.hidden);
    if (!actionBarHidden) {
      throw new Error('公开分享页刷新后不应显示分享动作栏');
    }
    const shareButtonCount = await page.locator('#btn-share:visible').count();
    if (shareButtonCount > 0) {
      throw new Error('公开分享页刷新后不应暴露分享按钮');
    }
  });
  return '公开分享页刷新后仍保持只读方案边界';
}

async function scenarioLoginView(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("欢迎回来")', { timeout: 15000 });
      await page.waitForSelector('text=登录后即可使用访谈与报告功能', { timeout: 15000 });
      await page.waitForSelector('text=当前未启用可用登录方式，请联系管理员。', { timeout: 15000 });
      if (await page.locator('#auth-account').isVisible()) {
        throw new Error('短信登录关闭时，不应展示手机号输入框');
      }
      if (await page.locator('#auth-code').isVisible()) {
        throw new Error('短信登录关闭时，不应展示验证码输入框');
      }
      const loginButton = page.getByRole('button', { name: '登录', exact: true });
      if (await loginButton.isVisible()) {
        throw new Error('短信登录关闭时，不应展示短信登录按钮');
      }
      const licenseGateVisible = await page.locator('h2:has-text("请输入 License 继续使用")').count();
      if (licenseGateVisible > 0) {
        throw new Error('未登录状态不应直接进入 License gate');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        authenticated: false,
        user: null,
        has_valid_license: false,
        status: 'missing',
        license: null,
        sms_login_enabled: false,
        wechat_login_enabled: false,
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
    },
  );
  return '未登录状态会隐藏短信登录表单，并提示当前未启用可用登录方式';
}

async function scenarioLoginSmsOnlyView(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("欢迎回来")', { timeout: 15000 });
      await page.waitForSelector('#auth-account', { timeout: 15000 });
      await page.waitForSelector('#auth-code', { timeout: 15000 });
      await page.getByRole('button', { name: '登录', exact: true }).waitFor({ timeout: 15000 });
      const wechatButtonVisible = await page.getByRole('button', { name: '微信扫码登录', exact: true }).isVisible().catch(() => false);
      if (wechatButtonVisible) {
        throw new Error('微信 provider 缺失或关闭时，不应展示微信登录入口');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        authenticated: false,
        user: null,
        has_valid_license: false,
        status: 'missing',
        license: null,
        sms_login_enabled: true,
        wechat_login_enabled: false,
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
    },
  );
  return '微信 provider 关闭或缺失时，前端仍展示短信登录表单并隐藏微信入口';
}

async function scenarioLoginWechatOnlyView(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("欢迎回来")', { timeout: 15000 });
      await page.getByRole('button', { name: '微信扫码登录', exact: true }).waitFor({ timeout: 15000 });
      if (await page.locator('#auth-account').isVisible().catch(() => false)) {
        throw new Error('短信 provider 关闭时，不应展示手机号输入框');
      }
      if (await page.locator('#auth-code').isVisible().catch(() => false)) {
        throw new Error('短信 provider 关闭时，不应展示验证码输入框');
      }
      const loginButtonVisible = await page.getByRole('button', { name: '登录', exact: true }).isVisible().catch(() => false);
      if (loginButtonVisible) {
        throw new Error('短信 provider 关闭时，不应展示短信登录按钮');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        authenticated: false,
        user: null,
        has_valid_license: false,
        status: 'missing',
        license: null,
        sms_login_enabled: false,
        wechat_login_enabled: true,
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
    },
  );
  return '短信 provider 关闭时，前端仍展示微信登录入口并隐藏短信表单';
}

async function scenarioLicenseGateView(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("请输入 License 继续使用")', { timeout: 15000 });
      await page.waitForSelector('text=登录后必须绑定有效 License，才能继续使用访谈与报告功能。', { timeout: 15000 });
      await page.waitForSelector('#license-code-input', { timeout: 15000 });
      await page.getByRole('button', { name: '绑定 License', exact: true }).waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: '退出登录', exact: true }).waitFor({ timeout: 15000 });
      const workbenchVisible = await page.locator('h2:has-text("访谈会话"), [data-workbench-task-input]:visible').count();
      if (workbenchVisible > 0) {
        throw new Error('License gate 生效时不应显示访谈工作台');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        has_valid_license: false,
        status: 'missing',
        license: {
          has_valid_license: false,
          status: 'missing',
          license: null,
        },
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
    },
  );
  return '已登录但无有效 License 时，会展示 License gate 与绑定入口';
}

async function scenarioLicenseActivateSuccess(browser, baseUrl) {
  const activatedPayload = {
    enforcement_enabled: true,
    has_valid_license: true,
    status: 'active',
    license: {
      code: 'LIC-ACTIVATED-001',
      masked_code: 'LIC-****-0001',
      level: 'professional',
      expires_at: '2030-12-31T00:00:00Z',
      not_before_at: '2026-01-01T00:00:00Z',
    },
    message: 'License 绑定成功',
  };
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#license-code-input', { timeout: 15000 });
      await page.fill('#license-code-input', 'LIC-ACTIVATED-001');
      await page.getByRole('button', { name: '绑定 License', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-workbench-task-input]', { timeout: 15000 });
      await page.getByRole('button', { name: '开始访谈', exact: true }).waitFor({ timeout: 15000 });
      const gateStillVisible = await page.locator('h2:has-text("请输入 License 继续使用")').count();
      if (gateStillVisible > 0) {
        throw new Error('License 绑定成功后不应继续停留在 License gate');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        has_valid_license: false,
        status: 'missing',
        license: {
          has_valid_license: false,
          status: 'missing',
          license: null,
        },
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
      licenseActivatePayload: activatedPayload,
    },
  );
  return 'License 绑定成功后会退出门禁，并回到访谈工作台';
}

async function scenarioLicenseActivateRefresh(browser, baseUrl) {
  const activatedPayload = {
    enforcement_enabled: true,
    has_valid_license: true,
    status: 'active',
    license: {
      code: 'LIC-ACTIVATED-REFRESH-001',
      masked_code: 'LIC-****-9001',
      level: 'professional',
      expires_at: '2030-12-31T00:00:00Z',
      not_before_at: '2026-01-01T00:00:00Z',
    },
    message: 'License 绑定成功',
  };
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#license-code-input', { timeout: 15000 });
      await page.fill('#license-code-input', 'LIC-ACTIVATED-REFRESH-001');
      await page.getByRole('button', { name: '绑定 License', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-workbench-task-input]', { timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-workbench-task-input]', { timeout: 15000 });
      const gateStillVisible = await page.locator('h2:has-text("请输入 License 继续使用")').count();
      if (gateStillVisible > 0) {
        throw new Error('License 绑定成功后刷新不应重新回到 License gate');
      }
    },
    undefined,
    {
      statusPayload: {
        ...buildStatusPayload(),
        has_valid_license: false,
        status: 'missing',
        license: {
          has_valid_license: false,
          status: 'missing',
          license: null,
        },
      },
      licenseCurrentPayload: {
        enforcement_enabled: true,
        has_valid_license: false,
        status: 'missing',
        license: null,
      },
      licenseActivatePayload: activatedPayload,
    },
  );
  return 'License 绑定成功后刷新首页仍停留在业务壳，而不会回到门禁页';
}

async function scenarioReportDetailFlow(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '报告', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-report-key="demo-report"]', { timeout: 15000 });
      await page.locator('[data-report-key="demo-report"]').click({ timeout: 15000 });
      await page.waitForSelector('.dv-report-title', { timeout: 15000 });
      const titleText = await page.locator('.dv-report-title').first().textContent();
      if (!safeText(titleText).includes('售后回访闭环试点报告')) {
        throw new Error(`报告详情标题异常: ${safeText(titleText, '<empty>')}`);
      }
      await page.waitForSelector('text=核心判断', { timeout: 15000 });
      const solutionButtonCount = await page.locator('button:visible').filter({ hasText: '查看方案' }).count();
      if (solutionButtonCount > 0) {
        throw new Error('报告详情不应继续展示查看方案入口');
      }
      const sidebarBox = await page.locator('.dv-report-sidebar-card:visible').first().boundingBox();
      const headerBox = await page.locator('.dv-report-header:visible').first().boundingBox();
      if (sidebarBox && headerBox && Math.abs(sidebarBox.y - headerBox.y) > 4) {
        throw new Error(`报告详情目录应与报告头顶部齐平: sidebar=${JSON.stringify(sidebarBox)} header=${JSON.stringify(headerBox)}`);
      }
      const redundantBackButtonCount = await page.getByRole('button', { name: '返回报告列表', exact: true }).count();
      if (redundantBackButtonCount > 0) {
        throw new Error('报告详情不应展示冗余的返回报告列表按钮');
      }
      const toolbarButtonCount = await page.locator('.dv-report-toolbar button:visible').count();
      if (toolbarButtonCount > 2) {
        throw new Error(`报告详情头部操作应收敛为主操作和更多菜单: count=${toolbarButtonCount}`);
      }
      const primaryActionCount = await page.locator('.dv-report-primary-action:visible').count();
      if (primaryActionCount !== 1) {
        throw new Error(`报告详情应展示一个主操作按钮: count=${primaryActionCount}`);
      }
      const overflowTrigger = page.locator('.dv-report-overflow-trigger:visible').first();
      await overflowTrigger.click({ timeout: 15000 });
      await page.waitForSelector('.dv-report-overflow-menu:visible', { timeout: 15000 });
      const overflowMenuText = safeText(await page.locator('.dv-report-overflow-menu:visible').first().textContent());
      if (!overflowMenuText.includes('下载') || !overflowMenuText.includes('Markdown')) {
        throw new Error(`报告详情更多菜单应展示下载分组: ${overflowMenuText || '<empty>'}`);
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => {
        const menu = document.querySelector('.dv-report-overflow-menu');
        return !menu || window.getComputedStyle(menu).display === 'none';
      }, null, { timeout: 15000 });
      await page.getByRole('button', { name: '报告', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-report-key="demo-report"]:visible', { timeout: 15000 });
    },
  );
  return '可从报告列表进入报告详情，报告头部操作已收敛为主操作和更多菜单';
}

async function scenarioReportDetailRefresh(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: '报告', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('[data-report-key="demo-report"]', { timeout: 15000 });
      await page.locator('[data-report-key="demo-report"]').click({ timeout: 15000 });
      await page.waitForSelector('.dv-report-title', { timeout: 15000 });
      await page.waitForSelector('text=核心判断', { timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.dv-report-title', { timeout: 15000 });
      const titleText = await page.locator('.dv-report-title').first().textContent();
      if (!safeText(titleText).includes('售后回访闭环试点报告')) {
        throw new Error(`刷新后报告详情标题异常: ${safeText(titleText, '<empty>')}`);
      }
      await page.waitForSelector('text=核心判断', { timeout: 15000 });
      const listCardVisibleCount = await page.locator('[data-report-key="demo-report"]:visible').count();
      if (listCardVisibleCount > 0) {
        throw new Error('刷新后不应退回报告列表态');
      }
    },
  );
  return '报告详情刷新后仍恢复到同一份报告详情';
}

async function scenarioInterviewRefresh(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      const sessionItem = page.locator('.dv-sidebar-session-item', { hasText: '售后回访试点会话' }).first();
      await sessionItem.waitFor({ timeout: 15000 });
      await sessionItem.click({ timeout: 15000 });
      await page.waitForSelector('text=目前最影响售后回访闭环效率的环节是什么？', { timeout: 15000 });
      await page.getByRole('button', { name: '下一题', exact: true }).waitFor({ timeout: 15000 });
      await assertNoVisibleBrandAccentMismatch(page, '.dv-app-content', '访谈页初始态');
      await page.getByText('问题归因不统一', { exact: true }).click({ timeout: 15000 });
      await assertNoVisibleBrandAccentMismatch(page, '.dv-app-content', '访谈页选项选中态');
      await page.getByRole('button', { name: '下一题', exact: true }).click({ timeout: 15000 });
      await page
        .getByText(/AI 正在思考|正在提交当前回答并准备下一题|正在等待上一题提交后的预取结果/)
        .first()
        .waitFor({ timeout: 15000 });
      await assertNoVisibleBrandAccentMismatch(page, '.dv-app-content', '访谈页问题生成态');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=目前最影响售后回访闭环效率的环节是什么？', { timeout: 15000 });
      await page.getByRole('button', { name: '下一题', exact: true }).waitFor({ timeout: 15000 });
      const startInterviewButtonCount = await page.getByRole('button', { name: '开始访谈', exact: true }).count();
      if (startInterviewButtonCount > 0) {
        throw new Error('访谈进行中刷新后不应退回到开始访谈步骤');
      }
      const sessionCardVisibleCount = await page.locator('.session-card-glow:visible').count();
      if (sessionCardVisibleCount > 0) {
        throw new Error('访谈进行中刷新后不应退回会话列表');
      }
    },
    undefined,
    { nextQuestionDelayMs: 750 },
    'mock',
    undefined,
    {
      ignoredConsolePatterns: [
        /获取问题失败: TypeError: Failed to fetch/,
        /错误详情: Failed to fetch TypeError: Failed to fetch/,
      ],
    },
  );
  return '访谈进行中刷新后仍恢复到同一会话与当前问题';
}

async function scenarioReportGenerationRefresh(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      const sessionItem = page.locator('.dv-sidebar-session-item', { hasText: '报告生成恢复验证会话' }).first();
      await sessionItem.waitFor({ timeout: 15000 });
      await sessionItem.click({ timeout: 15000 });
      try {
        await page.waitForSelector('text=需求摘要确认', { timeout: 15000 });
      } catch (error) {
        const stepZeroVisible = await page.getByRole('button', { name: '开始访谈', exact: true }).count();
        const currentQuestionVisible = await page.locator('text=下一题').count();
        const answeredLogVisible = await page.locator('text=已收集的回答').count();
        const currentUrl = page.url();
        throw new Error(
          `未进入需求摘要确认；url=${currentUrl}; step0=${stepZeroVisible}; step1=${currentQuestionVisible}; answeredLog=${answeredLogVisible}`
        );
      }
      const generateButton = page.getByRole('button', { name: '生成访谈报告', exact: true });
      await generateButton.waitFor({ timeout: 15000 });
      await generateButton.click({ timeout: 15000 });
      await page.waitForSelector('text=正在生成...', { timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      try {
        await page.waitForSelector('text=需求摘要确认', { timeout: 15000 });
      } catch (error) {
        const currentUrl = page.url();
        const interviewHeaderVisible = await page.locator('h2:has-text("访谈会话")').count();
        const reportsHeaderVisible = await page.locator('h2:has-text("访谈报告")').count();
        const stepZeroVisible = await page.getByRole('button', { name: '开始访谈', exact: true }).count();
        const generatingVisible = await page.locator('text=正在生成...').count();
        const generateButtonVisible = await page.getByRole('button', { name: '生成访谈报告', exact: true }).count();
        const nextButtonVisible = await page.getByRole('button', { name: '下一题', exact: true }).count();
        const answeredLogVisible = await page.locator('text=已收集的回答').count();
        throw new Error(
          `刷新后未恢复到需求摘要确认；url=${currentUrl}; interviewHeader=${interviewHeaderVisible}; reportsHeader=${reportsHeaderVisible}; step0=${stepZeroVisible}; generating=${generatingVisible}; generateBtn=${generateButtonVisible}; nextBtn=${nextButtonVisible}; answeredLog=${answeredLogVisible}`
        );
      }
      await page.waitForSelector('text=正在生成...', { timeout: 15000 });
      const sessionCardVisibleCount = await page.locator('.session-card-glow:visible').count();
      if (sessionCardVisibleCount > 0) {
        throw new Error('报告生成中刷新后不应退回会话列表');
      }
      const reportListVisibleCount = await page.locator('[data-report-key="demo-report"]:visible').count();
      if (reportListVisibleCount > 0) {
        throw new Error('报告生成中刷新后不应切到报告列表');
      }
    },
  );
  return '报告生成中刷新后仍恢复到需求确认态，并继续显示生成进度';
}

async function scenarioAdminConfigTab(browser, baseUrl) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await openAdminCenterFromAccountMenu(page);
      await page.locator('button:has-text("配置中心")').first().click({ timeout: 15000 });
      await page.waitForSelector('h3:has-text("配置中心")', { timeout: 15000 });
      await page.waitForSelector('text=AI 配置', { timeout: 15000 });
      await page.getByRole('button', { name: 'config.py', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('text=运行配置', { timeout: 15000 });
      await page.getByRole('button', { name: '前端配置', exact: true }).click({ timeout: 15000 });
      await page.waitForSelector('text=前端品牌', { timeout: 15000 });
    },
  );
  return '配置中心可加载，并能在 env/config/site 三类来源间切换';
}

const RESPONSIVE_THEME_VIEWPORTS = [
  { id: 'desktop', label: '桌面端', width: 1440, height: 1000 },
  { id: 'tablet', label: '平板端', width: 834, height: 1112 },
  { id: 'mobile', label: '移动端', width: 390, height: 844 },
];

const RESPONSIVE_THEME_MODES = [
  { mode: 'dark', label: '深色', expectDarkSurfaces: true },
  { mode: 'light', label: '浅色', expectDarkSurfaces: false },
];

const DARK_SURFACE_SELECTORS = [
  { selector: 'header', label: '顶部栏' },
  { selector: '.dv-app-sidebar', label: '桌面侧栏', optional: true },
  { selector: '.dv-side-nav-item.is-active', label: '侧栏当前导航', optional: true },
  { selector: '.dv-workbench-command', label: '工作台输入容器', optional: true },
  { selector: '.dv-library-toolbar', label: '库工具栏', optional: true },
  { selector: '.dv-library-list', label: '库列表容器', optional: true },
  { selector: '.dv-library-item', label: '库资源行', optional: true },
  { selector: '.dv-agent-card', label: 'Agents 卡片', optional: true, minLuminance: 0.014 },
  { selector: '.report-card-glow', label: '报告卡片', optional: true },
  { selector: '.dv-report-sidebar-card', label: '报告详情目录', optional: true },
  { selector: '.dv-report-body-shell', label: '报告详情正文', optional: true },
  { selector: '.account-menu', label: '账号与外观菜单', optional: true },
  { selector: '.theme-menu-item', label: '主题菜单项', optional: true },
];

const DARK_TEXT_SELECTORS = [
  '.brand-title-cn',
  '.dv-side-nav-item.is-active',
  '.dv-workbench-subtitle',
  '.dv-workbench-task-input',
  '.dv-workbench-submit',
  '.dv-library-title',
  '.dv-library-desc',
  '.dv-library-segment button.is-active',
  '.dv-agent-title',
  '.dv-agent-desc',
  '.report-card-glow h3',
  '.report-card-glow p',
  '.dv-report-sidebar-link',
  '.dv-report-mobile-pill',
  '.dv-report-inline-toc-link',
  '.account-menu',
  '.theme-menu-item',
];

const DARK_NEUTRAL_ACCENT_SELECTORS = [
  { selector: '.dv-report-sidebar-link.is-current', label: '报告详情目录当前项', optional: true },
  { selector: '.dv-report-sidebar-link.is-active', label: '报告详情目录活动项', optional: true },
  { selector: '.dv-report-mobile-nav-link.is-current', label: '报告详情移动目录当前项', optional: true },
  { selector: '.dv-report-mobile-pill.is-active', label: '报告详情移动分段当前项', optional: true },
  { selector: '.dv-report-inline-toc-link:hover', label: '报告详情内联目录 hover', optional: true },
  { selector: '.markdown-body blockquote', label: '报告详情引用块', optional: true, properties: ['borderLeftColor'] },
];

async function collectPageCompatibility(page, label, options = {}) {
  return await page.evaluate(({ pageLabel, surfaceSelectors, textSelectors, neutralAccentSelectors, expectDarkSurfaces }) => {
    const issues = [];
    const html = document.documentElement;
    const body = document.body;
    const isVisible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0.01
        && rect.width > 0
        && rect.height > 0;
    };
    const parseColor = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1]
        .split(',')
        .map((part) => Number.parseFloat(part.trim()))
        .filter((part) => Number.isFinite(part));
      if (parts.length < 3) return null;
      return {
        r: Math.max(0, Math.min(255, parts[0])),
        g: Math.max(0, Math.min(255, parts[1])),
        b: Math.max(0, Math.min(255, parts[2])),
        a: parts.length >= 4 ? Math.max(0, Math.min(1, parts[3])) : 1,
      };
    };
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    const luminance = (color) => {
      if (!color) return 0;
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    const contrast = (fg, bg) => {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const colorText = (color) => color
      ? `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
      : 'unknown';
    const isBlueAccentColor = (color) => color
      && color.a > 0.05
      && color.b > color.r + 35
      && color.b > color.g + 14;
    const resolveBackground = (node) => {
      let current = node;
      while (current instanceof HTMLElement) {
        const color = parseColor(window.getComputedStyle(current).backgroundColor);
        if (color && color.a > 0.08) return color;
        current = current.parentElement;
      }
      return parseColor(window.getComputedStyle(body).backgroundColor)
        || parseColor(window.getComputedStyle(html).backgroundColor)
        || { r: 9, g: 9, b: 11, a: 1 };
    };
    const describeNode = (node) => {
      if (!(node instanceof HTMLElement)) return '';
      if (node.id) return `#${node.id}`;
      const className = String(node.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      return `${node.tagName.toLowerCase()}${className ? `.${className}` : ''}`;
    };

    const widthOverflow = Math.max(
      html.scrollWidth - window.innerWidth,
      body ? body.scrollWidth - window.innerWidth : 0,
    );
    if (widthOverflow > 1) {
      issues.push(`${pageLabel}: 页面横向溢出 ${Math.round(widthOverflow)}px`);
    }

    if (Boolean(expectDarkSurfaces)) {
      for (const item of surfaceSelectors) {
        const nodes = Array.from(document.querySelectorAll(item.selector)).filter(isVisible);
        if (!nodes.length) {
          if (!item.optional) issues.push(`${pageLabel}: 缺少关键区域 ${item.label}`);
          continue;
        }
        for (const node of nodes.slice(0, 4)) {
          const bg = resolveBackground(node);
          if (luminance(bg) > 0.58) {
            issues.push(`${pageLabel}: ${item.label} 在深色模式下背景过亮 (${colorText(bg)})`);
            break;
          }
          if (item.minLuminance && luminance(bg) < item.minLuminance) {
            issues.push(`${pageLabel}: ${item.label} 在深色模式下背景过深 (${colorText(bg)})`);
            break;
          }
        }
      }

      for (const item of neutralAccentSelectors) {
        const nodes = Array.from(document.querySelectorAll(item.selector)).filter(isVisible);
        if (!nodes.length) {
          if (!item.optional) issues.push(`${pageLabel}: 缺少中性色检查区域 ${item.label}`);
          continue;
        }
        const properties = item.properties || ['backgroundColor', 'color', 'borderColor', 'borderLeftColor'];
        for (const node of nodes.slice(0, 4)) {
          const style = window.getComputedStyle(node);
          for (const property of properties) {
            const accentColor = parseColor(style[property]);
            if (isBlueAccentColor(accentColor)) {
              issues.push(`${pageLabel}: ${item.label} 不应继续使用蓝色强调 (${property}: ${style[property]})`);
              break;
            }
          }
        }
      }
    }

    const textNodes = new Set();
    for (const selector of textSelectors) {
      for (const node of Array.from(document.querySelectorAll(selector)).filter(isVisible)) {
        const text = String(node.textContent || node.getAttribute('aria-label') || '').trim();
        const hasDirectText = Array.from(node.childNodes || []).some(
          (child) => child.nodeType === Node.TEXT_NODE && String(child.textContent || '').trim(),
        );
        if (text && (hasDirectText || node.children.length === 0)) textNodes.add(node);
      }
    }
    for (const node of Array.from(textNodes).slice(0, 80)) {
      const style = window.getComputedStyle(node);
      if (node.matches(':disabled') || node.closest(':disabled')) continue;
      const fg = parseColor(style.color);
      const bg = resolveBackground(node);
      if (!fg || !bg) continue;
      const ratio = contrast(fg, bg);
      const fontSize = Number.parseFloat(style.fontSize || '16');
      const minRatio = fontSize >= 18 ? 3 : 4.5;
      if (ratio < minRatio) {
        issues.push(`${pageLabel}: ${describeNode(node)} 文本对比度不足 (${ratio.toFixed(2)}:1, ${colorText(fg)} on ${colorText(bg)})`);
      }
    }

    const accountButton = document.querySelector('button[aria-label="账号与外观设置"]');
    if (isVisible(accountButton)) {
      const rect = accountButton.getBoundingClientRect();
      if (rect.right > window.innerWidth + 1 || rect.left < -1) {
        issues.push(`${pageLabel}: 设置入口超出视口`);
      }
      if (rect.width < 36 || rect.height < 36) {
        issues.push(`${pageLabel}: 设置入口触控尺寸不足 (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }
    }

    return issues;
  }, {
    pageLabel: label,
    surfaceSelectors: DARK_SURFACE_SELECTORS,
    textSelectors: DARK_TEXT_SELECTORS,
    neutralAccentSelectors: DARK_NEUTRAL_ACCENT_SELECTORS,
    expectDarkSurfaces: Boolean(options.expectDarkSurfaces),
  });
}

async function clickVisibleNav(page, name) {
  const button = page.getByRole('button', { name, exact: true }).first();
  await button.click({ timeout: 15000 });
}

async function scenarioResponsiveThemeCompatibility(browser, baseUrl) {
  const findings = [];
  for (const theme of RESPONSIVE_THEME_MODES) {
    for (const viewport of RESPONSIVE_THEME_VIEWPORTS) {
      await runWithPage(
        browser,
        baseUrl,
        (mode) => {
          localStorage.setItem('intus_theme_mode', mode);
          localStorage.setItem('intus_intro_seen', 'true');
        },
        async (page) => {
          const prefix = `${theme.label}/${viewport.label}`;
          const checkOptions = { expectDarkSurfaces: theme.expectDarkSurfaces };
          await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('[data-workbench-task-input]', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/工作台`, checkOptions));

          await clickVisibleNav(page, '库');
          await page.waitForSelector('.dv-library-shell', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/库`, checkOptions));

          await clickVisibleNav(page, 'Agents');
          await page.waitForSelector('.dv-agents-shell', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/Agents`, checkOptions));

          await clickVisibleNav(page, '报告');
          await page.waitForSelector('.dv-report-surface-shell', { timeout: 15000 });
          await page.waitForSelector('[data-report-key="demo-report"]', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/报告`, checkOptions));
          await page.locator('[data-report-key="demo-report"]:visible').first().click({ timeout: 15000 });
          await page.waitForSelector('.dv-report-title', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/报告详情`, checkOptions));

          await page.locator('button[aria-label="账号与外观设置"]:visible').first().click({ timeout: 15000 });
          await page.waitForSelector('.account-menu:visible', { timeout: 15000 });
          findings.push(...await collectPageCompatibility(page, `${prefix}/设置菜单`, checkOptions));
        },
        theme.mode,
        undefined,
        'mock',
        { viewport: { width: viewport.width, height: viewport.height } },
      );
    }
  }
  if (findings.length > 0) {
    throw new Error(findings.slice(0, 20).join('\n'));
  }
  return '深色和浅色模式下桌面、平板和移动端关键页面无横向溢出，关键 surface 和文本对比度达标';
}

async function scenarioLiveLoginLicenseFlow(browser, baseUrl, liveContext) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await performLiveLoginAndLicense(page, baseUrl, liveContext);
      const gateVisible = await page.locator('h2:has-text("请输入 License 继续使用")').count();
      if (gateVisible > 0) {
        throw new Error('live 链路绑定 License 后仍停留在门禁页');
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForLiveHomeReady(page, 25000);
      const gateAfterReload = await page.locator('h2:has-text("请输入 License 继续使用")').count();
      if (gateAfterReload > 0) {
        throw new Error('live 链路刷新后重新回到了 License gate');
      }
    },
    undefined,
    undefined,
    'live',
    liveContext.storageState ? { storageState: liveContext.storageState } : undefined,
  );
  return `真实后端下已完成验证码登录与 License 绑定，手机号=${liveContext.authPhone}`;
}

async function scenarioLiveReportSolutionFlow(browser, baseUrl, liveContext) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await performLiveLoginAndLicense(page, baseUrl, liveContext);
      const fixture = await ensureLiveReportFixture(page, liveContext);

      await page.getByRole('button', { name: '报告', exact: true }).click({ timeout: 20000 });
      const reportSelector = `[data-report-key="${fixture.report_name}"]`;
      await page.waitForSelector(reportSelector, { timeout: 25000 });
      await page.locator(reportSelector).click({ timeout: 15000 });
      await page.waitForSelector('.dv-report-title', { timeout: 20000 });
      const titleText = safeText(await page.locator('.dv-report-title').first().textContent());
      if (!titleText.includes(fixture.title)) {
        throw new Error(`真实报告详情标题异常: ${titleText || '<empty>'}`);
      }

      const solutionEntryCount = await page.locator('button:visible').filter({ hasText: '查看方案' }).count();
      if (solutionEntryCount > 0) {
        throw new Error('真实报告详情不应继续展示查看方案入口');
      }

      const solutionResponsePromise = page.waitForResponse(
        (response) => response.ok() && response.url().includes(`/api/reports/${encodeURIComponent(fixture.report_name)}/solution`),
        { timeout: 25000 },
      );
      await page.goto(`${baseUrl}/solution.html?report=${encodeURIComponent(fixture.report_name)}`, { waitUntil: 'domcontentloaded' });
      const solutionResponse = await solutionResponsePromise;
      const payload = await solutionResponse.json();
      if (safeText(payload?.report_name) !== fixture.report_name) {
        throw new Error(`真实方案页 report_name 异常: ${safeText(payload?.report_name, '<empty>')}`);
      }
      await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 25000 });
      await page.waitForSelector('#btn-share', { timeout: 25000 });
    },
    undefined,
    undefined,
    'live',
    liveContext.storageState ? { storageState: liveContext.storageState } : undefined,
  );
  return '真实后端下已完成报告详情打开与方案页跳转';
}

async function scenarioLiveSolutionPublicShareFlow(browser, baseUrl, liveContext) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await performLiveLoginAndLicense(page, baseUrl, liveContext);
      const fixture = await ensureLiveReportFixture(page, liveContext);
      const shareTargetUrl = `${baseUrl}/solution.html?report=${encodeURIComponent(fixture.report_name)}`;
      await page.goto(shareTargetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#solution-shell:not([hidden])', { timeout: 25000 });

      const shareResponsePromise = page.waitForResponse(
        (response) => response.ok()
          && response.request().method() === 'POST'
          && response.url().includes(`/api/reports/${encodeURIComponent(fixture.report_name)}/solution/share`),
        { timeout: 25000 },
      );
      await page.click('#btn-share', { timeout: 15000 });
      await page.waitForSelector('#solution-share-panel:not([hidden])', { timeout: 15000 });
      const shareInput = safeText(await page.inputValue('#solution-share-input'));
      const shareResponse = await shareResponsePromise;
      const sharePayload = await shareResponse.json();
      const shareUrl = safeText(sharePayload?.share_url || shareInput);
      if (!shareUrl.includes('share=')) {
        throw new Error(`真实分享链接异常: ${shareUrl || '<empty>'}`);
      }

      const browserRef = page.context().browser();
      if (!browserRef) {
        throw new Error('无法创建匿名浏览器上下文');
      }
      const anonymousContext = await browserRef.newContext({ viewport: { width: 1440, height: 1080 } });
      const publicPage = await anonymousContext.newPage();
      try {
        await publicPage.goto(shareUrl, { waitUntil: 'domcontentloaded' });
        await publicPage.waitForSelector('#solution-shell:not([hidden])', { timeout: 25000 });
        await publicPage.waitForSelector('text=外部分享 · 只读方案', { timeout: 25000 });
        const actionBarHidden = await publicPage.locator('#solution-action-bar').evaluate((element) => element.hidden);
        if (!actionBarHidden) {
          throw new Error('真实公开分享模式下不应显示分享动作栏');
        }
        const shareButtonCount = await publicPage.locator('#btn-share:visible').count();
        if (shareButtonCount > 0) {
          throw new Error('真实公开分享模式下不应暴露分享按钮');
        }
      } finally {
        await anonymousContext.close();
      }
    },
    undefined,
    undefined,
    'live',
    liveContext.storageState ? { storageState: liveContext.storageState } : undefined,
  );
  return '真实后端下已完成方案分享创建，并以匿名态访问只读公开分享页';
}

async function scenarioLiveReportGenerationRefreshFlow(browser, baseUrl, liveContext) {
  await runWithPage(
    browser,
    baseUrl,
    () => {
      localStorage.setItem('intus_intro_seen', 'true');
    },
    async (page) => {
      await performLiveLoginAndLicense(page, baseUrl, liveContext);
      const fixture = await ensureLiveReportGenerationSessionFixture(page, liveContext);
      const interviewUrl = `${baseUrl}/index.html?view=interview&session=${encodeURIComponent(fixture.session_id)}`;
      await page.goto(interviewUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=需求摘要确认', { timeout: 25000 });

      const generateResponsePromise = page.waitForResponse(
        (response) => response.request().method() === 'POST'
          && response.url().includes(`/api/sessions/${encodeURIComponent(fixture.session_id)}/generate-report`),
        { timeout: 25000 },
      );
      const generateButton = page.getByRole('button', { name: '生成访谈报告', exact: true });
      await generateButton.waitFor({ timeout: 20000 });
      await generateButton.click({ timeout: 15000 });
      const generateResponse = await generateResponsePromise;
      if (![200, 202].includes(generateResponse.status())) {
        throw new Error(`真实报告生成请求异常: status=${generateResponse.status()}`);
      }
      await page.waitForSelector('text=正在生成...', { timeout: 25000 });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=需求摘要确认', { timeout: 25000 });
      await page.waitForSelector('text=正在生成...', { timeout: 25000 });

      const sessionCardVisibleCount = await page.locator('.session-card-glow:visible').count();
      if (sessionCardVisibleCount > 0) {
        throw new Error('真实报告生成中刷新后不应退回会话列表');
      }
      const reportListVisibleCount = await page.locator('[data-report-key]:visible').count();
      if (reportListVisibleCount > 0) {
        throw new Error('真实报告生成中刷新后不应切到报告列表');
      }

      const statusPayload = await fetchPageJson(page, `/api/status/report-generation/${encodeURIComponent(fixture.session_id)}`);
      if (!statusPayload.ok || !statusPayload.payload?.active) {
        throw new Error(`真实报告生成状态未保持 active: status=${statusPayload.status} payload=${statusPayload.text}`);
      }
    },
    undefined,
    undefined,
    'live',
    liveContext.storageState ? { storageState: liveContext.storageState } : undefined,
  );
  return '真实后端下报告生成中刷新后仍恢复到同一会话，并保持生成进度';
}

async function executeScenario(browser, baseUrl, scenario, runtimeContext = {}) {
  const startedAt = Date.now();
  try {
    let detail = '';
    if (scenario.id === 'help-docs') {
      detail = await scenarioHelpDocs(browser, baseUrl);
    } else if (scenario.id === 'solution-share') {
      detail = await scenarioSolutionShare(browser, baseUrl);
    } else if (scenario.id === 'workbench-composer-entry') {
      detail = await scenarioWorkbenchComposerEntry(browser, baseUrl);
    } else if (scenario.id === 'sidebar-library-agents-trim') {
      detail = await scenarioSidebarLibraryAgentsTrim(browser, baseUrl);
    } else if (scenario.id === 'report-list-trim') {
      detail = await scenarioReportListTrim(browser, baseUrl);
    } else if (scenario.id === 'admin-config-entry') {
      detail = await scenarioAdminConfigEntry(browser, baseUrl);
    } else if (scenario.id === 'solution-public-readonly') {
      detail = await scenarioSolutionPublicReadonly(browser, baseUrl);
    } else if (scenario.id === 'solution-public-readonly-refresh') {
      detail = await scenarioSolutionPublicReadonlyRefresh(browser, baseUrl);
    } else if (scenario.id === 'login-view') {
      detail = await scenarioLoginView(browser, baseUrl);
    } else if (scenario.id === 'login-sms-only-view') {
      detail = await scenarioLoginSmsOnlyView(browser, baseUrl);
    } else if (scenario.id === 'login-wechat-only-view') {
      detail = await scenarioLoginWechatOnlyView(browser, baseUrl);
    } else if (scenario.id === 'license-gate-view') {
      detail = await scenarioLicenseGateView(browser, baseUrl);
    } else if (scenario.id === 'license-activate-success') {
      detail = await scenarioLicenseActivateSuccess(browser, baseUrl);
    } else if (scenario.id === 'license-activate-refresh') {
      detail = await scenarioLicenseActivateRefresh(browser, baseUrl);
    } else if (scenario.id === 'report-detail-flow') {
      detail = await scenarioReportDetailFlow(browser, baseUrl);
    } else if (scenario.id === 'report-detail-refresh') {
      detail = await scenarioReportDetailRefresh(browser, baseUrl);
    } else if (scenario.id === 'interview-refresh') {
      detail = await scenarioInterviewRefresh(browser, baseUrl);
    } else if (scenario.id === 'report-generation-refresh') {
      detail = await scenarioReportGenerationRefresh(browser, baseUrl);
    } else if (scenario.id === 'admin-config-tab') {
      detail = await scenarioAdminConfigTab(browser, baseUrl);
    } else if (scenario.id === 'responsive-theme-compat') {
      detail = await scenarioResponsiveThemeCompatibility(browser, baseUrl);
    } else if (scenario.id === 'live-login-license-flow') {
      detail = await scenarioLiveLoginLicenseFlow(browser, baseUrl, runtimeContext);
    } else if (scenario.id === 'live-report-solution-flow') {
      detail = await scenarioLiveReportSolutionFlow(browser, baseUrl, runtimeContext);
    } else if (scenario.id === 'live-report-generation-refresh') {
      detail = await scenarioLiveReportGenerationRefreshFlow(browser, baseUrl, runtimeContext);
    } else if (scenario.id === 'live-solution-public-share-flow') {
      detail = await scenarioLiveSolutionPublicShareFlow(browser, baseUrl, runtimeContext);
    } else {
      throw new Error(`未知场景: ${scenario.id}`);
    }
    return {
      scenario_id: scenario.id,
      label: scenario.label,
      status: 'PASS',
      detail,
      duration_ms: Date.now() - startedAt,
      highlights: [],
    };
  } catch (error) {
    return {
      scenario_id: scenario.id,
      label: scenario.label,
      status: 'FAIL',
      detail: safeText(error?.message, 'browser smoke failed'),
      duration_ms: Date.now() - startedAt,
      highlights: [safeText(error?.stack, safeText(error?.message, 'browser smoke failed')).split('\n')[0]],
    };
  }
}

function resolveSuite(name) {
  if (name === 'minimal') {
    return {
      name: 'minimal',
      mode: 'mock',
      description: '帮助页 + 方案页分享 + 工作台新建访谈入口 + 侧栏、库页、报告页精简 + 管理后台配置入口',
      scenarios: [
        { id: 'help-docs', label: '帮助文档静态页' },
        { id: 'solution-share', label: '方案页分享面板' },
        { id: 'workbench-composer-entry', label: '工作台新建访谈弹框入口' },
        { id: 'sidebar-library-agents-trim', label: '侧栏与库页 Agents 精简' },
        { id: 'report-list-trim', label: '报告列表页精简' },
        { id: 'admin-config-entry', label: '设置菜单管理员入口' },
      ],
    };
  }
  if (name === 'extended') {
    return {
      name: 'extended',
      mode: 'mock',
      description: '在 minimal 基础上补公开分享只读、登录 provider 可见反馈、License 门禁前端视图、License 绑定成功切换、访谈与报告刷新恢复，以及配置中心页签切换',
      scenarios: [
        { id: 'help-docs', label: '帮助文档静态页' },
        { id: 'solution-share', label: '方案页分享面板' },
        { id: 'workbench-composer-entry', label: '工作台新建访谈弹框入口' },
        { id: 'sidebar-library-agents-trim', label: '侧栏与库页 Agents 精简' },
        { id: 'admin-config-entry', label: '设置菜单管理员入口' },
        { id: 'solution-public-readonly', label: '方案页公开分享只读' },
        { id: 'solution-public-readonly-refresh', label: '方案页公开分享刷新保持只读' },
        { id: 'login-view', label: '登录前端视图' },
        { id: 'login-sms-only-view', label: '登录视图仅短信 provider' },
        { id: 'login-wechat-only-view', label: '登录视图仅微信 provider' },
        { id: 'license-gate-view', label: 'License 门禁前端视图' },
        { id: 'license-activate-success', label: 'License 绑定成功后切回业务壳' },
        { id: 'license-activate-refresh', label: 'License 绑定后刷新保持业务壳' },
        { id: 'report-detail-flow', label: '报告详情入口收敛' },
        { id: 'report-detail-refresh', label: '报告详情刷新后保持详情态' },
        { id: 'interview-refresh', label: '访谈进行中刷新后保持当前会话' },
        { id: 'report-generation-refresh', label: '报告生成中刷新后保持进度' },
        { id: 'admin-config-tab', label: '管理员配置中心页签' },
      ],
    };
  }
  if (name === 'compat') {
    return {
      name: 'compat',
      mode: 'mock',
      description: '深色与浅色模式、桌面/平板/移动端响应式兼容性检查',
      scenarios: [
        { id: 'responsive-theme-compat', label: '深色与响应式兼容性' },
      ],
    };
  }
  if (name === 'live-minimal') {
    return {
      name: 'live-minimal',
      mode: 'live',
      description: '隔离数据目录下启动真实后端，执行验证码登录、License 绑定以及刷新恢复真链路',
      scenarios: [
        { id: 'live-login-license-flow', label: '真实后端登录与 License 绑定' },
      ],
    };
  }
  if (name === 'live-extended') {
    return {
      name: 'live-extended',
      mode: 'live',
      description: '在 live-minimal 基础上补真实报告生成恢复、真实报告详情、真实方案页和公开分享只读链路',
      scenarios: [
        { id: 'live-login-license-flow', label: '真实后端登录与 License 绑定' },
        { id: 'live-report-generation-refresh', label: '真实后端报告生成中刷新恢复' },
        { id: 'live-report-solution-flow', label: '真实后端方案页直达' },
        { id: 'live-solution-public-share-flow', label: '真实后端公开分享只读链路' },
      ],
    };
  }
  if (name !== 'minimal') {
    throw new Error(`未知 browser smoke suite: ${name}`);
  }
}

async function main() {
  const suite = resolveSuite(suiteName);
  let runtime = null;
  const browser = await chromium.launch({ headless: true });
  try {
    runtime = suite.mode === 'live'
      ? await startLiveBackend()
      : await (async () => {
        const { server, baseUrl } = await startStaticServer();
        return {
          mode: 'mock',
          baseUrl,
          cleanup: async () => {
            await new Promise((resolve) => server.close(resolve));
          },
        };
      })();

    const results = [];
    for (const scenario of suite.scenarios) {
      results.push(await executeScenario(browser, runtime.baseUrl, scenario, runtime));
    }
    const summary = buildSummary(results);
    const payload = {
      generated_at: nowIso(),
      suite: suite.name,
      description: suite.description,
      mode: suite.mode,
      base_url: runtime.baseUrl,
      summary,
      overall: summary.FAIL > 0 ? 'BLOCKED' : 'READY',
      results,
    };
    if (suite.mode === 'live') {
      payload.runtime = {
        auth_phone: runtime.authPhone,
        auth_db_path: runtime.authDbPath,
        license_db_path: runtime.licenseDbPath,
      };
    }
    console.log(JSON.stringify(payload, null, 2));
    process.exit(summary.FAIL > 0 ? 2 : 0);
  } finally {
    await browser.close();
    if (runtime?.cleanup) {
      await runtime.cleanup();
    }
  }
}

main().catch((error) => {
  const payload = {
    generated_at: nowIso(),
    suite: suiteName,
    summary: { PASS: 0, WARN: 0, FAIL: 1 },
    overall: 'BLOCKED',
    results: [
      {
        scenario_id: 'runner',
        label: '浏览器 runner',
        status: 'FAIL',
        detail: safeText(error?.message, 'browser runner failed'),
        highlights: [safeText(error?.stack, safeText(error?.message, 'browser runner failed')).split('\n')[0]],
      },
    ],
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(2);
});
