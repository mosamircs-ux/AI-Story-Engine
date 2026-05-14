import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { novels } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function resetStuckAnalyses() {
  try {
    const stuck = await db
      .update(novels)
      .set({ status: "error" })
      .where(eq(novels.status, "analyzing"))
      .returning({ id: novels.id, title: novels.title });
    if (stuck.length > 0) {
      logger.warn({ count: stuck.length, ids: stuck.map(n => n.id) }, "Reset novels stuck in 'analyzing' to 'error' on startup");
    }
  } catch (err) {
    logger.error({ err }, "Failed to reset stuck analyses on startup");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await resetStuckAnalyses();
});
