"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Onglets de navigation de l'espace super admin.
 *
 * Le plus spécifique gagne : `/admin/prospecteurs/xxx` allume bien
 * « Prospecteurs » et non « Boutiques », alors que `/admin` est un préfixe
 * de toutes les autres routes.
 */
const ONGLETS = [
  { href: "/admin/prospecteurs", label: "🧑🏾‍💼 Prospecteurs" },
  { href: "/admin/bannieres", label: "🖼️ Bannières" },
  { href: "/admin", label: "🏪 Boutiques" },
];

export default function AdminTabs() {
  const pathname = usePathname() ?? "";
  const actif = ONGLETS.find((o) => pathname === o.href || pathname.startsWith(`${o.href}/`))?.href;

  // Ordre d'affichage, indépendant de l'ordre de résolution ci-dessus.
  const affichage = ["/admin", "/admin/prospecteurs", "/admin/bannieres"];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {affichage.map((href) => {
        const onglet = ONGLETS.find((o) => o.href === href)!;
        const classes = "px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap";
        return href === actif ? (
          <span key={href} className={`${classes} bg-orange-500 text-white`}>
            {onglet.label}
          </span>
        ) : (
          <Link
            key={href}
            href={href}
            className={`${classes} bg-white border border-gray-200 text-gray-600 hover:border-orange-300 transition-colors`}
          >
            {onglet.label}
          </Link>
        );
      })}
    </div>
  );
}
