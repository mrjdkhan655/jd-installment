import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const url = new URL(
    user.role === "customer"
      ? `/portal/contracts/${contractId}`
      : `/dashboard/contracts/${contractId}/preview`,
    req.url
  );

  return NextResponse.redirect(url);
}
