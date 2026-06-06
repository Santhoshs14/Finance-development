"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { investmentsAPI } from "@/services/api";
import { useData } from "@/providers/DataProvider";
import { Investment } from "@/utils/calculations";
import toast from "react-hot-toast";

/**
 * Live investments subscription via DataProvider.
 */
export function useInvestments() {
  const { investments, dataReady } = useData();
  return {
    investments: investments as Investment[],
    isLoading: !dataReady,
    error: null as Error | null,
    refetch: async () => {
      /* no-op; real-time listener keeps it fresh */
    },
  };
}

export function useInvestmentMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["investments"] });

  const addInvestment = useMutation({
    mutationFn: (data: Record<string, unknown>) => investmentsAPI.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("Investment added!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add investment"),
  });

  const updateInvestment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      investmentsAPI.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Investment updated!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  });

  const deleteInvestment = useMutation({
    mutationFn: (id: string) => investmentsAPI.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("Investment deleted!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  return { addInvestment, updateInvestment, deleteInvestment };
}
