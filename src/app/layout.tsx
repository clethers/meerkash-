import type { Metadata, Viewport } from 'next';
import { Inter, Archivo } from 'next/font/google';
import './globals.css';
import { SetupNotice } from '@/components/SetupNotice';
import { supabaseConfigured } from '@/lib/env';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['700', '800', '900'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Meerkash — split group expenses fairly',
  description:
    'Someone pays, everyone gets their fair share worked out automatically, and the app tells you exactly who owes whom.',
};

export const viewport: Viewport = {
  themeColor: '#15825a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        {/* Applied before hydration so a stored 'dark' preference doesn't
            flash light on load once dark: styles exist. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body>{supabaseConfigured ? children : <SetupNotice />}</body>
    </html>
  );
}
