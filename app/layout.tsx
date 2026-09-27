import type { Metadata } from "next";
import { Suspense } from "react";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack";
import "./globals.css";

export const metadata: Metadata = {
  title: "Whiskey Stack: track & discover your whisky",
  description:
    "Track the whiskies on your shelf and let AI find your next bottle, buyable in the Netherlands at the best price.",
  icons: {
    icon: "/whiskey-favicon.png",
    apple: "/whiskey-favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Suspense fallback={<div className="app-loading">Loading…</div>}>
          <StackProvider app={stackServerApp}>
            <StackTheme>{children}</StackTheme>
          </StackProvider>
        </Suspense>
      </body>
    </html>
  );
}
