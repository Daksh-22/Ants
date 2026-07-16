"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Users, ShieldCheck, Loader2, Check, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { cn } from "@/lib/utils/cn";
import { executeProtectedTrade, WS_BASE } from "@/lib/api/portfolio";

interface MomentumSpike {
  id: string;
  sector: string;
  volume_multiplier: number;
  ants_accumulating: number;
  technical_context: string;
  timestamp: string;
}

const RECONNECT_STEPS_MS = [2000, 4000, 8000, 16000, 30000];

export function SwarmRadar() {
  const [spikes, setSpikes] = useState<MomentumSpike[]>([]);
  const [expired, setExpired] = useState<MomentumSpike[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<string[]>([]);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUsRef = useRef(false);

  const handleExecute = async (id: string, sector: string) => {
    setExecutingId(id);
    try {
      await executeProtectedTrade(sector);
      setExecutedIds((prev) => [...prev, id]);
    } catch {
      // silent — the button reverts and the user can retry
    } finally {
      setExecutingId(null);
    }
  };

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = () => {
      setStatus((s) => (s === "live" ? s : "connecting"));
      ws = new WebSocket(`${WS_BASE}/ws/swarm-radar`);

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("live");
      };

      ws.onclose = () => {
        if (closedByUsRef.current) return;
        setStatus("offline");
        const delay = RECONNECT_STEPS_MS[Math.min(retryRef.current, RECONNECT_STEPS_MS.length - 1)];
        retryRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event === "MOMENTUM_SPIKE") {
            const newSpike: MomentumSpike = {
              id: Math.random().toString(36).substr(2, 9),
              ...payload.data,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            };

            setSpikes((prev) => {
              const next = [newSpike, ...prev];
              if (next.length > 3) {
                // the oldest spike falls off — keep one greyed "expired" trace
                // instead of vanishing without a whisper (the FOMO tease)
                const dropped = next[3];
                setExpired((exp) => [dropped, ...exp].slice(0, 1));
              }
              return next.slice(0, 3);
            });
          }
        } catch {
          // malformed payload — skip it
        }
      };
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      ws?.close();
    };
  }, []);

  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <SectionLabel>Live Swarm Radar</SectionLabel>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "relative flex h-2.5 w-2.5",
              status === "live" ? "text-teal" : status === "connecting" ? "text-amber" : "text-red"
            )}
          >
            {status === "live" && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
            )}
            <span
              className={cn(
                "relative inline-flex h-2.5 w-2.5 rounded-full",
                status === "live" ? "bg-teal" : status === "connecting" ? "bg-amber" : "bg-red"
              )}
            />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{status}</span>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {spikes.length === 0 && status === "live" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-strong bg-surface/60 px-5 py-8 text-center opacity-70"
            >
              <Activity size={22} className="animate-pulse text-gold" />
              <p className="text-[13px] text-muted">Scanning market for volume breakouts...</p>
            </motion.div>
          )}

          {status === "offline" && (
            <motion.div
              key="offline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-red/30 bg-red-dim px-5 py-8 text-center"
            >
              <WifiOff size={22} className="text-red" />
              <p className="text-[13px] text-red">Radar offline — reconnecting…</p>
            </motion.div>
          )}

          {spikes.map((spike) => (
            <motion.div
              key={spike.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Card className="relative overflow-hidden border-l-[3px] border-purple">
                <motion.div
                  initial={{ opacity: 0.15 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="pointer-events-none absolute inset-0 bg-purple"
                />

                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-primary">{spike.sector}</span>
                      <Badge tone="purple" size="sm">Volume {spike.volume_multiplier}x</Badge>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-snug text-secondary">
                      {spike.technical_context}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted">{spike.timestamp}</span>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-strong pt-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
                    <Users size={14} strokeWidth={2.5} className="text-teal" />
                    <span>{spike.ants_accumulating} ants buying</span>
                  </div>

                  {executedIds.includes(spike.id) ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-teal-dim px-3 py-1.5 text-[12px] font-bold text-teal">
                      <Check size={14} strokeWidth={3} />
                      Executing + 8% TSL
                    </span>
                  ) : (
                    <button
                      onClick={() => handleExecute(spike.id, spike.sector)}
                      disabled={executingId === spike.id}
                      className="flex items-center gap-1.5 rounded-full fill-gold-gradient px-4 py-1.5 text-[12px] font-bold text-ink shadow-cta transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
                    >
                      {executingId === spike.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} strokeWidth={2.5} />
                      )}
                      Ride the Swarm
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}

          {expired.map((spike) => (
            <motion.div
              key={`expired-${spike.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.55 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between rounded-xl bg-surface px-3.5 py-2.5"
            >
              <span className="text-[12px] text-muted">
                {spike.sector} · expired · {spike.ants_accumulating} ants rode it
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
