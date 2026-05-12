import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body-var",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-var",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ballpark Portal",
  description: "Coach + admin portal for Ballpark.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${oswald.variable}`}
    >
      <body
        className="min-h-screen bg-darkest text-[#1a1a1a] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
