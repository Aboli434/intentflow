import type { Metadata } from 'next';
import '../styles/globals.css';

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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
