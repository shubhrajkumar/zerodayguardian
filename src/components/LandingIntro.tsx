import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";

type SpeechPart = { text: string; highlight?: boolean };

const speechParts: SpeechPart[] = [
  { text: "" },
  { text: "Every elite journey starts with one hard decision: to keep showing up. " },
  { text: "Join the top 1%", highlight: true },
  { text: " by mastering fundamentals, practicing daily, and thinking like a defender. " },
  { text: "When labs get difficult, " },
  { text: "never give up", highlight: true },
  { text: ". Keep learning, keep shipping, and keep protecting what matters. " },
  { text: "You are not just building skills, you are here to " },
  { text: "build your legacy", highlight: true },
  { text: ". Launch now and move like a guardian." },
];

const totalChars = speechParts.reduce((acc, part) => acc + part.text.length, 0);

const LandingIntro = () => {
  const [visible, setVisible] = useState(false);
  const [typedChars, setTypedChars] = useState(0);
  const [voiceState, setVoiceState] = useState<"idle" | "playing" | "paused">("idle");
  const [speechSupported, setSpeechSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const reducedMotionRef = useRef(false);

  const plainSpeech = useMemo(() => speechParts.map((part) => part.text).join(""), []);
  const isSpeaking = voiceState === "playing";

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setVisible(true);
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
  }, []);

  useEffect(() => {
    if (reducedMotionRef.current) {
      setTypedChars(totalChars);
      return;
    }
    if (typedChars >= totalChars) return;
    const timer = window.setInterval(() => {
      setTypedChars((prev) => Math.min(totalChars, prev + 2));
    }, 24);
    return () => window.clearInterval(timer);
  }, [typedChars]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    []
  );

  const playOrPauseSpeech = () => {
    if (!speechSupported) return;

    if (voiceState === "playing") {
      window.speechSynthesis.pause();
      setVoiceState("paused");
      return;
    }

    if (voiceState === "paused") {
      window.speechSynthesis.resume();
      setVoiceState("playing");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plainSpeech);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setVoiceState("playing");
    utterance.onpause = () => setVoiceState("paused");
    utterance.onresume = () => setVoiceState("playing");
    utterance.onend = () => setVoiceState("idle");
    utterance.onerror = () => setVoiceState("idle");
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const scrollToJourney = () => {
    const target = document.getElementById("labs-tools-section");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderTypedSpeech = () => {
    let remaining = typedChars;
    return speechParts.map((part, idx) => {
      if (remaining <= 0) return null;
      const chunk = part.text.slice(0, remaining);
      remaining -= part.text.length;
      return (
        <span
          key={`${part.text}-${idx}`}
          className={
            part.highlight
              ? "font-bold brand-gradient-text"
              : ""
          }
        >
          {chunk}
        </span>
      );
    });
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[radial-gradient(circle_at_20%_18%,rgba(0,245,255,0.2),transparent_42%),radial-gradient(circle_at_82%_14%,rgba(0,124,240,0.16),transparent_42%),linear-gradient(180deg,rgba(8,12,18,0.95),rgba(7,11,17,0.98))] p-6 md:p-10">
      <div className="absolute inset-0 pointer-events-none soc-grid-overlay opacity-80" aria-hidden="true" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_20%,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(0,229,255,0.16),transparent_40%)]" />

      <div className={`relative transition-all duration-700 ${visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"}`}>
        <h1 className="text-4xl md:text-6xl font-black leading-none">
          <span className="brand-gradient-text-animated">
            ZeroDay-Guardian
          </span>
        </h1>
        <p className="mt-3 text-lg md:text-2xl font-semibold text-cyan-50 drop-shadow-[0_0_12px_rgba(0,229,255,0.45)]">
          The One Line of Defence
        </p>
      </div>

      <div className={`relative mt-6 transition-all delay-150 duration-700 ${visible ? "translate-y-0 opacity-100" : "-translate-y-5 opacity-0"}`}>
        <div
          className="rounded-xl border border-cyan-300/25 bg-black/35 p-4 text-sm md:text-base leading-7 text-cyan-50/95 min-h-[160px]"
          aria-live="polite"
          aria-label="Motivation speech"
        >
          {renderTypedSpeech()}
          <span className="ml-1 inline-block h-5 w-[2px] bg-cyan-300 align-middle animate-pulse" aria-hidden="true" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={playOrPauseSpeech}
            className="inline-flex items-center gap-2 rounded-md border border-cyan-300/40 px-4 py-2 text-sm text-cyan-50 hover:bg-cyan-500/10"
            aria-label={voiceState === "playing" ? "Pause narration" : "Play narration"}
            aria-pressed={voiceState === "playing"}
          >
            {voiceState === "playing" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {voiceState === "playing" ? "Pause Voice" : voiceState === "paused" ? "Resume Voice" : "Play Voice"}
            <Volume2 className="h-4 w-4" />
          </button>
          <div className="inline-flex items-center gap-1 rounded-md border border-cyan-300/25 bg-black/25 px-3 py-2" aria-label="Microphone wave animation">
            {[0, 1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`h-4 w-[3px] rounded ${isSpeaking ? "bg-cyan-300 animate-[voice-wave_1s_ease-in-out_infinite]" : "bg-cyan-600/40"}`}
                style={{ animationDelay: `${bar * 0.12}s` }}
                aria-hidden="true"
              />
            ))}
          </div>
          {!speechSupported ? <p className="text-xs text-amber-200">Voice-over not supported in this browser.</p> : null}
        </div>

        <button
          type="button"
          onClick={scrollToJourney}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-md border border-cyan-300/45 px-5 py-3 font-semibold text-cyan-50 shadow-[0_0_18px_rgba(0,229,255,0.25)] transition hover:-translate-y-0.5 hover:bg-cyan-500/15 animate-[pulse_2.4s_ease-in-out_infinite]"
          aria-label="Start your journey and scroll to labs and tools"
        >
          Start Your Journey
        </button>
      </div>

      <div className="pointer-events-none fixed bottom-5 left-5 z-20 hidden sm:flex">
        <div className={`rounded-full border px-3 py-2 text-xs text-cyan-100 shadow-[0_0_18px_rgba(0,229,255,0.22)] ${isSpeaking ? "border-cyan-300/60 bg-cyan-500/15" : "border-cyan-300/30 bg-black/35"}`}>
          <span className={isSpeaking ? "inline-block animate-bounce" : "inline-block"}>ZORVIX Mentor</span>
        </div>
      </div>
    </section>
  );
};

export default LandingIntro;

