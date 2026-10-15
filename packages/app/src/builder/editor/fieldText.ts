import type { Field } from "@interactive-displays/core";

// Props that the inspector edits as text: a value that may be a number, lists one item per line, numbers
// separated by commas, and tables one row per line with cells split by "|".
export type Parsed = { value: unknown } | { problem: string };

type TextField = Extract<Field, { type: "value" | "list" | "numbers" | "table" }>;

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export const formatField = (field: TextField, value: unknown): string => {
  if (value === undefined || value === null) return "";
  switch (field.type) {
    case "value":
      return typeof value === "string" || typeof value === "number" ? String(value) : "";
    case "list":
      return Array.isArray(value) ? value.join("\n") : "";
    case "numbers":
      return Array.isArray(value) ? value.join(", ") : "";
    case "table":
      return Array.isArray(value) ? value.map((row) => (Array.isArray(row) ? row.join(" | ") : String(row))).join("\n") : "";
  }
};

const tooMany = (field: TextField, count: number): string | undefined =>
  "maxItems" in field && field.maxItems !== undefined && count > field.maxItems ? `At most ${field.maxItems}` : undefined;

// Text that reads as a plain decimal number. Codes such as "007", "0x3F" or "1e3" stay text, as written.
export const plainNumber = (text: string): number | undefined => {
  const trimmed = text.trim();
  return /^-?(0|[1-9]\d*)(\.\d+)?$/.test(trimmed) ? Number(trimmed) : undefined;
};

// Empty text means "not set" (the default), unless the prop is required.
export const parseField = (field: TextField, text: string): Parsed => {
  if (text.trim() === "") {
    if (field.required && field.type !== "value") return { value: [] };
    return { value: undefined };
  }
  switch (field.type) {
    case "value":
      return { value: plainNumber(text) ?? text.trim() };
    case "list": {
      const items = lines(text);
      const problem = tooMany(field, items.length);
      return problem ? { problem } : { value: items };
    }
    case "numbers": {
      const parts = text.split(/[\s,;]+/).filter(Boolean);
      const numbers = parts.map(Number);
      if (numbers.some((number) => !Number.isFinite(number))) return { problem: "Use numbers separated by commas" };
      if (field.min !== undefined && numbers.some((number) => number < (field.min ?? 0))) return { problem: `Each at least ${field.min}` };
      if (field.max !== undefined && numbers.some((number) => number > (field.max ?? 0))) return { problem: `Each at most ${field.max}` };
      const problem = tooMany(field, numbers.length);
      return problem ? { problem } : { value: numbers };
    }
    case "table":
      return { value: lines(text).map((line) => line.split("|").map((cell) => cell.trim())) };
  }
};
