export interface TextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

export interface ExtractedEditorText {
  text: string;
  entries: TextNodeEntry[];
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'SECTION', 'ARTICLE'
]);

export function extractTextWithOffsets(root: HTMLElement): ExtractedEditorText {
  let text = '';
  const entries: TextNodeEntry[] = [];

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const content = textNode.data;
      if (content.length > 0) {
        const start = text.length;
        text += content;
        const end = text.length;
        entries.push({ node: textNode, start, end });
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toUpperCase();

      if (tag === 'BR') {
        text += '\n';
        return;
      }

      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
      }

      for (let i = 0; i < element.childNodes.length; i++) {
        walk(element.childNodes[i]);
      }

      if (isBlock && text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
      }
    }
  }

  walk(root);
  return { text, entries };
}

export function createRangeFromOffsets(
  entries: TextNodeEntry[],
  start: number,
  end: number,
  expectedText?: string
): Range | null {
  if (entries.length === 0) return null;

  const rawTarget = expectedText?.trim();

  // If expectedText is provided, locate text in DOM Text nodes (exact, then case-insensitive, with \u00a0 normalized)
  if (rawTarget && rawTarget.length > 0) {
    let bestRange: Range | null = null;
    let minDiff = Infinity;
    const target = rawTarget.replace(/\u00a0/g, ' ');
    const targetLower = target.toLowerCase();

    // 1a. Exact search in single text node (normalizing \u00a0 to ' ' for matching)
    for (const entry of entries) {
      const nodeText = entry.node.data.replace(/\u00a0/g, ' ');
      let pos = nodeText.indexOf(target);
      while (pos !== -1) {
        const candStart = entry.start + pos;
        const diff = Math.abs(candStart - start);
        if (diff < minDiff) {
          minDiff = diff;
          try {
            const r = document.createRange();
            r.setStart(entry.node, pos);
            r.setEnd(entry.node, pos + target.length);
            bestRange = r;
          } catch {
            // Ignore
          }
        }
        pos = nodeText.indexOf(target, pos + 1);
      }
    }

    if (bestRange) return bestRange;

    // 1b. Case-insensitive search in single text node
    for (const entry of entries) {
      const nodeTextLower = entry.node.data.replace(/\u00a0/g, ' ').toLowerCase();
      let pos = nodeTextLower.indexOf(targetLower);
      while (pos !== -1) {
        const candStart = entry.start + pos;
        const diff = Math.abs(candStart - start);
        if (diff < minDiff) {
          minDiff = diff;
          try {
            const r = document.createRange();
            r.setStart(entry.node, pos);
            r.setEnd(entry.node, pos + target.length);
            bestRange = r;
          } catch {
            // Ignore
          }
        }
        pos = nodeTextLower.indexOf(targetLower, pos + 1);
      }
    }

    if (bestRange) return bestRange;

    // 1c. Cross-node search if target spans across adjacent tags
    for (let i = 0; i < entries.length; i++) {
      let combined = '';
      let j = i;
      while (j < entries.length && combined.length < target.length + 50) {
        combined += entries[j].node.data.replace(/\u00a0/g, ' ');
        const matchIdx = combined.indexOf(target);
        const matchIdxCI = matchIdx === -1 ? combined.toLowerCase().indexOf(targetLower) : matchIdx;
        if (matchIdxCI !== -1) {
          try {
            const range = document.createRange();
            let curLen = 0;
            let startSet = false;
            for (let k = i; k <= j; k++) {
              const len = entries[k].node.data.length;
              if (!startSet && matchIdxCI >= curLen && matchIdxCI < curLen + len) {
                range.setStart(entries[k].node, matchIdxCI - curLen);
                startSet = true;
              }
              const endIdx = matchIdxCI + target.length;
              if (startSet && endIdx > curLen && endIdx <= curLen + len) {
                range.setEnd(entries[k].node, endIdx - curLen);
                return range;
              }
              curLen += len;
            }
          } catch {
            // Ignore
          }
        }
        j++;
      }
    }
  }

  // 2. Direct offset matching only when expectedText is not provided
  if (start >= end) return null;
  let startEntry: TextNodeEntry | null = null;
  let endEntry: TextNodeEntry | null = null;

  for (const entry of entries) {
    if (!startEntry && start >= entry.start && start < entry.end) {
      startEntry = entry;
    }
    if (!endEntry && end > entry.start && end <= entry.end) {
      endEntry = entry;
    }
    if (startEntry && endEntry) break;
  }

  if (startEntry && endEntry) {
    try {
      const range = document.createRange();
      const startOffsetInNode = Math.max(0, Math.min(start - startEntry.start, startEntry.node.data.length));
      const endOffsetInNode = Math.max(0, Math.min(end - endEntry.start, endEntry.node.data.length));
      range.setStart(startEntry.node, startOffsetInNode);
      range.setEnd(endEntry.node, endOffsetInNode);
      return range;
    } catch {
      return null;
    }
  }

  return null;
}
