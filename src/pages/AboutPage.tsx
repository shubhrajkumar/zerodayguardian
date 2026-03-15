import { Eye, Flame, Shield, Target, Users } from "lucide-react";

const pillars = [
  {
    icon: Target,
    title: "Mission",
    desc: "Build disciplined cybersecurity professionals through practical training, measurable progression, and ethical responsibility.",
  },
  {
    icon: Eye,
    title: "Authority",
    desc: "ZeroDay-Guardian is designed as a high-standard cyber learning command center, not an entertainment platform.",
  },
  {
    icon: Shield,
    title: "Ethics",
    desc: "Every offensive technique is taught with legal scope, defensive purpose, and accountability.",
  },
  {
    icon: Users,
    title: "Top 1% Mindset",
    desc: "Consistency, clarity, and relentless practice separate elite operators from casual learners.",
  },
];

const AboutPage = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="font-mono text-3xl md:text-4xl font-bold mb-4">
            About <span className="text-accent">ZeroDay-Guardian</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We train cyber learners to think clearly under pressure, execute responsibly, and keep improving until excellence becomes habit.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {pillars.map((value) => (
            <div key={value.title} className="glass-card rounded-lg p-6">
              <value.icon className="h-7 w-7 text-primary mb-3" />
              <h3 className="font-mono text-lg font-semibold mb-2">{value.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{value.desc}</p>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-lg p-8 text-center">
          <h2 className="font-mono text-xl font-semibold mb-3 inline-flex items-center gap-2">
            <Flame className="h-5 w-5 text-accent" />
            Discipline Over Hype
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Never give up when labs get hard. Elite progress is built through repetition, reflection, and ethical execution.
          </p>
          <p className="text-xs text-muted-foreground font-mono">"Train with integrity. Defend with precision. Improve every day."</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
