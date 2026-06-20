import { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import { RightSidebar } from "@/components/discussion/RightSidebar";
import { ClubsSidebar } from "@/components/discussion/ClubsSidebar";

export const metadata: Metadata = {
  title: "Discussion | ChessLearn",
  description: "Join the chess discussion, share strategies, and connect with players.",
};

export default function DiscussionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--bg)] pt-24 pb-12 flex flex-col justify-between">
        <div className="max-w-[1450px] mx-auto w-full px-4 sm:px-6 flex justify-between gap-8">
          <div className="hidden lg:block w-[250px] flex-shrink-0">
            <ClubsSidebar />
          </div>
          <div className="w-full max-w-[650px] flex-shrink-0">
            {children}
          </div>
          <div className="hidden xl:block w-[320px] flex-shrink-0">
            <RightSidebar />
          </div>
        </div>

        {/* Footer Links at the bottom of the page */}
        <footer className="w-full border-t border-[var(--border)] mt-auto pt-6 pb-6">
          <div className="max-w-[1450px] mx-auto px-4 sm:px-6 text-[13px] text-[var(--text-muted)] flex flex-wrap gap-x-6 gap-y-2 justify-center lg:justify-start">
            <a href="#" className="hover:underline">Terms of Service</a>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <a href="#" className="hover:underline">Cookie Policy</a>
            <a href="#" className="hover:underline">Accessibility</a>
            <span>© 2026 ChessLearn</span>
          </div>
        </footer>
      </div>
    </>
  );
}
