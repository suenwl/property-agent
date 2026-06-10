"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, MapPin, ExternalLink, Loader2, Trash2 } from "lucide-react";

interface ViewingEvent {
  id: string;
  summary: string;
  location: string;
  startIso: string;
  startLabel: string;
  htmlLink: string;
}

interface ViewingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function ViewingsModal({ open, onClose }: ViewingsModalProps) {
  const [viewings, setViewings] = useState<ViewingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch("/api/calendar/viewings")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch viewings");
        const data = await res.json() as { viewings: ViewingEvent[] };
        setViewings(data.viewings);
      })
      .catch(() => setError("Could not load viewings. Please try again."))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleCancel(eventId: string) {
    setCancelling(eventId);
    // Optimistic removal
    setViewings((prev) => prev.filter((v) => v.id !== eventId));
    try {
      const res = await fetch("/api/calendar/viewings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
    } catch {
      // Restore on failure
      setError("Failed to cancel viewing. Please try again.");
      setViewings((prev) => {
        // Re-fetch to restore accurate state
        fetch("/api/calendar/viewings")
          .then(async (r) => {
            if (r.ok) {
              const d = await r.json() as { viewings: ViewingEvent[] };
              setViewings(d.viewings);
            }
          })
          .catch(() => null);
        return prev;
      });
    } finally {
      setCancelling(null);
    }
  }

  // Strip the "Property Viewing: " prefix for display
  function getPropertyName(summary: string): string {
    return summary.replace(/^Property Viewing:\s*/i, "");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="sm:max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            My Viewings
          </DialogTitle>
        </DialogHeader>

        <div className="mt-1 min-h-[120px]">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">Loading viewings…</span>
            </div>
          )}

          {!loading && error && (
            <p className="text-sm text-destructive text-center py-8">{error}</p>
          )}

          {!loading && !error && viewings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Calendar className="h-8 w-8 opacity-30" />
              <p className="text-sm">No upcoming viewings scheduled.</p>
            </div>
          )}

          {!loading && !error && viewings.length > 0 && (
            <ul className="space-y-2">
              {viewings.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium truncate">{getPropertyName(v.summary)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {v.startLabel}
                    </p>
                    {v.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{v.location}</span>
                      </p>
                    )}
                    {v.htmlLink && (
                      <a
                        href={v.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View in Google Calendar
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => handleCancel(v.id)}
                    disabled={cancelling === v.id}
                    title="Cancel viewing"
                    className="shrink-0 mt-0.5 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    {cancelling === v.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
