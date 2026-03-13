/**
 * Cursor position utilities for text transformations.
 */

export interface CursorPosition {
  node: Node;
  offset: number;
}

/**
 * Save the current cursor position within an element.
 */
export function saveCursorPosition(
  element: HTMLElement,
): CursorPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;
  return { node: range.startContainer, offset: range.startOffset };
}

/**
 * Restore a previously saved cursor position.
 */
export function restoreCursorPosition(
  element: HTMLElement,
  saved: CursorPosition | null,
): void {
  if (!saved) return;
  const selection = window.getSelection();
  if (!selection) return;

  if (element.contains(saved.node)) {
    try {
      const range = document.createRange();
      const maxOffset = saved.node.textContent?.length ?? 0;
      range.setStart(saved.node, Math.min(saved.offset, maxOffset));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      placeCursorAtEnd(element);
    }
  }
}

/**
 * Place cursor at the end of an element.
 */
export function placeCursorAtEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Path-based cursor position that survives DOM replacement.
 * Records the path from editor root as child indices + text offset.
 */
export interface ResilientCursorPosition {
  path: number[];
  offset: number;
}

/**
 * Save cursor as a path of child indices from the editor root.
 * Unlike saveCursorPosition (which stores a node reference),
 * this survives innerHTML replacement when the DOM structure matches.
 */
export function saveResilientCursorPosition(
  editor: HTMLElement,
): ResilientCursorPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return null;

  const path: number[] = [];
  let node: Node = range.startContainer;
  while (node !== editor) {
    const parent = node.parentNode;
    if (!parent) return null;
    const index = Array.from(parent.childNodes).indexOf(node as ChildNode);
    if (index === -1) return null;
    path.unshift(index);
    node = parent;
  }

  return { path, offset: range.startOffset };
}

/**
 * Restore cursor from a path-based position.
 * Gracefully degrades: if the path is invalid (structure changed),
 * leaves the cursor alone rather than jumping to offset 0.
 */
export function restoreResilientCursorPosition(
  editor: HTMLElement,
  saved: ResilientCursorPosition | null,
): void {
  if (!saved) return;
  const selection = window.getSelection();
  if (!selection) return;

  let node: Node = editor;
  for (const index of saved.path) {
    if (index >= node.childNodes.length) return;
    node = node.childNodes[index];
  }

  try {
    const range = document.createRange();
    const maxOffset =
      node.nodeType === Node.TEXT_NODE
        ? (node.textContent?.length ?? 0)
        : node.childNodes.length;
    range.setStart(node, Math.min(saved.offset, maxOffset));
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch {
    // Graceful degradation: don't move cursor
  }
}

/**
 * Place cursor immediately after an element.
 */
export function placeCursorAfterElement(element: Element): void {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStartAfter(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
