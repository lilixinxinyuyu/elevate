"""共用：从 selena-elevate.pages.dev 拿数据 + 简单缓存"""

import json
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

CACHE_DIR = Path.home() / ".hermes" / "selena-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL = 60  # 60 秒缓存：避免一次会话内多次脚本重复拉远端


def _load_env_file(path: Path) -> None:
    """如果 os.environ 里没有，从 .env 文件加载（KEY=VALUE 格式，#注释 OK）。"""
    if not path.exists():
        return
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
    except Exception:
        pass


# Hermes cron 等场景下脚本进程没继承 shell 的 .env，要自己读
_load_env_file(Path.home() / ".hermes" / ".env")

API_BASE = os.environ.get("SELENA_API_BASE", "https://selena-elevate.pages.dev")
PASSWORD = os.environ.get("SELENA_PASSWORD", "")


def _cache_path(key: str) -> Path:
    safe = "".join(c if c.isalnum() else "_" for c in key)
    return CACHE_DIR / f"{safe}.json"


def _read_cache(key: str):
    p = _cache_path(key)
    if not p.exists():
        return None
    age = time.time() - p.stat().st_mtime
    if age > CACHE_TTL:
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _write_cache(key: str, data):
    _cache_path(key).write_text(json.dumps(data))


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Selena-Math-Tutor/0.1 Hermes-Skill"


def fetch_json(path: str, *, use_cache: bool = True):
    """带 Auth 拉远端 JSON。失败抛带可读信息的异常。"""
    if not PASSWORD and "/api/" in path:
        raise SystemExit(
            "❌ 没有设 SELENA_PASSWORD。请在 ~/.hermes/.env 里加一行：\n"
            "   SELENA_PASSWORD=<网站密码>"
        )
    url = f"{API_BASE}{path}"
    if use_cache:
        cached = _read_cache(url)
        if cached is not None:
            return cached
    headers = {
        "Accept": "application/json",
        "User-Agent": UA,
    }
    if PASSWORD:
        headers["Authorization"] = f"Bearer {PASSWORD}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        raise SystemExit(f"❌ {url} → HTTP {e.code}: {body[:200]}")
    except urllib.error.URLError as e:
        raise SystemExit(f"❌ 网络拉不到 {url}: {e.reason}")
    if use_cache:
        _write_cache(url, data)
    return data


def post_json(path: str, body: dict):
    if not PASSWORD:
        raise SystemExit("❌ 没有设 SELENA_PASSWORD")
    url = f"{API_BASE}{path}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {PASSWORD}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_snapshot():
    """拉最新快照。返回 dict 或 None。"""
    data = fetch_json("/api/sync/download")
    if not data.get("ok"):
        return None
    latest = data.get("latest")
    if not latest:
        return None
    return latest


def get_questions_index():
    """拉静态题库（公开）。"""
    return fetch_json("/agent/questions.json")


def get_skills_index():
    return fetch_json("/agent/skills.json")
