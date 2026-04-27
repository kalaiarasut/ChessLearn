import { ReactNode } from "react";
import { DashboardHeader } from "./_components/DashboardHeader";
import { DashboardNav } from "./_components/DashboardNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] overflow-x-hidden">
      <DashboardHeader />
      
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8 md:py-12 mb-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <DashboardNav />
          </aside>
          
          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
