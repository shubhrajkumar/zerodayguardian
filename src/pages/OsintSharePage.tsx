import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGetJson } from "@/lib/apiClient";

const OsintSharePage = () => {
  const { shareId } = useParams();
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareId) return;
    apiGetJson(`/api/osint/share/${shareId}`)
      .then((res) => setPayload(res))
      .catch((err) => setError(err?.message || "Unable to load shared case."));
  }, [shareId]);

  if (error) {
    return <div className="container mx-auto px-4 py-12 text-sm text-muted-foreground">{error}</div>;
  }

  if (!payload?.case) {
    return <div className="container mx-auto px-4 py-12 text-sm text-muted-foreground">Loading shared case...</div>;
  }

  const { case: shared } = payload;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-6">
        <h1 className="text-2xl font-bold text-white">{shared.title}</h1>
        <p className="mt-1 text-sm text-slate-300">Target: {shared.target}</p>
        {shared.folder ? <p className="text-xs text-slate-400">Folder: {shared.folder}</p> : null}
        {Array.isArray(shared.tags) && shared.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {shared.tags.map((tag: string, index: number) => (
              <span key={`${tag}-${index}`} className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-200">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-sm text-slate-200/80">{shared.summary || "No summary provided."}</p>
        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h2 className="text-sm font-semibold text-white">Notes</h2>
            <p className="mt-2 text-xs text-slate-200/80 whitespace-pre-wrap">{shared.notes || "No notes provided."}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h2 className="text-sm font-semibold text-white">Entities</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-200/80">
              {(shared.entities || []).length
                ? shared.entities.map((entity: string, idx: number) => (
                  <span key={`${entity}-${idx}`} className="rounded-full border border-white/10 px-3 py-1">
                    {entity}
                  </span>
                ))
                : "No entities."}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h2 className="text-sm font-semibold text-white">Results</h2>
            <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap text-[11px] text-slate-200/80">
              {JSON.stringify(shared.results || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OsintSharePage;
