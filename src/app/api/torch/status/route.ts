import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const TORCH_STATUS_SCRIPT = path.join(ROOT, "scripts", "torch_status.py");

const getPythonCandidates = () => [
  path.join(ROOT, ".venv", "Scripts", "python.exe"),
  "python",
];

const runTorchStatus = async () => {
  const errors: string[] = [];

  for (const python of getPythonCandidates()) {
    const result = await new Promise<{
      ok: boolean;
      stdout: string;
      stderr: string;
      code: number | null;
    }>((resolve) => {
      const child = spawn(python, [TORCH_STATUS_SCRIPT], {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        resolve({
          ok: false,
          stdout,
          stderr: error.message,
          code: null,
        });
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          stdout,
          stderr,
          code,
        });
      });
    });

    if (!result.ok) {
      errors.push(`${python}: ${result.stderr || `exit ${result.code}`}`);
      continue;
    }

    try {
      return JSON.parse(result.stdout);
    } catch (error) {
      errors.push(`${python}: invalid JSON (${String(error)})`);
    }
  }

  return {
    ok: false,
    error: "Unable to execute a Torch-enabled Python runtime.",
    details: errors,
  };
};

export async function GET() {
  const payload = await runTorchStatus();
  return Response.json(payload);
}
