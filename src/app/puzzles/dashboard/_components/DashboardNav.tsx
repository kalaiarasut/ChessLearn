"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Zap } from "lucide-react";

export function DashboardNav() {
  const pathname = usePathname();

  const links = [
    { href: "/puzzles/dashboard", label: "Puzzle Dashboard", icon: LayoutDashboard },
    { href: "/puzzles/dashboard/improvement-areas", label: "Improvement Areas", icon: Target },
    { href: "/puzzles/dashboard/strengths", label: "Strengths", icon: Zap },
  ];

  return (
    <nav className="flex flex-col gap-2 w-full lg:w-64 flex-shrink-0">
      {links.map((link) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
              isActive
                ? "bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-hover)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] border border-transparent"
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "text-violet-400" : ""}`} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
