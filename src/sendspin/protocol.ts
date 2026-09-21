import { Schema } from "effect";
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

export const decodeEnvelope = Schema.decodeUnknownEffect(AnyEnvelope);

export const encodeEnvelope = Schema.encodeUnknownEffect(AnyEnvelope);

export const applyStatePatch = <T extends object>(
  current: Partial<T> | null,
  patch: Partial<{ readonly [K in keyof T]: T[K] | null }> | null,
): Partial<T> | null => {
  if (patch === null) return null;
  const next: Partial<T> = { ...current };

  for (const key in patch) {
    if (!Object.hasOwn(patch, key)) continue;
    const value = patch[key];

    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }

  return next;
};

export const applyMetadataPatch = (
  current: MetadataState | null,
  patch: Partial<MetadataState> | null,
): MetadataState | null => applyStatePatch<MetadataState>(current, patch);

export const applyControllerPatch = (
  current: ControllerState | null,
  patch: Partial<ControllerState> | null,
): ControllerState | null => applyStatePatch<ControllerState>(current, patch);
