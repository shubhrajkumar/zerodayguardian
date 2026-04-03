import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logFrontendErrorToFirestore } from "@/lib/firestoreGrowth";
import { logger } from "@/lib/logger";

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
        <div className="max-w-xl rounded-[28px] border border-rose-400/20 bg-rose-500/8 p-8 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <p className="terminal-font text-[11px] uppercase tracking-[0.24em] text-rose-100/72">Runtime failure captured</p>
          <h1 className="mt-3 text-3xl font-semibold">Something broke in the interface, but your progress should still be safe.</h1>
          <p className="mt-3 text-sm leading-6 text-rose-50/84">
            We captured the failure automatically. Reloading usually restores the workspace without losing your current server-side progress.
          </p>
          <p className="mt-3 text-sm leading-6 text-rose-100/70">{this.state.message}</p>
          <div className="mt-6">
            <Button onClick={this.handleReload} className="cyber-btn">
              Reload safely
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
