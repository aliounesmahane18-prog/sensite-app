"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getSupabase } from "@/lib/supabase";
import { CATEGORY_ICONS } from "@/lib/themes";

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
    <div className="min-h-screen relative overflow-hidden" ref={containerRef}
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

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 shadow-lg" style={{ background: primary }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {boutique.logo_url ? (
              <Image src={boutique.logo_url} alt={boutique.name} width={44} height={44}
                className="rounded-xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/20 border-2 border-white/30 flex items-center justify-center font-bold text-white">
                {boutique.name.slice(0, 2).toUpperCase()}
              </div>
            )}
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

      {/* ── PRODUITS ── */}
      <main className="relative z-10 max-w-2xl mx-auto px-3 py-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500">Aucun produit disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <div key={p.id} className="rounded-2xl overflow-hidden shadow-sm border"
                style={{ background: "white", borderColor: `${primary}22` }}>
                <div className="h-40 relative" style={{ background: `${secondary}11` }}>
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">📦</div>
                  )}
                  {p.is_featured && (
                    <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: accent, color: secondary }}>⭐ Vedette</span>
                  )}
                  {p.has_variants && (
                    <span className="absolute top-2 right-2 bg-white/90 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: primary }}>Options</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">{p.name}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-bold text-sm" style={{ color: primary }}>{fmt(p.price)} FCFA</p>
                      {p.old_price && <p className="text-xs text-gray-400 line-through">{fmt(p.old_price)} FCFA</p>}
                    </div>
                    <button onClick={() => openProductModal(p)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg active:scale-90 transition-all"
                      style={{ background: primary }}>+</button>
                  </div>
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
            <div className="flex items-start gap-3">
              {selectedProduct.image_url && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0">
                  <Image src={selectedProduct.image_url} alt={selectedProduct.name} fill className="object-cover" />
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
                          {item.product.image_url
                            ? <Image src={item.product.image_url} alt={item.product.name} width={56} height={56} className="w-full h-full object-cover" />
                            : <div className="flex items-center justify-center h-full text-2xl">📦</div>}
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
