import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from '@/components/PwaRegister';
import UpdateNotification from '@/components/UpdateNotification';

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: ' Aral Space',
  description: 'Local-First reviewer generator.',
  manifest: '/manifest.json',
  icons: {
    icon: '/ARAL_SPACE_LOGO.png',
    shortcut: '/ARAL_SPACE_LOGO.png',
    apple: '/ARAL_SPACE_LOGO.png',
  },
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
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
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
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 overflow-x-clip">
        <PwaRegister />
        <UpdateNotification />
        {children}
      </body>
    </html>
  );
}
