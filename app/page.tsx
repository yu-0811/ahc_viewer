"use client";

import { useState } from "react";
import contestLists from "../data/contest_lists.json";
import { AhcResult } from "@/types/ahc";

const normalContests: string[] = contestLists.normal ?? [];
const otherContests: string[] = contestLists.other ?? [];

const normalOrderDesc = [...normalContests].sort((a, b) => {
  const na = parseInt(a.replace("ahc", ""), 10);
  const nb = parseInt(b.replace("ahc", ""), 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) {
    return b.localeCompare(a);
  }
  return nb - na;
});

const displayOrder = [...normalOrderDesc, ...otherContests];
const contestOrderMap = new Map<string, number>();
displayOrder.forEach((cid, idx) => {
  contestOrderMap.set(cid.toUpperCase(), idx);
});


// パフォの色を返す関数
function getPerfBgClass(perf: number | null): string {
  if (perf === null) return "";

  if (perf < 400) return "bg-user-gray";
  if (perf < 800) return "bg-user-brown";
  if (perf < 1200) return "bg-user-green";
  if (perf < 1600) return "bg-user-cyan";
  if (perf < 2000) return "bg-user-blue";
  if (perf < 2400) return "bg-user-yellow";
  if (perf < 2800) return "bg-user-orange";
  return "bg-user-red";
}


export default function Home() {
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AhcResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults([]);
    if (!user) {
      setError("ユーザー名を入力してください");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        user,
      });

      const res = await fetch(`/api/ahc?${params.toString()}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("エラーが発生しました");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">AHC 延長戦 Viewer</h1>
      <p className="text-sm text-gray-700 mb-4 leading-relaxed">
        AtCoder のユーザー名を入力すると、全 AHC の本番順位・パフォーマンスに加えて、<br></br>
        延長戦（コンテスト終了後提出）の本番相当順位・パフォーマンスをまとめて表示します。<br></br>
        長期コンテストなどシステムテストがあるコンテストでは、<br></br>
        プレテストのスコアを基に延長戦本番相当順位を算出しています。<br></br>
        毎日 15 時にデータを更新しています。<br></br>
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 mb-4"
      >
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="AtCoder ユーザー名"
          className="border px-3 py-1 rounded w-48"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "取得中..." : "取得"}
        </button>
      </form>

      {error && <p className="text-red-500 mb-2">{error}</p>}

      {results.length > 0 && (
        <table className="table-fixed w-full border-collapse border border-gray-300 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-1 py-1 w-20">コンテスト</th>
              <th className="border px-2 py-1 whitespace-nowrap w-24">本番順位</th>
              <th className="border px-2 py-1 whitespace-nowrap w-28">本番パフォ</th>
              <th className="border px-2 py-1 whitespace-nowrap w-24">
                延長戦
                <br />
                本番相当
                <br className="sm:hidden" />
                順位
              </th>
              <th className="border px-2 py-1 whitespace-nowrap w-28">
                延長戦
                <br />
                本番相当
                <br className="sm:hidden" />
                パフォ
              </th>
            </tr>
          </thead>
          <tbody>
            {results
              .slice()
              .sort((a, b) => {
                const orderA =
                  contestOrderMap.get(a.contest) ?? Number.MAX_SAFE_INTEGER;
                const orderB =
                  contestOrderMap.get(b.contest) ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
              })
              .map((r) => (
                <tr key={r.contest} className="hover:bg-gray-50">
                  <td className="border px-1 py-1 text-center w-20">
                    <a
                      href={`https://atcoder.jp/contests/${r.contest.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      {r.contest}
                    </a>
                  </td>
                  <td className="border px-2 py-1 text-center w-24">
                    {r.rank ?? "-"}
                  </td>
                  <td className={`border px-2 py-1 text-center w-28 ${getPerfBgClass(r.perf)}`}>
                    {r.perf ?? "-"}
                  </td>
                  <td className="border px-2 py-1 text-center w-24">
                    {r.extended_equiv_rank ?? "-"}
                  </td>
                  <td
                    className={`border px-2 py-1 text-center w-28 ${getPerfBgClass(
                      r.extended_equiv_perf
                    )}`}
                  >
                    {r.extended_equiv_perf ?? "-"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
