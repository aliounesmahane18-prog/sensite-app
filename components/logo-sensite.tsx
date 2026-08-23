import Image from "next/image";
import Link from "next/link";

/**
 * Logo SENsite-APP — source unique, utilisée aux dix emplacements de
 * l'application.
 *
 * Le fichier est détouré depuis `public/logo-sensite-app.jpg` : le cadre
 * décoratif de la capture d'origine a été retiré et le fond clair rendu
 * transparent. L'original est conservé à côté.
 */
const FICHIER_LOGO: string | null = "/logo-sensite-app.png";

/** 569 ÷ 131 px, mesuré sur le fichier détouré. */
const RATIO_LOGO = 4.344;

interface Props {
  /** Hauteur d'affichage en pixels. Sert aussi à calculer la largeur. */
  hauteur: number;
  /** Classe de taille du texte, utilisée tant que le logo image est absent. */
  classeTexte?: string;
  /** Enveloppe le logo dans un lien. `null` pour aucun lien. */
  href?: string | null;
  /** Sur fond sombre, le mot « SENsite » doit passer en blanc. */
  sombre?: boolean;
  className?: string;
}

export default function LogoSensite({
  hauteur,
  classeTexte = "text-lg",
  href = "/",
  sombre = false,
  className = "",
}: Props) {
  const image = FICHIER_LOGO && (
    <Image
      src={FICHIER_LOGO}
      alt="SENsite-APP"
      // Dimensions explicites : sans elles, la page saute au chargement de
      // l'image (layout shift).
      width={Math.round(hauteur * RATIO_LOGO)}
      height={hauteur}
      className="object-contain w-auto"
      style={{ height: hauteur }}
      priority
    />
  );

  const contenu = FICHIER_LOGO ? (
    sombre ? (
      /**
       * Sur les barres foncées, le logo est posé sur une pastille claire.
       *
       * Ce n'est pas décoratif : le « site-App » est en bleu marine, mesuré
       * à un contraste de 1,30 sur `bg-gray-900` — il faut 3,0 pour qu'un
       * logo reste lisible. Sur fond clair il monte à 13,65. Le logo a été
       * dessiné pour un fond clair, on le lui rend.
       */
      <span className="inline-flex items-center rounded-lg bg-white px-2 py-1">{image}</span>
    ) : (
      image
    )
  ) : (
    <span className={`font-bold ${classeTexte} ${sombre ? "text-white" : ""}`}>
      SENsite<span className="text-orange-500">APP</span>
    </span>
  );

  const enveloppe = <span className={`inline-flex items-center ${className}`}>{contenu}</span>;

  return href ? (
    <Link href={href} aria-label="SENsite-APP">
      {enveloppe}
    </Link>
  ) : (
    enveloppe
  );
}
