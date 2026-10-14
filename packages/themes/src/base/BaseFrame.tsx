import type { FrameRendererProps } from "../contract.ts";

// One generic frame for every archetype: CSS grid areas named after the slots. Plain, but it shows the
// structure clearly, which is what the base theme is for.
export const BaseFrame = ({ archetype, slots }: FrameRendererProps) => (
  <div className="base-frame" data-archetype={archetype}>
    {Object.entries(slots).map(([slot, content]) => (
      <div key={slot} className="base-frame__slot" data-slot={slot} style={{ gridArea: slot }}>
        {content}
      </div>
    ))}
  </div>
);
