import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PublicEnvScript } from "@/components/public-env-script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/**
 * Rendu à chaque requête plutôt qu'au build : c'est ce qui permet à
 * `PublicEnvScript` de lire les variables d'environnement à l'exécution.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SENsite-APP — Boutiques en ligne Dakar",
  description: "Catalogue produits + commandes WhatsApp. Ali.IA Solutions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F97316",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <PublicEnvScript />
        {children}
      </body>
    </html>
  );
}
