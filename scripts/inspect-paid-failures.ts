import { desc } from "drizzle-orm";

import { createDatabase, paidArtifactFailureRecords, runMigrations } from "@growthbase/db";
import { getPaidArtifactFailureRecordById } from "@growthbase/receipt";

type CliArgs = {
  failureId?: string;
  limit: number;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const database = createDatabase(process.env.DATABASE_URL);

  try {
    await runMigrations(database);

    if (args.failureId) {
      const record = getPaidArtifactFailureRecordById(database, args.failureId);
      console.log(JSON.stringify({ failureId: args.failureId, record }, null, 2));
      return;
    }

    const rows = database.db
      .select()
      .from(paidArtifactFailureRecords)
      .orderBy(desc(paidArtifactFailureRecords.timestamp))
      .limit(args.limit)
      .all();

    console.log(
      JSON.stringify(
        {
          database: database.filename,
          limit: args.limit,
          count: rows.length,
          failures: rows.map((row) => ({
            failureId: row.failureId,
            serviceId: row.serviceId,
            requestHash: row.requestHash,
            buyerWallet: row.buyerWallet,
            transactionHash: row.transactionHash,
            executionOutcome: row.executionOutcome,
            deliveryStatus: row.deliveryStatus,
            failureCode: row.failureCode,
            failureMessage: row.failureMessage,
            timestamp: row.timestamp
          }))
        },
        null,
        2
      )
    );
  } finally {
    database.close();
  }
}

function parseArgs(argv: string[]): CliArgs {
  const parsed: CliArgs = {
    limit: 10
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--failureId") {
      parsed.failureId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      parsed.limit = Number(argv[index + 1] ?? parsed.limit);
      index += 1;
    }
  }

  return parsed;
}

await main();
