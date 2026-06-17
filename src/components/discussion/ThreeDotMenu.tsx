"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, UserX, UserPlus, ListPlus, VolumeX, Ban, BarChart2, Code, Flag, MessageSquareOff, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ThreeDotMenuProps {
  onDelete?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
}

export function ThreeDotMenu({ onDelete, onEdit, onReport }: ThreeDotMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const menuItems = [
    { icon: UserX, label: "Unfollow" },
    { icon: UserPlus, label: "Subscribe to" },
    { icon: ListPlus, label: "Add/remove from Lists" },
    { icon: VolumeX, label: "Mute" },
    { icon: MessageSquareOff, label: "Mute this conversation" },
    { icon: Ban, label: "Block" },
    { icon: BarChart2, label: "View post activity" },
    { icon: Code, label: "Embed post" },
    { icon: Flag, label: "Report post" },
  ];

  if (onEdit) {
    menuItems.unshift({ icon: Pencil, label: "Edit Post" });
  }

  if (onDelete) {
    menuItems.push({ icon: Ban, label: "Delete Post" });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--brand-muted)] rounded-full transition-colors opacity-0 group-hover/post:opacity-100"
      >
        <MoreHorizontal size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, transformOrigin: "top right" }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-64 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 flex flex-col"
          >
            {menuItems.map((item, idx) => (
              <button
                key={idx}
                className={`w-full px-4 py-3 flex items-center gap-3 text-sm font-medium transition-colors text-left ${
                  item.label === "Delete Post" 
                    ? "text-red-500 hover:bg-red-500/10" 
                    : "text-[var(--text-primary)] hover:bg-[var(--surface-alt)]"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  if (item.label === "Delete Post" && onDelete) {
                    onDelete();
                  } else if (item.label === "Edit Post" && onEdit) {
                    onEdit();
                  } else if (item.label === "Report post" && onReport) {
                    onReport();
                  }
                }}
              >
                <item.icon size={18} className={item.label === "Delete Post" ? "text-red-500" : "text-[var(--text-secondary)]"} />
                <span>{item.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
