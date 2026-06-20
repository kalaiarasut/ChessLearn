import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./supabase/env";
import { cookies } from "next/headers";
import { Post, User, PostReaction } from "./mock-data"; // Reuse types but we'll adapt to DB

// Reusable server client instance helper
export async function getSupabaseServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // This is safe since getPosts is usually a read-only request
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

// Fetch posts (optionally filtered by parent id for replies, or search query)
export async function getPosts(replyToId: string | null = null, limit = 20, cursor?: string, feedType: 'all' | 'following' = 'all', searchQuery?: string): Promise<Post[]> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id;

  let query = supabase
    .from("discussion_posts")
    .select(`
      id,
      content,
      images,
      created_at,
      reply_to_id,
      quoted_post_id,
      author_id,
      reactions:discussion_reactions (id, user_id, type),
      quoted_post:discussion_posts!quoted_post_id (
        id,
        content,
        images,
        created_at,
        author_id
      ),
      polls (
        id,
        options,
        poll_votes (
          user_id,
          option_index
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (replyToId) {
    query = query.eq("reply_to_id", replyToId);
  } else {
    query = query.is("reply_to_id", null);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (searchQuery) {
    query = query.ilike("content", `%${searchQuery}%`);
  }

  if (feedType === 'following' && currentUserId && !searchQuery) {
    // get followed user ids
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);
    if (follows && follows.length > 0) {
      const followedIds = follows.map((f: any) => f.following_id);
      query = query.in('author_id', [...followedIds, currentUserId]);
    } else {
      // If not following anyone, return empty or just own posts
      query = query.eq('author_id', currentUserId);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching posts:", error);
    return [];
  }

  // If fetching top-level posts, fetch their replies
  // To avoid N+1 queries, we could do a left join, but since Supabase doesn't natively support nested self-joins easily via postgrest, we'll fetch replies in a second query or recursively if it's a small depth.
  // For simplicity, we'll just fetch immediate replies for the returned posts.
  let allReplies: any[] = [];
  if (!replyToId && data && data.length > 0) {
    const parentIds = data.map((p: any) => p.id);
    const { data: repliesData } = await supabase
      .from("discussion_posts")
      .select(`
        id,
        content,
        images,
        created_at,
        reply_to_id,
        quoted_post_id,
        author_id,
        reactions:discussion_reactions (id, user_id, type),
        quoted_post:discussion_posts!quoted_post_id (
          id,
          content,
          images,
          created_at,
          author_id
        )
      `)
      .in("reply_to_id", parentIds)
      .order("created_at", { ascending: true });
    
    if (repliesData) {
      allReplies = repliesData;
    }
  }

  // Fetch all related profiles in a single query
  const allAuthorIds = new Set([
    ...(data?.map((p: any) => p.author_id) || []),
    ...(data?.map((p: any) => p.quoted_post?.author_id) || []),
    ...allReplies.map((p: any) => p.author_id),
    ...allReplies.map((p: any) => p.quoted_post?.author_id)
  ].filter(Boolean));

  let profilesMap: Record<string, any> = {};
  if (allAuthorIds.size > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, verified, is_online")
      .in("id", Array.from(allAuthorIds));
      
    if (profilesData) {
      profilesMap = profilesData.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  const mapPost = (p: any): Post => {
    const likes = p.reactions?.filter((r: any) => r.type === 'like') || [];
    const reposts = p.reactions?.filter((r: any) => r.type === 'repost') || [];
    const hasLiked = currentUserId ? likes.some((r: any) => r.user_id === currentUserId) : false;
    const hasReposted = currentUserId ? reposts.some((r: any) => r.user_id === currentUserId) : false;
    
    const postReplies = allReplies.filter(r => r.reply_to_id === p.id).map(mapPost);

    const profile = profilesMap[p.author_id];

    let quotedPost: Post | undefined = undefined;
    if (p.quoted_post) {
      const qp = p.quoted_post;
      const qProfile = profilesMap[qp.author_id];
      quotedPost = {
        id: qp.id,
        author: {
          id: qProfile?.id || qp.author_id || 'unknown',
          name: qProfile?.username || 'Unknown User',
          handle: qProfile?.username || 'unknown',
          avatar: qProfile?.avatar_url || `https://ui-avatars.com/api/?name=${qProfile?.username || 'U'}`,
          verified: qProfile?.verified || false,
          isOnline: qProfile?.is_online || false,
        },
        content: qp.content,
        images: qp.images && qp.images.length > 0 ? qp.images : undefined,
        createdAt: qp.created_at,
        reactions: { likes: 0, comments: 0, reposts: 0 },
      };
    }

    return {
      id: p.id,
      author: {
        id: profile?.id || p.author_id || 'unknown',
        name: profile?.username || 'Unknown User',
        handle: profile?.username || 'unknown',
        avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'U'}`,
        verified: profile?.verified || false,
        isOnline: profile?.is_online || false,
      },
      content: p.content,
      images: p.images && p.images.length > 0 ? p.images : undefined,
      createdAt: p.created_at,
      reactions: {
        likes: likes.length,
        comments: postReplies.length, // approximation
        reposts: reposts.length,
        hasLiked,
        hasReposted,
      },
      replies: postReplies.length > 0 ? postReplies : undefined,
      replyToId: p.reply_to_id || undefined,
      quotedPost,
      poll: p.polls && p.polls.length > 0 ? {
        id: p.polls[0].id,
        options: p.polls[0].options,
        votes: p.polls[0].poll_votes?.map((v: any) => ({ userId: v.user_id, optionIndex: v.option_index })) || []
      } : undefined
    };
  };

  return data.map(mapPost);
}

export async function searchUsers(query: string): Promise<User[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, verified, is_online")
    .ilike("username", `%${query}%`)
    .limit(5);

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    name: p.username,
    handle: p.username,
    avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${p.username}`,
    verified: p.verified,
    isOnline: p.is_online || false,
  }));
}

export async function getPostsByIds(postIds: string[]): Promise<Post[]> {
  if (postIds.length === 0) return [];

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id || null;

  const { data, error } = await supabase
    .from("discussion_posts")
    .select(`
      *,
      reactions:discussion_reactions(*),
      quoted_post:discussion_posts!quoted_post_id(*),
      polls(*, poll_votes(*))
    `)
    .in("id", postIds)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Fetch author profiles
  const authorIds = new Set<string>();
  data.forEach((p: any) => {
    authorIds.add(p.author_id);
    if (p.quoted_post) authorIds.add(p.quoted_post.author_id);
  });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, verified, is_online")
    .in("id", Array.from(authorIds));

  const profilesMap: Record<string, any> = {};
  if (profiles) {
    profiles.forEach((p: any) => profilesMap[p.id] = p);
  }

  // Fetch replies
  const { data: replies } = await supabase
    .from("discussion_posts")
    .select(`
      *,
      reactions:discussion_reactions(*),
      quoted_post:discussion_posts!quoted_post_id(*),
      polls(*, poll_votes(*))
    `)
    .in("reply_to_id", data.map((p: any) => p.id));
    
  if (replies) {
    replies.forEach((r: any) => {
      authorIds.add(r.author_id);
    });
    // fetch missing profiles
    const { data: moreProfiles } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, verified, is_online")
      .in("id", Array.from(authorIds));
    if (moreProfiles) {
      moreProfiles.forEach((p: any) => profilesMap[p.id] = p);
    }
  }

  const allReplies = replies || [];

  const mapPost = (p: any): Post => {
    const likes = p.reactions?.filter((r: any) => r.type === 'like') || [];
    const reposts = p.reactions?.filter((r: any) => r.type === 'repost') || [];
    const hasLiked = currentUserId ? likes.some((r: any) => r.user_id === currentUserId) : false;
    const hasReposted = currentUserId ? reposts.some((r: any) => r.user_id === currentUserId) : false;
    
    // We also need to map hasBookmarked
    const hasBookmarked = true; // By definition these are bookmarks

    const postReplies = allReplies.filter(r => r.reply_to_id === p.id).map(mapPost);
    const profile = profilesMap[p.author_id];

    let quotedPost: Post | undefined = undefined;
    if (p.quoted_post) {
      const qp = p.quoted_post;
      const qProfile = profilesMap[qp.author_id];
      quotedPost = {
        id: qp.id,
        author: {
          id: qProfile?.id || qp.author_id || 'unknown',
          name: qProfile?.username || 'Unknown User',
          handle: qProfile?.username || 'unknown',
          avatar: qProfile?.avatar_url || `https://ui-avatars.com/api/?name=${qProfile?.username || 'U'}`,
          verified: qProfile?.verified || false,
          isOnline: qProfile?.is_online || false,
        },
        content: qp.content,
        images: qp.images && qp.images.length > 0 ? qp.images : undefined,
        createdAt: qp.created_at,
        reactions: { likes: 0, comments: 0, reposts: 0 },
      };
    }

    return {
      id: p.id,
      author: {
        id: profile?.id || p.author_id || 'unknown',
        name: profile?.username || 'Unknown User',
        handle: profile?.username || 'unknown',
        avatar: profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.username || 'U'}`,
        verified: profile?.verified || false,
        isOnline: profile?.is_online || false,
      },
      content: p.content,
      images: p.images && p.images.length > 0 ? p.images : undefined,
      createdAt: p.created_at,
      reactions: {
        likes: likes.length,
        comments: postReplies.length,
        reposts: reposts.length,
        hasLiked,
        hasReposted,
        hasBookmarked
      },
      replies: postReplies.length > 0 ? postReplies : undefined,
      replyToId: p.reply_to_id || undefined,
      quotedPost,
      poll: p.polls && p.polls.length > 0 ? {
        id: p.polls[0].id,
        options: p.polls[0].options,
        votes: p.polls[0].poll_votes?.map((v: any) => ({ userId: v.user_id, optionIndex: v.option_index })) || []
      } : undefined
    };
  };

  return data.map(mapPost);
}
