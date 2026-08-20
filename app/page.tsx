import Link from "next/link";
import CarouselBannieres from "@/components/landing/carousel-bannieres";
import BoutiquesPartenaires from "@/components/landing/boutiques-partenaires";
import ProduitsVedettes from "@/components/landing/produits-vedettes";
import FormulaireContact from "@/components/landing/formulaire-contact";
import { getBannieres, getBoutiques, getProduitsVedettes } from "@/lib/landing";
import { envServeur } from "@/lib/supabase-server";

/**
 * Page d'accueil : le « centre commercial numérique ».
 *
 * Rendue à chaque requête (`force-dynamic`) plutôt que pré-générée : les
 * boutiques, produits vedettes et bannières changent depuis l'admin et
 * doivent apparaître sans redéploiement. C'est aussi ce qui permet au build
 * de passer sans aucune variable d'environnement.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // En parallèle : trois requêtes indépendantes, une seule attente.
  const [bannieres, boutiques, produits] = await Promise.all([
    getBannieres(),
    getBoutiques(),
    getProduitsVedettes(12),
  ]);

  // Lu à l'exécution, comme la config Supabase : la valeur suit un changement
  // de variable dans Vercel sans nécessiter un nouveau build.
  const numeroContact = envServeur("NEXT_PUBLIC_WHATSAPP_CONTACT");

  return (
    <main className="min-h-screen bg-white">
      {/* ============ EN-TÊTE ============ */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="font-bold text-xl shrink-0">
            SENsite<span className="text-orange-500">APP</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <a
              href="#boutiques"
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
            >
              Nos boutiques
            </a>
            <a
              href="#produits"
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-orange-500 transition-colors"
            >
              Produits
            </a>
            {/* Le libellé complet passe sur deux lignes sous 400px : on garde
                le verbe seul, l'intention reste claire à côté de « Connexion ». */}
            <a href="#contact" className="btn-primary text-xs sm:text-sm py-2 whitespace-nowrap">
              <span className="sm:hidden">Commander</span>
              <span className="hidden sm:inline">Commander une boutique</span>
            </a>
            <Link href="/login" className="btn-secondary text-xs sm:text-sm py-2 whitespace-nowrap">
              Connexion
            </Link>
          </div>
        </nav>
      </header>

      {/* ============ HERO ============ */}
      <section className="bg-gradient-to-b from-orange-50 via-amber-50 to-white">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center">
          <p className="text-4xl mb-4" aria-hidden="true">
            🏬 🛍️ 📲
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight">
            Votre <span className="text-orange-500">Centre Commercial Numérique</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mt-5 max-w-2xl mx-auto">
            Commandez en boutique, achetez vos produits préférés, tout via WhatsApp.
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <a href="#boutiques" className="btn-primary text-base px-8 py-3.5">
              Voir les boutiques
            </a>
            <a href="#contact" className="btn-secondary text-base px-8 py-3.5">
              Commander une boutique
            </a>
          </div>
        </div>
      </section>

      {/* ============ CARROUSEL ============ */}
      <CarouselBannieres bannieres={bannieres} />

      {/* ============ BOUTIQUES ============ */}
      <BoutiquesPartenaires boutiques={boutiques} />

      {/* ============ PRODUITS VEDETTES ============ */}
      <ProduitsVedettes produits={produits} />

      {/* ============ CONTACT ============ */}
      <FormulaireContact numeroContact={numeroContact} />

      {/* ============ PIED DE PAGE ============ */}
      <footer className="bg-gray-900 text-white py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div>
            <p className="font-bold text-lg">
              SENsite<span className="text-orange-500">APP</span>
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Toutes les boutiques de Dakar, à portée de WhatsApp.
            </p>
          </div>

          <div className="flex gap-5 text-sm">
            <a href="#boutiques" className="text-gray-300 hover:text-orange-400 transition-colors">
              Boutiques
            </a>
            <Link href="/login" className="text-gray-300 hover:text-orange-400 transition-colors">
              Connexion
            </Link>
            {numeroContact && (
              <a
                href={`https://wa.me/${numeroContact.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-green-400 transition-colors"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <p className="text-gray-500 text-xs text-center mt-8">
          © 2026 SENsite-APP — Ali.IA Solutions
        </p>
      </footer>
    </main>
  );
}
