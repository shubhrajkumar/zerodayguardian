import { connectDb, closeDb } from "../backend/src/config/db.mjs";
import { processWeeklyDigests } from "../backend/src/services/platformGrowthService.mjs";

const run = async () => {
  await connectDb();
  const result = await processWeeklyDigests();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  await closeDb();
};

run().catch(async (error) => {
  console.error("[weekly-digests] failed", error instanceof Error ? error.message : String(error));
  await closeDb().catch(() => undefined);
  process.exit(1);
});
