import { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

type PlatformHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  pills: string[];
  actions?: ReactNode;
  aside?: ReactNode;
};

const PlatformHero = ({ eyebrow, title, description, pills, actions, aside }: PlatformHeroProps) => {
  return (
    <section
      data-reveal
      className="premium-hero-shell cyber-card scanLine overflow-hidden rounded-[28px] p-5 sm:rounded-[32px] sm:p-6 md:rounded-[40px] md:p-9"
    >
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-8">
        <div className="space-y-4 sm:space-y-5">
          <div className="cyber-badge terminal-font max-w-full">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <div className="space-y-3 sm:space-y-4">
            <h1 className="glow-text max-w-4xl text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl md:text-[3.6rem] md:leading-[1.02]">{title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-300/82 md:text-base md:leading-7">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <span key={pill} className="cyber-badge">
                {pill}
              </span>
            ))}
          </div>
          {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        </div>
        <div className="cyber-card rounded-[20px] p-4 backdrop-blur-xl sm:rounded-[24px] sm:p-5 md:rounded-[28px]">
          {aside || (
            <div className="space-y-3 text-sm text-slate-200">
              <p className="inline-flex items-center gap-2 text-cyan-100">
                <ArrowRight className="h-4 w-4" />
                Platform architecture active
              </p>
              <p className="text-slate-300/76">
                This platform is structured as one connected cyber academy: verify, learn, simulate, improve, repeat.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlatformHero;
