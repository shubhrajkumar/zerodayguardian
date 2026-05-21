import { useEffect, useState } from "react";
import {
  isFirebaseConfigured,
  isFirebaseDiagnosticsEnabled,
  runFirestoreConnectionTest,
  type FirestoreConnectionTestResult,
} from "@/lib/firebase";

type BadgeState = "checking" | "connected" | "error";

const FirebaseStatusBadge = () => {
  const [status, setStatus] = useState<BadgeState>("checking");
  const [details, setDetails] = useState("Running Firestore connectivity check...");
  const isVisible = isFirebaseConfigured && isFirebaseDiagnosticsEnabled;

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;

    runFirestoreConnectionTest().then((result: FirestoreConnectionTestResult) => {
      if (cancelled) return;

      if (result.ok) {
        setStatus("connected");
        setDetails(result.documentPath ? `Connected: ${result.documentPath}` : "Connected");
        return;
      }

      setStatus("error");
      setDetails(result.reason ? `Issue: ${result.reason}` : "Firestore test failed");
    });

    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const accentClass =
    status === "connected"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
      : status === "error"
        ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
        : "border-cyan-400/40 bg-cyan-500/10 text-cyan-100";

  const dotClass =
    status === "connected"
      ? "bg-emerald-300"
      : status === "error"
        ? "bg-rose-300"
        : "bg-cyan-300";

  return (
    <div className="pointer-events-none fixed left-4 top-20 z-[120] hidden max-w-[calc(100vw-2rem)] lg:block">
      <div className={`rounded-2xl border px-3 py-2 shadow-[0_12px_30px_rgba(2,6,23,0.28)] backdrop-blur ${accentClass}`}>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
          <span className={`h-2 w-2 rounded-full ${dotClass} ${status === "checking" ? "animate-pulse" : ""}`} />
          Firebase
        </div>
        <p className="mt-1 text-xs leading-5 text-inherit/90">{details}</p>
      </div>
    </div>
  );
};

export default FirebaseStatusBadge;
