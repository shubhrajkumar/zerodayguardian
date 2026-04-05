import { startTransition, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";

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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(total > 0 ? (window.scrollY / total) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    startTransition(() => navigate("/auth", { replace: true }));
    setOpen(false);
  };

  const startFreeRoute = isAuthenticated ? "/program" : "/auth";
  const isToolsActive = toolsNav.some((item) => location.pathname === item.to);

  return (
    <>
      <div
        className="fixed left-0 top-0 z-[60] h-[2px] bg-[linear-gradient(90deg,#00ff88,#0066ff)] transition-all duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-[rgba(10,10,15,0.92)] backdrop-blur-2xl">
        <div className="mobile-page-frame flex min-h-16 items-center justify-between gap-3 py-2">
          <Link to="/" className="min-w-0 shrink-0">
            <span className="block truncate text-sm font-extrabold uppercase tracking-[0.18em] text-[#e2e8f0] sm:text-[0.95rem]">
              ZeroDay
              <span className="ml-2 terminal-font text-[0.78em] text-[#00ff88]">Guardian</span>
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
            {primaryNav.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex min-h-[40px] items-center rounded-xl px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border border-[#00ff88]/16 bg-[#00ff88]/8 text-white shadow-[0_0_18px_rgba(0,255,136,0.08)]"
                      : "text-slate-300 hover:bg-white/[0.03] hover:text-white"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    isToolsActive
                      ? "border border-[#00ff88]/16 bg-[#00ff88]/8 text-white shadow-[0_0_18px_rgba(0,255,136,0.08)]"
                      : "text-slate-300 hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  Tools
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-48 rounded-xl border-white/8 bg-[rgba(26,26,46,0.98)] text-[#e2e8f0] backdrop-blur-xl"
              >
                {toolsNav.map((item) => (
                  <DropdownMenuItem key={item.to} asChild className="cursor-pointer rounded-lg">
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {isAuthenticated ? <NotificationBell /> : null}
            {isAuthenticated && user ? (
              <Link
                to={`/u/${user.id}`}
                className="inline-flex min-h-[40px] items-center rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.03] hover:text-white"
              >
                Profile
              </Link>
            ) : null}
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="ghost-btn min-h-[40px] px-3 py-2 text-sm"
              >
                Logout
              </button>
            ) : (
              <Link
                to="/auth"
                className="ghost-btn min-h-[40px] px-3 py-2 text-sm"
              >
                Login
              </Link>
            )}

            <Link
              to={startFreeRoute}
              className="cyber-btn cta-focus-ring min-h-[42px] px-5 py-2 text-sm font-semibold"
            >
              Deploy Access
            </Link>
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-12 w-12 shrink-0 rounded-xl border border-white/6 bg-white/[0.02] text-[#e2e8f0]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[92vw] max-w-[22rem] border-white/8 bg-[rgba(10,10,15,0.98)] px-4 py-4 backdrop-blur-2xl sm:w-[24rem]">
              <SheetTitle className="text-base font-bold text-[#e2e8f0]">ZeroDay Guardian</SheetTitle>

              <div className="mt-6 flex flex-col gap-3">
                {primaryNav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-sm font-medium transition ${
                      location.pathname === item.to
                        ? "border border-[#00ff88]/16 bg-[#00ff88]/8 text-white"
                        : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                    aria-current={location.pathname === item.to ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                ))}

                <div className="cyber-card rounded-xl p-3">
                  <p className="terminal-font text-[11px] uppercase tracking-[0.2em] text-slate-500">Tools</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {toolsNav.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className={`flex min-h-12 w-full items-center rounded-xl px-3 py-3 text-sm font-medium transition ${
                          location.pathname === item.to
                            ? "bg-[#00ff88]/8 text-white"
                            : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {isAuthenticated && user ? (
                    <Link
                      to={`/u/${user.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 w-full items-center rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
                    >
                      Public Profile
                    </Link>
                  ) : null}
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="ghost-btn min-h-12 w-full justify-start px-4 py-3 text-left text-sm"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={() => setOpen(false)}
                      className="ghost-btn min-h-12 w-full justify-start px-4 py-3 text-sm"
                    >
                      Login
                    </Link>
                  )}

                  <Link
                    to={startFreeRoute}
                    onClick={() => setOpen(false)}
                    className="cyber-btn cta-focus-ring inline-flex min-h-12 w-full justify-center px-4 py-3 text-sm font-semibold"
                  >
                    Deploy Access
                  </Link>
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
