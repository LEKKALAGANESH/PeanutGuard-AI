import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'PeanutGuard AI',
  description:
    'Peanut crop disease detection & harvest optimization — 100% on-device, works offline',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PeanutGuard AI',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className="min-h-dvh antialiased"
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <AppShell>
          <main className="mx-auto w-full max-w-lg px-4 pb-24 pt-4 sm:max-w-xl sm:px-6 md:max-w-2xl md:px-8 lg:max-w-full lg:px-0 lg:pb-0 lg:pt-0">{children}</main>
        </AppShell>
      </body>
    </html>
  );
}
