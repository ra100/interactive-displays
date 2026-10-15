import { z } from "zod";
import { ToneSchema } from "../schema/tone.ts";
import { defineWidget } from "./defineWidget.ts";

export const dataGrid = defineWidget({
  kind: "data-grid",
  label: "Data grid",
  category: "data",
  description: "A small table of labelled rows, such as systems and their status.",
  props: z.strictObject({
    columns: z.array(z.string().max(24)).min(1).max(6).meta({ description: "Column headings" }),
    rows: z.array(z.array(z.string().max(40)).max(6)).max(16),
    highlight: z.number().int().min(1).max(16).optional().meta({ description: "Row number to pick out" }),
    tone: ToneSchema.default("secondary"),
  }),
  example: {
    columns: ["SYSTEM", "STATUS", "LOAD"],
    rows: [
      ["EPS 1", "ONLINE", "82%"],
      ["EPS 2", "ONLINE", "77%"],
      ["EPS 3", "STANDBY", "0%"],
    ],
  },
});
