import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'El. Parduotuvių Patikimumo Tikrintuvas | VVTAT & JAR Auditas',
  description: 'Automatizuotas Lietuvos el. parduotuvių patikimumo ir saugumo auditas pagal VVTAT 5 auksines taisykles ir Registrų centro (JAR) duomenis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt" className="h-full">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
