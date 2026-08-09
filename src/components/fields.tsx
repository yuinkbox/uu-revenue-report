import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Num } from "@/types/report";

export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label className="text-[13px] font-medium text-foreground/90">
        {required ? <span className="mr-0.5 text-destructive">*</span> : null}
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  placeholder = "0.00",
  step = "0.01",
  min = "0",
  disabled = false,
  className,
}: {
  value: Num | null;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      type="number"
      className={cn("nums h-9 bg-card", className)}
      value={value === "" || value === null ? "" : value}
      placeholder={placeholder}
      step={step}
      min={min}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      type="text"
      className={cn("h-9 bg-card", className)}
      value={value || ""}
      placeholder={placeholder || ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export type SelectOption = string | { value: string; label: string };

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-9 w-full bg-card", className)}>
        <SelectValue placeholder={placeholder || "请选择"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => {
          const optionValue = typeof opt === "string" ? opt : opt.value;
          const optionLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
