"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { askAnts, type ChatSource } from "@/lib/api/portfolio";
import { recordActivity } from "@/lib/gamification/dailyActivity";
import { Badge } from "@/components/ui/Badge";
import type { Analysis } from "@/lib/analysis/types";
import { cn } from "@/lib/utils/cn";

interface Message {
  role: "user" | "ants";
  text: string;
  sources?: ChatSource[];
  failed?: boolean;
}

const SUGGESTIONS = [
  "What should I fix first?",
  "Is my portfolio too concentrated?",
  "Direct vs regular plans?",
];

/**
 * Ask Ants — the AI assistant. Floating gold button on results; opens a chat
 * sheet. Answers come from the backend: Claude grounded in the RAG knowledge
 * base + this user's actual analysis. Offline → a retryable error bubble.
 */
export function AskAnts({ analysis }: { analysis: Analysis }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }));
    try {
      const reply = await askAnts(q, analysis);
      recordActivity("chat");
      setMessages((m) => [...m, { role: "ants", text: reply.answer, sources: reply.sources }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "ants", text: "Ants is catching its breath — the brain's offline right now.", failed: true },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }));
    }
  };

  const retry = (question: string) => {
    setMessages((m) => m.filter((msg) => !(msg.role === "ants" && msg.failed)));
    send(question);
  };

  return (
    <>
      {/* floating button — pinned to the 430px column, not the raw viewport */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-full max-w-app px-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          aria-label="Ask Ants"
          className="pointer-events-auto ml-auto flex items-center gap-2 rounded-full fill-gold-gradient px-4 py-3 text-[14px] font-bold text-ink shadow-cta"
        >
          <Sparkles size={17} strokeWidth={2.4} />
          Ask Ants
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/60"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="glass fixed inset-x-0 bottom-0 z-[60] mx-auto flex h-[72vh] w-full max-w-app flex-col rounded-t-3xl"
            >
              {/* header */}
              <div className="flex items-center justify-between px-6 pb-3 pt-4">
                <p className="flex items-center gap-2 text-[16px] font-bold text-primary">
                  <Sparkles size={16} className="text-gold" />
                  Ask Ants
                </p>
                <button onClick={() => setOpen(false)} aria-label="Close" className="-m-1 p-1 text-muted">
                  <X size={20} strokeWidth={2.4} />
                </button>
              </div>

              {/* messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 pb-3">
                {messages.length === 0 && (
                  <div className="pt-2">
                    <p className="text-[13px] leading-relaxed text-secondary">
                      Ask anything about your portfolio or investing. Answers use your actual
                      holdings and the Ants knowledge base.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium text-gold"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => {
                  const priorUserQuestion = m.failed
                    ? [...messages.slice(0, i)].reverse().find((p) => p.role === "user")?.text
                    : undefined;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 340, damping: 28 }}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                          m.role === "user"
                            ? "bg-gold-dim text-primary"
                            : m.failed
                              ? "bg-red-dim text-red"
                              : "card-sheen text-secondary"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {m.failed && priorUserQuestion && (
                          <button
                            onClick={() => retry(priorUserQuestion)}
                            className="mt-2 text-[12px] font-bold text-gold underline underline-offset-2"
                          >
                            Try again
                          </button>
                        )}
                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[...new Map(m.sources.map((s) => [s.source, s])).values()].map((s) => (
                              <Badge key={s.source} tone="neutral" size="sm">
                                {s.source}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {busy && (
                  <div className="flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-gold"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 border-t border-subtle px-4 py-3 pb-5"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your money…"
                  className="flex-1 rounded-xl border border-subtle bg-surface px-4 py-3 text-[15px] text-primary outline-none placeholder:text-muted focus:border-strong"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl fill-gold-gradient text-ink disabled:opacity-40"
                >
                  <Send size={18} strokeWidth={2.4} />
                </motion.button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
