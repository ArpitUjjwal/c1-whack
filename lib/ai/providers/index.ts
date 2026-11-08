import type { AiProvider } from "../provider";
import { claudeProvider } from "./claude";

/**
 * Pick the provider, once, for the process.
 *
 * `AI_PROVIDER` selects an implementation; Claude is the default and the only
 * one built. Adding another means one new file in this directory and one line
 * in the switch — no route and no component changes, which is the entire
 * reason the seam exists.
 *
 * With no credentials configured this returns `OFFLINE`, whose every method
 * resolves `null`. Callers already treat `null` as "use the local engine", so
 * nothing downstream has to know whether a key exists — and the demo runs
 * complete either way.
 */

const OFFLINE: AiProvider = {
  name: "local",
  available: () => false,
  analysePressure: async () => null,
  rewrite: async () => null,
  draftAdvocate: async () => null,
  explain: async () => null,
  agentScript: async () => null,
};

export function getProvider(): AiProvider {
  switch (process.env.AI_PROVIDER ?? "claude") {
    case "claude":
      return claudeProvider.available() ? claudeProvider : OFFLINE;
    case "none":
      return OFFLINE;
    default:
      // An unrecognised name is a configuration mistake, and silently running
      // the demo on local engines is the safe way to be wrong about it.
      return OFFLINE;
  }
}
