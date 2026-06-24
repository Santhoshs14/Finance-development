"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sipsAPI } from "@/services/api";
import { useData, useDataset } from "@/providers/DataProvider";
import type { SipDoc } from "@/schemas";
import toast from "react-hot-toast";

/** Live SIP-schedules subscription via DataProvider (lazy dataset). */
export function useSips() {
  useDataset("sips");
  const { sips, dataReady } = useData();
  return {
    sips: sips as unknown as SipDoc[],
    isLoading: !dataReady,
    error: null as Error | null,
  };
}

export function useSipMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["sips"] });

  const addSip = useMutation({
    mutationFn: (data: Record<string, unknown>) => sipsAPI.create(data),
    onSuccess: () => {
      invalidate();
      toast.success("SIP created!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create SIP"),
  });

  const updateSip = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      sipsAPI.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("SIP updated!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update SIP"),
  });

  const deleteSip = useMutation({
    mutationFn: (id: string) => sipsAPI.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success("SIP deleted!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete SIP"),
  });

  const investNow = useMutation({
    mutationFn: (id: string) => sipsAPI.executeNow(id),
    onSuccess: () => {
      invalidate();
      toast.success("SIP invested!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to invest"),
  });

  return { addSip, updateSip, deleteSip, investNow };
}
