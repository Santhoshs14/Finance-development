import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CreateGoalInput, GoalDoc, UpdateGoalInput } from "@/schemas";
import { snapToSerialized } from "./helpers";

export async function listGoals(uid: string): Promise<GoalDoc[]> {
  const snap = await adminDb
    .collection(`users/${uid}/goals`)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => snapToSerialized<GoalDoc>(d));
}

export async function createGoal(uid: string, input: CreateGoalInput): Promise<string> {
  const ref = await adminDb.collection(`users/${uid}/goals`).add({
    goal_name: input.goal_name,
    target_amount: input.target_amount,
    current_amount: input.current_amount ?? 0,
    deadline: input.deadline,
    description: input.description ?? "",
    linked_funds: input.linked_funds ?? [],
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateGoal(
  uid: string,
  id: string,
  patch: UpdateGoalInput
): Promise<void> {
  await adminDb
    .doc(`users/${uid}/goals/${id}`)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function deleteGoal(uid: string, id: string): Promise<void> {
  await adminDb.doc(`users/${uid}/goals/${id}`).delete();
}
