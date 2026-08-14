import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateOrderNumber, getErrorMessage } from "@/lib/utils";
import type { OrderItem } from "@/types";

export const dynamic = "force-dynamic";

interface IncomingItem {
  product_id: string;
  quantity: number;
}

/**
 * Enregistre une commande passée depuis un catalogue public.
 *
 * Route publique (le client n'a pas de compte), donc :
 *  - la boutique doit être active et abonnée ;
 *  - les prix et le total sont recalculés depuis la base, jamais repris du
 *    corps de la requête ;
 *  - l'écriture passe par la clé service role, ce qui évite d'ouvrir une
 *    politique RLS d'insertion à `anon` sur la table `orders`.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const slug = String(body.slug ?? "").trim();
    const customerName = String(body.customer_name ?? "").trim();
    const customerPhone = String(body.customer_phone ?? "").trim();
    const customerAddress = String(body.customer_address ?? "").trim();
    const rawItems: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (!slug || !customerName || !customerPhone || rawItems.length === 0) {
      return NextResponse.json({ error: "Commande incomplète." }, { status: 400 });
    }

    const quantities = new Map<string, number>();
    for (const item of rawItems) {
      const id = String(item?.product_id ?? "");
      const qty = Math.floor(Number(item?.quantity ?? 0));
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;
      quantities.set(id, (quantities.get(id) ?? 0) + Math.min(qty, 999));
    }
    if (quantities.size === 0) {
      return NextResponse.json({ error: "Aucun produit valide dans la commande." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: boutique } = await admin
      .from("boutiques")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("subscription_status", "active")
      .maybeSingle();
    if (!boutique) {
      return NextResponse.json({ error: "Boutique introuvable ou inactive." }, { status: 404 });
    }

    const { data: products, error: productsError } = await admin
      .from("products")
      .select("id, name, price")
      .eq("boutique_id", boutique.id)
      .eq("is_available", true)
      .in("id", Array.from(quantities.keys()));
    if (productsError) throw new Error(productsError.message);

    const items: OrderItem[] = (products ?? []).map((p: { id: string; name: string; price: number }) => ({
      product_id: p.id,
      name: p.name,
      price: p.price,
      quantity: quantities.get(p.id) ?? 0,
    }));
    if (items.length === 0) {
      return NextResponse.json({ error: "Les produits commandés ne sont plus disponibles." }, { status: 409 });
    }

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const incomingNumber = String(body.order_number ?? "");
    const orderNumber = /^SEN-\d{6}-\d{4}$/.test(incomingNumber) ? incomingNumber : generateOrderNumber();

    const { data: order, error: insertError } = await admin
      .from("orders")
      .insert({
        boutique_id: boutique.id,
        order_number: orderNumber,
        customer_name: customerName.slice(0, 120),
        customer_phone: customerPhone.slice(0, 40),
        customer_address: customerAddress ? customerAddress.slice(0, 240) : null,
        items,
        total_amount: totalAmount,
        status: "new",
      })
      .select("id, order_number, total_amount")
      .single();
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ order });
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
