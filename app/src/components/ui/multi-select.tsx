"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  allLabel: string;
  /** Noun used in the "N <countLabel> selected" label, e.g. "towns" */
  countLabel?: string;
  className?: string;
}

export function MultiSelectFilter({
  options,
  value,
  onChange,
  placeholder,
  allLabel,
  countLabel,
  className,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const triggerLabel =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? value[0]
      : countLabel
      ? `${value.length} ${countLabel} selected`
      : `${value.length} selected`;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-7 py-2 pr-2 pl-2.5 text-xs flex items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent whitespace-nowrap transition-colors outline-none select-none w-full cursor-default"
      >
        <span className={cn("truncate flex-1 text-left", value.length === 0 && "text-muted-foreground")}>
          {triggerLabel}
        </span>
        {value.length > 0 ? (
          <X
            className="size-4 shrink-0 text-muted-foreground pointer-events-auto cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground pointer-events-none" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover text-popover-foreground rounded-lg shadow-md ring-1 ring-foreground/10 py-1 min-w-full w-max max-w-[220px] max-h-64 overflow-y-auto">
          <button
            type="button"
            className="w-full text-left px-1.5 py-1 pr-8 text-sm cursor-default hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 rounded-md"
            onClick={() => { onChange([]); setOpen(false); }}
          >
            <span className="size-4 shrink-0" />
            {allLabel}
          </button>
          {options.map((opt) => {
            const selected = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                className="w-full text-left px-1.5 py-1 pr-8 text-sm cursor-default hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 rounded-md"
                onClick={() => toggle(opt.value)}
              >
                <Check
                  className={cn(
                    "size-4 shrink-0 transition-opacity",
                    selected ? "opacity-100" : "opacity-0"
                  )}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
