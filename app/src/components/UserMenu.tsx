"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { LogOut, LogIn, ChevronDown, CalendarDays } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ViewingsModal } from "@/components/ViewingsModal";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [showViewings, setShowViewings] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
        title="Sign in with Google"
      >
        <LogIn className="h-4 w-4" />
        <span>Sign in</span>
      </button>
    );
  }

  const { user } = session;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-muted transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "ring-2 ring-muted"
        )}
        title={user?.name ?? "Account"}
      >
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "User avatar"}
            width={28}
            height={28}
            className="rounded-full"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
            {initials}
          </div>
        )}
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border bg-background shadow-lg z-50 overflow-hidden">
          {/* User info */}
          <div className="px-3 py-2.5 border-b">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>

          {/* My Viewings */}
          <button
            onClick={() => { setOpen(false); setShowViewings(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            My Viewings
          </button>

          {/* Sign out */}
          <button
            onClick={() => { setOpen(false); void signOut(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}

      <ViewingsModal open={showViewings} onClose={() => setShowViewings(false)} />
    </div>
  );
}
