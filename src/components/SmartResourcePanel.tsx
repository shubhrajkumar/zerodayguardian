import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Loader2, Sparkles } from "lucide-react";
import { LearningResource, resourceCatalog } from "@/data/resourceCatalog";

export interface TopicIntent {
  id: string;
  title: string;
  query: string;
  tags: string[];
  devtoTag: string;
}

interface PanelProps {
  topic: TopicIntent;
}

interface ExternalResource {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
}

interface TopicResources {
  curated: LearningResource[];
  external: ExternalResource[];
}

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const scoreResource = (resource: LearningResource, topic: TopicIntent): number => {
  const terms = new Set([...tokenize(topic.title), ...tokenize(topic.query), ...topic.tags.flatMap(tokenize)]);
  const searchable = `${resource.title} ${resource.summary} ${resource.tags.join(" ")}`.toLowerCase();
  let score = 0;
  terms.forEach((term) => {
    if (searchable.includes(term)) score += 1;
  });
  return score;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) =>
  Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
  ]);

const fetchDevto = async (topic: TopicIntent): Promise<ExternalResource[]> => {
  const endpoint = `https://dev.to/api/articles?per_page=3&tag=${encodeURIComponent(topic.devtoTag)}`;
  const response = await withTimeout(fetch(endpoint), 4500);
  if (!response.ok) return [];
  const data = (await response.json()) as Array<{ id: number; title: string; url: string; description: string }>;
  return data.map((item) => ({
    id: `devto-${item.id}`,
    title: item.title,
    source: "DEV Community",
    url: item.url,
    summary: item.description || "Fresh community insight relevant to this topic.",
  }));
};

const fetchWiki = async (topic: TopicIntent): Promise<ExternalResource[]> => {
  const endpoint = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
    topic.query
  )}&limit=3&namespace=0&format=json&origin=*`;
  const response = await withTimeout(fetch(endpoint), 4500);
  if (!response.ok) return [];
  const payload = (await response.json()) as [string, string[], string[], string[]];
  const [, titles, descriptions, urls] = payload;
  return titles.map((title, idx) => ({
    id: `wiki-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    source: "Wikipedia",
    url: urls[idx],
    summary: descriptions[idx] || "Reference article aligned with the selected topic.",
  }));
};

const SmartResourcePanel = ({ topic }: PanelProps) => {
  const cacheRef = useRef(new Map<string, TopicResources>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [external, setExternal] = useState<ExternalResource[]>([]);

  const curated = useMemo(
    () =>
      [...resourceCatalog]
        .map((resource) => ({ resource, score: scoreResource(resource, topic) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((item) => item.resource),
    [topic]
  );

  useEffect(() => {
    let alive = true;

    const load = async () => {
      setError(null);
      const cached = cacheRef.current.get(topic.id);
      if (cached) {
        setExternal(cached.external);
        return;
      }

      setLoading(true);
      try {
        const [devto, wiki] = await Promise.allSettled([fetchDevto(topic), fetchWiki(topic)]);
        const gathered = [
          ...(devto.status === "fulfilled" ? devto.value : []),
          ...(wiki.status === "fulfilled" ? wiki.value : []),
        ].slice(0, 5);

        if (!alive) return;
        setExternal(gathered);
        cacheRef.current.set(topic.id, { curated, external: gathered });
      } catch {
        if (!alive) return;
        setError("Live external references are unavailable right now. Curated resources are still available.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [topic, curated]);

  return (
    <section id="smart-resources" className="xp-section" data-reveal>
      <div className="xp-container">
        <header className="xp-section-head" data-reveal>
          <p className="xp-section-kicker">Intelligent Resource Routing</p>
          <h2 className="xp-section-title">
            Best Learning Path for: <span className="xp-highlight">{topic.title}</span>
          </h2>
          <p className="xp-body">
            Click-driven recommendations combine curated standards and live references so learners get relevant, high-quality material instantly.
          </p>
        </header>

        <div className="xp-grid-two">
          <article className="xp-panel" data-reveal>
            <h3 className="xp-subtitle">Top Curated References</h3>
            <div className="xp-resource-list">
              {curated.map((resource) => (
                <a
                  key={resource.id}
                  className="xp-resource-item"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <div>
                    <p className="xp-resource-kind">
                      {resource.kind} · {resource.source}
                    </p>
                    <h4>{resource.title}</h4>
                    <p>{resource.summary}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </article>

          <article className="xp-panel" data-reveal>
            <h3 className="xp-subtitle">Live External Learning Feed</h3>
            {loading ? (
              <p className="xp-status">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching fresh global references...
              </p>
            ) : null}
            {error ? <p className="xp-status">{error}</p> : null}
            {!loading && external.length === 0 && !error ? (
              <p className="xp-status">
                <Sparkles className="h-4 w-4" />
                No live matches yet. Try another topic for different recommendations.
              </p>
            ) : null}
            <div className="xp-resource-list">
              {external.map((resource) => (
                <a
                  key={resource.id}
                  className="xp-resource-item"
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <div>
                    <p className="xp-resource-kind">{resource.source}</p>
                    <h4>{resource.title}</h4>
                    <p>{resource.summary}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
};

export default SmartResourcePanel;

