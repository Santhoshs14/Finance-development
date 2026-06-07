import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CreateInvestmentInput,
  InvestmentDoc,
  UpdateInvestmentInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

/** Returns native investments plus a normalized view of legacy mutualFunds. */
export async function listInvestments(uid: string): Promise<InvestmentDoc[]> {
  const [native, legacy] = await Promise.all([
    adminDb.collection(`users/${uid}/investments`).get(),
    adminDb.collection(`users/${uid}/mutualFunds`).get(),
  ]);

  const investments = native.docs.map((d) => snapToSerialized<InvestmentDoc>(d));

  const legacyMapped = legacy.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: (data.fund_name as string) || (data.name as string) || "Untitled Fund",
      investment_type: "Mutual Fund" as const,
      buy_price: (data.average_nav as number) || (data.buy_price as number) || 0,
      current_price:
        (data.current_nav as number) || (data.current_price as number) || 0,
      quantity: (data.units as number) || (data.quantity as number) || 0,
      sip_amount: (data.sip_amount as number) || 0,
      linked_goal_id: (data.linked_goal_id as string) ?? null,
      account_id: (data.account_id as string) ?? null,
      scheme_code: (data.scheme_code as string) || undefined,
      fund_house: (data.fund_house as string) || undefined,
      _source: "mutualFunds",
    } satisfies InvestmentDoc;
  });

  return [...investments, ...legacyMapped];
}

export async function createInvestment(
  uid: string,
  input: CreateInvestmentInput
): Promise<string> {
  const data: Record<string, unknown> = {
    name: input.name,
    investment_type: input.investment_type,
    buy_price: input.buy_price,
    current_price: input.current_price ?? input.buy_price,
    quantity: input.quantity,
    sip_amount: input.sip_amount,
    scheme_code: input.scheme_code,
    fund_house: input.fund_house,
    linked_goal_id: input.linked_goal_id ?? null,
    account_id: input.account_id ?? null,
    createdAt: FieldValue.serverTimestamp(),
  };
  // Gold-specific fields
  if (input.purity != null) data.purity = input.purity;
  if (input.form) data.form = input.form;
  if (input.weight_grams != null) data.weight_grams = input.weight_grams;
  if (input.making_charges != null) data.making_charges = input.making_charges;
  if (input.purchase_date) data.purchase_date = input.purchase_date;

  const ref = await adminDb.collection(`users/${uid}/investments`).add(data);
  return ref.id;
}

export async function updateInvestment(
  uid: string,
  id: string,
  patch: UpdateInvestmentInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/investments/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteInvestment(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/investments/${id}`).delete();
}
