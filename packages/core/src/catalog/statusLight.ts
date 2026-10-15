import { z } from "zod";
import { defineWidget } from "./defineWidget.ts";

export const STATUSES = ["ok", "info", "warning", "danger", "off"] as const;

export const statusLight = defineWidget({
  kind: "status-light",
  label: "Status light",
  category: "data",
  description: "A labelled indicator lamp: ok, info, warning, danger or off.",
  props: z.strictObject({
    label: z.string().min(1).max(40),
    status: z.enum(STATUSES).default("ok"),
    blink: z.boolean().default(false),
  }),
  example: { label: "CONTAINMENT", status: "ok" },
  bindable: ["status"],
});
