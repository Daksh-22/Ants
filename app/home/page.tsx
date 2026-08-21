"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, RotateCw, PenLine } from "lucide-react";
import { useAppState } from "@/components/app/AppState";
import { UploadEmptyState } from "@/components/home/UploadEmptyState";
import { Processing } from "@/components/home/Processing";
import { Results } from "@/components/home/Results";
import { Button } from "@/components/ui/Button";
import { ApiTimeoutError } from "@/lib/api/portfolio";
import type { Analysis } from "@/lib/analysis/types";

/**
 * /home is a small state machine:
 *   not analyzed  → UploadEmptyState (no bottom nav)
 *   processing    → Processing (waits on the real fetch, never fades blank)
 *   failed        → AnalysisFailed (retry, with the user's input intact)
 *   analyzed      → Results (bottom nav appears)
 *
 * On failure this used to substitute the built-in demo analysis: a user who
 * had just typed their real holdings was shown a stranger's ₹104,019 book with
 * flags about stocks they don't own, behind a small "showing a demo portfolio"
 * strip. Worse, the Retry on that strip called reset(), which wiped the saved
 * positions — so "retry" meant "retype your entire portfolio". Failures now
 * surface as failures, and the retry re-runs the same request.
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeRoute />
    </Suspense>
  );
}

function HomeRoute() {
  const { analyzed, analysis, hydrated, setAnalyzed, setAnalysis } = useAppState();
  const router = useRouter();
  const params = useSearchParams();

  // ?edit=1 drops the user back into the entry form with their existing rows
  // restored, instead of forcing a destructive reset + full retype to fix one
  // quantity. Consumed once so a refresh doesn't strand them in edit mode.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (params.get("edit") === "1") {
      setEditing(true);
      router.replace("/home");
    }
  }, [params, router]);
  const [processing, setProcessing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const resultRef = useRef<Analysis | null>(null);
  const pendingRef = useRef<Promise<void> | null>(null);
  // kept so Retry re-runs the same request instead of discarding the input
  const lastFetcherRef = useRef<(() => Promise<Analysis>) | null>(null);

  // Each attempt gets a number, and only the newest one may touch state.
  // Cancel and Retry both leave the previous request in flight — nothing
  // aborts it — so a superseded attempt would still resolve later and write
  // over the current screen. The 45s client timeout made that routine: cancel
  // a cold-start request, retry, succeed, and half a minute later the old
  // attempt's rejection replaced the rendered Results with a dead-end error
  // while the analysis sat correctly saved in /portfolio.
  const runIdRef = useRef(0);

  const start = (fetcher: () => Promise<Analysis>) => {
    const runId = ++runIdRef.current;
    resultRef.current = null;
    lastFetcherRef.current = fetcher;
    setFailure(null);
    pendingRef.current = fetcher()
      .then((a) => {
        if (runId !== runIdRef.current) return;
        resultRef.current = a;
      })
      .catch((err: unknown) => {
        if (runId !== runIdRef.current) return;
        resultRef.current = null;
        setFailure(
          err instanceof ApiTimeoutError
            ? "The server took too long to answer. It may have been asleep — trying again usually works."
            : err instanceof Error && err.message
              ? err.message
              : "We couldn't reach the server."
        );
      });
    setProcessing(true);
  };

  const finish = () => {
    setProcessing(false);
    if (!resultRef.current) return; // failure state renders instead
    setFailure(null);
    setAnalysis(resultRef.current, false);
    setAnalyzed(true);
  };

  const retry = () => {
    if (lastFetcherRef.current) start(lastFetcherRef.current);
  };

  // avoid an empty→results flash before localStorage is read
  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-[55] flex items-center justify-center bg-base">
        <span className="text-[20px] font-extrabold text-gold">Sift</span>
      </div>
    );
  }

  if (processing) {
    return (
      <Processing
        onDone={finish}
        waitFor={pendingRef.current ?? undefined}
        onCancel={() => {
          // Retire this attempt so its later resolution can't overwrite the
          // cancellation notice with a timeout message the user never caused.
          runIdRef.current += 1;
          resultRef.current = null;
          setProcessing(false);
          setFailure("Cancelled. Your positions are still saved.");
        }}
      />
    );
  }

  if (failure) {
    return (
      <AnalysisFailed
        message={failure}
        onRetry={retry}
        onEdit={() => {
          setFailure(null);
          lastFetcherRef.current = null;
          // Without this, "Edit what I entered" cleared the error and fell
          // through to whichever branch matched next: a returning user landed
          // back on the STALE previous Results with their edits nowhere in
          // sight, and a first-timer got the upload/manual chooser instead of
          // the form they had just filled in.
          setEditing(true);
        }}
      />
    );
  }

  // `analyzed` and `analysis` are two separate localStorage keys, so they can
  // disagree: a partial write, or a payload AppState's shape guard rejects on
  // hydration, leaves analyzed=true with analysis=null. Results used to paper
  // over that with the demo portfolio. Now the flag alone is not enough —
  // without the actual analysis we fall through to the upload state, which is
  // the honest thing to show someone who has no readable portfolio.
  if (analyzed && analysis && !editing) {
    return <Results analysis={analysis} />;
  }

  return (
    <UploadEmptyState
      onStart={(f) => {
        setEditing(false);
        start(f);
      }}
      startInManualEntry={editing}
      onExitEdit={editing ? () => setEditing(false) : undefined}
    />
  );
}

/**
 * Honest dead-end recovery. Both routes out keep the user's work: Retry
 * re-issues the same analysis, and "Edit what I entered" returns to the form,
 * which restores the last submitted rows from localStorage.
 */
function AnalysisFailed({
  message,
  onRetry,
  onEdit,
}: {
  message: string;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-base">
      <div className="mx-auto flex min-h-full max-w-app flex-col justify-center px-6 py-10">
        <div className="flex items-center gap-2.5">
          <AlertTriangle size={20} className="shrink-0 text-amber" />
          <h1 className="text-[20px] font-bold text-primary">That didn&apos;t go through</h1>
        </div>
        <p className="mt-2.5 text-[14px] leading-relaxed text-secondary">{message}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Nothing was lost — your positions are still saved.
        </p>

        <div className="mt-7 space-y-2.5">
          <Button onClick={onRetry} className="w-full">
            <RotateCw size={16} strokeWidth={2.4} />
            Try again
          </Button>
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface px-6 py-3.5 text-[14px] font-semibold text-secondary transition-colors hover:bg-elevated"
          >
            <PenLine size={15} strokeWidth={2.4} />
            Edit what I entered
          </button>
        </div>
      </div>
    </div>
  );
}
