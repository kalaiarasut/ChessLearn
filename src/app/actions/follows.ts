"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/discussion-service";

export async function toggleFollow(followingId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to follow users");
  }

  if (user.id === followingId) {
    throw new Error("Cannot follow yourself");
  }

  // Check if following
  const { data: existing } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .single();

  if (existing) {
    // Unfollow
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);
  } else {
    // Follow
    await supabase
      .from("follows")
      .insert({
        follower_id: user.id,
        following_id: followingId
      });

    // Notify
    await supabase.from("notifications").insert({
      user_id: followingId,
      actor_id: user.id,
      type: "follow"
    });
  }

  revalidatePath("/discussion");
}

export async function checkIsFollowing(followingId: string): Promise<boolean> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .single();

  return !!data;
}
