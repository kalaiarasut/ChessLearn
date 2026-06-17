"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function ImageLightbox({ images, initialIndex, onClose, onNext, onPrev }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden"; // Prevent scrolling behind modal

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [onClose, onNext, onPrev]);

  if (!images || images.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
        />

        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X size={24} />
        </button>

        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-4 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
            >
              <ChevronRight size={32} />
            </button>
          </>
        )}

        <motion.div
          key={initialIndex}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={images[initialIndex]}
            alt={`Image ${initialIndex + 1}`}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
