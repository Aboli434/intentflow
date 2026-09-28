import type { Metadata } from 'next';
import '../styles/globals.css';
import { ToastProvider } from '@/components/ui/ToastContext';

export const metadata: Metadata = {
  title: 'IntentFlow — Workspace & Collaboration Platform',
  description: 'Web collaboration platform for clients and developers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0B0F19] text-[#F8FAFC] font-sans antialiased selection:bg-indigo-600 selection:text-white overflow-x-hidden">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
