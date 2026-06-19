"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function DiscussionSearchBar() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      router.push(`/discussion?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-[var(--text-muted)] group-focus-within:text-[var(--cta-bg)] transition-colors" />
      </div>
      <input
        type="text"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-[var(--surface-alt)] border border-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-full py-2.5 pl-12 pr-4 focus:outline-none focus:border-[var(--cta-bg)] focus:bg-[var(--surface)] transition-all"
      />
    </div>
  );
}
