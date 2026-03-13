// @vitest-environment jsdom
import { sanitizeHtml } from "../utils/sanitize";

/**
 * Replicate serializeEditorContent logic for testing.
 * The real function is not exported — we test the same algorithm.
 */
function canonicalSerialize(editor: HTMLElement): string {
  const clone = editor.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll("[class]")) {
    el.removeAttribute("class");
  }
  for (const img of clone.querySelectorAll("img[data-image-id]")) {
    img.removeAttribute("src");
  }
  for (const el of clone.querySelectorAll("[style]")) {
    el.removeAttribute("style");
  }
  return clone.innerHTML;
}

/** Build a DOM element from an HTML string (test helper). */
function html(content: string): HTMLElement {
  const el = document.createElement("div");
  // Safe: hardcoded test fixture strings only
  el.insertAdjacentHTML("afterbegin", content);
  return el;
}

describe("canonicalSerialize", () => {
  it("strips section-hue class attributes", () => {
    const el = html(
      '<div data-section-type="work" class="section-hue-3">+work</div>' +
        '<div class="section-hue-3"><p>task notes</p></div>',
    );
    const result = canonicalSerialize(el);
    expect(result).not.toContain("class=");
    expect(result).toContain('data-section-type="work"');
    expect(result).toContain("+work");
  });

  it("strips src on images with data-image-id", () => {
    const el = html(
      '<img data-image-id="abc" src="blob:http://localhost/fake" alt="photo" width="100" height="80">',
    );
    const result = canonicalSerialize(el);
    expect(result).not.toContain("src=");
    expect(result).toContain('data-image-id="abc"');
    expect(result).toContain('alt="photo"');
  });

  it("preserves src on images without data-image-id", () => {
    const el = html('<img src="https://example.com/img.png" alt="ext">');
    const result = canonicalSerialize(el);
    expect(result).toContain("src=");
  });

  it("strips style attributes", () => {
    const el = html('<p style="color: red;">styled text</p>');
    const result = canonicalSerialize(el);
    expect(result).not.toContain("style=");
    expect(result).toContain("styled text");
  });

  it("produces output that survives sanitizeHtml round-trip", () => {
    const el = html(
      '<div data-section-type="work" class="section-hue-3">+work</div>' +
        '<div class="section-hue-3"><p>notes here</p></div>' +
        '<img data-image-id="img1" src="blob:http://localhost/x" alt="pic" width="200" height="150">' +
        '<p style="font-weight: bold;">hello</p>',
    );
    const canonical = canonicalSerialize(el);
    const afterSanitize = sanitizeHtml(canonical);
    expect(afterSanitize).toBe(canonical);
  });

  it("does not mutate the original DOM", () => {
    const el = html(
      '<div data-section-type="work" class="section-hue-3">+work</div>',
    );
    canonicalSerialize(el);
    expect(el.querySelector("[data-section-type]")?.className).toBe(
      "section-hue-3",
    );
  });
});
