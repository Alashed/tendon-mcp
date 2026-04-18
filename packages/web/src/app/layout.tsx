import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tendon.alashed.kz'),
  title: {
    default: 'Tendon — Task tracking for Claude Code',
    template: '%s · Tendon',
  },
  description:
    'Connect your task board to Claude Code in one command. No config files, no tokens, no friction.',
  applicationName: 'Tendon',
  openGraph: {
    title: 'Tendon',
    description: "Your tasks, in Claude's hands.",
    siteName: 'Tendon',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Tendon',
    description: "Your tasks, in Claude's hands.",
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/logo.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: '/apple-icon.svg',
    shortcut: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#08080B',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
