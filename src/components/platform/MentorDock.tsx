import { Brain, ChevronRight, Flame, Radar, Sparkles, Target } from "lucide-react";
import { startTransition, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdaptiveMentor } from "@/context/AdaptiveMentorContext";

const MentorDock = () => {
  const navigate = useNavigate();
  const mentor = useAdaptiveMentor();
  const [expanded, setExpanded] = useState(false);

  const openMentor = () => {
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: "adaptive-mentor-dock",
          title: "Adaptive Mentor",
          query: `${mentor.summary} Primary recommendation: ${mentor.recommendation} Micro action: ${mentor.microAction}.`,
          tags: ["mentor", mentor.difficulty, "adaptive"],
          mentorMode: true,
        },
      })
    );
  };

  return (
    <aside className="mentor-dock pointer-events-none fixed right-4 top-[5.6rem] z-30 hidden w-[min(24rem,calc(100vw-2rem))] xl:block">
      <div className={`pointer-events-auto mentor-dock__panel ${expanded ? "is-expanded" : ""}`}>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mentor-dock__toggle"
        >
          <span className="mentor-dock__pulse" aria-hidden="true" />
          <Brain className="h-4 w-4 text-cyan-200" />
          <span>{mentor.difficultyLabel}</span>
          <ChevronRight className={`h-4 w-4 transition ${expanded ? "rotate-90" : ""}`} />
        </button>

        <div className="mentor-dock__body">
          <div className="mentor-dock__hero">
            <div>
              <p className="mentor-dock__eyebrow">ZORVIX mentor</p>
              <h3 className="mentor-dock__title">{mentor.pathTitle}</h3>
            </div>
            <div className="mentor-dock__confidence">
              <Radar className="h-4 w-4 text-cyan-300" />
              {mentor.confidence}%
            </div>
          </div>

          <p className="mentor-dock__summary">{mentor.summary}</p>

          {mentor.primaryFocus ? (
            <div className="mentor-dock__focus mentor-dock__focus--primary">
              <Target className="h-4 w-4 text-cyan-300" />
              <div>
                <p className="mentor-dock__focus-title">{mentor.primaryFocus.title}</p>
                <p className="mentor-dock__focus-detail">{mentor.primaryFocus.detail}</p>
              </div>
            </div>
          ) : null}

          {mentor.secondaryFocus ? (
            <div className="mentor-dock__focus">
              <Flame className="h-4 w-4 text-amber-300" />
              <div>
                <p className="mentor-dock__focus-title">{mentor.secondaryFocus.title}</p>
                <p className="mentor-dock__focus-detail">{mentor.secondaryFocus.detail}</p>
              </div>
            </div>
          ) : null}

          <div className="mentor-dock__recommendation">
            <p className="mentor-dock__eyebrow">Next recommendation</p>
            <p>{mentor.recommendation}</p>
          </div>

          <div className="mentor-dock__actions">
            <button type="button" className="mentor-dock__action mentor-dock__action--primary" onClick={openMentor}>
              <Sparkles className="h-4 w-4" />
              Open ZORVIX Mentor
            </button>
            <button type="button" className="mentor-dock__action" onClick={() => startTransition(() => navigate("/learn"))}>
              Go to Learning Path
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default MentorDock;
