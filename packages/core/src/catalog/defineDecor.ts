import type { z } from "zod";

// Decor is theme-specific ornament (an LCARS elbow, a CRT scanline bar). It carries no meaning, so the
// generator and AI never need it, and it is hidden when a screen is shown in another theme.
export interface DecorDefinition<Props extends z.ZodType = z.ZodType> {
  // "<theme>.<name>", e.g. "lcars.elbow"
  readonly kind: string;
  readonly label: string;
  readonly description: string;
  readonly props: Props;
  readonly example: z.input<Props>;
}

export type AnyDecorDefinition = DecorDefinition<z.ZodType<Record<string, unknown>>>;

export type DecorProps<Definition extends DecorDefinition> = z.output<Definition["props"]>;

export const defineDecor = <Props extends z.ZodType<Record<string, unknown>>>(
  definition: DecorDefinition<Props>,
): DecorDefinition<Props> => definition;

export type DecorCatalog = ReadonlyMap<string, AnyDecorDefinition>;
