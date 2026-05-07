#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""
Intus 会话管理工具

用途: 管理访谈会话的保存、恢复和清理
使用方式: uvx scripts/session_manager.py <命令> [参数]
"""

import argparse
import json
import logging
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# 颜色代码
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


def log_info(message: str) -> None:
    """输出信息日志"""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")


def log_warn(message: str) -> None:
    """输出警告日志"""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")


def log_error(message: str) -> None:
    """输出错误日志"""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def get_script_dir() -> Path:
    """获取脚本所在目录"""
    return Path(__file__).parent.resolve()


def get_session_dir() -> Path:
    """获取会话存储目录"""
    session_dir = get_script_dir().parent / "data" / "sessions"
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir


def get_reports_dir() -> Path:
    """获取报告存储目录"""
    reports_dir = get_script_dir().parent / "data" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    return reports_dir


def generate_session_id() -> str:
    """生成唯一的会话ID"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = secrets.token_hex(4)
    return f"dv-{timestamp}-{random_suffix}"


def get_utc_now() -> str:
    """获取当前UTC时间的ISO格式字符串"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create_session(topic: str, scenario_id: str = None) -> str:
    """
    创建新的访谈会话

    Args:
        topic: 访谈主题
        scenario_id: 场景ID（可选，默认使用 product-requirement）

    Returns:
        str: 会话ID
    """
    from scripts.scenario_loader import get_scenario_loader

    session_id = generate_session_id()
    session_file = get_session_dir() / f"{session_id}.json"

    # 加载场景配置
    loader = get_scenario_loader()
    if not scenario_id:
        scenario_id = "product-requirement"
    scenario_config = loader.get_scenario(scenario_id)
    if not scenario_config:
        scenario_config = loader.get_default_scenario()
        scenario_id = scenario_config.get("id", "product-requirement")

    # 根据场景配置创建动态维度
    dimensions = {}
    for dim in scenario_config.get("dimensions", []):
        dimensions[dim["id"]] = {
            "coverage": 0,
            "items": [],
            "score": None  # 用于评估型场景
        }

    session_data = {
        "session_id": session_id,
        "topic": topic,
        "created_at": get_utc_now(),
        "updated_at": get_utc_now(),
        "status": "in_progress",
        "scenario_id": scenario_id,
        "scenario_config": scenario_config,
        "dimensions": dimensions,
        "reference_docs": [],
        "interview_log": [],
        "requirements": [],
        "summary": None
    }

    session_file.write_text(
        json.dumps(session_data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    log_info(f"创建会话: {session_id} (场景: {scenario_id})")
    return session_id


def list_sessions() -> list[dict]:
    """
    列出所有会话

    Returns:
        list[dict]: 会话列表
    """
    session_dir = get_session_dir()
    sessions = []

    for session_file in session_dir.glob("*.json"):
        try:
            data = json.loads(session_file.read_text(encoding="utf-8"))
            sessions.append({
                "session_id": data.get("session_id", session_file.stem),
                "topic": data.get("topic", "未知"),
                "status": data.get("status", "未知"),
                "created_at": data.get("created_at", "未知"),
                "updated_at": data.get("updated_at", "未知"),
                "dimensions": data.get("dimensions", {})
            })
        except (json.JSONDecodeError, IOError) as e:
            log_warn(f"读取会话文件失败: {session_file.name} - {e}")

    # 按更新时间排序
    sessions.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return sessions


def print_sessions_table(sessions: list[dict]) -> None:
    """打印会话列表表格"""
    if not sessions:
        log_info("没有找到任何会话")
        return

    # 表头
    print(f"{Colors.BLUE}{'━' * 80}{Colors.NC}")
    print(f"{'会话ID':<25} {'主题':<20} {'状态':<10} {'更新时间':<20}")
    print(f"{Colors.BLUE}{'━' * 80}{Colors.NC}")

    status_icons = {
        "in_progress": "🔄 进行中",
        "completed": "✅ 已完成",
        "paused": "⏸️ 已暂停"
    }

    for session in sessions:
        topic = session["topic"]
        if len(topic) > 18:
            topic = topic[:15] + "..."

        status = status_icons.get(session["status"], session["status"])

        print(f"{session['session_id']:<25} {topic:<20} {status:<10} {session['updated_at']:<20}")

    print(f"{Colors.BLUE}{'━' * 80}{Colors.NC}")


def get_session(session_id: str) -> Optional[dict]:
    """
    获取会话详情

    Args:
        session_id: 会话ID

    Returns:
        Optional[dict]: 会话数据
    """
    session_file = get_session_dir() / f"{session_id}.json"

    if not session_file.exists():
        log_error(f"会话不存在: {session_id}")
        return None

    try:
        return json.loads(session_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, IOError) as e:
        log_error(f"读取会话失败: {e}")
        return None


def update_session(session_id: str, updates: dict) -> bool:
    """
    更新会话数据

    Args:
        session_id: 会话ID
        updates: 要更新的字段

    Returns:
        bool: 是否成功
    """
    session_file = get_session_dir() / f"{session_id}.json"

    if not session_file.exists():
        log_error(f"会话不存在: {session_id}")
        return False

    try:
        data = json.loads(session_file.read_text(encoding="utf-8"))
        data.update(updates)
        data["updated_at"] = get_utc_now()

        session_file.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        log_info(f"已更新会话: {session_id}")
        return True

    except (json.JSONDecodeError, IOError) as e:
        log_error(f"更新会话失败: {e}")
        return False


def add_interview_log(session_id: str, question: str, answer: str, dimension: Optional[str] = None) -> bool:
    """
    添加访谈记录

    Args:
        session_id: 会话ID
        question: 问题
        answer: 回答
        dimension: 所属维度（可选）

    Returns:
        bool: 是否成功
    """
    session = get_session(session_id)
    if not session:
        return False

    log_entry = {
        "timestamp": get_utc_now(),
        "question": question,
        "answer": answer,
        "dimension": dimension
    }

    session["interview_log"].append(log_entry)
    session["updated_at"] = get_utc_now()

    session_file = get_session_dir() / f"{session_id}.json"
    session_file.write_text(
        json.dumps(session, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    return True


def update_dimension_coverage(session_id: str, dimension: str, coverage: int, items: list) -> bool:
    """
    更新维度覆盖度

    Args:
        session_id: 会话ID
        dimension: 维度名称
        coverage: 覆盖度百分比
        items: 收集的信息项

    Returns:
        bool: 是否成功
    """
    session = get_session(session_id)
    if not session:
        return False

    if dimension not in session["dimensions"]:
        log_error(f"未知维度: {dimension}")
        return False

    session["dimensions"][dimension]["coverage"] = coverage
    session["dimensions"][dimension]["items"] = items
    session["updated_at"] = get_utc_now()

    session_file = get_session_dir() / f"{session_id}.json"
    session_file.write_text(
        json.dumps(session, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    return True


def get_incomplete_sessions() -> list[str]:
    """
    获取未完成的会话ID列表

    Returns:
        list[str]: 未完成的会话ID列表
    """
    sessions = list_sessions()
    return [
        s["session_id"]
        for s in sessions
        if s["status"] in ("in_progress", "paused")
    ]


def pause_session(session_id: str) -> bool:
    """暂停会话"""
    return update_session(session_id, {"status": "paused"})


def resume_session(session_id: str) -> bool:
    """恢复会话"""
    return update_session(session_id, {"status": "in_progress"})


def complete_session(session_id: str) -> bool:
    """完成会话"""
    return update_session(session_id, {"status": "completed"})


def delete_session(session_id: str) -> bool:
    """
    删除会话

    Args:
        session_id: 会话ID

    Returns:
        bool: 是否成功
    """
    session_file = get_session_dir() / f"{session_id}.json"

    if not session_file.exists():
        log_error(f"会话不存在: {session_id}")
        return False

    session_file.unlink()
    log_info(f"会话已删除: {session_id}")
    return True


def cleanup_completed(days: int = 30) -> int:
    """
    清理已完成的旧会话

    Args:
        days: 保留天数

    Returns:
        int: 清理的会话数量
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    count = 0

    for session_file in get_session_dir().glob("*.json"):
        try:
            data = json.loads(session_file.read_text(encoding="utf-8"))
            if data.get("status") == "completed":
                updated_str = data.get("updated_at", "")
                if updated_str:
                    updated = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                    if updated < cutoff:
                        session_file.unlink()
                        count += 1
        except Exception as e:
            log_warn(f"处理会话文件时出错: {session_file.name} - {e}")

    log_info(f"已清理 {count} 个过期会话")
    return count


def get_progress_display(session_id: str) -> str:
    """
    获取进度显示字符串

    Args:
        session_id: 会话ID

    Returns:
        str: 进度显示文本
    """
    session = get_session(session_id)
    if not session:
        return ""

    # 从场景配置中获取维度名称，兼容旧会话
    dimension_names = {}
    scenario_config = session.get("scenario_config")
    if scenario_config and "dimensions" in scenario_config:
        for dim in scenario_config["dimensions"]:
            dimension_names[dim["id"]] = dim.get("name", dim["id"])
    else:
        dimension_names = {
            "customer_needs": "客户需求",
            "business_process": "业务流程",
            "tech_constraints": "技术约束",
            "project_constraints": "项目约束"
        }

    lines = ["📊 访谈进度"]

    for dim_key, dim_name in dimension_names.items():
        coverage = session["dimensions"].get(dim_key, {}).get("coverage", 0)

        # 生成进度条
        filled = int(coverage / 10)
        empty = 10 - filled

        if coverage == 100:
            icon = "✅"
        elif coverage > 0:
            icon = "🔄"
        else:
            icon = "⬜"

        bar = "█" * filled + "░" * empty
        lines.append(f" {icon} {dim_name:<8} [{bar}] {coverage:>3}%")

    return "\n".join(lines)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="Intus 会话管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  uvx scripts/session_manager.py create "CRM系统需求访谈"
  uvx scripts/session_manager.py list
  uvx scripts/session_manager.py get dv-20260120-abc12345
  uvx scripts/session_manager.py progress dv-20260120-abc12345
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="命令")

    # create 命令
    create_parser = subparsers.add_parser("create", help="创建新会话")
    create_parser.add_argument("topic", help="访谈主题")

    # list 命令
    subparsers.add_parser("list", help="列出所有会话")

    # get 命令
    get_parser = subparsers.add_parser("get", help="获取会话详情")
    get_parser.add_argument("session_id", help="会话ID")

    # incomplete 命令
    subparsers.add_parser("incomplete", help="获取未完成的会话")

    # pause 命令
    pause_parser = subparsers.add_parser("pause", help="暂停会话")
    pause_parser.add_argument("session_id", help="会话ID")

    # resume 命令
    resume_parser = subparsers.add_parser("resume", help="恢复会话")
    resume_parser.add_argument("session_id", help="会话ID")

    # complete 命令
    complete_parser = subparsers.add_parser("complete", help="完成会话")
    complete_parser.add_argument("session_id", help="会话ID")

    # delete 命令
    delete_parser = subparsers.add_parser("delete", help="删除会话")
    delete_parser.add_argument("session_id", help="会话ID")

    # cleanup 命令
    cleanup_parser = subparsers.add_parser("cleanup", help="清理已完成的旧会话")
    cleanup_parser.add_argument("days", type=int, nargs="?", default=30, help="保留天数（默认30天）")

    # progress 命令
    progress_parser = subparsers.add_parser("progress", help="显示访谈进度")
    progress_parser.add_argument("session_id", help="会话ID")

    # add-log 命令
    addlog_parser = subparsers.add_parser("add-log", help="添加访谈记录")
    addlog_parser.add_argument("session_id", help="会话ID")
    addlog_parser.add_argument("question", help="问题")
    addlog_parser.add_argument("answer", help="回答")
    addlog_parser.add_argument("--dimension", help="所属维度")

    # update-dimension 命令
    updim_parser = subparsers.add_parser("update-dimension", help="更新维度覆盖度")
    updim_parser.add_argument("session_id", help="会话ID")
    updim_parser.add_argument("dimension", help="维度名称")
    updim_parser.add_argument("coverage", type=int, help="覆盖度百分比")
    updim_parser.add_argument("--items", help="信息项（JSON数组）")

    args = parser.parse_args()

    if args.command == "create":
        session_id = create_session(args.topic)
        print(session_id)

    elif args.command == "list":
        sessions = list_sessions()
        print_sessions_table(sessions)

    elif args.command == "get":
        session = get_session(args.session_id)
        if session:
            print(json.dumps(session, ensure_ascii=False, indent=2))

    elif args.command == "incomplete":
        incomplete = get_incomplete_sessions()
        for sid in incomplete:
            print(sid)

    elif args.command == "pause":
        if pause_session(args.session_id):
            log_info(f"会话已暂停: {args.session_id}")

    elif args.command == "resume":
        if resume_session(args.session_id):
            log_info(f"会话已恢复: {args.session_id}")

    elif args.command == "complete":
        if complete_session(args.session_id):
            log_info(f"会话已完成: {args.session_id}")

    elif args.command == "delete":
        delete_session(args.session_id)

    elif args.command == "cleanup":
        cleanup_completed(args.days)

    elif args.command == "progress":
        progress = get_progress_display(args.session_id)
        if progress:
            print(progress)

    elif args.command == "add-log":
        if add_interview_log(args.session_id, args.question, args.answer, args.dimension):
            log_info("访谈记录已添加")

    elif args.command == "update-dimension":
        items = json.loads(args.items) if args.items else []
        if update_dimension_coverage(args.session_id, args.dimension, args.coverage, items):
            log_info(f"维度 {args.dimension} 已更新")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
