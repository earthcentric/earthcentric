import { NextResponse } from "next/server";
import { getCategoryFilters } from "@/actions/categories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || "all";

  try {
    const attributes = await getCategoryFilters(slug);
    return NextResponse.json({ attributes });
  } catch (e) {
    console.error("Category filters API error:", e);
    return NextResponse.json({ attributes: [] });
  }
}
