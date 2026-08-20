import Image from "next/image";
import Link from "next/link";
import { lienCommandeProduit, type ProduitVedette } from "@/lib/landing";
import { formatFcfa } from "@/lib/utils";

interface Props {
  produits: ProduitVedette[];
}

/**
 * Vitrine des produits mis en avant, toutes boutiques confondues.
 *
 * Composant serveur : rien n'est interactif ici, le bouton de commande est
 * un simple lien wa.me. Aucun JavaScript n'est envoyé au navigateur pour
 * cette section.
 */
export default function ProduitsVedettes({ produits }: Props) {
  if (produits.length === 0) return null;

  return (
    <section id="produits" className="scroll-mt-16 py-14 bg-slate-900">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-white text-center">Produits Vedettes</h2>
        <p className="text-white/80 text-center mt-2">
          La sélection du moment, commandée directement sur WhatsApp
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {produits.map((p) => (
            <div
              key={p.id}
              // Ombre au repos : sur fond bleu nuit, une carte sans relief
              // paraît collée au fond.
              className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col transition-shadow hover:shadow-xl"
            >
              {/* Même cadrage que le catalogue d'une boutique : hauteur fixe,
                  `contain` sur fond neutre, la photo n'est jamais coupée. */}
              <div
                className="relative w-full h-48 overflow-hidden rounded-t-2xl"
                style={{ background: "#f5f5f5" }}
              >
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-contain object-center"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-4xl text-gray-300">📦</div>
                )}
                <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  ⭐ Vedette
                </span>
              </div>

              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="font-semibold text-sm text-gray-900 line-clamp-2">{p.name}</p>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-bold text-orange-500">{formatFcfa(p.price)}</span>
                  {p.old_price != null && p.old_price > p.price && (
                    <span className="text-xs text-gray-400 line-through">{formatFcfa(p.old_price)}</span>
                  )}
                </div>

                <Link
                  href={`/boutique/${p.boutique_slug}`}
                  className="text-xs text-gray-500 hover:text-orange-500 truncate transition-colors"
                >
                  🏪 {p.boutique_name}
                </Link>

                <a
                  href={lienCommandeProduit(p)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-whatsapp text-xs text-center mt-auto"
                >
                  💬 Commander
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
