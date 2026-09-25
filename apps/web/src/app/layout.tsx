import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'IntentFlow — Phase 1 Engineering Foundation',
  description: 'Technical foundation check for IntentFlow web application.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
