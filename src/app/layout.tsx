import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { ThemeProvider } from "@/lib/theme-context";
import { DisplayPreferencesProvider } from "@/lib/display-preferences-context";
import { Toaster } from 'sonner';
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import GlobalInviteListener from "@/components/ui/GlobalInviteListener";
import { FloatingMessages } from "@/components/discussion/FloatingMessages";

export const metadata: Metadata = {
  title: "ChessLearn",
  description: "A premium chess platform for players of all levels",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('ChessLearn-theme');
                if (t === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <DisplayPreferencesProvider>
            <GlobalInviteListener />
            {children}
            <FloatingMessages />
            <Toaster theme="system" position="bottom-right" />
          </DisplayPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
