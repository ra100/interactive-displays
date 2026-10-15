import { z } from "zod";
import { type Tone, TONES } from "../schema/tone.ts";

// Form fields for the editor's inspector, derived from a widget's or decor's props schema. They come from the
// same JSON Schema that the API and AI see, so the inspector never needs a hand-written form per widget.
// A schema can steer the editor with `.meta({ "x-editor": "asset:image" })`.

interface FieldBase {
  key: string;
  label: string;
  description?: string;
  required: boolean;
}

export type Field =
  | (FieldBase & { type: "text"; default?: string; maxLength?: number; multiline: boolean })
  | (FieldBase & { type: "number"; default?: number; min?: number; max?: number; integer: boolean })
  | (FieldBase & { type: "boolean"; default?: boolean })
  | (FieldBase & { type: "enum"; options: string[]; default?: string })
  | (FieldBase & { type: "tone"; default?: Tone })
  | (FieldBase & { type: "asset"; accept: "image" | "video" | "any"; default?: string })
  // A number or a short text, such as a readout's value: numeric input is kept as a number.
  | (FieldBase & { type: "value"; default?: string | number })
  // Lists edited one item per line; tables one row per line with cells split by "|".
  | (FieldBase & { type: "list"; maxItems?: number; default?: string[] })
  | (FieldBase & { type: "numbers"; maxItems?: number; min?: number; max?: number; default?: number[] })
  | (FieldBase & { type: "table"; default?: string[][] })
  // Anything the form cannot express as one control; edited as JSON.
  | (FieldBase & { type: "json"; default?: unknown });

export type FieldType = Field["type"];

type JsonSchema = Record<string, unknown>;

const MULTILINE_FROM = 120;

const isSchema = (value: unknown): value is JsonSchema => typeof value === "object" && value !== null;

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

// "colSpan" → "Col span", "max-value" → "Max value"
export const humanize = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const isToneList = (options: readonly unknown[]): boolean =>
  options.length === TONES.length && TONES.every((tone) => options.includes(tone));

const describeOne = (key: string, schema: JsonSchema, required: boolean): Field => {
  const base: FieldBase = {
    key,
    label: str(schema["title"]) ?? humanize(key),
    required,
    ...(str(schema["description"]) ? { description: str(schema["description"]) as string } : {}),
  };
  const fallback = schema["default"];
  const editor = str(schema["x-editor"]);
  const options = Array.isArray(schema["enum"]) ? schema["enum"] : undefined;

  if (editor?.startsWith("asset") && schema["type"] === "string") {
    const accept = editor.split(":")[1];
    return {
      ...base,
      type: "asset",
      accept: accept === "image" || accept === "video" ? accept : "any",
      ...(typeof fallback === "string" ? { default: fallback } : {}),
    };
  }

  if (options && options.every((option) => typeof option === "string")) {
    const values = options as string[];
    if (isToneList(values)) {
      return { ...base, type: "tone", ...(typeof fallback === "string" ? { default: fallback as Tone } : {}) };
    }
    return { ...base, type: "enum", options: values, ...(typeof fallback === "string" ? { default: fallback } : {}) };
  }

  const variants = Array.isArray(schema["anyOf"]) ? schema["anyOf"].filter(isSchema) : [];
  const variantTypes = new Set(variants.map((variant) => variant["type"]));
  if (variants.length === 2 && variantTypes.has("string") && variantTypes.has("number")) {
    return {
      ...base,
      type: "value",
      ...(typeof fallback === "string" || typeof fallback === "number" ? { default: fallback } : {}),
    };
  }

  if (schema["type"] === "array" && isSchema(schema["items"])) {
    const items = schema["items"];
    const maxItems = num(schema["maxItems"]);
    const limit = maxItems !== undefined ? { maxItems } : {};
    if (items["type"] === "string") {
      return { ...base, type: "list", ...limit, ...(Array.isArray(fallback) ? { default: fallback as string[] } : {}) };
    }
    if (items["type"] === "number" || items["type"] === "integer") {
      const min = num(items["minimum"]);
      const max = num(items["maximum"]);
      return {
        ...base,
        type: "numbers",
        ...limit,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        ...(Array.isArray(fallback) ? { default: fallback as number[] } : {}),
      };
    }
    if (items["type"] === "array" && isSchema(items["items"]) && items["items"]["type"] === "string") {
      return { ...base, type: "table", ...(Array.isArray(fallback) ? { default: fallback as string[][] } : {}) };
    }
  }

  switch (schema["type"]) {
    case "string": {
      const maxLength = num(schema["maxLength"]);
      return {
        ...base,
        type: "text",
        multiline: maxLength === undefined || maxLength > MULTILINE_FROM,
        ...(maxLength !== undefined ? { maxLength } : {}),
        ...(typeof fallback === "string" ? { default: fallback } : {}),
      };
    }
    case "number":
    case "integer": {
      const min = num(schema["minimum"]);
      const max = num(schema["maximum"]);
      return {
        ...base,
        type: "number",
        integer: schema["type"] === "integer",
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        ...(typeof fallback === "number" ? { default: fallback } : {}),
      };
    }
    case "boolean":
      return { ...base, type: "boolean", ...(typeof fallback === "boolean" ? { default: fallback } : {}) };
    default:
      return { ...base, type: "json", ...(fallback !== undefined ? { default: fallback } : {}) };
  }
};

// One field per top-level prop, in schema order. A schema that is not an object yields no fields.
export const describeFields = (schema: z.ZodType): Field[] => {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema;
  const properties = isSchema(json["properties"]) ? json["properties"] : {};
  const required = new Set(Array.isArray(json["required"]) ? json["required"] : []);
  return Object.entries(properties).flatMap(([key, value]) =>
    isSchema(value) ? [describeOne(key, value, required.has(key))] : [],
  );
};
