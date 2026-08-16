"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import ProductForm from "@/components/product-form";

export default function ModifierProduitPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Parameters<typeof ProductForm>[0]["product"]>(undefined);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      const { data: profile } = await getSupabase().from("profiles").select("boutique_id").eq("id", user.id).single();
      setBoutiqueId(profile?.boutique_id || null);
      const { data: p } = await getSupabase().from("products").select("*").eq("id", productId).single();
      setProduct(p);
      setLoading(false);
    };
    load();
  }, [router, productId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/produits" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Modifier le produit</h1>
      </div>
      {boutiqueId && userId && product && (
        <ProductForm
          boutiqueId={boutiqueId}
          userId={userId}
          product={product}
          onSuccess={() => router.push("/dashboard/produits")}
        />
      )}
    </div>
  );
}
