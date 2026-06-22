import { startTransition, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useZdg } from "@/context/ZdgContext";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { hoverScale, tapScale, navbarReveal } from "@/lib/animations";

const primaryNav = [
  { label: "Learn", to: "/learn" },
  { label: "Labs", to: "/lab" },
  { label: "Program", to: "/program" },
];

const toolsNav = [
  { label: "OSINT", to: "/osint" },
  { label: "Resources", to: "/resources" },
  { label: "Blog", to: "/blog" },
];

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const { globalXp, streakCount } = useZdg();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (scrollY / total) * 100 : 0);
      setScrolled(scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    startTransition(() => navigate("/auth", { replace: true }));
    setOpen(false);
  };

  const displayHandle = user?.name || "Guardian";
  const isUserAuthenticated = isAuthenticated;
  const startFreeRoute = isUserAuthenticated ? "/program" : "/auth";
  const isToolsActive = toolsNav.some((item) => location.pathname === item.to);
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Scroll progress bar with glow */}
      <div
        className="fixed left-0 top-0 z-[60] h-[2px] bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-500 transition-all duration-200 shadow-[0_0_8px_rgba(34,211,238,0.3)]"
        style={{ width: `${scrollProgress}%` }}
      />
      {/* Tactical status bar — top left */}
      <div className="fixed left-4 top-[68px] z-50 hidden md:flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        <span>OPS:{scrolled ? "NAV" : "HOM"}</span>
        <span className="text-slate-700">|</span>
        <span>ZDG-SECURE</span>
      </div>

      {/* Navbar */}
      <motion.nav
        variants={navbarReveal}
        initial="hidden"
        animate="visible"
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-xl bg-[#050508]/80 border-b border-slate-800/50 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2">
          {/* Brand */}
          <motion.div whileHover={hoverScale} whileTap={tapScale}>
            <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.08)] transition-all duration-300 group-hover:border-emerald-400/50 group-hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]">
              <Swords className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-bold tracking-[0.2em] text-slate-100 min-[480px]:block">
              <span className="text-slate-500">ZDG:</span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                CORE
              </span>
            </span>
          </Link>
          </motion.div>

          {/* Desktop nav links */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex min-h-[38px] items-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive(item.to)
                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.06)]"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
                aria-current={isActive(item.to) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    isToolsActive
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                  }`}
                >
                  Tools
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-48 rounded-lg border border-slate-800 bg-slate-900/95 backdrop-blur-xl"
              >
                {toolsNav.map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="cursor-pointer rounded-md text-slate-300 focus:text-emerald-300 focus:bg-emerald-500/10">
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop right side */}
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            {isUserAuthenticated ? <NotificationBell /> : null}
            {isUserAuthenticated ? (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-800/50 bg-slate-900/50">
                <span className="text-[10px] font-mono font-medium text-emerald-400">
                  {globalXp.toLocaleString()} XP
                </span>
                {streakCount > 0 && (
                  <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {streakCount}d
                  </span>
                )}
              </div>
            ) : null}
            {isUserAuthenticated && user ? (
              <Link
                to={`/u/${user?.id}`}
                className="inline-flex min-h-[38px] items-center rounded-lg px-3 py-2 text-sm text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
              >
                {displayHandle}
              </Link>
            ) : null}
            {isUserAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[38px] items-center rounded-lg px-3 py-2 text-sm text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/auth"
                className="inline-flex min-h-[38px] items-center rounded-lg px-3 py-2 text-sm text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
              >
                Login
              </Link>
            )}

            <Link
              to={startFreeRoute}
              className="group relative inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_20px_rgba(52,211,153,0.25)] active:scale-[0.98]"
            >
              <Swords className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
              Deploy Access
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-300">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[92vw] max-w-[22rem] border-l border-slate-800 bg-slate-900/95 px-4 py-4 backdrop-blur-2xl sm:w-[24rem]">
              <div className="flex items-center justify-between mb-2">
                <SheetTitle className="flex items-center gap-2 text-base font-bold text-slate-100">
                  <Swords className="h-4 w-4 text-emerald-400" />
                  ZeroDay Guardian
                </SheetTitle>
                <ThemeToggle />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {primaryNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-11 w-full items-center rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive(item.to)
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                    }`}
                    aria-current={isActive(item.to) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Tools</p>
                  <div className="mt-2 flex flex-col gap-1">
                    {toolsNav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-11 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          isActive(item.to)
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {isUserAuthenticated && user ? (
                    <Link
                      to={`/u/${user.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
                    >
                      Public Profile
                    </Link>
                  ) : null}
                  {isUserAuthenticated ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex min-h-11 w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={() => setOpen(false)}
                      className="flex min-h-11 w-full items-center rounded-lg px-4 py-3 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800/40 hover:text-slate-200"
                    >
                      Login
                    </Link>
                  )}

                  <Link
                    to={startFreeRoute}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    Deploy Access
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </motion.nav>
    </>
  );
};

export default Navbar;
