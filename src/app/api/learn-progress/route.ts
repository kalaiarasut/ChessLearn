import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeLearnPreferences } from "@/lib/learn-progress-sync";

async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("user_learn_progress")
      .select("payload")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ learn: normalizeLearnPreferences(data?.payload) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load opening progress.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const learn = normalizeLearnPreferences((payload as { learn?: unknown })?.learn);

  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { error } = await supabase.from("user_learn_progress").upsert(
      {
        user_id: user.id,
        payload: learn,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, learn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save opening progress.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
