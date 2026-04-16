import { NextResponse } from "next/server";
import themeManifest from "@/data/themeManifest.json";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DEFAULT_BOARD_THEME = themeManifest.defaultBoardTheme;
const DEFAULT_PIECE_THEME = themeManifest.defaultPieceTheme;
const ALLOWED_BOARD_THEMES = new Set(themeManifest.boardThemes);
const ALLOWED_PIECE_THEMES = new Set(themeManifest.pieceThemes);

type PreferencesPayload = {
  boardTheme?: string;
  pieceTheme?: string;
  soundEnabled?: boolean;
};

function sanitizePayload(payload: PreferencesPayload) {
  const updates: {
    board_theme?: string;
    piece_theme?: string;
    sound_enabled?: boolean;
  } = {};

  if (typeof payload.boardTheme === "string" && ALLOWED_BOARD_THEMES.has(payload.boardTheme)) {
    updates.board_theme = payload.boardTheme;
  }

  if (typeof payload.pieceTheme === "string" && ALLOWED_PIECE_THEMES.has(payload.pieceTheme)) {
    updates.piece_theme = payload.pieceTheme;
  }

  if (typeof payload.soundEnabled === "boolean") {
    updates.sound_enabled = payload.soundEnabled;
  }

  return updates;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("board_theme, piece_theme, sound_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    boardTheme: data?.board_theme ?? DEFAULT_BOARD_THEME,
    pieceTheme: data?.piece_theme ?? DEFAULT_PIECE_THEME,
    soundEnabled: data?.sound_enabled ?? true,
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PreferencesPayload;
  try {
    payload = (await request.json()) as PreferencesPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updates = sanitizePayload(payload);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid preferences were provided." }, { status: 400 });
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      ...updates,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
