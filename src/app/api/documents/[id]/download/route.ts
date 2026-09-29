import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: fileBlob, error: downloadErr } = await supabase.storage
    .from("documents")
    .download(doc.storage_path);

  if (downloadErr || !fileBlob) {
    // If download directly fails, attempt signed url redirect
    const { data: signed } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 60);

    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl);
    }
    return NextResponse.json({ error: "Could not retrieve file content" }, { status: 404 });
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.file_name)}"`,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
