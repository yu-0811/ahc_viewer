from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

CONTESTS_URL = "https://kenkoooo.com/atcoder/resources/contests.json"
RESULTS_URL_TEMPLATE = "https://atcoder.jp/contests/{contest_id}/results/json"
EXTENDED_URL_TEMPLATE = (
    "https://atcoder.jp/contests/{contest_id}/standings/extended/json?showAllUsers=true"
)

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
RESULTS_DIR = DATA_DIR / "results"
EXTENDED_DIR = DATA_DIR / "extended"
CONTEST_META_PATH = DATA_DIR / "contests.json"
CONTEST_LISTS_PATH = DATA_DIR / "contest_lists.json"


def load_contest_lists() -> dict[str, list[str]]:
    default = {"normal": [], "other": [], "skip_extended": []}
    if not CONTEST_LISTS_PATH.exists():
        return default
    try:
        with CONTEST_LISTS_PATH.open(encoding="utf-8") as fp:
            data = json.load(fp)
            normal = list(dict.fromkeys(data.get("normal", [])))
            other = list(dict.fromkeys(data.get("other", [])))
            skip_extended = list(dict.fromkeys(data.get("skip_extended", [])))
            return {"normal": normal, "other": other, "skip_extended": skip_extended}
    except Exception as exc:  # noqa: BLE001
        print(f"Failed to load contest list: {exc}", file=sys.stderr)
        return default


def save_contest_lists(data: dict[str, list[str]]) -> None:
    data = {
        "normal": sorted(set(data.get("normal", []))),
        "other": list(dict.fromkeys(data.get("other", []))),
        "skip_extended": sorted(set(data.get("skip_extended", []))),
    }
    CONTEST_LISTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONTEST_LISTS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def fetch_json(url: str) -> Any:
    """Fetch JSON from URL while tolerating BOM/leading whitespace."""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return json.loads(resp.text.lstrip("\ufeff \n\r\t"))

def fetch_extended_json(url: str, session: requests.Session) -> Any:
    resp = session.get(url, timeout=30)
    resp.raise_for_status()
    # standings json also may include BOM/whitespace
    return json.loads(resp.text.lstrip("\ufeff \n\r\t"))

def fetch_ahc_contests() -> list[dict[str, Any]]:
    """Return contest metadata for all AHC contests."""
    data = fetch_json(CONTESTS_URL)
    contests = [
        c
        for c in data
        if isinstance(c.get("id"), str) and c["id"].startswith("ahc")
    ]
    contests.sort(key=lambda c: c["id"])
    return contests

def get_valid_session(cookie_path: Path | str = Path("session.json")) -> requests.Session | None:
    cookie_path = Path(cookie_path)
    session = requests.Session()
    try:
        with cookie_path.open("r", encoding="utf-8") as f:
            cookies = json.load(f)
        session.cookies.set('REVEL_SESSION', cookies['REVEL_SESSION'], domain='.atcoder.jp')
    except Exception as e:
        print(f"Failed to load cookies from {cookie_path}: {e}", file=sys.stderr)
        return None
    
    # 確認
    resp = session.get("https://atcoder.jp/home", timeout=10)
    if "ログイン" in resp.text:
        print("Warning: Not logged in. Please check your session cookie.", file=sys.stderr)
        return None
    return session

# 順位表から必要な情報だけ取り出す
def simplify_results(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simplified = []
    for row in rows:
        simplified.append(
            {
                "user": row.get("UserScreenName"),
                "rank": row.get("Place"),
                "performance": row.get("Performance"),
            }
        )
    simplified.sort(key=lambda r: (r["rank"] if isinstance(r["rank"], int) else 10**9, r["user"] or ""))
    return simplified


def simplify_extended(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    simplified = []
    for row in rows:
        additional = row.get("Additional") or {}
        simplified.append(
            {
                "user": row.get("UserScreenName"),
                "rank": row.get("Rank"),
                "contest_rank": additional.get("standings.extendedContestRank"), # 本番順位
            }
        )
    simplified.sort(key=lambda r: (r["rank"] if isinstance(r["rank"], int) else 10**9, r["user"] or ""))
    return simplified


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def process_contest(contest_id: str, session: requests.Session, fetch_extended: bool = True) -> None:
    timestamp = datetime.now(timezone.utc).isoformat()

    results_url = RESULTS_URL_TEMPLATE.format(contest_id=contest_id)
    extended_url = EXTENDED_URL_TEMPLATE.format(contest_id=contest_id)
    results_path = RESULTS_DIR / f"{contest_id}.json"
    extended_path = EXTENDED_DIR / f"{contest_id}.json"

    # 順位表の取得
    if results_path.exists():
        print(f"[{contest_id}] results already cached, skipping.")
    else:
        try:
            print(f"[{contest_id}] fetching results ...")
            results_raw = fetch_json(results_url)
            results_data = {
                "contest_id": contest_id,
                "fetched_at": timestamp,
                "rows": simplify_results(results_raw),
            }
            save_json(results_path, results_data)
        except Exception as exc:  # noqa: BLE001
            print(f"[{contest_id}] failed to fetch results: {exc}", file=sys.stderr)
        time.sleep(5)

    # 延長戦順位表の取得
    if not fetch_extended:
        print(f"[{contest_id}] skip extended standings.")
    else:
        try:
            print(f"[{contest_id}] fetching extended standings ...")
            extended_raw = fetch_extended_json(extended_url, session)
            rows = extended_raw.get("StandingsData", [])
            extended_data = {
                "contest_id": contest_id,
                "fetched_at": timestamp,
                "rows": simplify_extended(rows),
            }
            save_json(extended_path, extended_data)
        except Exception as exc:  # noqa: BLE001
            print(f"[{contest_id}] failed to fetch extended standings: {exc}", file=sys.stderr)
        time.sleep(5)

def main() -> None:
    contest_lists = load_contest_lists()
    normal = list(contest_lists.get("normal", []))
    other = list(contest_lists.get("other", []))
    skip_extended = set(contest_lists.get("skip_extended", []))
    contests = list(dict.fromkeys(normal + other))

    fetch_contests = fetch_ahc_contests()
    updated = False
    for c in fetch_contests:
        cid = c["id"]
        if cid not in contests:
            contests.append(cid)
        if cid not in normal and cid not in other:
            normal.append(cid)
            updated = True

    if updated: # 新しいコンテストがあったら保存
        print("New contests found, updating contest_lists.json")
        contest_lists["normal"] = sorted(set(normal))
        contest_lists["other"] = other
        save_contest_lists(contest_lists)
        contests = contest_lists["normal"] + contest_lists["other"]
        skip_extended = set(contest_lists.get("skip_extended", []))

    session = get_valid_session()
    if session is None:
        sys.exit("Failed to prepare logged-in session; aborting.")

    for contest in contests:
        process_contest(contest, session, contest not in skip_extended)


if __name__ == "__main__":
    main()
