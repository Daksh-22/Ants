"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Zap, Users, ShieldCheck, Loader2, Check } from "lucide-react";
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

export function SwarmRadar() {
  const [spikes, setSpikes] = useState<MomentumSpike[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<string[]>([]);

  const handleExecute = async (id: string, sector: string) => {
    setExecutingId(id);
    try {
      const result = await executeProtectedTrade(sector);
      console.log("Trade Executed:", result);
      setExecutedIds(prev => [...prev, id]);
    } catch (e) {
      alert("Trade failed. Check backend.");
    } finally {
      setExecutingId(null);
    }
  };

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/swarm-radar`);

    ws.onopen = () => setStatus("live");
    ws.onclose = () => setStatus("offline");
    ws.onerror = () => setStatus("offline");

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "MOMENTUM_SPIKE") {
          const newSpike: MomentumSpike = {
            id: Math.random().toString(36).substr(2, 9),
            ...payload.data,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          };
          
          setSpikes((prev) => [newSpike, ...prev].slice(0, 3));
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <section className="mt-7">
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Live Swarm Radar</SectionLabel>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "relative flex h-2.5 w-2.5",
            status === "live" ? "text-teal" : status === "connecting" ? "text-amber" : "text-red"
          )}>
            {status === "live" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
            )}
            <span className={cn(
              "relative inline-flex rounded-full h-2.5 w-2.5",
              status === "live" ? "bg-teal" : status === "connecting" ? "bg-amber" : "bg-red"
            )}></span>
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {status}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {spikes.length === 0 && status === "live" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-strong bg-surface/60 px-5 py-8 text-center opacity-70"
            >
              <Activity size={22} className="text-gold animate-pulse" />
              <p className="text-[13px] text-muted">Scanning market for volume breakouts...</p>
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
              <Card className="border-l-[3px] border-purple relative overflow-hidden">
                <motion.div 
                  initial={{ opacity: 0.15 }} 
                  animate={{ opacity: 0 }} 
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-0 bg-purple pointer-events-none" 
                />
                
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-primary">{spike.sector}</span>
                      <Badge tone="purple" size="sm">Volume {spike.volume_multiplier}x</Badge>
                    </div>
                    <p className="mt-1.5 text-[13px] text-secondary leading-snug">
                      {spike.technical_context}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted whitespace-nowrap">{spike.timestamp}</span>
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
                      className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-[12px] font-bold text-ink transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
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
        </AnimatePresence>
      </div>
    </section>
  );
}