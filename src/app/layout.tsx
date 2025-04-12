import type { Metadata } from "next";
import { Geist } from "next/font/google"; // Removed Geist_Mono if not explicitly used everywhere
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Removed Geist_Mono import if only geistSans is needed globally
// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

// Updated Metadata example
export const metadata: Metadata = {
  title: "Jo App - Daily Journal & Habits", // Example of a better title
  description: "Your personal journaling and habit tracking companion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/*
        MODIFIED: Added Tailwind classes to the body tag:
        - bg-gray-100: Sets a light gray background for the entire app viewport.
        - text-gray-900: Sets the default text color to dark gray for better readability.
        - Removed geistMono variable if not used globally.
      */}
      <body
        className={`${geistSans.variable} antialiased bg-gray-100 text-gray-900`}
      >
        {children}
      </body>
    </html>
  );
}
