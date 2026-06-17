import { motion } from "framer-motion";

export function SkeletonPost() {
  return (
    <div className="flex gap-4 p-4 border-b border-[var(--border)] animate-pulse">
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)]" />
      </div>
      
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-4 w-24 bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-16 bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-8 bg-[var(--surface-alt)] rounded" />
        </div>
        
        <div className="space-y-2 mt-3">
          <div className="h-4 w-[90%] bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-[75%] bg-[var(--surface-alt)] rounded" />
          <div className="h-4 w-[80%] bg-[var(--surface-alt)] rounded" />
        </div>

        <div className="mt-4 h-48 w-full bg-[var(--surface-alt)] rounded-2xl" />

        <div className="flex items-center gap-6 mt-4 max-w-[425px]">
          <div className="h-8 w-12 bg-[var(--surface-alt)] rounded-full" />
          <div className="h-8 w-12 bg-[var(--surface-alt)] rounded-full" />
          <div className="h-8 w-12 bg-[var(--surface-alt)] rounded-full" />
          <div className="h-8 w-8 bg-[var(--surface-alt)] rounded-full ml-auto" />
        </div>
      </div>
    </div>
  );
}
