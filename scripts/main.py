from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

allowed_origins = [
    "https://ahc-viewer-git-main-yuus-projects-7965612b.vercel.app/", 
    "http://localhost:3000", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
RESULTS_DIR = DATA_DIR / "results"
EXTENDED_DIR = DATA_DIR / "extended"
CONTEST_LISTS_PATH = DATA_DIR / "contest_lists.json"


def load_json(path: Path) -> Any | None:
    try:
        with path.open(encoding="utf-8") as fp:
            return json.load(fp)
    except FileNotFoundError:
        print(f"[warn] missing data file: {path}")
        return None
    except json.JSONDecodeError as exc:
        print(f"[warn] failed to parse {path}: {exc}")
        return None


def load_contest_lists() -> tuple[list[str], list[str]]:
    data = load_json(CONTEST_LISTS_PATH) or {}
    normal = list(dict.fromkeys(data.get("normal", [])))
    other = list(dict.fromkeys(data.get("other", [])))
    return normal, other


def get_ordered_contests() -> list[str]:
    normal, other = load_contest_lists()
    ahc_pairs: list[tuple[int, str]] = []
    for cid in normal:
        if not cid.startswith("ahc"):
            continue
        try:
            number = int(cid.replace("ahc", ""))
        except ValueError:
            continue
        ahc_pairs.append((number, cid))

    if not ahc_pairs:
        ahc_pairs = [
            (i, f"ahc{str(i).zfill(3)}") for i in range(1, 58)
        ]

    ahc_pairs.sort(key=lambda x: x[0], reverse=True)
    ordered = [cid for _, cid in ahc_pairs]
    ordered.extend(other)
    return ordered


def fetch_results_for_contest(contest_id: str, user: str):
    path = RESULTS_DIR / f"{contest_id}.json"
    data = load_json(path)
    if not isinstance(data, dict):
        return None, None, {}

    my_rank = None
    my_perf = None
    place_to_perf: dict[int, int] = {}

    for row in data.get("rows", []):
        place = row.get("rank")
        perf = row.get("performance")

        if isinstance(place, int) and isinstance(perf, int):
            place_to_perf[place] = perf

        if row.get("user") == user:
            my_rank = place
            my_perf = perf

    return my_rank, my_perf, place_to_perf


def fetch_extended_equiv_for_contest(
    contest_id: str, user: str, place_to_perf: dict[int, int]
):
    path = EXTENDED_DIR / f"{contest_id}.json"
    data = load_json(path)
    if not isinstance(data, dict):
        return None, None, None

    rows = data.get("rows", [])

    my_rows = [r for r in rows if r.get("user") == user]
    if not my_rows:
        return None, None, None

    # 延長戦の行は contest_rank が None になっている
    my_row = next(
        (r for r in my_rows if r.get("contest_rank") is None),
        my_rows[0],
    )
    my_rank_ext = my_row.get("rank")
    if not isinstance(my_rank_ext, int):
        return None, None, None

    upper_player_cnt : int = 0 # 
    for r in rows:
        extended_rank = r.get("rank") # 延長戦順位
        base_rank = r.get("contest_rank")
        if extended_rank < my_rank_ext and isinstance(base_rank, int): # 延長戦順位が自分より上で、本番順位が存在する
            upper_player_cnt += 1
    
    equiv_base_rank = upper_player_cnt + 1
    equiv_perf = place_to_perf.get(equiv_base_rank)

    return my_rank_ext, equiv_base_rank, equiv_perf


@app.get("/api/ahc")
def ahc(user: str):
    contests = get_ordered_contests()
    results = []

    for cid in contests:
        print(f"fetching {cid} ...")

        main_rank, main_perf, place_to_perf = fetch_results_for_contest(cid, user)

        ext_rank = None
        ext_equiv_rank = None
        ext_equiv_perf = None
        if place_to_perf:
            ext_rank, ext_equiv_rank, ext_equiv_perf = fetch_extended_equiv_for_contest(
                cid, user, place_to_perf
            )

        results.append(
            {
                "contest": cid.upper(),
                "rank": main_rank,
                "perf": main_perf,
                "extended_rank": ext_rank,
                "extended_equiv_rank": ext_equiv_rank,
                "extended_equiv_perf": ext_equiv_perf,
            }
        )

    return {"results": results}
