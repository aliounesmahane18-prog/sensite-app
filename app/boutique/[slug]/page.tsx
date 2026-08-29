"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { CATEGORY_ICONS } from "@/lib/themes";
import ImageProduit from "@/components/image-produit";

interface Boutique {
  id: string; name: string; slug: string; whatsapp_number: string;
  color_primary: string; color_secondary: string; color_accent: string;
  category: string; quartier: string | null; logo_url: string | null;
  description: string | null;
}

interface Variant { name: string; values: string[]; }

interface Product {
  id: string; boutique_id: string; name: string; price: number;
  old_price: number | null; image_url: string | null; description: string | null;
  is_featured: boolean; category: string | null; has_variants: boolean; variants: Variant[];
}

interface CartItem { product: Product; quantity: number; selectedVariants: Record<string, string>; }

interface FloatingIcon { id: number; icon: string; x: number; y: number; size: number; opacity: number; speed: number; }

export default function CataloguePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<"cart" | "form">("cart");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [floatingIcons, setFloatingIcons] = useState<FloatingIcon[]>([]);
  const [scrollY, setScrollY] = useState(0);
  // `null` = onglet « Tout »
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Parallaxe au scroll
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase();
      const { data: b } = await supabase.from("boutiques").select("*")
        .eq("slug", slug).eq("is_active", true).eq("subscription_status", "active").maybeSingle();
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBoutique(b);

      // Générer les icônes flottantes
      const icons = CATEGORY_ICONS[b.category] || CATEGORY_ICONS.autre;
      const generated: FloatingIcon[] = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        icon: icons[i % icons.length],
        x: Math.random() * 100,
        y: Math.random() * 200,
        size: 20 + Math.random() * 30,
        opacity: 0.04 + Math.random() * 0.08,
        speed: 0.1 + Math.random() * 0.3,
      }));
      setFloatingIcons(generated);

      const { data: prods } = await supabase.from("products").select("*")
        .eq("boutique_id", b.id).eq("is_available", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      setProducts(prods || []);
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleAddToCart = (product: Product, variants: Record<string, string> = {}) => {
    const key = `${product.id}-${JSON.stringify(variants)}`;
    setCart(prev => {
      const existing = prev.find(i => `${i.product.id}-${JSON.stringify(i.selectedVariants)}` === key);
      if (existing) return prev.map(i => `${i.product.id}-${JSON.stringify(i.selectedVariants)}` === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, selectedVariants: variants }];
    });
    setSelectedProduct(null);
    setSelectedVariants({});
  };

  const openProductModal = (product: Product) => {
    if (!product.has_variants || !product.variants?.length) { handleAddToCart(product); return; }
    setSelectedProduct(product);
    setSelectedVariants({});
  };

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  // ── CATÉGORIES ──
  // Extraites des produits eux-mêmes : le gérant saisit la catégorie en texte
  // libre, il n'y a pas de liste de référence en base.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const label = p.category?.trim();
      if (!label) continue; // les produits sans catégorie ne vivent que sous « Tout »
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products]);

  // Si la catégorie active disparaît (produit modifié ou retiré), on retombe
  // sur « Tout » plutôt que d'afficher une grille vide sans explication.
  useEffect(() => {
    if (activeCategory && !categories.some(c => c.name === activeCategory)) {
      setActiveCategory(null);
    }
  }, [categories, activeCategory]);

  const normalize = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const visibleProducts = useMemo(() => {
    const query = normalize(search.trim());
    return products.filter(p => {
      // La recherche s'applique à l'intérieur de la catégorie active.
      if (activeCategory && p.category?.trim() !== activeCategory) return false;
      if (!query) return true;
      return [p.name, p.description, p.category]
        .some(field => field && normalize(field).includes(query));
    });
  }, [products, activeCategory, search]);

  const sendOrder = () => {
    if (!orderForm.name || !orderForm.phone || !boutique) return;
    const items = cart.map(i => {
      const variantStr = Object.entries(i.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(", ");
      return `  • ${i.product.name}${variantStr ? ` (${variantStr})` : ""} x${i.quantity} — ${fmt(i.product.price * i.quantity)} FCFA`;
    }).join("\n");
    const msg = encodeURIComponent(
      `🛒 *COMMANDE — ${boutique.name}*\n─────────────────\n${items}\n─────────────────\n` +
      `💰 *TOTAL: ${fmt(total)} FCFA*\n\n👤 ${orderForm.name}\n📞 ${orderForm.phone}` +
      `${orderForm.address ? `\n📍 ${orderForm.address}` : ""}\n─────────────────\nVia SENsite-APP`
    );
    // Enregistrement de la commande AVANT l'ouverture de WhatsApp, mais sans
    // l'attendre : `window.open` doit rester dans le même tour que le clic,
    // sinon le navigateur bloque l'onglet. La requête part donc en premier et
    // se termine en arrière-plan.
    //
    // La route recalcule les prix et le total depuis la base : ce qui est
    // envoyé ici n'est qu'une liste d'identifiants et de quantités.
    //
    // Un échec d'enregistrement ne doit surtout pas empêcher la commande de
    // partir sur WhatsApp — c'est elle qui fait vivre la boutique.
    void fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: boutique.slug,
        customer_name: orderForm.name,
        customer_phone: orderForm.phone,
        customer_address: orderForm.address,
        items: cart.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
      }),
    }).catch(() => undefined);

    const wa = boutique.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
    setCart([]); setCartOpen(false); setStep("cart");
    setOrderForm({ name: "", phone: "", address: "" });
  };

  const primary = boutique?.color_primary || "#F97316";
  const secondary = boutique?.color_secondary || "#1C1917";
  const accent = boutique?.color_accent || "#EAB308";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: secondary }}>
      <div className="text-center">
        <div className="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full mx-auto mb-3" style={{ borderColor: primary, borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: accent }}>Chargement...</p>
      </div>
    </div>
  );

  if (notFound || !boutique) return (
    <div className="min-h-screen flex items-center justify-center text-center px-4" style={{ background: secondary }}>
      <div><p className="text-5xl mb-4">🏪</p><h1 className="text-2xl font-bold text-white mb-2">Boutique introuvable</h1></div>
    </div>
  );

  return (
    // Pas d'`overflow-hidden` ici : un ancêtre qui masque le débordement crée un
    // conteneur de défilement et neutralise `position: sticky` sur le header et
    // les onglets. Le calque parallaxe est en `fixed` et se découpe lui-même.
    <div className="min-h-screen relative" ref={containerRef}
      style={{ background: `${secondary}11` }}>

      {/* ── ARRIÈRE-PLAN PARALLAXE ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {floatingIcons.map((icon) => (
          <div key={icon.id} className="absolute select-none"
            style={{
              left: `${icon.x}%`,
              top: `${icon.y}%`,
              fontSize: `${icon.size}px`,
              opacity: icon.opacity,
              transform: `translateY(${-scrollY * icon.speed * 0.3}px) rotate(${scrollY * icon.speed * 0.05}deg)`,
              transition: "transform 0.1s linear",
              filter: "blur(0.5px)",
            }}>
            {icon.icon}
          </div>
        ))}
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 50% 0%, ${primary}08 0%, transparent 70%)`,
        }} />
      </div>

      {/* ── RETOUR VERS L'ACCUEIL ──
          Volontairement hors du bloc collant : elle défile avec la page et
          laisse la recherche se coller en haut. `min-h-[44px]` est la taille
          de cible tactile recommandée, le catalogue se consulte au pouce. */}
      <nav className="relative z-20 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-1">
          <Link
            href="/#boutiques"
            className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-4 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
          >
            <span aria-hidden="true">←</span> Accueil
          </Link>
        </div>
      </nav>

      {/* ── HEADER + ONGLETS (collés ensemble au scroll) ── */}
      <div className="sticky top-0 z-30 shadow-lg">
      <header style={{ background: primary }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Le logo ramène à la liste des boutiques : c'est le geste
                attendu, et il double le lien « ← Accueil » au-dessus. */}
            <Link href="/#boutiques" aria-label="Retour aux boutiques"
              className="shrink-0 transition-transform hover:scale-105">
              {boutique.logo_url ? (
                // `contain` sur fond neutre : un logo n'est jamais rogné, et la
                // transparence ne laisse pas voir la couleur du header.
                <span className="relative block w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/30"
                  style={{ background: "#f5f5f5" }}>
                  <Image src={boutique.logo_url} alt={boutique.name} fill sizes="64px"
                    className="object-contain" />
                </span>
              ) : (
                <span className="block w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center font-bold text-white text-lg">
                  {boutique.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </Link>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">{boutique.name}</h1>
              {boutique.quartier && <p className="text-xs text-white/80">📍 {boutique.quartier}</p>}
            </div>
          </div>
          <button onClick={() => setCartOpen(true)}
            className="relative bg-white/20 border border-white/30 rounded-2xl p-2.5 active:scale-95 transition-all">
            <span className="text-xl">🛒</span>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: accent, color: secondary }}>{count}</span>
            )}
          </button>
        </div>
      </header>

      {/* ── RECHERCHE + ONGLETS CATÉGORIES ── */}
      {products.length > 0 && (
        <div className="border-b" style={{ background: "white", borderColor: `${primary}22` }}>
          <div className="max-w-2xl mx-auto px-3 pt-3 pb-2 space-y-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔍</span>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                aria-label="Rechercher un produit"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all"
                style={{ borderColor: `${primary}33`, boxShadow: "none" }}
              />
            </div>

            {categories.length > 0 && (
              // whitespace-nowrap + overflow-x-auto : la barre défile sur mobile
              // au lieu de passer à la ligne.
              <div
                className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
                role="tablist"
                aria-label="Catégories de produits"
              >
                {[{ name: null as string | null, label: "Tout", total: products.length }, ...categories.map(c => ({ name: c.name as string | null, label: c.name, total: c.total }))].map(tab => {
                  const isActive = activeCategory === tab.name;
                  return (
                    <button
                      key={tab.name ?? "__all__"}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveCategory(tab.name)}
                      className="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all active:scale-95"
                      style={
                        isActive
                          ? { background: primary, borderColor: primary, color: "white" }
                          : { background: "transparent", borderColor: `${primary}44`, color: primary }
                      }
                    >
                      {tab.label} ({tab.total})
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ── PRODUITS ── */}
      <main className="relative z-10 max-w-2xl mx-auto px-3 py-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500">Aucun produit disponible</p>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500">
              {search.trim()
                ? `Aucun produit ne correspond à « ${search.trim()} »`
                : "Aucun produit dans cette catégorie"}
            </p>
            <button
              onClick={() => { setSearch(""); setActiveCategory(null); }}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
              style={{ background: primary }}
            >
              Voir tous les produits
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visibleProducts.map(p => (
              <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm border"
                style={{ background: "white", borderColor: `${primary}22` }}>
                {/* `relative` est indispensable : <Image fill> se positionne sur
                    le premier ancêtre positionné. Hauteur fixe + overflow-hidden
                    de la carte : l'image ne peut pas déborder.
                    `contain` sur fond neutre : une photo prise en portrait est
                    affichée en entier, jamais coupée en haut ni en bas. */}
                <div className="relative w-full h-48 overflow-hidden rounded-t-2xl"
                  style={{ background: "#f5f5f5" }}>
                  <ImageProduit src={p.image_url} alt={p.name} fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-contain object-center" />
                  {p.is_featured && (
                    <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: accent, color: secondary }}>⭐ Vedette</span>
                  )}
                  {p.has_variants && (
                    <span className="absolute top-2 right-2 bg-white/90 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: primary }}>Options</span>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="font-semibold text-sm text-gray-900 line-clamp-2">{p.name}</p>
                  <div>
                    <p className="font-bold text-sm" style={{ color: primary }}>{fmt(p.price)} FCFA</p>
                    {p.old_price && <p className="text-xs text-gray-400 line-through">{fmt(p.old_price)} FCFA</p>}
                  </div>
                  {/* Le « + » seul n'expliquait pas ce qu'il faisait. Bouton
                      pleine largeur, 44px de haut : c'est la taille de cible
                      tactile recommandée, et le catalogue se consulte au pouce. */}
                  {/* `text-xs` sur mobile : la grille est à deux colonnes,
                      une carte fait ~177px et le libellé complet était coupé
                      en 14px. Pas de `truncate` — le texte passe à la ligne
                      plutôt que d'être amputé, le bouton grandit. */}
                  <button
                    onClick={() => openProductModal(p)}
                    className="w-full min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 text-white text-xs sm:text-sm font-semibold px-2 py-2 leading-tight active:scale-95 transition-all"
                    style={{ background: primary }}
                  >
                    <ShoppingCart className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Ajouter au panier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 py-6 text-center" style={{ background: secondary }}>
        <p className="font-bold text-sm" style={{ color: accent }}>
          {boutique.name}
        </p>
        <p className="text-xs mt-1" style={{ color: `${accent}88` }}>
          Propulsé par <span style={{ color: accent }}>SENsite</span>APP
        </p>
      </footer>

      {/* ── BOUTON PANIER FIXE ── */}
      {count > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-20">
          <button onClick={() => setCartOpen(true)}
            className="text-white font-bold px-6 py-3.5 rounded-2xl shadow-2xl"
            style={{ background: primary, boxShadow: `0 8px 25px ${primary}66` }}>
            🛒 Panier ({count}) — {fmt(total)} FCFA
          </button>
        </div>
      )}

      {/* ── MODAL VARIANTES ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedProduct(null)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-2" />

            {/* Fermer par le fond noir n'est pas devinable : un retour explicite,
                teinté avec la couleur de la boutique. */}
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="flex items-center gap-1 text-sm font-medium -ml-1 px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              style={{ color: primary }}
            >
              <span aria-hidden="true">←</span> Retour
            </button>

            <div className="flex items-start gap-3">
              {selectedProduct.image_url && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0"
                  style={{ background: "#f5f5f5" }}>
                  <ImageProduit src={selectedProduct.image_url} alt={selectedProduct.name} fill sizes="64px" className="object-contain object-center" tailleIcone="text-2xl" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-900">{selectedProduct.name}</h3>
                <p className="font-bold text-lg" style={{ color: primary }}>{fmt(selectedProduct.price)} FCFA</p>
              </div>
            </div>
            {selectedProduct.variants?.map((variant, vi) => (
              <div key={vi}>
                <p className="text-sm font-semibold text-gray-700 mb-2">{variant.name}</p>
                <div className="flex flex-wrap gap-2">
                  {variant.values.map((val, i) => (
                    <button key={i} onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.name]: val }))}
                      className="px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all"
                      style={selectedVariants[variant.name] === val
                        ? { background: primary, borderColor: primary, color: "white" }
                        : { borderColor: "#E5E7EB", color: "#374151", background: "white" }}>
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => {
                const allSelected = selectedProduct.variants?.every(v => selectedVariants[v.name]);
                if (!allSelected) { alert("Sélectionne toutes les options"); return; }
                handleAddToCart(selectedProduct, selectedVariants);
              }}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-base"
              style={{ background: primary }}>
              ➕ Ajouter au panier
            </button>
          </div>
        </div>
      )}

      {/* ── PANIER DRAWER ── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/50" onClick={() => { setCartOpen(false); setStep("cart"); }} />
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="w-10 h-1 rounded-full bg-gray-200 absolute top-2 left-1/2 -translate-x-1/2" />
              <h3 className="font-bold text-lg">{step === "cart" ? `🛒 Panier (${count})` : "📝 Mes infos"}</h3>
              <button onClick={() => { setCartOpen(false); setStep("cart"); }} className="text-gray-400 text-2xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {step === "cart" ? (
                cart.length === 0
                  ? <div className="text-center py-12"><p className="text-4xl mb-2">🛒</p><p className="text-gray-400">Panier vide</p></div>
                  : <div className="space-y-3">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: `${primary}08` }}>
                        <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                          <ImageProduit src={item.product.image_url} alt={item.product.name} width={56} height={56} className="w-full h-full object-contain" tailleIcone="text-2xl" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.product.name}</p>
                          {Object.entries(item.selectedVariants).map(([k, v]) => (
                            <p key={k} className="text-xs text-gray-400">{k}: {v}</p>
                          ))}
                          <p className="text-sm font-bold" style={{ color: primary }}>{fmt(item.product.price * item.quantity)} FCFA</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setCart(prev => {
                            const updated = prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity - 1 } : i);
                            return updated.filter(i => i.quantity > 0);
                          })} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center font-bold">−</button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <button onClick={() => setCart(prev => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ background: primary }}>+</button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span style={{ color: primary }}>{fmt(total)} FCFA</span>
                    </div>
                  </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Ton nom *</label>
                    <input type="text" value={orderForm.name} onChange={e => setOrderForm({ ...orderForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none"
                      style={{ borderColor: orderForm.name ? primary : "#E5E7EB" }}
                      placeholder="Fatou Diallo" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Ton WhatsApp *</label>
                    <input type="tel" value={orderForm.phone} onChange={e => setOrderForm({ ...orderForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none"
                      style={{ borderColor: orderForm.phone ? primary : "#E5E7EB" }}
                      placeholder="77 123 45 67" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Quartier / Adresse</label>
                    <input type="text" value={orderForm.address} onChange={e => setOrderForm({ ...orderForm, address: e.target.value })}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none"
                      placeholder="Médina, Dakar..." />
                  </div>
                  <div className="rounded-xl p-3 text-sm" style={{ background: `${primary}11`, color: primary }}>
                    📲 Ta commande sera envoyée sur WhatsApp de la boutique
                  </div>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100 space-y-2">
                {step === "cart" ? (
                  <button onClick={() => setStep("form")}
                    className="w-full py-3.5 rounded-2xl text-white font-bold text-base"
                    style={{ background: primary }}>
                    Commander →
                  </button>
                ) : (
                  <>
                    <button onClick={() => setStep("cart")}
                      className="w-full py-3 rounded-2xl border-2 font-semibold text-gray-700"
                      style={{ borderColor: `${primary}33` }}>
                      ← Retour au panier
                    </button>
                    <button onClick={sendOrder}
                      className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-base shadow-lg shadow-green-200">
                      💬 Envoyer sur WhatsApp
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
