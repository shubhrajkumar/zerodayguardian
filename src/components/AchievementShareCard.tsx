import html2canvas from "html2canvas";
import { Copy, Download, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { buildShareLinks } from "@/lib/firestoreGrowth";

type Props = {
  userName: string;
  achievement: string;
  detail: string;
  shareUrl: string;
};

const AchievementShareCard = ({ userName, achievement, detail, shareUrl }: Props) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const shareText = useMemo(
    () => `${userName} unlocked ${achievement} on ZeroDay Guardian. ${detail}`,
    [achievement, detail, userName]
  );
  const shareLinks = useMemo(() => buildShareLinks(shareUrl, shareText), [shareText, shareUrl]);

  const exportCard = async () => {
    if (!cardRef.current) return null;
    setBusy(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#050910",
        scale: 2,
      });
      return canvas.toDataURL("image/png");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const dataUrl = await exportCard();
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${achievement.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.click();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    toast({ title: "Share copy copied" });
  };

  return (
    <div className="space-y-4">
      <div
        ref={cardRef}
        className="rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#04070e,#08111d)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
      >
        <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-cyan-100/70">ZeroDay Guardian</p>
        <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{achievement}</h3>
        <p className="mt-3 text-sm text-slate-300/82">{detail}</p>
        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Operator</p>
            <p className="mt-2 text-xl font-semibold text-cyan-50">{userName}</p>
          </div>
          <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-emerald-100">
            Verified reward
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={busy} className="cyber-btn terminal-font">
          <Download className="h-4 w-4" />
          Download PNG
        </button>
        <button type="button" onClick={copy} className="cyber-btn terminal-font">
          <Copy className="h-4 w-4" />
          Copy
        </button>
        <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer" className="cyber-btn terminal-font">
          <Share2 className="h-4 w-4" />
          WhatsApp
        </a>
        <a href={shareLinks.twitter} target="_blank" rel="noreferrer" className="cyber-btn terminal-font">Twitter</a>
        <a href={shareLinks.linkedin} target="_blank" rel="noreferrer" className="cyber-btn terminal-font">LinkedIn</a>
      </div>
    </div>
  );
};

export default AchievementShareCard;

