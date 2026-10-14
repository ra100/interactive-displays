interface Props {
  kind: string;
  reason: string;
}

// Shown in place of a widget that cannot render, so the problem is visible but contained.
export const WidgetFallback = ({ kind, reason }: Props) => (
  <div className="widget-fallback" role="note" data-kind={kind}>
    <span className="widget-fallback__kind">{kind}</span>
    <span className="widget-fallback__reason">{reason}</span>
  </div>
);
