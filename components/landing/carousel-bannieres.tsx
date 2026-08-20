"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BanniereLanding } from "@/lib/landing";

const DELAI_MS = 4000;

interface Props {
  bannieres: BanniereLanding[];
}

/** Destination d'une bannière : lien libre, sinon la boutique liée, sinon rien. */
function destination(b: BanniereLanding): string | null {
  if (b.lien_url) return b.lien_url;
  if (b.boutique_slug) return `/boutique/${b.boutique_slug}`;
  return null;
}

/**
 * Carrousel publicitaire de la page d'accueil.
 *
 * Écrit en React pur (pas de librairie) : une piste en `translateX` et un
 * minuteur. Le défilement s'arrête au survol et à la première interaction
 * clavier ou souris — un carrousel qui repart pendant qu'on lit une offre
 * est une frustration classique.
 */
export default function CarouselBannieres({ bannieres }: Props) {
  const slides: BanniereLanding[] = bannieres.length
    ? bannieres
    : [
        {
          id: "defaut",
          titre: "Votre Centre Commercial Numérique",
          sous_titre: "Toutes les boutiques de Dakar, à commander sur WhatsApp",
          image_url: "",
          lien_url: "#boutiques",
          boutique_slug: null,
        },
      ];

  const [index, setIndex] = useState(0);
  const [enPause, setEnPause] = useState(false);

  const total = slides.length;
  const suivant = useCallback(() => setIndex((i) => (i + 1) % total), [total]);
  const precedent = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);

  useEffect(() => {
    if (total < 2 || enPause) return;
    // Un utilisateur qui a demandé « moins d'animations » ne veut pas d'un
    // diaporama qui bouge tout seul.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const t = setInterval(suivant, DELAI_MS);
    return () => clearInterval(t);
  }, [total, enPause, suivant]);

  return (
    <section
      className="relative w-full overflow-hidden bg-gray-100 h-[200px] sm:h-[300px]"
      onMouseEnter={() => setEnPause(true)}
      onMouseLeave={() => setEnPause(false)}
      onFocusCapture={() => setEnPause(true)}
      aria-roledescription="carrousel"
      aria-label="Bannières publicitaires"
    >
      {/* Une seule piste large de `total * 100 %`, décalée d'un cran. */}
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ width: `${total * 100}%`, transform: `translateX(-${index * (100 / total)}%)` }}
      >
        {slides.map((b, i) => {
          const lien = destination(b);
          const contenu = (
            <>
              {b.image_url ? (
                <Image
                  src={b.image_url}
                  alt={b.titre ?? "Bannière"}
                  fill
                  sizes="100vw"
                  priority={i === 0}
                  className="object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300" />
              )}

              {(b.titre || b.sous_titre) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black/35">
                  {b.titre && (
                    <p className="text-white font-bold text-2xl sm:text-4xl drop-shadow">{b.titre}</p>
                  )}
                  {b.sous_titre && (
                    <p className="text-white/90 text-sm sm:text-lg mt-2 max-w-2xl">{b.sous_titre}</p>
                  )}
                </div>
              )}
            </>
          );

          return (
            <div key={b.id} className="relative h-full shrink-0" style={{ width: `${100 / total}%` }}>
              {lien ? (
                <Link href={lien} className="block relative w-full h-full" aria-label={b.titre ?? "Voir"}>
                  {contenu}
                </Link>
              ) : (
                contenu
              )}
            </div>
          );
        })}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={precedent}
            aria-label="Bannière précédente"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-800 font-bold shadow flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={suivant}
            aria-label="Bannière suivante"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-800 font-bold shadow flex items-center justify-center transition-colors"
          >
            ›
          </button>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {slides.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Aller à la bannière ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/90"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
