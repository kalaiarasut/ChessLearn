"use client";

import { useState, useEffect } from "react";
import { getLinkPreviewAction } from "@/app/actions/discussion";
import { Link2 } from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const data = await getLinkPreviewAction(url);
        if (isMounted) {
          setPreview(data);
        }
      } catch (err) {
        // Silent fail for link previews
        console.error("Failed to load link preview for", url, err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-24 mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] animate-pulse flex items-center justify-center">
        <Link2 className="text-[var(--text-muted)] w-6 h-6" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a 
      href={preview.url || url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="mt-3 flex flex-col sm:flex-row w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors text-left group"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <div className="sm:w-32 h-32 sm:h-auto shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--border)] overflow-hidden">
          <img 
            src={preview.image} 
            alt={preview.title || "Link preview"} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="p-3 flex flex-col justify-center min-w-0 flex-1">
        {preview.siteName && (
          <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1 truncate">
            {preview.siteName}
          </span>
        )}
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1 line-clamp-1 group-hover:text-[var(--brand)] transition-colors">
          {preview.title || url}
        </h3>
        {preview.description && (
          <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
            {preview.description}
          </p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <Link2 size={12} />
          <span className="truncate">{new URL(preview.url || url).hostname}</span>
        </div>
      </div>
    </a>
  );
}
