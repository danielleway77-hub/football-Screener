"use client";

import * as React from "react";
import { ErrorState } from "@/components/states/ErrorState";

type Props = {
  children: React.ReactNode;
  /** Custom fallback; defaults to ErrorState with a working "Try again". */
  fallback?: (reset: () => void) => React.ReactNode;
};

type State = { failed: boolean };

/** Client error boundary for islands (polling panels, charts…). Logs, never shows the stack. */
export class AppErrorBoundary extends React.Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    console.error("Island crashed:", error.message);
  }

  reset = () => this.setState({ failed: false });

  override render() {
    if (this.state.failed) {
      return this.props.fallback ? (
        this.props.fallback(this.reset)
      ) : (
        <ErrorState onRetry={this.reset} />
      );
    }
    return this.props.children;
  }
}
