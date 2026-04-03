import { useEffect, useMemo, useState } from "react";
import { Activity, Newspaper, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { debounce } from "@/utils/debounce";
import { apiGetJson } from "@/lib/apiClient";
import SearchBar from "@/components/SearchBar";
import FilterBar from "@/components/FilterBar";
import BlogCard from "@/components/BlogCard";

type Post = {
  id: string;
  title: string;
  category: string;
  date: string;
  excerpt: string;
  whyMatters?: string;
  source: string;
  credibility: string;
  readTime: string;
  url: string;
};

const categories = ["All", "Zero-Day", "Breaches", "AI Security", "Malware", "Global Threat Intel"];
const categoryToApi = (value: string) =>
  value === "All"
    ? "all"
    : value === "Zero-Day"
      ? "zero-day"
      : value === "Breaches"
        ? "breaches"
        : value === "AI Security"
          ? "ai-security"
          : value === "Malware"
            ? "malware"
            : "threat-intel";

const BlogPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const debouncedSearch = useMemo(() => debounce((value: string) => setSearchTerm(value), 280), []);

  const load = async (forceRefresh = false) => {
    setLoading(true);
    try {
      if (forceRefresh) {
        await apiGetJson(`/api/intelligence/news?category=${categoryToApi(selectedCategory)}&limit=9&refresh=true`);
      }
      const payload = await apiGetJson<{ posts: Post[]; updatedAt: number | null }>(
        `/api/intelligence/blog/posts?category=${categoryToApi(selectedCategory)}&q=${encodeURIComponent(searchTerm)}&limit=18`
      );
      const nextPosts = (payload.posts || []).slice(0, 9);

      if (!nextPosts.length && !forceRefresh) {
        await load(true);
        return;
      }

      setPosts(nextPosts);
      setLastUpdated(payload.updatedAt || Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    const stream = new EventSource("/api/intelligence/news/stream", { withCredentials: true });
    stream.addEventListener("news:update", () => {
      load().catch(() => undefined);
    });
    return () => stream.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshNow = async () => {
    setLoading(true);
    try {
      await load(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="rounded-2xl border border-cyan-300/20 p-7 bg-[radial-gradient(circle_at_20%_10%,rgba(0,229,255,0.2),transparent_40%),radial-gradient(circle_at_78%_25%,rgba(255,55,95,0.18),transparent_42%),rgba(8,11,20,0.85)]">
          <h1 className="text-3xl md:text-4xl font-black">
            <span className="brand-gradient-text">Cyber Intelligence Center</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-3xl">
            Simple, respectful cyber updates with short summaries and clear impact so you can act quickly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 px-3 py-1 bg-cyan-500/10"><Sparkles className="h-3.5 w-3.5" /> Live feed</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 px-3 py-1 bg-cyan-500/10"><ShieldAlert className="h-3.5 w-3.5" /> Credibility indicators</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/30 px-3 py-1 bg-cyan-500/10"><Activity className="h-3.5 w-3.5" /> Auto refresh</span>
          </div>
        </section>

        <section className="glass-card rounded-xl p-5 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold inline-flex items-center gap-2"><Newspaper className="h-4 w-4 text-cyan-300" /> Latest Cybersecurity News Feed</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "unknown"}
            </span>
            <span className="text-[11px] text-cyan-100/70">Auto refresh: 60s</span>
            <button onClick={refreshNow} className="text-xs border border-cyan-300/30 rounded px-2 py-1 hover:bg-cyan-500/10 inline-flex items-center gap-1" disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 max-w-md">
            <SearchBar value={searchTerm} onChange={debouncedSearch} placeholder="Search intelligence reports..." />
          </div>
          <FilterBar options={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>

        {loading && !posts.length ? <p className="text-sm text-muted-foreground">Loading live intelligence feed...</p> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <BlogCard
              key={post.id}
              post={{
                title: `${post.title}`,
                slug: `external-${encodeURIComponent(post.id)}`,
                category: post.category,
                date: post.date,
                excerpt: `${post.excerpt}\nWhy it matters: ${post.whyMatters || "Review impact and validate your controls."}\nSource: ${post.source} (${post.credibility})`,
                readTime: post.readTime,
                externalUrl: post.url,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default BlogPage;

