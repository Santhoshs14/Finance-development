"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { netWorthAPI } from "@/services/api";

export interface NetWorthSnapshot {
  id: string;
  month: string;
  accounts: number;
  investments: number;
  cc_outstanding: number;
  lent: number;
  borrowed: number;
  net_worth: number;
  updatedAt?: string;
}

export function useNetWorthHistory() {
  const qc = useQueryClient();

  const { data: snapshots = [], isLoading } = useQuery<NetWorthSnapshot[]>({
    queryKey: ["netWorthSnapshots"],
    queryFn: () => netWorthAPI.getSnapshots(12),
    staleTime: 1000 * 60 * 5,
  });

  const saveMutation = useMutation({
    mutationFn: netWorthAPI.saveSnapshot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["netWorthSnapshots"] });
    },
  });

  return { snapshots, isLoading, saveSnapshot: saveMutation.mutate };
}
