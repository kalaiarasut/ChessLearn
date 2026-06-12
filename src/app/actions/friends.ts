"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(friendId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("friendships").insert({
    user_id: user.id,
    friend_id: friendId,
    status: "pending",
  });

  if (error) {
    // If it's a unique violation (code 23505), they already sent a request, which is fine
    if (error.code === "23505") {
      console.warn("Friend request already exists");
      return; // gracefully ignore
    }
    console.error("Error sending friend request:", error);
    throw new Error(`Failed to send friend request: ${error.message}`);
  }

  revalidatePath("/play/online");
  return { success: true };
}

export async function acceptFriendRequest(friendId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", friendId)
    .eq("friend_id", user.id);

  if (error) {
    console.error("Error accepting friend request:", error);
    throw new Error("Failed to accept friend request");
  }

  revalidatePath("/play/online");
  return { success: true };
}
