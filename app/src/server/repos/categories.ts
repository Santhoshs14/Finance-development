import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  CategoryDoc,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listCategories(uid: string): Promise<CategoryDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/categories`)
    .orderBy("name")
    .get();
  return snap.docs.map((d) => snapToSerialized<CategoryDoc>(d));
}

export async function createCategory(
  uid: string,
  input: CreateCategoryInput
): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/categories`).add({
    name: input.name,
    type: input.type,
    icon: input.icon ?? "tag",
    color: input.color ?? "#6b7280",
    tax_section: input.tax_section,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateCategory(
  uid: string,
  id: string,
  patch: UpdateCategoryInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/categories/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteCategory(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/categories/${id}`).delete();
}
