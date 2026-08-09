import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
  hint?: string;
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "nums mt-1 truncate text-[22px] font-semibold leading-7 tracking-tight",
              tone === "success" && "text-emerald-600",
              tone === "danger" && "text-destructive",
              tone === "warning" && "text-amber-600",
            )}
          >
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground">
            {icon}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
