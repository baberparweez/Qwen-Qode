import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qwen Qode",
  description: "Local coding agent powered by Qwen2.5-coder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
