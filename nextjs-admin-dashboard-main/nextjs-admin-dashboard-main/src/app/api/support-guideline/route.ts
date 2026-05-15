import { readFile, readdir } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

export const runtime = "nodejs";

const PREFERRED_NAMES = [
  "support-guideline.docx",
  "Support-and-guideline.docx",
  "guideline.docx",
];

/** Do not walk these top-level folders under public (large static assets). */
const SKIP_TOP_LEVEL_DIRS = new Set(["images"]);

async function findHandbookRelativePaths(publicDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentAbs: string, relativePosix: string): Promise<void> {
    const entries = await readdir(currentAbs, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(currentAbs, ent.name);
      const rel = relativePosix ? `${relativePosix}/${ent.name}` : ent.name;

      if (ent.isDirectory()) {
        if (relativePosix === "" && SKIP_TOP_LEVEL_DIRS.has(ent.name)) {
          continue;
        }
        await walk(abs, rel);
      } else if (/\.docx$/i.test(ent.name) || /\.word$/i.test(ent.name)) {
        results.push(rel);
      }
    }
  }

  await walk(publicDir, "");
  return results;
}

function pickRelativePath(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  const lower = candidates.map((p) => ({ p, l: p.toLowerCase() }));
  for (const pref of PREFERRED_NAMES) {
    const pl = pref.toLowerCase();
    const hit = lower.find(({ l }) => l === pl || l.endsWith(`/${pl}`));
    if (hit) return hit.p;
  }
  return [...candidates].sort((a, b) => a.localeCompare(b, "en"))[0] ?? null;
}

export async function GET() {
  const publicDir = path.join(process.cwd(), "public");

  let relative: string | null = null;
  try {
    const all = await findHandbookRelativePaths(publicDir);
    relative = pickRelativePath(all);
  } catch {
    return NextResponse.json(
      { message: "Could not read the public folder on the server." },
      { status: 500 },
    );
  }

  if (!relative) {
    return NextResponse.json(
      {
        message:
          "No handbook file found. Put a Word file saved as .docx inside the project's public folder (you can use a subfolder such as public/docs).",
      },
      { status: 404 },
    );
  }

  const filePath = path.join(publicDir, ...relative.split("/"));
  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return NextResponse.json({ message: "Handbook file could not be read from disk." }, { status: 404 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${path.basename(relative)}"`,
      "X-Support-Document": relative,
      "Cache-Control": "private, max-age=30",
    },
  });
}
