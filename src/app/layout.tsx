// src/app/layout.tsx
import type { Metadata } from "next";
// --- FIX: Import font directly from the 'geist' package ---
import { GeistSans } from 'geist/font/sans';
// If you also need the monospace font, uncomment the line below:
// import { GeistMono } from 'geist/font/mono';
import "./globals.css";

// Import the Header component
import Header from "@/components/layout/Header"; // Adjust path if needed

// --- FIX: Remove incorrect initialization via next/font/google ---
// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// Metadata remains the same
export const metadata: Metadata = {
  title: "Jo App - Daily Journal & Habits",
  description: "Your personal journaling and habit tracking companion.",
};

// RootLayout component
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // No server-side session check performed here anymore.
  // Auth state is likely handled within the Header or individual pages.

  return (
    // Apply the font variable directly from the imported font object
    // Add other font variables if needed (e.g., ${GeistMono.variable})
    <html lang="en" className={`${GeistSans.variable}`}>
      <body
        // --- FIX: Apply font variable via className on <html> or <body> ---
        // Using it on <html> is often preferred, removed duplicate from here.
        className={`antialiased bg-gray-100 text-gray-900 flex flex-col min-h-screen`}
      >
        {/* Render Header unconditionally */}
        <Header />

        {/* Main content area where child pages will be rendered */}
        {/* Added container and padding for better layout */}
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>

        {/* Optional: Add a footer here */}
        {/* <footer className="bg-white p-4 text-center text-sm text-gray-600 mt-auto border-t">
          Jo App &copy; {new Date().getFullYear()}
        </footer> */}
      </body>
    </html>
  );
}