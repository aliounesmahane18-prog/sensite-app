"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Image d'un produit, avec repli propre.
 *
 * Trois raisons distinctes font qu'une photo ne s'affiche pas, et chacune
 * demande une réponse différente :
 *
 *  1. Le produit n'a pas d'image (`image_url` vide) → icône neutre.
 *  2. L'optimiseur d'images (`/_next/image`, servi par Vercel) échoue alors
 *     que le fichier est bien présent chez Supabase — quota de transformations
 *     dépassé, ou format refusé. On refait alors une tentative en direct sur
 *     l'URL Supabase, sans passer par l'optimiseur.
 *  3. Le fichier est réellement absent du bucket → icône neutre.
 *
 * Dans tous les cas le texte alternatif cassé du navigateur n'est jamais
 * visible : on affiche une carte neutre à la place.
 */

type EtatImage = "optimisee" | "directe" | "echec";

type ImageProduitProps = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Taille de l'icône de repli, en classes Tailwind. */
  tailleIcone?: string;
} & (
  | { fill: true; sizes: string; width?: never; height?: never }
  | { fill?: false; width: number; height: number; sizes?: string }
);

export default function ImageProduit(props: ImageProduitProps) {
  const { src, alt, className, tailleIcone = "text-4xl" } = props;
  const [etat, setEtat] = useState<EtatImage>("optimisee");

  // Un changement de produit doit repartir d'une tentative optimisée : sans
  // cela, une carte recyclée par React garderait l'état d'échec du précédent.
  useEffect(() => setEtat("optimisee"), [src]);

  const url = src?.trim();

  if (!url || etat === "echec") {
    return (
      <div
        className={`flex h-full w-full items-center justify-center text-gray-300 ${tailleIcone}`}
        role="img"
        aria-label={alt}
      >
        📦
      </div>
    );
  }

  // `onError` ne dit pas *pourquoi* le chargement a échoué. On tente donc
  // systématiquement le direct avant de renoncer : c'est le seul moyen de
  // distinguer une panne de l'optimiseur d'un fichier réellement manquant.
  const onError = () =>
    setEtat((precedent) => (precedent === "optimisee" ? "directe" : "echec"));

  const communs = {
    src: url,
    alt,
    className,
    onError,
    unoptimized: etat === "directe",
  };

  return props.fill ? (
    <Image {...communs} fill sizes={props.sizes} />
  ) : (
    <Image {...communs} width={props.width} height={props.height} />
  );
}
