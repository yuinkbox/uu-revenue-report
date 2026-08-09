import { useMemo, useState } from "react";
import { Check, CornerDownLeft, PackageSearch } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/types/report";

export default function ProductCombobox({
  value,
  onChange,
  onCategoryChange,
  catalog,
}: {
  value: string;
  onChange: (v: string) => void;
  onCategoryChange?: (v: string) => void;
  catalog: CatalogProduct[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of catalog) {
      const key = p.category || "其他";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()];
  }, [catalog]);

  const trimmed = search.trim();
  const exactMatch = catalog.some((p) => p.name === trimmed);

  function pick(name: string, category?: string) {
    onChange(name);
    if (category && onCategoryChange) onCategoryChange(category);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full min-w-[150px] items-center gap-2 rounded-md border bg-card px-2.5 text-left text-sm shadow-xs transition-colors",
            "hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          )}
        >
          <PackageSearch className="size-3.5 shrink-0 text-muted-foreground" />
          <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
            {value || "选择或输入商品"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索商品，或直接输入新名称"
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed) {
                e.preventDefault();
                const hit = catalog.find((p) => p.name === trimmed);
                pick(trimmed, hit?.category);
              }
            }}
          />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
              目录里没有匹配的商品
            </CommandEmpty>
            {trimmed && !exactMatch ? (
              <CommandGroup heading="自定义">
                <CommandItem value={`__custom__${trimmed}`} onSelect={() => pick(trimmed)}>
                  <CornerDownLeft className="size-3.5 text-muted-foreground" />
                  <span className="truncate">使用「{trimmed}」</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {grouped.map(([category, items]) => (
              <CommandGroup key={category} heading={category}>
                {items.map((p) => (
                  <CommandItem
                    key={p.name}
                    value={p.name}
                    onSelect={() => pick(p.name, p.category)}
                  >
                    <Check className={cn("size-3.5", value === p.name ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
