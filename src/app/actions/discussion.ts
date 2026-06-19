"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/discussion-service";

export async function createPost(content: string, images: string[] = [], replyToId?: string, quotedPostId?: string, pollOptions?: string[]) {
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

  // Insert poll if provided
  if (pollOptions && pollOptions.length >= 2) {
    const { error: pollError } = await supabase
      .from("polls")
      .insert({
        post_id: post.id,
        options: pollOptions
      });
    if (pollError) {
      console.error("Failed to create poll:", pollError);
    }
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

  const updates: { content: string; images?: string[] } = { content };
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
  const posts = await getPosts(replyToId, limit, cursor, feedType);

  if (feedType === 'all' && !replyToId) {
    // "For You" algorithm: sort by engagement (likes + comments * 2 + reposts * 3)
    posts.sort((a, b) => {
      const scoreA = (a.reactions?.likes || 0) + (a.reactions?.comments || 0) * 2 + (a.reactions?.reposts || 0) * 3;
      const scoreB = (b.reactions?.likes || 0) + (b.reactions?.comments || 0) * 2 + (b.reactions?.reposts || 0) * 3;
      if (scoreB === scoreA) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return scoreB - scoreA;
    });
  }

  return posts;
}

export async function fetchUsersAction(query: string) {
  const { searchUsers } = await import("@/lib/discussion-service");
  return searchUsers(query);
}

export async function searchPostsAction(query: string) {
  const { getPosts } = await import("@/lib/discussion-service");
  // getPosts(replyToId, limit, cursor, feedType, searchQuery)
  return getPosts(null, 50, undefined, 'all', query);
}

export async function getLinkPreviewAction(url: string) {
  try {
    const ogs = (await import('open-graph-scraper')).default;
    const { result } = await ogs({ 
      url,
      fetchOptions: {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      }
    });
    return {
      title: result.ogTitle || result.twitterTitle,
      description: result.ogDescription || result.twitterDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: result.ogUrl || url,
      siteName: result.ogSiteName,
    };
  } catch (e) {
    console.error("Link preview error:", e);
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

export async function voteOnPollAction(pollId: string, optionIndex: number) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to vote");

  const { error } = await supabase
    .from('poll_votes')
    .insert({
      poll_id: pollId,
      user_id: user.id,
      option_index: optionIndex
    });

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error("You have already voted on this poll");
    }
    throw new Error(`Failed to vote: ${error.message}`);
  }

  revalidatePath("/discussion");
}

export async function toggleBookmarkAction(postId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to bookmark");

  // Check if bookmark exists
  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .single();

  if (existing) {
    // Remove bookmark
    await supabase.from('bookmarks').delete().eq('id', existing.id);
  } else {
    // Add bookmark
    await supabase.from('bookmarks').insert({
      user_id: user.id,
      post_id: postId
    });
  }

  revalidatePath("/discussion");
  revalidatePath("/discussion/bookmarks");
}

export async function fetchBookmarkedPostsAction() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('post_id')
    .eq('user_id', user.id)
    .not('post_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !bookmarks || bookmarks.length === 0) return [];

  const postIds = bookmarks.map(b => b.post_id);
  
  // Need to fetch actual posts using getPosts but filtered by IDs
  const { getPostsByIds } = await import("@/lib/discussion-service");
  if (getPostsByIds) {
      return getPostsByIds(postIds);
  }
  
  return [];
}

export async function toggleMatchBookmarkAction(matchId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be logged in to bookmark");

  // Check if bookmark exists
  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('match_id', matchId)
    .maybeSingle();

  if (existing) {
    await supabase.from('bookmarks').delete().eq('id', existing.id);
  } else {
    await supabase.from('bookmarks').insert({
      user_id: user.id,
      match_id: matchId
    });
  }
}

export async function fetchBookmarkedMatchesAction(userId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('match_id')
    .eq('user_id', userId)
    .not('match_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !bookmarks || bookmarks.length === 0) return [];
  return bookmarks.map(b => b.match_id).filter(Boolean) as string[];
}
