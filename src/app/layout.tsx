import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EMS — Election Management System",
  description:
    "Secure civic Election Management System with verified voter onboarding, encrypted immutable ballots, and live real-time results.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#090D0B] text-[#F3F4F6]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[#1F2E26] bg-[#090D0B] py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 text-xs text-[#9CA3AF] sm:flex-row sm:px-6 lg:px-8">
            <p className="font-medium text-[#F3F4F6]">
              Election Management System (EMS)
            </p>
            <p>
              Encrypted, secret, single-use digital ballots &bull; Live verified
              tallying
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
