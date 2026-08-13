"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Boutique { id: string; name: string; slug: string; whatsapp_number: string; color_primary: string; category: string; quartier: string | null; }
interface Product { id: string; boutique_id: string; name: string; price: number; old_price: number | null; image_url: string | null; description: string | null; is_featured: boolean; category: string | null; }
interface CartItem { product: Product; quantity: number; }

export default function CataloguePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<"cart"|"form">("cart");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: b, error } = await supabase.from("boutiques").select("*").eq("slug", slug).eq("is_active", true).eq("subscription_status", "active").single();
      if (error || !b) { setNotFound(true); setLoading(false); return; }
      setBoutique(b);
      const { data: prods } = await supabase.from("products").select("*").eq("boutique_id", b.id).eq("is_available", true).order("is_featured", { ascending: false });
      setProducts(prods || []);
      setLoading(false);
    };
    load();
  }, [slug]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? {...i, quantity: i.quantity + 1} : i);
      return [...prev, { product, quantity: 1 }];
    });
  };

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const count = cart.reduce((s, i) => s + i.quantity, 0);

  const sendOrder = () => {
    if (!orderForm.name || !orderForm.phone || !boutique) return;
    const items = cart.map(i => `  • ${i.product.name} x${i.quantity} — ${new Intl.NumberFormat("fr-FR").format(i.product.price * i.quantity)} FCFA`).join("\n");
    const msg = encodeURIComponent(`🛒 *COMMANDE — ${boutique.name}*\n─────────────────\n${items}\n─────────────────\n💰 *TOTAL: ${new Intl.NumberFormat("fr-FR").format(total)} FCFA*\n\n👤 ${orderForm.name}\n📞 ${orderForm.phone}${orderForm.address ? `\n📍 ${orderForm.address}` : ""}\n─────────────────\nVia SENsite-APP`);
    const wa = boutique.whatsapp_number.replace(/\D/g, "");
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
    setCart([]); setCartOpen(false); setStep("cart"); setOrderForm({ name: "", phone: "", address: "" });
  };

  const color = boutique?.color_primary || "#F97316";

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"/></div>;
  if (notFound) return <div className="min-h-screen flex items-center justify-center text-center px-4"><div><p className="text-5xl mb-4">🏪</p><h1 className="text-2xl font-bold mb-2">Boutique introuvable</h1><p className="text-gray-500">Cette boutique n&apos;est pas disponible.</p></div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{boutique?.name}</h1>
            {boutique?.quartier && <p className="text-xs text-white/80">📍 {boutique.quartier}</p>}
          </div>
          <button onClick={() => setCartOpen(true)} className="relative bg-white/20 border border-white/30 rounded-2xl p-2.5">
            🛒
            {count > 0 && <span className="absolute -top-1 -right-1 bg-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center" style={{ color }}>{count}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16"><p className="text-4xl mb-3">📦</p><p className="text-gray-500">Aucun produit disponible</p></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map(p => (
              <div key={p.id} className="card overflow-hidden">
                <div className="h-40 bg-gray-100 relative">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-4xl">📦</div>}
                  {p.is_featured && <span className="absolute top-2 left-2 badge bg-yellow-400 text-yellow-900">⭐</span>}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 line-clamp-2">{p.name}</p>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="font-bold text-sm" style={{ color }}>{new Intl.NumberFormat("fr-FR").format(p.price)} FCFA</p>
                      {p.old_price && <p className="text-xs text-gray-400 line-through">{new Intl.NumberFormat("fr-FR").format(p.old_price)} FCFA</p>}
                    </div>
                    <button onClick={() => addToCart(p)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg" style={{ background: color }}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-20">
          <button onClick={() => setCartOpen(true)} className="text-white font-bold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2" style={{ background: color }}>
            🛒 Voir panier ({count}) — {new Intl.NumberFormat("fr-FR").format(total)} FCFA
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-black/40" onClick={() => { setCartOpen(false); setStep("cart"); }} />
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">{step === "cart" ? `Panier (${count})` : "Mes infos"}</h3>
              <button onClick={() => { setCartOpen(false); setStep("cart"); }} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {step === "cart" ? (
                cart.length === 0 ? <div className="text-center py-12"><p className="text-4xl mb-2">🛒</p><p className="text-gray-400">Panier vide</p></div> :
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                        {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full">📦</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.product.name}</p>
                        <p className="text-sm font-bold" style={{ color }}>{new Intl.NumberFormat("fr-FR").format(item.product.price * item.quantity)} FCFA</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCart(prev => { const n = prev.map(i => i.product.id === item.product.id ? {...i, quantity: i.quantity - 1} : i); return n.filter(i => i.quantity > 0); })} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">−</button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => addToCart(item.product)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: color }}>+</button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 flex justify-between font-bold">
                    <span>Total</span><span style={{ color }}>{new Intl.NumberFormat("fr-FR").format(total)} FCFA</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div><label className="label">Ton nom *</label><input type="text" value={orderForm.name} onChange={e => setOrderForm({...orderForm, name: e.target.value})} className="input-field" placeholder="Fatou Diallo" /></div>
                  <div><label className="label">Ton WhatsApp *</label><input type="tel" value={orderForm.phone} onChange={e => setOrderForm({...orderForm, phone: e.target.value})} className="input-field" placeholder="77 123 45 67" /></div>
                  <div><label className="label">Quartier / Adresse</label><input type="text" value={orderForm.address} onChange={e => setOrderForm({...orderForm, address: e.target.value})} className="input-field" placeholder="Médina, Dakar..." /></div>
                  <div className="bg-green-50 rounded-xl p-3 text-sm text-green-700">📲 Ta commande sera envoyée sur WhatsApp de la boutique</div>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100">
                {step === "cart" ? (
                  <button onClick={() => setStep("form")} className="w-full py-3.5 rounded-2xl text-white font-bold" style={{ background: color }}>Commander →</button>
                ) : (
                  <div className="space-y-2">
                    <button onClick={() => setStep("cart")} className="w-full btn-secondary py-3">← Retour</button>
                    <button onClick={sendOrder} className="w-full btn-whatsapp py-3.5">💬 Envoyer la commande sur WhatsApp</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
