"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakAnimationProps {
  days: boolean[]; // e.g. [true, true, true, false, false, false, false]
  currentDayIndex: number;
}

export default function StreakAnimation({ days, currentDayIndex }: StreakAnimationProps) {
  const [showCurrentDayFire, setShowCurrentDayFire] = useState(false);
  const [showFullAnimation, setShowFullAnimation] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Sequence of animations
    // 1. Show the grid for a moment
    const t1 = setTimeout(() => {
      setShowCurrentDayFire(true); // Pop up fire on current day
    }, 800);

    // 2. Full fire animation
    const t2 = setTimeout(() => {
      setShowFullAnimation(true);
    }, 1800);

    // 3. Disappear
    const t3 = setTimeout(() => {
      setIsVisible(false);
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.8 }}
        className="relative z-50 flex items-center justify-center pointer-events-none"
      >
        <motion.div
          className="relative bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6"
          layoutId="streak-box"
        >
          {showFullAnimation && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center text-orange-500"
            >
              <Flame size={200} className="fill-red-500 drop-shadow-[0_0_60px_rgba(239,68,68,0.9)] text-red-500" />
            </motion.div>
          )}

          <h2 className="text-3xl font-bold text-white z-10 flex items-center gap-2">
            <Flame className="text-red-500 fill-red-500 animate-pulse" />
            Streak Updated!
          </h2>

          <div className="flex gap-3 z-10">
            {days.map((isComplete, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className="text-xs text-zinc-400 font-medium">DAY {idx + 1}</div>
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                    isComplete && idx !== currentDayIndex
                      ? "border-red-500 bg-red-500/20"
                      : idx === currentDayIndex
                      ? "border-red-500 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  {isComplete && idx !== currentDayIndex && (
                    <Flame className="text-red-500 fill-red-500 w-6 h-6" />
                  )}
                  {idx === currentDayIndex && (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <AnimatePresence>
                        {showCurrentDayFire && (
                          <motion.div
                            initial={{ scale: 0, y: 10, opacity: 0 }}
                            animate={{ scale: 1.2, y: -5, opacity: 1 }}
                            transition={{ type: "spring", bounce: 0.5 }}
                          >
                            <Flame className="text-red-500 fill-red-500 w-8 h-8 drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: showCurrentDayFire ? 1 : 0 }}
            className="text-red-400 font-medium z-10 text-lg"
          >
            {days.filter(d => d).length + 1} Day Streak!
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
