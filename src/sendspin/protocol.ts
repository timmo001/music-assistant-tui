import { Effect, Schema } from "effect";
import {
  ClientHello,
  ClientInit,
  ServerActivate,
  ServerHello,
  ServerInit,
  ServerState,
  type ControllerState,
  type MetadataState,
} from "./models.js";

export const AnyEnvelope = Schema.Union([
  ClientInit,
  ServerInit,
  ServerHello,
  ClientHello,
  ServerActivate,
  ServerState,
]);
export type AnyEnvelope = typeof AnyEnvelope.Type;

export const decodeEnvelope = Effect.fn("Sendspin.decodeEnvelope")(function* (
  input: unknown,
) {
  return yield* Schema.decodeUnknownEffect(AnyEnvelope)(input);
});

export const encodeEnvelope = Schema.encodeUnknownEffect(AnyEnvelope);

export const applyStatePatch = <T extends Readonly<Record<string, unknown>>>(
  current: T | null,
  patch: Partial<{ readonly [K in keyof T]: T[K] | null }> | null,
): T | null => {
  if (patch === null) return null;
  const next: Record<string, unknown> = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  return next as T;
};

export const applyMetadataPatch = (
  current: MetadataState | null,
  patch: Partial<MetadataState> | null,
): MetadataState | null => applyStatePatch(current, patch);

export const applyControllerPatch = (
  current: ControllerState | null,
  patch: Partial<ControllerState> | null,
): ControllerState | null => applyStatePatch(current, patch);
