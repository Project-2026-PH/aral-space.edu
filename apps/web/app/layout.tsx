import type { Metadata, Viewport } from 'next';
import './globals.css';
import Link from 'next/link';
import { Sparkles, BookOpen, Layers } from 'lucide-react';
import PwaRegister from '@/components/PwaRegister';
import AnonymousSessionBadge from '@/components/AnonymousSessionBadge';

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Quiz Creator & Mastery Hub',
  description: 'MSRC-Driven AI Question Authoring & Spaced Repetition Mastery Engine',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuizMaster',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
        <PwaRegister />
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-primary text-white shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-sm font-extrabold tracking-tight text-foreground">QuizMaster</span>
                <span className="block text-[10px] font-semibold text-muted-foreground -mt-0.5">Spaced Mastery Studio</span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <AnonymousSessionBadge />
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
          {children}
        </main>
      </body>
    </html>
  );
}
