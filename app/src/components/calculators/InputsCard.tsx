"use client";

import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface InputsCardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function InputsCard({ title = "Inputs", action, children }: InputsCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
