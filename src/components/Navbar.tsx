import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { navLinks } from "@/config/navLinks";

// Navbar automatically builds links from config and highlights active path

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const triggerToolsNeurobot = () => {
    window.dispatchEvent(
      new CustomEvent("neurobot:topic", {
        detail: {
          id: "tools-guided",
          title: "Tool Learning with ZORVEX",
          query: "Teach me this cybersecurity tool with step-by-step labs and examples.",
          tags: ["tools", "labs", "hands-on"],
        },
      })
    );
  };

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Scroll progress */}
      <div
        className="fixed top-0 left-0 h-[2px] bg-accent z-[60] transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary/10 bg-background/78 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="group flex items-center gap-2.5 nav-logo">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-500/10 shadow-[0_0_22px_rgba(34,211,238,0.35)]">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              <span className="absolute inset-0 rounded-xl bg-cyan-300/10 animate-pulse" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-black tracking-tight brand-gradient-text-animated">
                ZeroDay-Guardian
              </span>
              <span className="block text-[10px] uppercase tracking-[0.24em] text-cyan-100/85 group-hover:text-white transition-colors">
                The One Line of Defence
              </span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) =>
              link.to === "/tools" ? (
                <div
                  key={link.to}
                  className="tools-nav-wrap"
                  onMouseEnter={() => setToolsOpen(true)}
                  onMouseLeave={() => setToolsOpen(false)}
                >
                  <Link
                    to={link.to}
                    className={`nav-pill min-h-[44px] px-3 py-2 rounded-md text-sm font-medium inline-flex items-center ${
                      location.pathname === link.to ? "text-accent nav-pill-active" : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-current={location.pathname === link.to ? "page" : undefined}
                    onFocus={() => setToolsOpen(true)}
                  >
                    {link.label}
                  </Link>
                  {toolsOpen ? (
                    <div className="tools-nav-menu" onMouseEnter={() => setToolsOpen(true)}>
                      <button
                        type="button"
                        onClick={() => {
                          triggerToolsNeurobot();
                          navigate("/tools?mode=neurobot");
                          setToolsOpen(false);
                        }}
                      >
                        <strong>Learn from ZORVEX</strong>
                        <span>AI-guided explanation, examples, and step-by-step practice path.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/tools?mode=website");
                          setToolsOpen(false);
                        }}
                      >
                        <strong>Learn from Website</strong>
                        <span>Structured tool reviews, categories, and curated learning notes.</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`nav-pill min-h-[44px] px-3 py-2 rounded-md text-sm font-medium inline-flex items-center ${
                    location.pathname === link.to ? "text-accent nav-pill-active" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={location.pathname === link.to ? "page" : undefined}
                >
                  {link.label}
                </Link>
              )
            )}
            <Link to="/auth" className="nav-pill min-h-[44px] px-3 py-2 rounded-md text-sm font-medium inline-flex items-center text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <ThemeToggle />
          </div>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background/95 backdrop-blur-xl border-primary/10 w-[86vw] max-w-[22rem]">
              <SheetTitle className="font-mono text-accent">Navigation</SheetTitle>
              <div className="flex flex-col gap-2 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className={`min-h-[44px] px-4 py-3 rounded-md font-mono text-sm transition-colors nav-pill flex items-center ${
                      location.pathname === link.to
                        ? "text-accent bg-secondary nav-pill-active"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                    aria-current={location.pathname === link.to ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4">
                  <Link to="/auth" onClick={() => setOpen(false)} className="min-h-[44px] px-4 py-3 rounded-md font-mono text-sm transition-colors nav-pill flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                    Sign In
                  </Link>
                  <ThemeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
};

export default Navbar;

