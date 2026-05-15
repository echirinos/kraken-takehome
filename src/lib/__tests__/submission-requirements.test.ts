import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("submission requirements", () => {
  it("includes the required repository artifacts", () => {
    for (const relativePath of [
      "Dockerfile",
      "docker-compose.yml",
      "README.md",
      "solution-design-note.md",
      "ai-transcript.md",
      "public/kraken-logo.png",
      "data/assets.json",
      "data/strategies.json",
    ]) {
      expect(fs.existsSync(path.join(root, relativePath)), relativePath).toBe(true);
    }
  });

  it("keeps Docker Compose compatible with the grader", () => {
    const compose = read("docker-compose.yml");
    const dockerfile = read("Dockerfile");

    expect(compose).toContain("3000:3000");
    expect(compose).toContain("./data:/app/data:ro");
    expect(compose).not.toMatch(/^networks:/m);
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain('CMD ["npm", "run", "start"]');
  });

  it("does not introduce runtime outbound network clients in application code", () => {
    const runtimeFiles = listRuntimeSourceFiles(path.join(root, "src"));
    const forbiddenPatterns = [
      /\bfetch\s*\(/,
      /\baxios\b/,
      /from\s+["']node:https?["']/,
      /require\(["']node:https?["']\)/,
      /\bhttps?\.(request|get)\s*\(/,
      /\bnet\.connect\s*\(/,
      /\bdns\.(lookup|resolve)\s*\(/,
      /new\s+WebSocket\s*\(/,
    ];

    const violations = runtimeFiles.flatMap((filePath) => {
      const contents = fs.readFileSync(filePath, "utf8");
      return forbiddenPatterns
        .filter((pattern) => pattern.test(contents))
        .map((pattern) => `${path.relative(root, filePath)} matched ${pattern}`);
    });

    expect(violations).toEqual([]);
  });

  it("documents the reviewer-critical decisions", () => {
    const readme = read("README.md");
    const designNote = read("solution-design-note.md");
    const transcript = read("ai-transcript.md");

    expect(readme).toContain("docker-compose up");
    expect(readme).toContain("/earn-products");
    expect(readme).toContain("Dependencies");
    expect(readme).toContain("Known Limitations");
    expect(readme).toContain("apr_estimate.low");
    expect(readme).toContain("can_allocate");

    expect(designNote).toContain("```mermaid");
    expect(designNote).toContain("Read ./data/*.json");
    expect(designNote).toContain("400 INVALID_TIER");
    expect(designNote).toContain("500 DATA_UNAVAILABLE");
    expect(designNote).toContain("2.9999999999999999");

    expect(transcript).toContain("Critical review");
    expect(transcript).toContain("Final Trap Review");
    expect(transcript).toContain("AI Limits");
  });
});

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listRuntimeSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listRuntimeSourceFiles(fullPath);
    }

    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      return [fullPath];
    }

    return [];
  });
}
