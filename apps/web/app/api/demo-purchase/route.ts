import { NextResponse } from "next/server";

import { runDemoPurchase } from "../../../lib/demoPurchaseServer";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runDemoPurchase();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Purchase failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
