import { SCREEN_SCHEMA_VERSION } from "../schema/screen.ts";

type Document = Record<string, unknown>;

const isDocument = (value: unknown): value is Document =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// One step per version: the function for version N returns a version N+1 document. Steps never validate;
// the schema does that after the last step, so a migration only reshapes what changed.
const steps: Record<number, (doc: Document) => Document> = {
  // v1 had no drafts: a saved screen was on air. v2 marks that revision as published.
  1: (doc) => ({
    ...doc,
    schemaVersion: 2,
    published: typeof doc["revision"] === "number" ? doc["revision"] : 0,
  }),
};

// Upgrades an older screen document to the current schema version. Anything it does not recognise
// (not an object, a missing or future version) is returned unchanged for validation to reject.
export const migrateScreen = (input: unknown): unknown => {
  if (!isDocument(input)) return input;
  let doc = input;
  for (;;) {
    const version = doc["schemaVersion"];
    if (typeof version !== "number" || version >= SCREEN_SCHEMA_VERSION) return doc;
    const step = steps[version];
    if (!step) return doc;
    doc = step(doc);
  }
};
