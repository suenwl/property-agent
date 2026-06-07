"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SendHorizonal, Bot, User, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, PropertyDoc } from "@/types";

interface PropertyChatProps {
  property: PropertyDoc;
}

const STARTER_PROMPTS = [
  "Is this property priced fairly?",
  "What factors are driving this listing's price?",
  "What would be a fair price for this property?",
];

export function PropertyChat({ property }: PropertyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset conversation whenever a different property is opened
  useEffect(() => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setConversationId(null);
  }, [property._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const newHistory = [...messages, userMessage];
      setMessages(newHistory);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat/valuation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            conversationId,
            property,
          }),
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

        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, conversationId, property]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center py-2">
                Ask the agent to evaluate this listing
              </p>
              <div className="flex flex-col gap-1.5">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    disabled={isLoading}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-dashed hover:bg-muted/60 hover:border-solid transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs prose-neutral max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2 flex-row">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3 w-3" />
              </div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-2 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about this property…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 h-8 text-xs"
          />
          <Button
            size="icon"
            className="h-8 w-8"
            onClick={() => void sendMessage(input)}
            disabled={isLoading || !input.trim()}
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Re-export icon so PropertyModal can use it without an extra import
export { Sparkles };
