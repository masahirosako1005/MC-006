// 未来日程(ダミー 100 件)を app/src/data/future-trips.json に書き出す。実行: node scripts/build-future-trips.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildFutureTrips } from "./lib/future-trips.mjs";

const out = fileURLToPath(new URL("../src/data/future-trips.json", import.meta.url));
const data = buildFutureTrips();
if (data.groups.length !== 100) {
  console.error(`groups=${data.groups.length} (expected 100)`);
  process.exit(1);
}
writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
console.log(
  `future-trips: users=${data.users.length} groups=${data.groups.length} members=${data.members.length} logs=${data.groupStatusLogs.length} listings=${data.listings.length}`,
);
