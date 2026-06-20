import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { increments } = await req.json() as { increments: Record<string, number> };
    if (!increments || Object.keys(increments).length === 0) {
      return NextResponse.json({ success: true, newUnlocks: [] });
    }

    const { data: achievements, error: achErr } = await supabase.from('achievements').select('id, title, max_progress');
    if (achErr || !achievements) {
      return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
    }

    const newUnlocks: string[] = [];

    for (const [title, incValue] of Object.entries(increments)) {
      if (incValue <= 0) continue;

      const achievement = achievements.find(a => a.title === title);
      if (!achievement) continue;

      const { data: currentStatus } = await supabase
        .from('user_achievements')
        .select('progress, unlocked_at')
        .eq('user_id', user.id)
        .eq('achievement_id', achievement.id)
        .maybeSingle();

      let currentProgress = currentStatus?.progress || 0;
      let unlockedAt = currentStatus?.unlocked_at || null;

      if (unlockedAt) {
        continue;
      }

      currentProgress += incValue;
      if (currentProgress >= achievement.max_progress) {
        currentProgress = achievement.max_progress;
        unlockedAt = new Date().toISOString();
        newUnlocks.push(title);
      }

      await supabase.from('user_achievements').upsert({
        user_id: user.id,
        achievement_id: achievement.id,
        progress: currentProgress,
        unlocked_at: unlockedAt
      }, { onConflict: 'user_id, achievement_id' });
    }

    return NextResponse.json({ success: true, newUnlocks });
  } catch (err) {
    console.error("Progress update error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: userAch, error } = await supabase
    .from('user_achievements')
    .select(`
      progress,
      unlocked_at,
      achievements ( title, max_progress )
    `)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }

  const progressMap: Record<string, { current: number, max: number, unlocked: boolean }> = {};
  
  if (userAch) {
    for (const record of userAch as any[]) {
      if (record.achievements?.title) {
        progressMap[record.achievements.title] = {
          current: record.progress,
          max: record.achievements.max_progress,
          unlocked: !!record.unlocked_at
        };
      }
    }
  }

  return NextResponse.json({ progress: progressMap });
}
