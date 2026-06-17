"use client";

import { Share, Link as LinkIcon, Flag, Code } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { FaTwitter, FaFacebook, FaWhatsapp, FaLinkedin, FaReddit } from "react-icons/fa";
import { toast } from "sonner";

export function ShareMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
    setIsOpen(false);
  };

  const shareOptions = [
    { icon: FaTwitter, label: "Twitter", color: "hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10" },
    { icon: FaFacebook, label: "Facebook", color: "hover:text-[#1877F2] hover:bg-[#1877F2]/10" },
    { icon: FaWhatsapp, label: "WhatsApp", color: "hover:text-[#25D366] hover:bg-[#25D366]/10" },
    { icon: FaLinkedin, label: "LinkedIn", color: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/10" },
    { icon: FaReddit, label: "Reddit", color: "hover:text-[#FF4500] hover:bg-[#FF4500]/10" },
  ];

  return (
    <div className="relative" ref={containerRef} onMouseLeave={() => setIsOpen(false)}>
      <button
        onMouseEnter={() => setIsOpen(true)}
        className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand)] transition-colors"
      >
        <div className="p-2 rounded-full group-hover:bg-[var(--brand-muted)] transition-colors">
          <Share size={18} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 flex gap-1"
          >
            {shareOptions.map((opt) => (
              <button
                key={opt.label}
                title={opt.label}
                className={`p-2.5 rounded-full text-[var(--text-primary)] transition-all ${opt.color}`}
              >
                <opt.icon size={20} />
              </button>
            ))}
            <div className="w-px bg-[var(--border)] mx-1 my-2" />
            <button
              title="Copy Link"
              onClick={copyLink}
              className="p-2.5 rounded-full text-[var(--text-primary)] hover:text-[var(--brand)] hover:bg-[var(--brand-muted)] transition-all"
            >
              <LinkIcon size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
