import Image from "next/image";
import Link from "next/link";

/**
 * Logo SENsite-APP — source unique.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POUR PASSER AU LOGO IMAGE :
 *   1. déposer le fichier dans `public/logo-sensite-app.png` ;
 *   2. renseigner FICHIER_LOGO et RATIO_LOGO ci-dessous.
 * Rien d'autre à toucher : les huit emplacements de l'application passent
 * automatiquement du logo typographique au logo image.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tant que FICHIER_LOGO vaut `null`, c'est la version typographique qui
 * s'affiche. Pointer `next/image` vers un fichier absent afficherait un
 * texte alternatif cassé sur toutes les pages — pire que le logo actuel.
 */
const FICHIER_LOGO: string | null = null;

/** largeur ÷ hauteur du fichier, à mesurer une fois le logo déposé. */
const RATIO_LOGO = 1;

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
  const contenu = FICHIER_LOGO ? (
    <Image
      src={FICHIER_LOGO}
      alt="SENsite-APP"
      // Dimensions explicites : sans elles, la page saute au chargement de
      // l'image (layout shift).
      width={Math.round(hauteur * RATIO_LOGO)}
      height={hauteur}
      // Le logo a un fond clair : `contain` évite qu'il soit rogné si le
      // conteneur ne respecte pas exactement son ratio.
      className="object-contain w-auto"
      style={{ height: hauteur }}
      priority
    />
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
