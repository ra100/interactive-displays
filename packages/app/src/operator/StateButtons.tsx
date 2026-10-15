import type { ShowOverview } from "@interactive-displays/core";

// One big button per show state, from the show's own list, plus a separate panic button for blackout.
export const StateButtons = ({
  overview,
  onSet,
}: {
  overview: ShowOverview;
  onSet: (stateId: string) => void;
}) => {
  const { states } = overview.show;
  const blackout = states.find((state) => state.effect === "blackout");
  const normal = states[0];
  const inBlackout = blackout?.id === overview.state;

  return (
    <div className="state-controls">
      <div className="state-grid">
        {states
          .filter((state) => state !== blackout)
          .map((state) => (
            <button
              key={state.id}
              type="button"
              className="state-button"
              data-effect={state.effect}
              aria-pressed={state.id === overview.state}
              onClick={() => onSet(state.id)}
            >
              <span className="state-button__label">{state.label}</span>
              {state.banner && state.banner.toLowerCase() !== state.label.toLowerCase() ? (
                <span className="state-button__banner">{state.banner}</span>
              ) : null}
            </button>
          ))}
      </div>
      {blackout ? (
        <button
          type="button"
          className="panic-button"
          aria-pressed={inBlackout}
          onClick={() => onSet(inBlackout && normal && normal !== blackout ? normal.id : blackout.id)}
        >
          {inBlackout ? `End ${blackout.label.toLowerCase()}` : blackout.label}
        </button>
      ) : null}
    </div>
  );
};
