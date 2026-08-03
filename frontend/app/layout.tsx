import type { Metadata } from "next";
import { VT323, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SnapsBypassInitializer } from "@/components/SnapsBypassInitializer";
import { ContractInfoFooter } from "@/components/ContractInfoFooter";

const retroFont = VT323({
  variable: "--font-inter",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DoodleGuard",
  description: "NDA enforcement at the speed of consensus. AI Jury detects leaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${retroFont.variable} ${geistMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <div className="flex flex-col min-h-screen">
              <SnapsBypassInitializer />
              <main className="flex-1 flex flex-col">
                {children}
              </main>
              <ContractInfoFooter />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
