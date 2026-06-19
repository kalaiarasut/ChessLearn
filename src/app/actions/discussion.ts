"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/discussion-service";

export async function createPost(content: string, images: string[] = [], replyToId?: string, quotedPostId?: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to post");
  }

  const { data: post, error } = await supabase
    .from("discussion_posts")
    .insert({
      author_id: user.id,
      content,
      images,
      reply_to_id: replyToId || null,
      quoted_post_id: quotedPostId || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Find mentions
  const mentions = Array.from(new Set((content.match(/@\w+/g) || []).map(m => m.slice(1))));
  
  if (mentions.length > 0) {
    const { data: mentionedUsers } = await supabase
      .from("profiles")
      .select("id, handle")
      .in("handle", mentions);

    if (mentionedUsers && mentionedUsers.length > 0) {
      const notifications = mentionedUsers
        .filter(u => u.id !== user.id) // Don't notify self
        .map(u => ({
          user_id: u.id,
          actor_id: user.id,
          type: "mention",
          post_id: post.id
        }));
      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }
    }
  }

  // Notification for reply
  if (replyToId) {
    const { data: parentPost } = await supabase
      .from("discussion_posts")
      .select("author_id")
      .eq("id", replyToId)
      .single();

    if (parentPost && parentPost.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: parentPost.author_id,
        actor_id: user.id,
        type: "reply",
        post_id: post.id
      });
    }
  }

  revalidatePath("/discussion");
}

export async function deletePost(postId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to delete");
  }

  // Ensure user owns post
  const { data: post } = await supabase
    .from("discussion_posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("discussion_posts")
    .delete()
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/discussion");
}

export async function editPost(postId: string, content: string, images?: string[]) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to edit");
  }

  // Ensure user owns post
  const { data: post } = await supabase
    .from("discussion_posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post || post.author_id !== user.id) {
    throw new Error("Unauthorized");
  }

  const updates: any = { content };
  if (images) {
    updates.images = images;
  }

  const { error } = await supabase
    .from("discussion_posts")
    .update(updates)
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/discussion");
}

export async function toggleReaction(postId: string, type: 'like' | 'repost') {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Must be logged in to react");
  }

  // Check if reaction exists
  const { data: existing } = await supabase
    .from("discussion_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .eq("type", type)
    .single();

  if (existing) {
    // Remove it
    await supabase
      .from("discussion_reactions")
      .delete()
      .eq("id", existing.id);
  } else {
    // Add it
    await supabase
      .from("discussion_reactions")
      .insert({
        post_id: postId,
        user_id: user.id,
        type,
      });

    // Generate notification
    const { data: parentPost } = await supabase
      .from("discussion_posts")
      .select("author_id")
      .eq("id", postId)
      .single();

    if (parentPost && parentPost.author_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: parentPost.author_id,
        actor_id: user.id,
        type, // "like" or "repost"
        post_id: postId
      });
    }
  }

  revalidatePath("/discussion");
}

export async function fetchPostsAction(replyToId: string | null = null, limit = 20, cursor?: string, feedType: 'all' | 'following' = 'all') {
  const { getPosts } = await import("@/lib/discussion-service");
  return getPosts(replyToId, limit, cursor, feedType);
}

export async function fetchUsersAction(query: string) {
  const { searchUsers } = await import("@/lib/discussion-service");
  return searchUsers(query);
}

export async function getLinkPreviewAction(url: string) {
  try {
    const ogs = (await import('open-graph-scraper')).default;
    const { result } = await ogs({ url });
    return {
      title: result.ogTitle || result.twitterTitle,
      description: result.ogDescription || result.twitterDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: result.ogUrl || url,
      siteName: result.ogSiteName,
    };
  } catch (e) {
    return null;
  }
}

export async function reportPostAction(postId: string, reason: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to report a post");

  const { error } = await supabase
    .from('reported_posts')
    .insert({
      post_id: postId,
      reporter_id: user.id,
      reason
    });

  if (error) throw new Error(`Failed to report post: ${error.message}`);
}
