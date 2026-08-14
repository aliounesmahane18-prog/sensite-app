"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { ErrorBanner } from "@/components/config-error";
import { formatFcfa, getErrorMessage } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
  category: string | null;
}

export default function ProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile?.boutique_id) {
          setError("Ton compte n'est rattaché à aucune boutique. Contacte Ali.IA Solutions.");
          return;
        }

        const { data, error: queryError } = await getSupabase()
          .from("products")
          .select("id, name, price, is_available, image_url, category")
          .eq("boutique_id", profile.boutique_id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);
        setProducts(data ?? []);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAvailable = async (id: string, current: boolean) => {
    const { error: updateError } = await getSupabase()
      .from("products")
      .update({ is_available: !current })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, is_available: !current } : p)));
  };

  const deleteProduct = async (id: string) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    const { error: deleteError } = await getSupabase().from("products").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="section-title">
          Mes produits <span className="text-gray-400 text-lg">({products.length})</span>
        </h1>
        <Link href="/dashboard/produits/nouveau" className="btn-primary text-sm shrink-0">
          + Ajouter
        </Link>
      </div>

      {error && <ErrorBanner message={error} />}

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 mb-4">Aucun produit pour l&apos;instant</p>
          <Link href="/dashboard/produits/nouveau" className="btn-primary">
            Ajouter mon premier produit
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className={`card overflow-hidden ${p.is_available ? "" : "opacity-60"}`}>
              <div className="h-40 bg-gray-100 flex items-center justify-center">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">📦</span>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                {p.category && <p className="text-xs text-gray-400">{p.category}</p>}
                <p className="text-orange-500 font-bold">{formatFcfa(p.price)}</p>
              </div>
              <div className="border-t border-gray-100 p-3 flex gap-2">
                <Link
                  href={`/dashboard/produits/${p.id}/modifier`}
                  className="btn-secondary text-xs py-1.5 flex-1 text-center"
                >
                  ✏️ Modifier
                </Link>
                <button
                  onClick={() => toggleAvailable(p.id, p.is_available)}
                  title={p.is_available ? "Masquer du catalogue" : "Afficher dans le catalogue"}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {p.is_available ? "👁" : "🙈"}
                </button>
                <button
                  onClick={() => deleteProduct(p.id)}
                  title="Supprimer"
                  className="text-xs py-1.5 px-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
