"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BoutiqueLanding } from "@/lib/landing";
import { COULEUR_SECTEUR, libelleSecteur } from "@/lib/secteurs";

interface Props {
  boutiques: BoutiqueLanding[];
}

const TOUS = "__tous__";

export default function BoutiquesPartenaires({ boutiques }: Props) {
  const [secteur, setSecteur] = useState(TOUS);

  // Les pastilles ne listent que les secteurs réellement représentés : un
  // filtre qui ne renvoie jamais rien n'a pas à exister.
  const secteurs = useMemo(() => {
    const compte = new Map<string, number>();
    for (const b of boutiques) {
      const cle = b.category ?? "autre";
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
    return Array.from(compte.entries()).sort((a, b) => b[1] - a[1]);
  }, [boutiques]);

  const visibles = useMemo(
    () => (secteur === TOUS ? boutiques : boutiques.filter((b) => (b.category ?? "autre") === secteur)),
    [boutiques, secteur],
  );

  return (
    <section id="boutiques" className="scroll-mt-16 py-14 bg-sky-100">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 text-center">Nos Boutiques Partenaires</h2>
        <p className="text-gray-500 text-center mt-2">
          {boutiques.length} boutique{boutiques.length > 1 ? "s" : ""} à découvrir
        </p>

        {boutiques.length === 0 ? (
          <p className="text-center text-gray-400 py-12">
            Les premières boutiques arrivent très bientôt.
          </p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mt-8 justify-start sm:justify-center">
              <button
                type="button"
                onClick={() => setSecteur(TOUS)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  secteur === TOUS
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
                }`}
              >
                Tous ({boutiques.length})
              </button>
              {secteurs.map(([cle, n]) => (
                <button
                  key={cle}
                  type="button"
                  onClick={() => setSecteur(cle)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    secteur === cle
                      ? "bg-orange-500 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
                  }`}
                >
                  {libelleSecteur(cle)} ({n})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {visibles.map((b) => (
                <div
                  key={b.id}
                  className="card p-4 flex flex-col gap-3 transition-shadow hover:shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    {/* contain sur fond neutre : le logo n'est jamais rogné */}
                    <div
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-100 shrink-0"
                      style={{ background: "#f5f5f5" }}
                    >
                      {b.logo_url ? (
                        <Image
                          src={b.logo_url}
                          alt={b.name}
                          fill
                          sizes="64px"
                          className="object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                          {b.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {b.is_featured && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto shrink-0">
                        ⭐ Vedette
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 line-clamp-2">{b.name}</p>
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                        COULEUR_SECTEUR[b.category ?? "autre"] ?? COULEUR_SECTEUR.autre
                      }`}
                    >
                      {libelleSecteur(b.category)}
                    </span>
                    {(b.ville || b.quartier) && (
                      <p className="text-xs text-gray-500 mt-2 truncate">
                        📍 {[b.ville, b.quartier].filter(Boolean).join(" — ")}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/boutique/${b.slug}`}
                    className="btn-secondary text-sm text-center w-full"
                  >
                    Voir la boutique
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
