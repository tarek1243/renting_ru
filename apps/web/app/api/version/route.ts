import { unstable_noStore as noStore } from "next/cache";
import { NextResponse } from "next/server";
import { getAppVersion } from "../../../lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  noStore();

  return NextResponse.json(
    { version: getAppVersion() },
    { headers: { "cache-control": "no-store" } },
  );
}
