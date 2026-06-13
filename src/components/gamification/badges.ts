export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export const CYBERSECURITY_BADGES: Badge[] = [
  {
    id: "first-blood",
    name: "First Blood",
    description: "Completed your first hands-on lab.",
    icon: "🩸",
    requirement: "Complete first lab",
  },
  {
    id: "bug-hunter",
    name: "Bug Hunter",
    description: "Found five validated vulnerabilities.",
    icon: "🎯",
    requirement: "Find 5 vulnerabilities",
  },
  {
    id: "code-warrior",
    name: "Code Warrior",
    description: "Completed ten guided cybersecurity missions.",
    icon: "⚔️",
    requirement: "Complete 10 missions",
  },
  {
    id: "streak-master",
    name: "Streak Master",
    description: "Kept a seven-day learning streak alive.",
    icon: "🔥",
    requirement: "7-day learning streak",
  },
  {
    id: "xp-legend",
    name: "XP Legend",
    description: "Reached level 10 through consistent practice.",
    icon: "⭐",
    requirement: "Reach level 10",
  },
  {
    id: "defense-expert",
    name: "Defense Expert",
    description: "Cleared five blue-team defense labs.",
    icon: "🛡️",
    requirement: "Complete 5 defense labs",
  },
  {
    id: "offense-master",
    name: "Offense Master",
    description: "Cleared five ethical offense labs.",
    icon: "⚡",
    requirement: "Complete 5 offense labs",
  },
  {
    id: "community-hero",
    name: "Community Hero",
    description: "Helped ten other students move forward.",
    icon: "🤝",
    requirement: "Help 10 students",
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Finished a lab in under five minutes.",
    icon: "⏱️",
    requirement: "Complete lab in under 5 mins",
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Scored 100% on five separate labs.",
    icon: "💎",
    requirement: "100% score on 5 labs",
  },
];
