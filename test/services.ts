import { BunServices } from "@effect/platform-bun";
import { Effect, type Scope } from "effect";

export const runWithServices = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices | Scope.Scope>,
) =>
  Effect.runPromise(
    effect.pipe(Effect.scoped, Effect.provide(BunServices.layer)),
  );
