import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { ToastProvider } from '@/components/ui/ToastContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'IntentFlow — B2B Client Collaboration Platform',
  description:
    'IntentFlow turns messy client conversations into structured, AI-verified work. A real-time workspace for clients and developer teams.',
  keywords: 'client collaboration, B2B SaaS, project management, AI intent analysis, deliverable review',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'IntentFlow — B2B Client Collaboration Platform',
    description: 'Turn messy client communication into structured, verified work.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] font-inter antialiased selection:bg-indigo-600 selection:text-white overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
