// @vitest-environment jsdom
import {
  saveResilientCursorPosition,
  restoreResilientCursorPosition,
} from "../services/editorTextTransforms/cursor";

/** Build a DOM element from an HTML string (test helper). */
function makeEditor(content: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("contenteditable", "true");
  document.body.appendChild(el);
  // Safe: hardcoded test fixture strings only
  el.insertAdjacentHTML("afterbegin", content);
  return el;
}

function setCursor(node: Node, offset: number): void {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
}

afterEach(() => {
  document.body.textContent = "";
});

describe("saveResilientCursorPosition", () => {
  it("returns null when no selection exists", () => {
    const el = makeEditor("<p>hello</p>");
    window.getSelection()!.removeAllRanges();
    expect(saveResilientCursorPosition(el)).toBeNull();
  });

  it("records path to a text node in a paragraph", () => {
    const el = makeEditor("<p>hello world</p>");
    const textNode = el.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    const saved = saveResilientCursorPosition(el);
    expect(saved).not.toBeNull();
    expect(saved!.path).toEqual([0, 0]); // p[0] -> text[0]
    expect(saved!.offset).toBe(5);
  });
});

describe("restoreResilientCursorPosition", () => {
  it("restores cursor after DOM rebuild with same structure", () => {
    const el = makeEditor("<p>hello world</p><p>second</p>");
    const textNode = el.querySelector("p")!.firstChild!;
    setCursor(textNode, 5);

    const saved = saveResilientCursorPosition(el);

    // Rebuild DOM with identical structure
    el.textContent = "";
    el.insertAdjacentHTML("afterbegin", "<p>hello world</p><p>second</p>");

    restoreResilientCursorPosition(el, saved);

    const sel = window.getSelection()!;
    expect(sel.rangeCount).toBe(1);
    const range = sel.getRangeAt(0);
    expect(range.startOffset).toBe(5);
    expect(range.startContainer.textContent).toBe("hello world");
  });

  it("gracefully handles invalid path (no cursor jump)", () => {
    const el = makeEditor("<p>only one paragraph</p>");
    const textNode = el.querySelector("p")!.firstChild!;
    setCursor(textNode, 3);

    // Saved position pointing to a second paragraph that won't exist
    const saved = { path: [1, 0], offset: 2 };

    // Place cursor at known position first
    setCursor(textNode, 3);
    restoreResilientCursorPosition(el, saved);

    // Cursor should stay where it was (at offset 3), not jump
    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    expect(range.startOffset).toBe(3);
  });

  it("clamps offset to node length", () => {
    const el = makeEditor("<p>hi</p>");
    const saved = { path: [0, 0], offset: 100 };

    restoreResilientCursorPosition(el, saved);

    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    // Should clamp to "hi".length = 2
    expect(range.startOffset).toBe(2);
  });

  it("does nothing when saved is null", () => {
    const el = makeEditor("<p>hello</p>");
    const textNode = el.querySelector("p")!.firstChild!;
    setCursor(textNode, 3);

    restoreResilientCursorPosition(el, null);

    const sel = window.getSelection()!;
    const range = sel.getRangeAt(0);
    expect(range.startOffset).toBe(3);
  });
});
