import { Schema } from "effect";

export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

const NullableString = Schema.NullOr(Schema.String);
const NullableNumber = Schema.NullOr(Schema.Finite);

export const ServerInfo = Schema.Struct({
  server_id: Schema.String,
  server_version: Schema.String,
  schema_version: Schema.Finite,
  min_supported_schema_version: Schema.Finite,
  base_url: Schema.optionalKey(NullableString),
  homeassistant_addon: Schema.Boolean,
  onboard_done: Schema.Boolean,
  name: Schema.optionalKey(NullableString),
  status: Schema.String,
  internal_url: Schema.optionalKey(NullableString),
  external_url: Schema.optionalKey(NullableString),
  has_remote_access: Schema.Boolean,
});
export interface ServerInfo extends Schema.Schema.Type<typeof ServerInfo> {}

export const MediaItemImage = Schema.Struct({
  type: Schema.String,
  path: Schema.String,
  provider: Schema.String,
  remotely_accessible: Schema.Boolean,
  proxy_id: Schema.optionalKey(NullableString),
});
export interface MediaItemImage extends Schema.Schema.Type<
  typeof MediaItemImage
> {}

export const MediaItemSummary = Schema.Struct({
  item_id: Schema.String,
  provider: Schema.String,
  name: Schema.String,
  uri: Schema.String,
  media_type: Schema.String,
  is_playable: Schema.Boolean,
  version: Schema.optionalKey(Schema.String),
  sort_name: Schema.optionalKey(NullableString),
});
export interface MediaItemSummary extends Schema.Schema.Type<
  typeof MediaItemSummary
> {}

export const PlayerMedia = Schema.Struct({
  uri: Schema.String,
  title: NullableString,
  artist: Schema.optionalKey(NullableString),
  album: Schema.optionalKey(NullableString),
  image_url: Schema.optionalKey(NullableString),
  duration: Schema.optionalKey(NullableNumber),
  media_type: Schema.String,
  elapsed_time: Schema.optionalKey(NullableNumber),
  elapsed_time_last_updated: Schema.optionalKey(NullableNumber),
  source_id: Schema.optionalKey(NullableString),
  queue_item_id: Schema.optionalKey(NullableString),
});
export interface PlayerMedia extends Schema.Schema.Type<typeof PlayerMedia> {}

export const Player = Schema.Struct({
  player_id: Schema.String,
  provider: Schema.String,
  type: Schema.String,
  name: Schema.String,
  available: Schema.Boolean,
  enabled: Schema.Boolean,
  device_info: Schema.optionalKey(Schema.Unknown),
  playback_state: Schema.String,
  elapsed_time: Schema.optionalKey(NullableNumber),
  elapsed_time_last_updated: Schema.optionalKey(NullableNumber),
  powered: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  volume_level: Schema.optionalKey(NullableNumber),
  volume_muted: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  active_source: Schema.optionalKey(NullableString),
  synced_to: Schema.optionalKey(NullableString),
  group_members: Schema.Array(Schema.String),
  supported_features: Schema.Array(Schema.String),
  current_media: Schema.optionalKey(Schema.NullOr(PlayerMedia)),
});
export interface Player extends Schema.Schema.Type<typeof Player> {}

export const QueueItem = Schema.Struct({
  queue_id: Schema.String,
  queue_item_id: Schema.String,
  name: Schema.String,
  duration: NullableNumber,
  sort_index: Schema.Finite,
  available: Schema.Boolean,
  image: Schema.optionalKey(Schema.NullOr(MediaItemImage)),
  media_item: Schema.optionalKey(Schema.NullOr(MediaItemSummary)),
});
export interface QueueItem extends Schema.Schema.Type<typeof QueueItem> {}

export const PlayerQueue = Schema.Struct({
  queue_id: Schema.String,
  active: Schema.Boolean,
  display_name: Schema.String,
  available: Schema.Boolean,
  items: Schema.Finite,
  state: Schema.String,
  elapsed_time: Schema.Finite,
  elapsed_time_last_updated: Schema.Finite,
  playback_speed: Schema.Finite,
  current_index: Schema.optionalKey(NullableNumber),
  shuffle_enabled: Schema.Boolean,
  repeat_mode: Schema.String,
  autoplay_enabled: Schema.Boolean,
  current_item: Schema.optionalKey(Schema.NullOr(QueueItem)),
  next_item: Schema.optionalKey(Schema.NullOr(QueueItem)),
});
export interface PlayerQueue extends Schema.Schema.Type<typeof PlayerQueue> {}

export const CommandMessage = Schema.Struct({
  message_id: MessageId,
  command: Schema.String,
  args: Schema.optionalKey(
    Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
  ),
});
export interface CommandMessage extends Schema.Schema.Type<
  typeof CommandMessage
> {}

export const SuccessResultMessage = Schema.Struct({
  message_id: MessageId,
  result: Schema.Unknown,
  partial: Schema.optionalKey(Schema.Boolean),
});
export interface SuccessResultMessage extends Schema.Schema.Type<
  typeof SuccessResultMessage
> {}

export const ErrorResultMessage = Schema.Struct({
  message_id: MessageId,
  error_code: Schema.Finite,
  details: Schema.optionalKey(NullableString),
});
export interface ErrorResultMessage extends Schema.Schema.Type<
  typeof ErrorResultMessage
> {}

export const EventMessage = Schema.Struct({
  event: Schema.String,
  object_id: Schema.optionalKey(NullableString),
  data: Schema.optionalKey(Schema.Unknown),
});
export interface EventMessage extends Schema.Schema.Type<typeof EventMessage> {}
