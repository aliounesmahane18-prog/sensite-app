"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { ErrorBanner } from "@/components/config-error";
import { ProductForm, type ProductFormValues } from "@/components/product-form";
import { getErrorMessage } from "@/lib/utils";

export default function ModifierProduitPage() {
  const params = useParams<{ id: string }>();
  const productId = typeof params?.id === "string" ? params.id : "";

  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [values, setValues] = useState<ProductFormValues | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile?.boutique_id) {
          setError("Ton compte n'est rattaché à aucune boutique. Contacte Ali.IA Solutions.");
          return;
        }
        setBoutiqueId(profile.boutique_id);

        const { data: product } = await getSupabase()
          .from("products")
          .select("name, description, price, old_price, category, is_available, is_featured, image_url")
          .eq("id", productId)
          .eq("boutique_id", profile.boutique_id)
          .maybeSingle();

        if (cancelled) return;
        if (!product) {
          setError("Produit introuvable.");
          return;
        }

        setValues({
          name: product.name ?? "",
          description: product.description ?? "",
          price: String(product.price ?? ""),
          old_price: product.old_price === null ? "" : String(product.old_price),
          category: product.category ?? "",
          is_available: product.is_available ?? true,
          is_featured: product.is_featured ?? false,
          image_url: product.image_url ?? null,
        });
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
  }, [productId]);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/produits" className="text-gray-400 hover:text-gray-700">
          ←
        </Link>
        <h1 className="section-title">Modifier le produit</h1>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        boutiqueId &&
        values && <ProductForm boutiqueId={boutiqueId} productId={productId} initialValues={values} />
      )}
    </div>
  );
}
