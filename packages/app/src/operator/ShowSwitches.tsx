import type { ShowSettings } from "@interactive-displays/core";

type Switchable = "displayGlobalActions" | "sounds" | "aiPublish" | "aiLiveControl";

const SWITCHES: Array<{ key: Switchable; label: string; hint: string }> = [
  {
    key: "displayGlobalActions",
    label: "Display buttons run the show",
    hint: "Buttons on displays can change the show state and shared values",
  },
  { key: "sounds", label: "Sounds on displays", hint: "Button beeps and alert sounds from the theme" },
  { key: "aiPublish", label: "AI may publish", hint: "An AI assistant connected over MCP can put screens on air" },
  {
    key: "aiLiveControl",
    label: "AI may run the show",
    hint: "An AI assistant can change the show state and shared values and assign screens to displays",
  },
];

// Show-wide switches the crew may need mid-take: an actor's stray tap must not trigger red alert, sound is often
// recorded separately, and an AI assistant stays off the air unless the crew lets it on.
export const ShowSwitches = ({
  settings,
  onChange,
}: {
  settings: ShowSettings;
  onChange: (patch: Partial<Pick<ShowSettings, Switchable>>) => void;
}) => (
  <div className="show-switches">
    {SWITCHES.map(({ key, label, hint }) => (
      <label key={key} className="show-switch">
        <span className="show-switch__text">
          <span className="show-switch__label">{label}</span>
          <span className="show-switch__hint">{hint}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={settings[key]}
          onChange={(event) => onChange({ [key]: event.target.checked })}
        />
      </label>
    ))}
  </div>
);
