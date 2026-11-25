import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://electys.vercel.app"),
  title: "Electys",
  description:
    "Secure election management platform with verified voter onboarding, encrypted one-time ballots, and live real-time results.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#090D0B] text-[#F3F4F6]">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
