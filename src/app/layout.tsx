import type { Metadata, Viewport } from 'next';
import { Epilogue, Geist_Mono, Montserrat } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import InstallPrompt from '@/components/InstallPrompt';
import LayoutShell from '@/components/LayoutShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const epilogue = Epilogue({
  variable: '--font-epilogue',
  subsets: ['latin'],
});

const calSans = localFont({
  src: '../../node_modules/cal-sans/fonts/webfonts/CalSans-SemiBold.woff2',
  variable: '--font-cal-sans',
  weight: '600',
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['600', '700'],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swapify.312.dev';
const description =
  'A shared playlist that clears as you listen — friends drop songs in, you react, and the queue empties itself.';

export const metadata: Metadata = {
  title: {
    default: 'Swapify',
    template: '%s | Swapify',
  },
  description,
  manifest: '/manifest.json',
  metadataBase: new URL(appUrl),
  openGraph: {
    type: 'website',
    siteName: 'Swapify',
    title: 'Swapify — Swap songs with friends',
    description,
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Swapify — Swap songs with friends',
    description,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Swapify',
  },
  other: {
    'msapplication-TileColor': '#081420',
  },
};

export const viewport: Viewport = {
  themeColor: '#38BDF8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${epilogue.variable} ${calSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased bg-background text-foreground min-h-screen grain-overlay`}
      >
        <ServiceWorkerRegister />
        <InstallPrompt />
        <TooltipProvider>
          <LayoutShell>{children}</LayoutShell>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
