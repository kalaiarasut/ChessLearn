import { toast } from "react-hot-toast";
import { Award, Zap, Crosshair, Target, Castle, Shield, Skull, Crown, Star, Activity, ArrowUp, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const iconMap: Record<string, any> = {
  Crown, ArrowUp, RefreshCcw, Zap, Shield, Crosshair, Target, Castle, Skull, Activity, Star, Award
};

export interface AchievementData {
  title: string;
  desc: string;
  icon: string;
  rarity: "Common" | "Rare" | "Epic" | "Legendary";
}

export const showAchievement = (achievement: AchievementData) => {
  const Icon = iconMap[achievement.icon] || Award;
  const isLegendary = achievement.rarity === "Legendary";
  const isEpic = achievement.rarity === "Epic";
  const isRare = achievement.rarity === "Rare";

  let glowColor = "rgba(255,255,255,0.1)";
  let borderColor = "var(--border)";
  if (isLegendary) {
    glowColor = "rgba(234, 179, 8, 0.2)";
    borderColor = "rgb(234, 179, 8)";
  } else if (isEpic) {
    glowColor = "rgba(168, 85, 247, 0.2)";
    borderColor = "rgb(168, 85, 247)";
  } else if (isRare) {
    glowColor = "rgba(59, 130, 246, 0.2)";
    borderColor = "rgb(59, 130, 246)";
  }

  toast.custom((t) => (
    <AnimatePresence>
      {t.visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className="max-w-md w-full bg-[var(--surface-alt)] shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden"
          style={{
            boxShadow: `0 10px 40px -10px ${glowColor}`,
            border: `1px solid ${borderColor}`,
          }}
        >
          <div className="p-4 flex items-start gap-4 w-full relative overflow-hidden">
            {/* Background shimmer for Legendary/Epic */}
            {(isLegendary || isEpic) && (
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent skew-x-12 animate-[shimmer_2s_infinite]" />
            )}

            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg z-10 ${
              isLegendary ? 'bg-yellow-500/20 text-yellow-500' :
              isEpic ? 'bg-purple-500/20 text-purple-500' :
              isRare ? 'bg-blue-500/20 text-blue-500' :
              'bg-[var(--text-primary)] text-[var(--bg)]'
            }`}>
              <Icon size={24} />
            </div>

            <div className="flex-1 min-w-0 z-10">
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: borderColor }}>
                Achievement Unlocked
              </p>
              <p className="text-[16px] font-bold text-[var(--text-primary)] truncate">
                {achievement.title}
              </p>
              <p className="text-[13px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                {achievement.desc}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  ), { duration: 5000, position: 'bottom-right' });
};
