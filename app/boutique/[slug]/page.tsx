"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError } from "@/components/config-error";
import { formatFcfa, generateOrderNumber } from "@/lib/utils";

interface Boutique {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  color_primary: string | null;
  category: string;
  quartier: string | null;
}

interface Product {
  id: string;
  boutique_id: string;
  name: string;
  price: number;
  old_price: number | null;
  image_url: string | null;
  description: string | null;
  is_featured: boolean;
  category: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type Status = "loading" | "ready" | "not-found" | "unconfigured" | "error";

export default function CataloguePage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [status, setStatus] = useState<Status>("loading");
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({ name: "", phone: "", address: "" });
  const [step, setStep] = useState<"cart" | "form">("cart");
  const [orderNumber, setOrderNumber] = useState("");

  useEffect(() => {
    setOrderNumber(generateOrderNumber());
  }, []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    const load = async () => {
      if (!isSupabaseConfigured()) {
        setStatus("unconfigured");
        return;
      }
      try {
        const supabase = getSupabase();
        const { data: b, error: boutiqueError } = await supabase
          .from("boutiques")
          .select("id, name, slug, whatsapp_number, color_primary, category, quartier")
          .eq("slug", slug)
          .eq("is_active", true)
          .eq("subscription_status", "active")
          .maybeSingle();

        if (cancelled) return;
        if (boutiqueError) {
          setStatus("error");
          return;
        }
        if (!b) {
          setStatus("not-found");
          return;
        }
        setBoutique(b);

        const { data: prods } = await supabase
          .from("products")
          .select("id, boutique_id, name, price, old_price, image_url, description, is_featured, category")
          .eq("boutique_id", b.id)
          .eq("is_available", true)
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false });

        if (cancelled) return;
        setProducts(prods ?? []);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof SupabaseConfigError ? "unconfigured" : "error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const decrement = (productId: string) =>
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0),
    );

  const total = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  const formValid = orderForm.name.trim().length > 0 && orderForm.phone.trim().length > 0;

  const whatsappHref = useMemo(() => {
    if (!boutique || cart.length === 0) return "";
    const lines = cart
      .map((i) => `  • ${i.product.name} x${i.quantity} — ${formatFcfa(i.product.price * i.quantity)}`)
      .join("\n");
    const message =
      `🛒 *COMMANDE ${orderNumber}*\n${boutique.name}\n─────────────────\n${lines}\n` +
      `─────────────────\n💰 *TOTAL : ${formatFcfa(total)}*\n\n` +
      `👤 ${orderForm.name}\n📞 ${orderForm.phone}` +
      `${orderForm.address ? `\n📍 ${orderForm.address}` : ""}\n─────────────────\nVia SENsite-APP`;
    const number = boutique.whatsapp_number.replace(/\D/g, "");
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  }, [boutique, cart, orderForm, orderNumber, total]);

  /**
   * Enregistre la commande côté serveur, sans bloquer l'ouverture de WhatsApp.
   * `keepalive` permet à la requête d'aboutir même si l'onglet passe en
   * arrière-plan au moment où WhatsApp s'ouvre.
   */
  const persistOrder = () => {
    if (!boutique) return;
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        slug: boutique.slug,
        order_number: orderNumber,
        customer_name: orderForm.name.trim(),
        customer_phone: orderForm.phone.trim(),
        customer_address: orderForm.address.trim(),
        items: cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
      }),
    }).catch(() => {
      // La commande part quand même sur WhatsApp : on n'interrompt pas le client.
    });
  };

  const handleSend = () => {
    persistOrder();
    // Le navigateur suit le lien WhatsApp juste après ce gestionnaire. On
    // attend un court instant avant de vider le panier pour ne pas modifier
    // le `href` pendant que la navigation démarre.
    window.setTimeout(() => {
      setCart([]);
      setCartOpen(false);
      setStep("cart");
      setOrderForm({ name: "", phone: "", address: "" });
      setOrderNumber(generateOrderNumber());
    }, 500);
  };

  const color = boutique?.color_primary || "#F97316";

  if (status === "unconfigured") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ConfigError />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-5xl mb-4">📡</p>
          <h1 className="text-2xl font-bold mb-2">Connexion impossible</h1>
          <p className="text-gray-500 mb-4">Vérifie ta connexion internet et réessaie.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status === "not-found" || !boutique) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div>
          <p className="text-5xl mb-4">🏪</p>
          <h1 className="text-2xl font-bold mb-2">Boutique introuvable</h1>
          <p className="text-gray-500">Cette boutique n&apos;est pas disponible pour le moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-30 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg">{boutique.name}</h1>
            {boutique.quartier && <p className="text-xs text-white/80">📍 {boutique.quartier}</p>}
          </div>
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Ouvrir le panier (${count} article${count > 1 ? "s" : ""})`}
            className="relative bg-white/20 border border-white/30 rounded-2xl p-2.5"
          >
            🛒
            {count > 0 && (
              <span
                className="absolute -top-1 -right-1 bg-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                style={{ color }}
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 pb-24">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500">Aucun produit disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="h-40 bg-gray-100 relative">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">📦</div>
                  )}
                  {p.is_featured && (
                    <span className="absolute top-2 left-2 badge bg-yellow-400 text-yellow-900">⭐</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 line-clamp-2">{p.name}</p>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="font-bold text-sm" style={{ color }}>
                        {formatFcfa(p.price)}
                      </p>
                      {p.old_price !== null && (
                        <p className="text-xs text-gray-400 line-through">{formatFcfa(p.old_price)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addToCart(p)}
                      aria-label={`Ajouter ${p.name} au panier`}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-lg"
                      style={{ background: color }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {count > 0 && !cartOpen && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-20">
          <button
            onClick={() => setCartOpen(true)}
            className="text-white font-bold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2"
            style={{ background: color }}
          >
            🛒 Voir panier ({count}) — {formatFcfa(total)}
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div
            className="flex-1 bg-black/40"
            onClick={() => {
              setCartOpen(false);
              setStep("cart");
            }}
          />
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">{step === "cart" ? `Panier (${count})` : "Mes infos"}</h3>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setStep("cart");
                }}
                aria-label="Fermer le panier"
                className="text-gray-400 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {step === "cart" ? (
                cart.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-2">🛒</p>
                    <p className="text-gray-400">Panier vide</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                          {item.product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">📦</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.product.name}</p>
                          <p className="text-sm font-bold" style={{ color }}>
                            {formatFcfa(item.product.price * item.quantity)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => decrement(item.product.id)}
                            aria-label={`Retirer un ${item.product.name}`}
                            className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                          <button
                            onClick={() => addToCart(item.product)}
                            aria-label={`Ajouter un ${item.product.name}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                            style={{ background: color }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-100 flex justify-between font-bold">
                      <span>Total</span>
                      <span style={{ color }}>{formatFcfa(total)}</span>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label" htmlFor="customer-name">
                      Ton nom *
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      value={orderForm.name}
                      onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
                      className="input-field"
                      placeholder="Fatou Diallo"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="customer-phone">
                      Ton WhatsApp *
                    </label>
                    <input
                      id="customer-phone"
                      type="tel"
                      value={orderForm.phone}
                      onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                      className="input-field"
                      placeholder="77 123 45 67"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="customer-address">
                      Quartier / Adresse
                    </label>
                    <input
                      id="customer-address"
                      type="text"
                      value={orderForm.address}
                      onChange={(e) => setOrderForm({ ...orderForm, address: e.target.value })}
                      className="input-field"
                      placeholder="Médina, Dakar..."
                    />
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 text-sm text-green-700">
                    📲 Ta commande sera envoyée sur le WhatsApp de la boutique
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-gray-100">
                {step === "cart" ? (
                  <button
                    onClick={() => setStep("form")}
                    className="w-full py-3.5 rounded-2xl text-white font-bold"
                    style={{ background: color }}
                  >
                    Commander →
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button onClick={() => setStep("cart")} className="w-full btn-secondary py-3">
                      ← Retour
                    </button>
                    {formValid ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleSend}
                        className="w-full btn-whatsapp py-3.5"
                      >
                        💬 Envoyer la commande sur WhatsApp
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full btn-whatsapp py-3.5 opacity-50 cursor-not-allowed"
                      >
                        Renseigne ton nom et ton WhatsApp
                      </button>
                    )}
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
