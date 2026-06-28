"use client";

import { useState } from "react";
import { useAppState } from "@/components/app/AppState";
import { UploadEmptyState } from "@/components/home/UploadEmptyState";
import { Processing } from "@/components/home/Processing";
import { Results } from "@/components/home/Results";

/**
 * /home is a small state machine:
 *   not analyzed  → UploadEmptyState (no bottom nav)
 *   uploading     → Processing (2.2s, no bottom nav)
 *   analyzed      → Results (bottom nav appears)
 * Returning users (analyzed persisted in localStorage) land straight on Results.
 */
export default function HomePage() {
  const { analyzed, hydrated, setAnalyzed } = useAppState();
  const [processing, setProcessing] = useState(false);

  // avoid an empty→results flash before localStorage is read
  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-base">
        <span className="text-[20px] font-extrabold text-gold">Ants</span>
      </div>
    );
  }

  if (processing) {
    return (
      <Processing
        onDone={() => {
          setProcessing(false);
          setAnalyzed(true);
        }}
      />
    );
  }

  if (analyzed) {
    return <Results />;
  }

  return <UploadEmptyState onStart={() => setProcessing(true)} />;
}
