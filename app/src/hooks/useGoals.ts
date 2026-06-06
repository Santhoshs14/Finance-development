"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { goalsAPI } from "@/services/api";
import { useData } from "@/providers/DataProvider";
import { Goal } from "@/utils/calculations";
import toast from "react-hot-toast";

/**
 * Live goals subscription via DataProvider. Mutations stay on React Query
 * for optimistic UX, but the canonical source is Firestore — onSnapshot
 * keeps the list fresh across tabs.
 */
export function useGoals() {
  const { goals, dataReady } = useData();
  return {
    goals: goals as Goal[],
    isLoading: !dataReady,
    error: null as Error | null,
    refetch: async () => {
      /* no-op; real-time listener keeps it fresh */
    },
  };
}

export function useGoalMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    // Belt-and-suspenders: invalidate the cache for any legacy callers.
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  };

  const addGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) => goalsAPI.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("Goal added!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add goal"),
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      goalsAPI.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Goal updated!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => goalsAPI.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Goal deleted!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  return { addGoal, updateGoal, deleteGoal };
}
