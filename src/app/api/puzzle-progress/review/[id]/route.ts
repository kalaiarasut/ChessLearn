import { NextResponse } from "next/server";
import { updateReviewQueueItemForCurrentUser } from "@/lib/puzzle-progress-server";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, context: RouteContext) {
  let payload: { outcome?: "solved" | "failed" };

  try {
    payload = (await request.json()) as { outcome?: "solved" | "failed" };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (payload.outcome !== "solved" && payload.outcome !== "failed") {
    return NextResponse.json({ error: "Invalid review outcome." }, { status: 400 });
  }

  const resolvedParams = await context.params;
  const id = Number.parseInt(resolvedParams.id, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid review item id." }, { status: 400 });
  }

  try {
    const item = await updateReviewQueueItemForCurrentUser(id, payload.outcome);
    if (!item) {
      return NextResponse.json({ error: "Review item not found." }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update review item.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
