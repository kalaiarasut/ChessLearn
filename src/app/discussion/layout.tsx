import { Metadata } from "next";
import Navbar from "@/components/ui/Navbar";
import { RightSidebar } from "@/components/discussion/RightSidebar";

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
      <div className="min-h-screen bg-[var(--bg)] pt-24 pb-12">
        <div className="max-w-[1050px] mx-auto w-full px-4 sm:px-6 flex gap-8 justify-center">
          <div className="w-[600px] flex-shrink-0">
            {children}
          </div>
          <div className="hidden lg:block w-[350px] flex-shrink-0">
            <RightSidebar />
          </div>
        </div>
      </div>
    </>
  );
}
