"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { FiltersPanel } from "@/components/FiltersPanel";
import { PropertyList } from "@/components/PropertyList";
import { PropertyModal } from "@/components/PropertyModal";
import type { ChatMessage, FilterState, PropertyDoc } from "@/types";

// Map must be dynamically imported — Leaflet requires browser APIs
const MapView = dynamic(
  () => import("@/components/MapView").then((m) => m.MapView),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted animate-pulse" /> }
);

const EMPTY_FILTERS: FilterState = {
  listing_type: null,
  property_category: null,
  bedrooms_min: null,
  bedrooms_max: null,
  price_per_month_min: null,
  price_per_month_max: null,
  price_min: null,
  price_max: null,
  town: null,
  furnishing: null,
  pets_allowed: null,
  size_sqft_min: null,
  flat_type: null,
  built_year_min: null,
  built_year_max: null,
};

export default function SearchPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  // Elastic Agent Builder manages history server-side; we just track the conversation_id
  const [conversationId, setConversationId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [properties, setProperties] = useState<PropertyDoc[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState<PropertyDoc | null>(null);

  // Run a property search with the given filters
  const runSearch = useCallback(async (f: FilterState) => {
    setIsSearchLoading(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (res.ok) {
        const data = await res.json();
        setProperties(data.hits);
        setTotalCount(data.total);
      }
    } finally {
      setIsSearchLoading(false);
    }
  }, []);

  // Load all properties on first render.
  // Fetch is written inline so setState calls only happen in async .then() callbacks,
  // which satisfies the react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(EMPTY_FILTERS),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setProperties(data.hits);
        setTotalCount(data.total);
      });
    return () => { cancelled = true; };
  }, []);

  const handleChatSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId }),
      });

      if (!res.ok) {
        setMessages([
          ...newHistory,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
          },
        ]);
        return;
      }

      const data = await res.json();

      setMessages([
        ...newHistory,
        { role: "assistant", content: data.reply },
      ]);

      // Store the conversation_id for subsequent turns
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (data.filters) {
        // Merge agent-extracted filters with current (null values = no change)
        const merged: FilterState = { ...filters };
        for (const key of Object.keys(data.filters) as (keyof FilterState)[]) {
          if (data.filters[key] !== null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (merged as any)[key] = data.filters[key];
          }
        }
        setFilters(merged);
        runSearch(merged);
      }
    } finally {
      setIsChatLoading(false);
    }
  }, [input, isChatLoading, messages, filters, runSearch, conversationId]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left panel — Chat */}
      <div className="w-[380px] flex-shrink-0 flex flex-col border-r">
        {/* Nav */}
        <div className="flex items-center px-4 h-12 border-b bg-background">
          <span className="font-semibold text-sm tracking-tight">
            PropertyAgent
          </span>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            input={input}
            isLoading={isChatLoading}
            onInputChange={setInput}
            onSubmit={handleChatSubmit}
          />
        </div>
      </div>

      {/* Right panel — Filters + Map/List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filters bar */}
        <FiltersPanel
          filters={filters}
          resultCount={totalCount ?? properties.length}
          onFilterChange={(f) => {
            setFilters(f);
            void runSearch(f);
          }}
          onClearFilters={() => {
            setFilters(EMPTY_FILTERS);
            void runSearch(EMPTY_FILTERS);
          }}
        />

        {/* Map + List — always side by side */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map — isolation:isolate keeps Leaflet z-indices from escaping the container */}
          <div className="flex-1 overflow-hidden" style={{ isolation: "isolate" }}>
            <MapView
              properties={properties}
              selectedId={selectedProperty?._id ?? null}
              onSelect={(p) => setSelectedProperty(p)}
            />
          </div>

          {/* Property list */}
          <div className="w-[360px] flex-shrink-0 border-l overflow-hidden">
            <PropertyList
              properties={properties}
              selectedId={selectedProperty?._id ?? null}
              isLoading={isSearchLoading}
              onSelect={(p) => setSelectedProperty(p)}
            />
          </div>
        </div>
      </div>

      {/* Property detail modal */}
      <PropertyModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
      />
    </div>
  );
}
