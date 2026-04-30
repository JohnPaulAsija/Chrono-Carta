import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";

const URL =
  "https://firebasestorage.googleapis.com/v0/b/chrono-carta.firebasestorage.app/o/cliopatria.geojson?alt=media";
const DEST = "public/data/cliopatria-0.0.1/cliopatria.geojson";

if (existsSync(DEST)) {
  console.log(`[cliopatria] already present at ${DEST}, skipping.`);
  process.exit(0);
}

await mkdir(dirname(DEST), { recursive: true });
console.log(`[cliopatria] downloading from ${URL}`);
const response = await fetch(URL);
if (!response.ok || !response.body) {
  console.error(`[cliopatria] download failed: ${response.status}`);
  process.exit(1);
}
await pipeline(response.body, createWriteStream(DEST));
console.log(`[cliopatria] wrote ${DEST}`);
