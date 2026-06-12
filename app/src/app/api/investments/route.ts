import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  // Load from investments collection
  const snapshot = await adminDb
    .collection(`users/${uid}/investments`)
    .get();

  const investments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Also load legacy mutualFunds collection and map to investments schema
  const mfSnapshot = await adminDb
    .collection(`users/${uid}/mutualFunds`)
    .get();

  const mutualFunds = mfSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.fund_name || data.name || "Untitled Fund",
      investment_type: "Mutual Fund",
      buy_price: data.average_nav || data.buy_price || 0,
      current_price: data.current_nav || data.current_price || 0,
      quantity: data.units || data.quantity || 0,
      sip_amount: data.sip_amount || 0,
      linked_goal_id: data.linked_goal_id || null,
      account_id: data.account_id || null,
      _source: "mutualFunds",
      ...(!data.fund_name && !data.average_nav ? {} : {}),
    };
  });

  return NextResponse.json({ investments: [...investments, ...mutualFunds] });
}

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { uid } = auth;

  const body = await req.json();
  const { name, investment_type, buy_price, current_price, quantity } = body;

  const parsedQuantity = parseFloat(quantity);
  if (!name || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid required fields: name, quantity" },
      { status: 400 }
    );
  }

  // buy_price is optional (e.g. gifted holdings or fixed deposits tracked by
  // current value only); default to 0 rather than rejecting the request.
  const parsedBuyPrice = Number.isFinite(parseFloat(buy_price)) ? parseFloat(buy_price) : 0;
  const parsedCurrentPrice = Number.isFinite(parseFloat(current_price))
    ? parseFloat(current_price)
    : parsedBuyPrice;

  const data: Record<string, unknown> = {
    name,
    investment_type: investment_type || "Equity",
    buy_price: parsedBuyPrice,
    current_price: parsedCurrentPrice,
    quantity: parsedQuantity,
    createdAt: FieldValue.serverTimestamp(),
  };

  // Optional fields
  if (body.sip_amount) data.sip_amount = parseFloat(body.sip_amount);
  if (body.account_id) data.account_id = body.account_id;
  if (body.linked_transaction_id) data.linked_transaction_id = body.linked_transaction_id;
  if (body.linked_goal_id) data.linked_goal_id = body.linked_goal_id;
  if (body.needs_allocation != null) data.needs_allocation = !!body.needs_allocation;
  if (body.scheme_code) data.scheme_code = body.scheme_code;
  if (body.fund_house) data.fund_house = body.fund_house;
  // Gold-specific fields
  if (body.purity != null) data.purity = Number(body.purity);
  if (body.form) data.form = body.form;
  if (body.weight_grams != null) data.weight_grams = parseFloat(String(body.weight_grams));
  if (body.making_charges != null) data.making_charges = parseFloat(String(body.making_charges));
  if (body.purchase_date) data.purchase_date = body.purchase_date;

  const ref = await adminDb.collection(`users/${uid}/investments`).add(data);
  return NextResponse.json({ id: ref.id, message: "Investment created" }, { status: 201 });
}
