import { startTransition } from "react";
import type { NavigateFunction } from "react-router-dom";

export type AssistantAction =
  | { type: "navigate"; to: string }
  | { type: "mentor"; title: string; query: string; tags?: string[] }
  | { type: "route_or_mentor"; to: string; title: string; query: string };

export const openAssistantMentor = ({
  title,
  query,
  pathname,
  tags = [],
}: {
  title: string;
  query: string;
  pathname: string;
  tags?: string[];
}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("neurobot:topic", {
      detail: {
        id: "invisible-assistant",
        title,
        query,
        tags: ["assistant", "contextual", pathname.replace(/\//g, "") || "home", ...tags],
        mentorMode: true,
      },
    })
  );
};

export const executeAssistantAction = ({
  action,
  navigate,
  pathname,
}: {
  action: AssistantAction;
  navigate: NavigateFunction;
  pathname: string;
}) => {
  if (action.type === "navigate") {
    startTransition(() => navigate(action.to));
    return;
  }
  if (action.type === "mentor") {
    openAssistantMentor({
      title: action.title,
      query: action.query,
      pathname,
      tags: action.tags,
    });
    return;
  }
  if (pathname !== action.to) {
    startTransition(() => navigate(action.to));
    return;
  }
  openAssistantMentor({
    title: action.title,
    query: action.query,
    pathname,
  });
};
