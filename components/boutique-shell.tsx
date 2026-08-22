"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import LogoSensite from "@/components/logo-sensite";

export interface OngletShell {
  cle: string;
  label: string;
  actif: boolean;
  onClick: () => void;
}

interface Props {
  boutique: {
    name: string;
    slug: string;
    logo_url: string | null;
    color_primary: string;
  };
  /** Pastille d'état affichée sous le nom (abonnement, statut démo…). */
  badge?: { label: string; className: string };
  onglets: OngletShell[];
  /** Lien de sortie en bas de la barre latérale. */
  retour: { href: string; label: string };
  catalogueUrl: string;
  children: React.ReactNode;
}

/**
 * Châssis à barre latérale des espaces boutique.
 *
 * Reprend la mise en page de `app/dashboard/layout.tsx` — même largeur, mêmes
 * couleurs, même comportement mobile (tiroir + bouton ☰) — pour que le
 * prospecteur retrouve exactement l'écran que voit le gérant.
 *
 * Différence avec le dashboard : la navigation ne change pas d'URL, elle
 * bascule un onglet dans la page. Les entrées sont donc des boutons et non
 * des liens.
 */
export default function BoutiqueShell({
  boutique,
  badge,
  onglets,
  retour,
  catalogueUrl,
  children,
}: Props) {
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex-col
          ${tiroirOuvert ? "flex" : "hidden"} lg:flex`}
      >
        <div className="p-4 border-b border-gray-100">
          <LogoSensite hauteur={32} classeTexte="text-lg" />
        </div>

        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {boutique.logo_url ? (
              // `contain` sur fond neutre : le logo n'est pas rogné.
              <div
                className="relative w-9 h-9 rounded-xl overflow-hidden border border-gray-100 shrink-0"
                style={{ background: "#f5f5f5" }}
              >
                <Image
                  src={boutique.logo_url}
                  alt={boutique.name}
                  fill
                  sizes="36px"
                  className="object-contain"
                />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: boutique.color_primary }}
              >
                {boutique.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{boutique.name}</p>
              {badge && <span className={`badge ${badge.className}`}>{badge.label}</span>}
            </div>
          </div>

          <a
            href={catalogueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-500 hover:underline mt-2 block truncate"
          >
            🔗 Voir le catalogue
          </a>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {onglets.map((o) => (
            <button
              key={o.cle}
              onClick={() => {
                o.onClick();
                setTiroirOuvert(false);
              }}
              className={`block w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                o.actif ? "bg-orange-50 text-orange-500" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <Link
            href={retour.href}
            className="text-sm text-gray-400 hover:text-orange-500 px-3 py-2 w-full text-left transition-colors block"
          >
            {retour.label}
          </Link>
        </div>
      </aside>

      {tiroirOuvert && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setTiroirOuvert(false)}
        />
      )}

      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between lg:hidden">
          <button onClick={() => setTiroirOuvert(true)} className="text-2xl" aria-label="Menu">
            ☰
          </button>
          <span className="font-bold text-sm truncate px-2">{boutique.name}</span>
          <div className="w-8" />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
