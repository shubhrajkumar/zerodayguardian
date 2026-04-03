import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Seo from "@/components/Seo";
import { useReferralRecord } from "@/hooks/useGrowthFeatures";
import { useUserProgress } from "@/context/UserProgressContext";

const SecuritySettingsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user } = useAuth();
  const { progress } = useUserProgress();
  const { data: referral } = useReferralRecord();
  const [profile, setProfile] = useState<typeof user>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfile(user);
    setLoading(false);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged out" });
    navigate("/auth", { replace: true });
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Seo
        title="Security Settings | ZeroDay Guardian"
        description="Manage account security, growth profile visibility, and referral progress."
        path="/security"
      />
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-950/70 p-6">
        <h1 className="text-2xl font-bold text-white">Security Settings</h1>
        <p className="mt-2 text-sm text-slate-300">Your account uses the app's secure email and password session system.</p>

        <div className="mt-6 grid gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-200">
          <div>Name: {loading ? "Loading..." : profile?.name || "-"}</div>
          <div>Email: {loading ? "Loading..." : profile?.email || "-"}</div>
          <div>Role: {loading ? "Loading..." : profile?.role || "-"}</div>
          <div>Level: {progress.level}</div>
          <div>XP: {progress.points}</div>
          <div>Streak: {progress.streak} days</div>
          <div>Referral code: {referral?.code || "Loading..."}</div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(`/u/${user?.id || ""}`)}
            className="rounded-lg border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/10"
          >
            Open public profile
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-rose-300/40 px-4 py-2 text-sm text-rose-100 hover:bg-rose-500/10"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsPage;
