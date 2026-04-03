import { FormEvent, useCallback, useEffect, useState } from "react";
import { Award, MessageCircle, Shield, ThumbsUp, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGetJson, apiPostJson } from "@/lib/apiClient";

type LeaderboardRow = { position: number; alias: string; rank: string; points: number; streak: number; level: number };
type Mission = { id: string; title: string; objective: string; rewardPoints: number };
type Reply = { id: string; content: string; createdAt: number; upvotes: number };
type Thread = { id: string; title: string; content: string; roleTag?: "Beginner" | "Pentester" | "Analyst"; upvotes: number; replies: number; createdAt: number; repliesList?: Reply[] };

const CommunityPage = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [sort, setSort] = useState<"trending" | "new" | "unanswered">("trending");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [roleTag, setRoleTag] = useState<"Beginner" | "Pentester" | "Analyst">("Beginner");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [newThreadCount, setNewThreadCount] = useState(0);
  const [latestSeenThreadId, setLatestSeenThreadId] = useState("");

  const load = useCallback(async (sortBy: "trending" | "new" | "unanswered" = sort) => {
    const [board, weekly, threadData] = await Promise.all([
      apiGetJson<{ leaderboard: LeaderboardRow[] }>("/api/intelligence/progression/leaderboard?period=alltime&limit=20"),
      apiGetJson<{ challenges: Mission[] }>("/api/intelligence/progression/weekly-challenges"),
      apiGetJson<{ threads: Thread[] }>(`/api/intelligence/community/threads?sort=${sortBy}&limit=80`),
    ]);
    setLeaderboard(board.leaderboard || []);
    setMissions(weekly.challenges || []);
    const nextThreads = threadData.threads || [];
    if (latestSeenThreadId && nextThreads[0]?.id && nextThreads[0].id !== latestSeenThreadId) {
      const seenIndex = nextThreads.findIndex((item) => item.id === latestSeenThreadId);
      setNewThreadCount(seenIndex > 0 ? seenIndex : 1);
    }
    if (!latestSeenThreadId && nextThreads[0]?.id) {
      setLatestSeenThreadId(nextThreads[0].id);
    }
    setThreads(nextThreads);
  }, [latestSeenThreadId, sort]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  useEffect(() => {
    const timer = setInterval(() => load(sort).catch(() => undefined), 15000);
    return () => clearInterval(timer);
  }, [load, sort]);

  const submitThread = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("");
    try {
      await apiPostJson("/api/intelligence/community/threads", { title, content, roleTag });
      setTitle("");
      setContent("");
      setRoleTag("Beginner");
      setStatus("Thread published. XP reward applied.");
      await load();
    } catch {
      setStatus("Thread blocked or failed moderation checks.");
    }
  };

  const submitReply = async (parentId: string) => {
    const text = String(replyDraft[parentId] || "").trim();
    if (!text) return;
    setStatus("");
    try {
      await apiPostJson("/api/intelligence/community/replies", { parentId, content: text });
      setReplyDraft((prev) => ({ ...prev, [parentId]: "" }));
      setStatus("Reply posted. XP reward applied.");
      await load();
    } catch {
      setStatus("Reply failed moderation checks.");
    }
  };

  const upvote = async (threadId: string) => {
    try {
      await apiPostJson("/api/intelligence/community/vote", { threadId, direction: "up" });
      await load();
    } catch {
      setStatus("Upvote could not be applied.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 page-shell">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="glass-card rounded-lg p-8">
          <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
            ZeroDay-Guardian <span className="text-accent">Community Intelligence</span>
          </h1>
          <p className="text-muted-foreground">Backend-backed discussions, challenge competition, and contribution-driven rank progression.</p>
          <div className="cyber-divider mt-4" />
          <p className="mt-2 text-sm font-semibold text-cyan-100">Train. Compete. Dominate.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="glass-card rounded-lg p-5">
            <h2 className="font-semibold inline-flex items-center gap-2"><Award className="h-4 w-4 text-amber-300" /> Challenge Leaderboard</h2>
            <div className="mt-3 text-sm space-y-2">
              {leaderboard.slice(0, 6).map((row) => (
                <div key={row.alias} className="flex items-center justify-between">
                  <span>{row.alias}</span>
                  <span>{row.rank} - {row.points} pts</span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-cyan-300/20 bg-black/20 p-2 text-xs">
              Rank system: Recruit → Analyst → Hunter → Guardian → Elite
            </div>
          </article>
          <article className="glass-card rounded-lg p-5">
            <h2 className="font-semibold inline-flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" /> Weekly Challenges</h2>
            <div className="mt-3 text-sm space-y-2">
              {missions.map((m) => (
                <div key={m.id}>
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-muted-foreground">{m.objective}</p>
                  <p className="text-cyan-200/80 text-xs">Reward: {m.rewardPoints} pts</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-cyan-100/80">Top 20 finishers get Guardian badges and board priority.</p>
          </article>
          <article className="glass-card rounded-lg p-5">
            <h2 className="font-semibold inline-flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Badges + Trust Signals</h2>
            <p className="mt-3 text-sm text-muted-foreground">Automated moderation + contribution scoring keeps discussions ethical, practical, and high quality.</p>
            <p className="mt-2 text-xs text-cyan-100/80">Earn: Recon Specialist, Web Defender, Incident Responder, Elite Guardian.</p>
          </article>
        </section>

        <section className="glass-card rounded-lg p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-semibold inline-flex items-center gap-2"><MessageCircle className="h-4 w-4 text-cyan-300" /> Discussion Threads</h2>
            <div className="flex gap-2 text-xs">
              {(["trending", "new", "unanswered"] as const).map((item) => (
                <button key={item} className={`border rounded px-2 py-1 ${sort === item ? "border-cyan-300/50 bg-cyan-500/10" : "border-cyan-300/20"}`} onClick={() => setSort(item)}>
                  {item}
                </button>
              ))}
            </div>
            {newThreadCount > 0 ? (
              <button
                type="button"
                className="text-[11px] rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100"
                onClick={() => {
                  setLatestSeenThreadId(threads[0]?.id || latestSeenThreadId);
                  setNewThreadCount(0);
                }}
              >
                {newThreadCount} new thread{newThreadCount > 1 ? "s" : ""} - mark read
              </button>
            ) : null}
          </div>

          <form className="grid gap-2 mb-4" onSubmit={submitThread}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm" placeholder="Thread title" required />
            <select value={roleTag} onChange={(e) => setRoleTag(e.target.value as "Beginner" | "Pentester" | "Analyst")} className="h-10 rounded-md border border-primary/20 bg-background px-3 text-sm">
              {["Beginner", "Pentester", "Analyst"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[100px] rounded-md border border-primary/20 bg-background p-3 text-sm" placeholder="Share a defensive strategy, lab insight, or question..." required />
            <div className="flex items-center justify-between">
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono h-10 px-5" type="submit">Publish Thread</Button>
              <span className="text-xs text-muted-foreground">{status}</span>
            </div>
          </form>

          <div className="space-y-3">
            {threads.map((thread) => (
              <article key={thread.id} className="rounded-md border border-primary/15 p-3 bg-black/20">
                <h3 className="font-semibold">{thread.title}</h3>
                <p className="mt-1 text-[11px] inline-flex rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5">{thread.roleTag || "Beginner"}</p>
                <p className="text-sm text-muted-foreground mt-1">{thread.content}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(thread.createdAt).toLocaleString()}</span>
                  <span>{thread.upvotes} upvotes</span>
                  <span>{thread.replies} replies</span>
                  <button className="inline-flex items-center gap-1 border border-cyan-300/20 rounded px-2 py-0.5" onClick={() => upvote(thread.id)}>
                    <ThumbsUp className="h-3 w-3" /> Upvote
                  </button>
                </div>

                <div className="mt-3 pl-3 border-l border-cyan-300/20 space-y-2">
                  {(thread.repliesList || []).map((reply) => (
                    <div key={reply.id} className="text-xs">
                      <p className="text-muted-foreground">{reply.content}</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1">{new Date(reply.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={replyDraft[thread.id] || ""}
                      onChange={(e) => setReplyDraft((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                      placeholder="Reply..."
                      className="h-8 flex-1 rounded border border-cyan-300/20 bg-black/20 px-2 text-xs"
                    />
                    <button className="text-xs border border-cyan-300/20 rounded px-2" onClick={() => submitReply(thread.id)}>Send</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-lg p-8 text-center">
          <h2 className="font-mono text-xl font-semibold mb-4 inline-flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Connect With ZeroDay-Guardian Operators
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Share practical defense tactics and build elite discipline with the community.</p>
        </section>
      </div>
    </div>
  );
};

export default CommunityPage;
