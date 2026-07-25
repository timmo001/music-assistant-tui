import multicastDns from "multicast-dns";
import type { Answer } from "dns-packet";
import { Effect, Schema } from "effect";
import { normalizeBaseUrl } from "./api.js";

const SERVICE = "_mass._tcp.local";

export interface DiscoveredServer {
  readonly name: string;
  readonly serverId?: string;
  readonly url: string;
}

export class DiscoveryError extends Schema.TaggedErrorClass<DiscoveryError>()(
  "DiscoveryError",
  { message: Schema.String },
) {}

export class ServerSelectionRequired extends Schema.TaggedErrorClass<ServerSelectionRequired>()(
  "ServerSelectionRequired",
  { servers: Schema.Array(Schema.String) },
) {}

const textRecords = (records: readonly Answer[]): Map<string, string> => {
  const values = new Map<string, string>();
  for (const record of records) {
    if (record.type !== "TXT") continue;
    const entries = Array.isArray(record.data) ? record.data : [record.data];
    for (const entry of entries) {
      const text = Buffer.isBuffer(entry)
        ? entry.toString("utf8")
        : String(entry);
      const separator = text.indexOf("=");
      if (separator > 0)
        values.set(text.slice(0, separator), text.slice(separator + 1));
    }
  }
  return values;
};

export const discoverServers = (
  timeoutMs = 1500,
): Effect.Effect<readonly DiscoveredServer[], DiscoveryError> =>
  Effect.tryPromise({
    try: () =>
      new Promise<readonly DiscoveredServer[]>((resolve, reject) => {
        const mdns = multicastDns();
        const found = new Map<string, DiscoveredServer>();
        const finish = () => mdns.destroy(() => resolve([...found.values()]));
        const timer = setTimeout(finish, timeoutMs);

        mdns.on("error", (error) => {
          clearTimeout(timer);
          mdns.destroy(() => reject(error));
        });
        mdns.on("response", (response) => {
          const records = [...response.answers, ...response.additionals];
          const pointers = records.filter(
            (record) => record.type === "PTR" && record.name === SERVICE,
          );
          for (const pointer of pointers) {
            if (pointer.type !== "PTR") continue;
            const instance = String(pointer.data);
            const related = records.filter(
              (record) => record.name === instance,
            );
            const txt = textRecords(related);
            const srv = related.find((record) => record.type === "SRV");
            const advertised = txt.get("internal_url") ?? txt.get("base_url");
            let url = advertised;
            if (url === undefined && srv?.type === "SRV") {
              url = `http://${srv.data.target.replace(/\.$/, "")}:${srv.data.port}`;
            }
            if (url === undefined) continue;
            const serverId = txt.get("server_id") ?? txt.get("id");
            found.set(serverId ?? instance, {
              name: txt.get("name") ?? instance.replace(`.${SERVICE}`, ""),
              serverId,
              url: normalizeBaseUrl(url),
            });
          }
        });
        mdns.once("ready", () => mdns.query(SERVICE, "PTR"));
      }),
    catch: (error) =>
      new DiscoveryError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

export const selectServer = (
  explicitUrl: string | undefined,
  discovered: readonly DiscoveredServer[],
): Effect.Effect<string, DiscoveryError | ServerSelectionRequired> => {
  if (explicitUrl !== undefined)
    return Effect.succeed(normalizeBaseUrl(explicitUrl));
  if (discovered.length === 1) return Effect.succeed(discovered[0].url);
  if (discovered.length > 1) {
    return Effect.fail(
      new ServerSelectionRequired({
        servers: discovered.map((server) => `${server.name}: ${server.url}`),
      }),
    );
  }
  return Effect.fail(
    new DiscoveryError({
      message: "No Music Assistant server found; set MUSIC_ASSISTANT_URL",
    }),
  );
};
