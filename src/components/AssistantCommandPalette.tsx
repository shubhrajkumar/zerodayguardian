import { startTransition, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brain, Compass, GraduationCap, LayoutDashboard, Search, Shield, TerminalSquare } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { useAuth } from "@/context/AuthContext";
import { useUserProgress } from "@/context/UserProgressContext";
import { useLearningMode } from "@/context/LearningModeContext";
import { getRecentClientDiagnostics } from "@/lib/runtimeDiagnostics";
import { buildAssistantHints } from "@/lib/assistantHints";
import { executeAssistantAction } from "@/lib/assistantActions";

const AssistantCommandPalette = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { progress, trackAction } = useUserProgress();
  const { mindset } = useLearningMode();
  const [open, setOpen] = useState(false);

  const weakest = progress.skillGraph.weakest[0];
  const strongest = progress.skillGraph.strongest[0];
  const diagnostics = getRecentClientDiagnostics().filter((item) => item.path === location.pathname);
  const frictionSignal = useMemo(
    () => ({
      count: diagnostics.length,
      latestMessage: diagnostics[0]?.message || "",
    }),
    [diagnostics]
  );

  const assistantHints = useMemo(
    () =>
      buildAssistantHints({
        pathname: location.pathname,
        isAuthenticated,
        mindset,
        weakest,
        strongest,
        recommendedPath: progress.skillGraph.recommendedPath,
        frictionSignal,
        inactive: false,
        hintAffinity: {},
      }).slice(0, 6),
    [frictionSignal, isAuthenticated, location.pathname, mindset, progress.skillGraph.recommendedPath, strongest, weakest]
  );

  const navigationItems = useMemo(
    () => [
      { id: "nav-dashboard", label: "Open Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { id: "nav-learn", label: "Open Learn", to: "/learn", icon: GraduationCap },
      { id: "nav-lab", label: "Open Labs", to: `/lab?mindset=${mindset}`, icon: TerminalSquare },
      { id: "nav-tools", label: "Open Tools", to: "/tools", icon: Compass },
      { id: "nav-resources", label: "Open Resources", to: "/resources", icon: Search },
      { id: "nav-osint", label: "Open OSINT", to: "/osint", icon: Shield },
    ],
    [mindset]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("assistant:open-command-palette", onOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("assistant:open-command-palette", onOpen as EventListener);
    };
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search actions, routes, and ZORVIX help..." />
      <CommandList>
        <CommandEmpty>No matching command found.</CommandEmpty>

        <CommandGroup heading="ZORVIX">
          {assistantHints.map((hint) => (
            <CommandItem
              key={hint.id}
              onSelect={async () => {
                setOpen(false);
                await trackAction({
                  type: "assistant_command_used",
                  tool: "assistant_command_palette",
                  query: hint.id,
                  depth: 2,
                  success: true,
                  metadata: { path: location.pathname, source: "assistant_hint", category: hint.category },
                }).catch(() => undefined);
                executeAssistantAction({
                  action: hint.action,
                  navigate,
                  pathname: location.pathname,
                });
              }}
            >
              <Brain className="mr-2 h-4 w-4" />
              <span>{hint.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.id}
                onSelect={async () => {
                  setOpen(false);
                  await trackAction({
                    type: "assistant_command_used",
                    tool: "assistant_command_palette",
                    query: item.id,
                    depth: 1,
                    success: true,
                  metadata: { to: item.to, source: "navigation" },
                  }).catch(() => undefined);
                  startTransition(() => navigate(item.to));
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t border-white/5 px-3 py-2 text-[11px] text-muted-foreground">
        <span>Unified ZORVIX control layer</span>
        <CommandShortcut>Ctrl/Cmd + K</CommandShortcut>
      </div>
    </CommandDialog>
  );
};

export default AssistantCommandPalette;
