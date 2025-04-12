import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// No longer need server-side Supabase imports here
// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';

// Import the Header component
import Header from "@/components/layout/Header"; // Adjust path if needed

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jo App - Daily Journal & Habits",
  description: "Your personal journaling and habit tracking companion.",
};

// No longer async
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // No server-side session check here anymore

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} antialiased bg-gray-100 text-gray-900 flex flex-col min-h-screen`}
      >
        {/* Render Header unconditionally */}
        {/* The Header component itself will handle showing/hiding content based on auth state */}
        <Header />

        {/* Main content area */}
        <main className="flex-grow">
          {children}
        </main>

        {/* Optional: Add a footer here */}
        {/* <footer className="bg-gray-200 p-4 text-center text-sm text-gray-600 mt-auto">
          Jo App Footer
        </footer> */}
      </body>
    </html>
  );
}

