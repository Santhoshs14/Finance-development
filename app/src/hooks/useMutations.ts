"use client";

import { useMutation } from "@tanstack/react-query";
import { transactionsAPI, accountsAPI } from "@/services/api";
import toast from "react-hot-toast";

/**
 * Optimistic transaction mutations.
 * Since DataProvider uses onSnapshot (real-time), the confirmed state
 * will arrive shortly after mutation success. These hooks provide
 * immediate toast feedback and handle errors gracefully.
 */
export function useTransactionMutations() {
  const addTransaction = useMutation({
    mutationFn: (data: unknown) =>
      transactionsAPI.create(data as Parameters<typeof transactionsAPI.create>[0]),
    onSuccess: () => toast.success("Transaction added!"),
    onError: (err: Error) => toast.error(err.message || "Failed to add transaction"),
  });

  const updateTransaction = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      transactionsAPI.update(id, data as Parameters<typeof transactionsAPI.update>[1]),
    onSuccess: () => toast.success("Transaction updated!"),
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => transactionsAPI.delete(id),
    onSuccess: () => toast.success("Transaction deleted!"),
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  return { addTransaction, updateTransaction, deleteTransaction };
}

export function useAccountMutations() {
  const addAccount = useMutation({
    mutationFn: (data: unknown) =>
      accountsAPI.create(data as Parameters<typeof accountsAPI.create>[0]),
    onSuccess: () => toast.success("Account added!"),
    onError: (err: Error) => toast.error(err.message || "Failed to add account"),
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      accountsAPI.update(id, data as Parameters<typeof accountsAPI.update>[1]),
    onSuccess: () => toast.success("Account updated!"),
    onError: (err: Error) => toast.error(err.message || "Failed to update"),
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => accountsAPI.delete(id),
    onSuccess: () => toast.success("Account deleted!"),
    onError: (err: Error) => toast.error(err.message || "Failed to delete"),
  });

  return { addAccount, updateAccount, deleteAccount };
}
