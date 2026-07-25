import { Schema } from "effect";

export const ProtocolVersion = Schema.Literal(1);
export const Identity = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
  Schema.brand("SendspinIdentity"),
);
export const NoiseSuite = Schema.Literals([
  "25519_ChaChaPoly_SHA256",
  "25519_AESGCM_SHA256",
]);
export const Role = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z]+@v[1-9][0-9]*$/)),
);
export const Activity = Schema.Literals(["playback", "pairing", "management"]);
export const TrustLevel = Schema.Literals(["user", "none"]);

export const Envelope = <Type extends Schema.Top, Payload extends Schema.Top>(
  type: Type,
  payload: Payload,
) => Schema.Struct({ type, payload });

export const ClientInitPayload = Schema.Struct({
  client_id: Identity,
  version: ProtocolVersion,
  suite: NoiseSuite,
});
export const ClientInit = Envelope(
  Schema.Literal("client/init"),
  ClientInitPayload,
);

export const ServerInitPayload = Schema.Struct({
  server_id: Identity,
  version: ProtocolVersion,
});
export const ServerInit = Envelope(
  Schema.Literal("server/init"),
  ServerInitPayload,
);

export const ServerHelloPayload = Schema.Struct({ name: Schema.String });
export const ServerHello = Envelope(
  Schema.Literal("server/hello"),
  ServerHelloPayload,
);

export const DeviceInfo = Schema.Struct({
  product_name: Schema.optionalKey(Schema.String),
  manufacturer: Schema.optionalKey(Schema.String),
  software_version: Schema.optionalKey(Schema.String),
  mac_address: Schema.optionalKey(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/)),
    ),
  ),
});

export const ClientHelloPayload = Schema.Struct({
  name: Schema.String,
  device_info: Schema.optionalKey(DeviceInfo),
  trust_level: TrustLevel,
  supported_roles: Schema.Array(Role),
  unpaired_access: Schema.Struct({ enabled: Schema.Boolean }),
});
export const ClientHello = Envelope(
  Schema.Literal("client/hello"),
  ClientHelloPayload,
);

export const ServerActivatePayload = Schema.Struct({
  activities: Schema.Array(Activity),
  active_roles: Schema.optionalKey(Schema.Array(Role)),
  selected_pair_method: Schema.optionalKey(
    Schema.Literals(["dynamic_pin", "pairing_psk", "static_pin"]),
  ),
});
export const ServerActivate = Envelope(
  Schema.Literal("server/activate"),
  ServerActivatePayload,
);

const NullableString = Schema.NullOr(Schema.String);
const NullableNumber = Schema.NullOr(Schema.Finite);
export const MetadataState = Schema.Struct({
  timestamp: Schema.optionalKey(Schema.Finite),
  title: Schema.optionalKey(NullableString),
  artist: Schema.optionalKey(NullableString),
  album: Schema.optionalKey(NullableString),
  artwork_url: Schema.optionalKey(NullableString),
  duration: Schema.optionalKey(NullableNumber),
  position: Schema.optionalKey(NullableNumber),
});
export interface MetadataState extends Schema.Schema.Type<
  typeof MetadataState
> {}

export const ControllerState = Schema.Struct({
  supported_commands: Schema.optionalKey(Schema.Array(Schema.String)),
  volume: Schema.optionalKey(
    Schema.NullOr(
      Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
    ),
  ),
  muted: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  repeat: Schema.optionalKey(NullableString),
  shuffle: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
});
export interface ControllerState extends Schema.Schema.Type<
  typeof ControllerState
> {}

export const ServerStatePayload = Schema.Struct({
  metadata: Schema.optionalKey(Schema.NullOr(MetadataState)),
  controller: Schema.optionalKey(Schema.NullOr(ControllerState)),
});
export const ServerState = Envelope(
  Schema.Literal("server/state"),
  ServerStatePayload,
);
