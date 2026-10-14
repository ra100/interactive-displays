import { Component, type ReactNode } from "react";
import { WidgetFallback } from "./WidgetFallback.tsx";

interface Props {
  kind: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

// One broken widget must never take the whole display down during a take.
// Error boundaries have to be classes, so this is the one place with methods instead of arrow functions.
export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(`Widget "${this.props.kind}" failed to render`, error);
  }

  override render() {
    return this.state.failed ? <WidgetFallback kind={this.props.kind} reason="Render error" /> : this.props.children;
  }
}
