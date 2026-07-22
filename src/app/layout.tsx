import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PlanoProvider } from "@/contexts/PlanoContext";
import { MesAtualProvider } from "@/contexts/MesAtualContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Controle Financeiro",
  description: "Controle financeiro pessoal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var r=window.location.pathname;var ehAuthPublica=r==='/login'||r.indexOf('/cadastro')===0;if(!ehAuthPublica&&localStorage.getItem('tema')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className="h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <PlanoProvider>
              <MesAtualProvider>{children}</MesAtualProvider>
            </PlanoProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
