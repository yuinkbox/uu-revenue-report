import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  subtitle,
  icon,
  children,
  className,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("shadow-xs", className)}>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-5">
        {icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted/60 text-foreground/80">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
