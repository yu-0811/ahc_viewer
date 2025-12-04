import { NextRequest, NextResponse } from "next/server";

import { fetchAhcResults } from "@/lib/results";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const user = searchParams.get("user")?.trim();

  if (!user) {
    return NextResponse.json(
      { error: "user query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const results = await fetchAhcResults(user);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[error] failed to fetch AHC results:", error);
    return NextResponse.json(
      { error: "failed to fetch results" },
      { status: 500 }
    );
  }
}
