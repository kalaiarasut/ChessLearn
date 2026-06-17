import Link from "next/link";
import { Search, UserPlus, MoreHorizontal } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/discussion-service";

export async function RightSidebar() {
  const supabase = await getSupabaseServerClient();

  // 1. Fetch Trending Topics
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
        const uniqueTags = Array.from(new Set(tags));
        uniqueTags.forEach((tag) => {
          const lowerTag = tag.toLowerCase();
          hashtagCounts[lowerTag] = (hashtagCounts[lowerTag] || 0) + 1;
        });
      }
    });
  }
  const trendingTags = Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 2. Fetch Relevant People
  const { data: people } = await supabase
    .from("profiles")
    .select("id, username, rating")
    .order("rating", { ascending: false })
    .limit(3);

  return (
    <div className="flex flex-col gap-4 sticky top-24">
      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[var(--text-muted)] group-focus-within:text-[var(--cta-bg)] transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-[var(--surface-alt)] border border-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:border-[var(--cta-bg)] focus:bg-[var(--surface)] transition-all"
        />
      </div>

      {/* Relevant People */}
      <div className="bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <h2 className="font-bold text-[var(--text-primary)] text-xl px-4 py-3">Relevant people</h2>
        {people && people.map((person) => (
          <div key={person.id} className="px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center font-bold text-[var(--text-primary)] shrink-0">
                {person.username[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[var(--text-primary)] leading-tight hover:underline">
                  {person.username}
                </span>
                <span className="text-[var(--text-secondary)] text-[15px]">
                  @{person.username.toLowerCase()}
                </span>
              </div>
            </div>
            <button className="bg-white text-black font-bold py-1.5 px-4 rounded-full text-sm hover:bg-gray-200 transition-colors">
              Follow
            </button>
          </div>
        ))}
        <div className="px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--cta-bg)] text-[15px]">
          Show more
        </div>
      </div>

      {/* What's Happening */}
      <div className="bg-[var(--surface-alt)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <h2 className="font-bold text-[var(--text-primary)] text-xl px-4 py-3">What's happening</h2>
        
        {trendingTags.length === 0 ? (
          <div className="px-4 py-3 text-[var(--text-muted)] text-sm">
            No trending topics right now.
          </div>
        ) : (
          <div className="flex flex-col">
            {trendingTags.map(([tag, count], index) => (
              <Link
                key={tag}
                href={`/discussion?q=${encodeURIComponent(tag)}`}
                className="px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors flex flex-col gap-0.5 relative group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)] text-[13px]">Trending in Discussion</span>
                  <button className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--cta-bg)] hover:bg-[var(--cta-bg)]/10 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <span className="font-bold text-[var(--text-primary)] mt-0.5">{tag}</span>
                <span className="text-[var(--text-muted)] text-[13px] mt-1">{count} posts</span>
              </Link>
            ))}
          </div>
        )}
        <div className="px-4 py-4 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-[var(--cta-bg)] text-[15px]">
          Show more
        </div>
      </div>
      
      {/* Footer Links */}
      <div className="px-4 text-[13px] text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1 mt-1">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <span>© 2026 ChessLearn</span>
      </div>
    </div>
  );
}
