import fs from "fs";
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { AgreementDocument, type AgreementData } from "./AgreementDocument";

async function main() {
  const jsonPath = process.argv[2];
  const outPath = process.argv[3];
  if (!jsonPath || !outPath) {
    console.error("Usage: tsx generatePdfCli.ts <input.json> <output.pdf>");
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: AgreementData = JSON.parse(raw);

  const element = React.createElement(AgreementDocument, { data });
  await renderToFile(element as any, outPath);
  process.exit(0);
}

main().catch((err) => {
  console.error("PDF generation CLI failed:", err);
  process.exit(1);
});
