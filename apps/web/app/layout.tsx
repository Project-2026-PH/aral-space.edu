import type { Metadata, Viewport } from 'next';
import './globals.css';
import Image from 'next/image';
import Link from 'next/link';
import PwaRegister from '@/components/PwaRegister';
import AnonymousSessionBadge from '@/components/AnonymousSessionBadge';
import ThemeToggle from '@/components/ThemeToggle';

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
    title: 'Aral Space',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
        <PwaRegister />
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Image
                src="/ARAL_SPACE_LOGO.png"
                alt="Aral Space"
                width={44}
                height={44}
                priority
                className="h-11 w-11 rounded-2xl object-cover shadow-md shadow-primary/20 group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="text-sm font-extrabold tracking-tight text-foreground">Aral Space</span>
                <span className="block text-[10px] font-semibold text-muted-foreground -mt-0.5">Your Space to Study</span>
              </div>
            </Link>

            <div className="flex items-center gap-2.5">
              <ThemeToggle />
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
