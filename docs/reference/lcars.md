# LCARS references

What the LCARS look is built from, where each piece was seen, and what this repository draws for it. Use it when
adding LCARS frames, decor or screens, so new pieces come from the shows rather than from memory of one panel.

LCARS (Library Computer Access/Retrieval System) was designed by Michael Okuda for *Star Trek: The Next
Generation* and changed with every series after it. The panels on set were small (20 to 30 inch backlit
transparencies and monitors), so buttons were about 1 to 2 cm tall and the screens were dense. On an 80 to 100
inch 4K panel that density only comes back if buttons keep their real size, which is why buttons are sized in
centimetres (see `docs/deviations/2026-10-16-physical-button-size.md`).

## Sources

- Michael Okuda's work on TNG, DS9, Voyager and the TNG films, as seen on screen.
- [thelcars.com](https://www.thelcars.com) by Jim Robertus: HTML and CSS LCARS templates with colour codes per era
  (credited by most fan builds for palette and font).
- [ha-lcars](https://github.com/th3jesta/ha-lcars): Home Assistant themes for Classic, Next Gen, Lower Decks,
  Picard, Romulan, Cardassian and alert palettes; readout shapes named lozenge, bullet, capped and barrel.
- [CB-LCARS](https://github.com/snootched/cb-lcars): header, footer, open, contained and callout elbows, Picard
  double elbows, lozenge, bullet, capped and Picard buttons, multimeter sliders, data cascade, pulse wave and
  grid backgrounds.
- [lcars for R/Shiny](https://cran.r-project.org/package=lcars): frames built from corner elbows and sides cut
  into coloured, labelled segments; button columns for sidebars; palettes `lcars_2357`, `lcars_2369`,
  `lcars_2375` and `lcars_2379` (TNG, DS9, Voyager, Nemesis).
- [LCARS SDK](https://github.com/Aricwithana/LCARS-SDK): a full web LCARS kit with elbows, brackets and button
  styles.
- [Supergraphic panel design system](https://brycewatson.com/blog/23-supergraphic-panel-design-system):
  asymmetric elbows (equal radii look wrong), half-pill sidebar buttons, condensed all-caps type.

## Eras

| Era | Where | Look | Here |
|---|---|---|---|
| TNG, 2364–2370 | Bridge, Engineering, Ops | Orange, peach, lilac and blue blocks on black; sidebar sweeps; numbered blocks; pill buttons | LCARS default palette |
| DS9 (Starfleet panels), 2369 | Defiant, runabouts | Warmer salmon and peach with pink and grey-blue | `ds9` variant |
| Voyager, 2371–2378 | Voyager bridge and Astrometrics | Yellow, lilac and blues; frames on both sides; more data cascades | `voyager` variant |
| Nemesis, 2379 | Enterprise-E | Blue and grey, thinner bars, more line art | `nemesis` variant |
| Lower Decks, 2380 | Cerritos | Brighter, punchier TNG with a hot orange | `lower-decks` variant |
| Picard, 2399+ | Titan, Enterprise-G | Grey with orange accents, thin double elbows, rounded rectangles | `picard` variant |

## Elements

| Element | Seen on | Here |
|---|---|---|
| Sweep (elbow) joining a column to a bar, asymmetric radii | Every era | `lcars.elbow` decor; every frame |
| Sidebar of numbered blocks, number top left, label bottom right | TNG, VOY | `sidebar`, `split` and `console` frames; buttons in `nav` |
| Split double frame: upper frame sweeps down into a bar, a gap, lower frame sweeps up into the column | TNG Engineering, VOY | `split` frame |
| Full console: left sweep and column, tool row, right panel behind a divider | VOY, DS9 Defiant | `console` frame |
| Bars broken into coloured segments with reference numbers | TNG, VOY | `lcars.segments` decor; the split frame's bars |
| Pill (lozenge) buttons, half-pill (bullet) buttons | Every era | `button` in toolbar and main slots |
| Rounded end caps closing a bar | Every era | `lcars.cap`, `lcars.bar` with caps |
| Brackets around a group | TNG, Nemesis | `lcars.bracket` |
| Data cascade: columns of numbers scrolling | TNG, VOY | `data-cascade` widget |
| Sensor scope: rings, bearing ticks, sweeping arm, contacts | TNG tactical and science | `lcars.scan` decor |
| Lamp rows: small rounded lights blinking | TNG Ops and Engineering | `status-matrix` widget, drawn as pills in LCARS |
| Segmented gauges with caps | TNG Engineering | `gauge` widget, segmented variant |
| Readout tags: capped label with number, value beside it | Every era | `readout` widget |
| Ship cutaway (Okudagram) | Every era | `image` widget with an asset (the demo's ship schematic) |
| Alert banner | Every era | `alert-banner` widget |

## Not drawn yet

- Picard double elbows (two thin parallel sweeps) and the rounded-rectangle Picard panels.
- Callout elbows (an elbow with a block hanging off its bar).
- Pulse-wave and grid backgrounds, and the multimeter slider from CB-LCARS.
- Right-hand sweeps in frames (the decor elbow already has `tr` and `br` corners).
