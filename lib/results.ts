import { readFile } from "fs/promises";
import path from "path";

import { AhcResult } from "@/types/ahc";

type ContestLists = {
  normal?: unknown;
  other?: unknown;
};

type ResultRow = {
  user?: string;
  rank?: number;
  performance?: number;
};

type ExtendedRow = {
  user?: string;
  rank?: number;
  contest_rank?: number | null;
};

type ContestResult = {
  rank: number | null;
  perf: number | null;
  placeToPerf: Map<number, number>;
};

type ExtendedResult = {
  extendedRank: number | null;
  extendedEquivRank: number | null;
  extendedEquivPerf: number | null;
};

const DATA_DIR = path.join(process.cwd(), "data");
const RESULTS_DIR = path.join(DATA_DIR, "results");
const EXTENDED_DIR = path.join(DATA_DIR, "extended");
const CONTEST_LISTS_PATH = path.join(DATA_DIR, "contest_lists.json");

async function loadJson<T>(filepath: string): Promise<T | null> {
  try {
    const raw = await readFile(filepath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      console.warn(`[warn] missing data file: ${filepath}`);
    } else {
      console.warn(`[warn] failed to load ${filepath}:`, error);
    }
    return null;
  }
}

function ensureStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

async function getOrderedContests(): Promise<string[]> {
  const data = (await loadJson<ContestLists>(CONTEST_LISTS_PATH)) ?? {};
  const normal = ensureStringList(data.normal);
  const other = ensureStringList(data.other);

  const ahcPairs: Array<{ number: number; id: string }> = [];
  for (const cid of normal) {
    if (!cid.startsWith("ahc")) continue;
    const number = Number.parseInt(cid.replace("ahc", ""), 10);
    if (Number.isNaN(number)) continue;
    ahcPairs.push({ number, id: cid });
  }

  ahcPairs.sort((a, b) => b.number - a.number);
  return [...ahcPairs.map((entry) => entry.id), ...other];
}

async function fetchResultsForContest(
  contestId: string,
  user: string
): Promise<ContestResult> {
  const data = await loadJson<{ rows?: ResultRow[] }>(
    path.join(RESULTS_DIR, `${contestId}.json`)
  );

  if (!data || !Array.isArray(data.rows)) {
    return { rank: null, perf: null, placeToPerf: new Map() };
  }

  let myRank: number | null = null;
  let myPerf: number | null = null;
  const placeToPerf = new Map<number, number>();

  for (const row of data.rows) {
    const place = typeof row.rank === "number" ? row.rank : null;
    const perf = typeof row.performance === "number" ? row.performance : null;

    if (place !== null && perf !== null) {
      const existing = placeToPerf.get(place);
      if (existing === undefined || perf < existing) {
        placeToPerf.set(place, perf);
      }
    }

    if (row.user === user) {
      myRank = place;
      myPerf = perf;
    }
  }

  return { rank: myRank, perf: myPerf, placeToPerf };
}

async function fetchExtendedEquivForContest(
  contestId: string,
  user: string,
  placeToPerf: Map<number, number>
): Promise<ExtendedResult> {
  const data = await loadJson<{ rows?: ExtendedRow[] }>(
    path.join(EXTENDED_DIR, `${contestId}.json`)
  );

  if (!data || !Array.isArray(data.rows) || placeToPerf.size === 0) {
    return {
      extendedRank: null,
      extendedEquivRank: null,
      extendedEquivPerf: null,
    };
  }

  const myRows = data.rows.filter((row) => row.user === user);
  if (myRows.length === 0) {
    return {
      extendedRank: null,
      extendedEquivRank: null,
      extendedEquivPerf: null,
    };
  }

  const preferredRow =
    myRows.find((row) => row.contest_rank == null) ?? myRows[0];
  const myRankExt =
    typeof preferredRow.rank === "number" ? preferredRow.rank : null;

  if (myRankExt === null) {
    return {
      extendedRank: null,
      extendedEquivRank: null,
      extendedEquivPerf: null,
    };
  }

  let upperPlayerCnt = 0;
  for (const row of data.rows) {
    const extendedRank = typeof row.rank === "number" ? row.rank : null;
    const baseRank =
      typeof row.contest_rank === "number" ? row.contest_rank : null;

    if (
      extendedRank !== null &&
      baseRank !== null &&
      extendedRank < myRankExt
    ) {
      upperPlayerCnt += 1;
    }
  }

  const equivBaseRank = upperPlayerCnt + 1;
  const equivPerf = placeToPerf.get(equivBaseRank) ?? null;

  console.debug(
    `[debug] extended equiv for ${contestId} user=${user}: ext_rank=${myRankExt}, equiv_base_rank=${equivBaseRank}, equiv_perf=${equivPerf}`
  );

  return {
    extendedRank: myRankExt,
    extendedEquivRank: equivBaseRank,
    extendedEquivPerf: equivPerf,
  };
}

export async function fetchAhcResults(user: string): Promise<AhcResult[]> {
  const contests = await getOrderedContests();
  const results: AhcResult[] = [];

  for (const contestId of contests) {
    console.log(`[info] fetching ${contestId} for ${user} ...`);
    const { rank, perf, placeToPerf } = await fetchResultsForContest(
      contestId,
      user
    );

    let extendedRank: number | null = null;
    let extendedEquivRank: number | null = null;
    let extendedEquivPerf: number | null = null;

    if (placeToPerf.size > 0) {
      const extended = await fetchExtendedEquivForContest(
        contestId,
        user,
        placeToPerf
      );
      extendedRank = extended.extendedRank;
      extendedEquivRank = extended.extendedEquivRank;
      extendedEquivPerf = extended.extendedEquivPerf;
    }

    results.push({
      contest: contestId.toUpperCase(),
      rank,
      perf,
      extended_rank: extendedRank,
      extended_equiv_rank: extendedEquivRank,
      extended_equiv_perf: extendedEquivPerf,
    });
  }

  return results;
}
