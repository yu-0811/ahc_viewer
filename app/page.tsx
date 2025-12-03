"use client";

import { useState } from "react";

type AhcResult = {
  contest: string;
  rank: number | null;
  perf: number | null;
};

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
        start: "1",
        end: "60",
      });

      const res = await fetch(`/api/ahc?${params.toString()}`);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error: ${res.status} ${text}`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err: any) {
      setError(err.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>AHC 結果ビューア</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <label>
          AtCoder ユーザー名：
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{ marginLeft: 8 }}
          />
        </label>
        <button type="submit" disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? "取得中..." : "取得"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {results.length > 0 && (
        <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>回</th>
              <th>本番順位</th>
              <th>本番パフォ</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.contest}>
                <td>{r.contest}</td>
                <td>{r.rank ?? "-"}</td>
                <td>{r.perf ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
