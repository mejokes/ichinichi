import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("NoteEditor header layout", () => {
  it("keeps header width aligned with editor body width", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");
    const headerRuleMatch = css.match(/\.header\s*\{[^}]*\}/m);

    expect(headerRuleMatch).toBeTruthy();
    expect(headerRuleMatch?.[0]).toMatch(/\bmax-width\s*:\s*65ch\b/);
  });

  it("anchors saving status inside header bounds", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");
    const headerRuleMatch = css.match(/\.header\s*\{[^}]*\}/m);

    expect(headerRuleMatch).toBeTruthy();
    expect(headerRuleMatch?.[0]).toMatch(/\bposition\s*:\s*relative\b/);
  });

  it("lets the title row grow so weather can align to right edge", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");
    const headerTitleRuleMatch = css.match(/\.headerTitle\s*\{[^}]*\}/m);

    expect(headerTitleRuleMatch).toBeTruthy();
    expect(headerTitleRuleMatch?.[0]).toMatch(/\bflex\s*:\s*1\b/);
  });

  it("left-aligns weather on mobile when it wraps under the title", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");

    expect(css).toMatch(
      /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*\.weatherLabel\s*\{[\s\S]*margin-left\s*:\s*0[\s;\S]*\}[\s\S]*\}/m,
    );
  });

  it("pins saving status to bottom-right of header", () => {
    const cssPath = resolve(
      process.cwd(),
      "src/components/NoteEditor/NoteEditor.module.css",
    );
    const css = readFileSync(cssPath, "utf8");
    const savingRuleMatch = css.match(/\.saving\s*\{[^}]*\}/m);

    expect(savingRuleMatch).toBeTruthy();
    expect(savingRuleMatch?.[0]).toMatch(/\btop\s*:\s*100%/);
    expect(savingRuleMatch?.[0]).toMatch(/\bright\s*:\s*0\b/);
  });
});
