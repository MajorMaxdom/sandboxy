import { deserialize, fromBase64, gunzip, gzip, serialize, toBase64, type SceneFile } from './save';
import type { Simulation } from '../sim/simulation';

const PREFIX = '#s=';

const toUrlSafe = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromUrlSafe = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);

/** Encode the current scene into a shareable URL (scene lives in the #hash, no server needed). */
export async function shareUrl(sim: Simulation): Promise<string> {
  const json = JSON.stringify(await serialize(sim));
  const packed = toUrlSafe(toBase64(await gzip(new TextEncoder().encode(json))));
  const base = location.href.split('#')[0];
  return `${base}${PREFIX}${packed}`;
}

export function hasSharedScene(hash = location.hash): boolean {
  return hash.startsWith(PREFIX) && hash.length > PREFIX.length;
}

/** Load a scene from a share hash. */
export async function loadShared(sim: Simulation, hash = location.hash): Promise<void> {
  const bytes = await gunzip(fromBase64(fromUrlSafe(hash.slice(PREFIX.length))));
  const scene = JSON.parse(new TextDecoder().decode(bytes)) as SceneFile;
  await deserialize(sim, scene);
}
