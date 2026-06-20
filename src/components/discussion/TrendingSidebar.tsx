import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/discussion-service";

export async function TrendingSidebar() {
  const supabase = await getSupabaseServerClient();

  // Fetch recent posts to determine trending hashtags
  const { data: posts } = await supabase
    .from("discussion_posts")
    .select("content")
    .order("created_at", { ascending: false })
    .limit(100);

  const hashtagCounts: Record<string, number> = {};

  if (posts) {
    posts.forEach((post) => {
      const tags = post.content.match(/#\w+/g);
      if (tags) {
        // Unique tags per post to prevent spamming
        const uniqueTags = Array.from(new Set(tags));
        uniqueTags.forEach((tag: any) => {
          const lowerTag = tag.toLowerCase();
          hashtagCounts[lowerTag] = (hashtagCounts[lowerTag] || 0) + 1;
        });
      }
    });
  }

  const trendingTags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="sticky top-28 bg-[var(--surface-alt)] rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)]">
        <h2 className="font-bold text-[var(--text-primary)] text-lg">Trending Topics</h2>
      </div>
      
      {trendingTags.length === 0 ? (
        <div className="p-4 text-[var(--text-muted)] text-sm">
          No trending topics right now.
        </div>
      ) : (
        <div className="flex flex-col">
          {trendingTags.map(([tag, count], index) => (
            <Link
              key={tag}
              href={`/discussion?q=${encodeURIComponent(tag)}`}
              className="px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] last:border-none flex flex-col gap-1"
            >
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--text-muted)] text-xs">{index + 1} • Trending</span>
              </div>
              <span className="font-bold text-[var(--text-primary)]">{tag}</span>
              <span className="text-[var(--text-muted)] text-xs">{count} {count === 1 ? 'post' : 'posts'}</span>
            </Link>
          ))}
        </div>
      )}
      
      <div className="p-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        <p>Trending algorithms are currently based on recent activity.</p>
      </div>
    </div>
  );
}
