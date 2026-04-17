import { NextResponse } from "next/server";
import { getOpeningBySlug } from "@/lib/openings-catalog";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }> | { slug: string };
};

export async function GET(_request: Request, context: RouteContext) {
  const resolvedParams = await context.params;
  const slug = decodeURIComponent(resolvedParams.slug ?? "");

  try {
    const opening = await getOpeningBySlug(slug);
    if (!opening) {
      return NextResponse.json({ error: "Opening not found." }, { status: 404 });
    }

    return NextResponse.json(opening);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load opening.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
