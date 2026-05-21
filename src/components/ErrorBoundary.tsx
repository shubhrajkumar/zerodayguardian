import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logFrontendErrorToFirestore } from "@/lib/firestoreGrowth";
import { logger } from "@/lib/logger";

const SUPPORT_EMAIL = "ksubhraj28@gmail.com";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "Unexpected runtime error",
    };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    logger.error("React tree crashed", "ErrorBoundary", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    logFrontendErrorToFirestore({
      source: "ErrorBoundary",
      message: error.message,
      stack: error.stack,
      metadata: { componentStack: info.componentStack },
    }).catch(() => undefined);
  }

  private readonly handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
        <div className="max-w-xl rounded-[28px] border border-rose-400/20 bg-[linear-gradient(180deg,rgba(62,10,18,0.92),rgba(22,8,12,0.98))] p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-rose-100/72">System breach detected [red alert]</p>
          <h1 className="mt-3 text-3xl font-semibold">The interface crashed, but your mission data should still be secure.</h1>
          <p className="mt-3 text-sm leading-6 text-rose-50/84">
            We captured the fault automatically and isolated the failure path. Reloading usually restores the workspace
            without losing server-side progress.
          </p>
          <p className="mt-3 text-sm leading-6 text-rose-100/70">{this.state.message}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={this.handleReload} className="cyber-btn">
              Redeploy Interface
            </Button>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=ZeroDay%20Guardian%20runtime%20failure`} className="ghost-btn">
              Contact Support
            </a>
          </div>
          <div className="mt-4 rounded-2xl border border-rose-400/12 bg-white/[0.03] p-4 text-left text-sm text-rose-100/72">
            Fallback mode is active. Blank screen prevented.
          </div>
        </div>
      </div>
    );
  }
}
