"use client";

import { useEffect, useState } from "react";
import { getLinkPreviewAction } from "@/app/actions/discussion";

export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getLinkPreviewAction(url).then(res => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [url]);

  if (loading) return null;
  if (!data || (!data.title && !data.image)) return null;

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex flex-col mt-3 border border-[var(--border)] rounded-2xl overflow-hidden hover:bg-[var(--surface-hover)] transition-colors no-underline block max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && (
        <div className="w-full relative aspect-video bg-[var(--surface-alt)]">
          <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            Article
          </div>
        </div>
      )}
      <div className="p-3 flex flex-col gap-0.5 bg-[var(--surface-alt)]">
        <span className="text-[15px] font-bold text-[var(--text-primary)] line-clamp-1">{data.title}</span>
        {data.description && (
          <span className="text-[14px] text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-snug">{data.description}</span>
        )}
        <span className="text-[13px] text-[var(--text-muted)] mt-1.5 truncate flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 bg-[var(--border)] rounded-sm overflow-hidden flex items-center justify-center shrink-0">
            <img src={`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`} alt="" className="w-3 h-3" onError={(e) => e.currentTarget.style.display='none'} />
          </span>
          {data.siteName || new URL(url).hostname}
        </span>
      </div>
    </a>
  );
}
