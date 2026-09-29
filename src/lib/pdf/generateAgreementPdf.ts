import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import type { AgreementData } from "./AgreementDocument";

const execFileAsync = promisify(execFile);

export async function generateAgreementPdf(data: AgreementData): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tmpDir, `agreement-${id}.json`);
  const outputPath = path.join(tmpDir, `agreement-${id}.pdf`);

  try {
    await fs.promises.writeFile(inputPath, JSON.stringify(data), "utf-8");

    const cliPath = path.resolve(process.cwd(), "src/lib/pdf/generatePdfCli.ts");
    const tsxBin = path.resolve(process.cwd(), "node_modules/.bin/tsx");

    await execFileAsync(tsxBin, [cliPath, inputPath, outputPath], {
      timeout: 30000,
      env: { ...process.env },
    });

    const buffer = await fs.promises.readFile(outputPath);
    return buffer;
  } finally {
    try {
      if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
      if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
