import { redirect } from "next/navigation";

export default function BudgetsRedirect() {
  redirect("/spending/budgets");
}
