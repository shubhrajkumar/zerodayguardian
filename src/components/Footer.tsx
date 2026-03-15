import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="relative z-10 border-t border-primary/10 bg-background/90 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-mono text-lg font-bold mb-3">
              <span className="brand-gradient-text-animated">
                ZeroDay-Guardian
              </span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The One Line of Defence. AI-powered cybersecurity command center for learning, labs, and operational intelligence.
            </p>
          </div>

          <div>
            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Quick Links</h4>
            <div className="flex flex-col gap-2">
              {[
                { label: "Home", to: "/" },
                { label: "Tools", to: "/tools" },
                { label: "Learn", to: "/learn" },
                { label: "Lab", to: "/lab" },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Intelligence</h4>
            <div className="flex flex-col gap-2">
              {[
                { label: "Cyber Intelligence Center", to: "/blog" },
                { label: "Resources", to: "/resources" },
                { label: "Community", to: "/community" },
                { label: "About", to: "/about" },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="text-sm text-muted-foreground hover:text-accent transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-mono text-sm font-semibold text-foreground mb-3">Command Updates</h4>
            <p className="text-sm text-muted-foreground mb-3">Receive tactical updates, weekly vulnerability breakdowns, and AI mentor upgrades.</p>
            <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
              <Input type="email" placeholder="Your email" className="bg-secondary border-primary/20 text-sm" />
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono text-xs shrink-0">
                Join
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-primary/10 text-center">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ZeroDay-Guardian. All rights reserved.</p>
          <p className="mt-2 text-sm font-semibold brand-gradient-text-animated">
            Created by Shubhraj
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;


