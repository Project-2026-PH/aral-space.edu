export const EMPTY_RICH_TEXT = '<p><br></p>';

const ALLOWED_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL',
  'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'BR', 'HR'
]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character] || character));
}

export function normalizeRichTextHtml(value: string | null | undefined): string {
  if (!value?.trim()) return EMPTY_RICH_TEXT;
  if (!/<[a-z][\s\S]*>/i.test(value)) {
    return `<p>${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`;
  }
  return sanitizeRichTextHtml(value);
}

export function sanitizeRichTextHtml(value: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return value
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/href\s*=\s*(?:"|')?\s*javascript:[^\s"'>]+(?:"|')?/gi, '');
  }

  const document = new DOMParser().parseFromString(value, 'text/html');
  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    if (!ALLOWED_TAGS.has(element.tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const cleanChild = cleanNode(child);
        if (cleanChild) fragment.appendChild(cleanChild);
      });
      return fragment;
    }

    const clean = document.createElement(element.tagName.toLowerCase());
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      if (/^(https?:|mailto:)/i.test(href)) {
        clean.setAttribute('href', href);
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noreferrer noopener');
      }
    }
    Array.from(element.childNodes).forEach((child) => {
      const cleanChild = cleanNode(child);
      if (cleanChild) clean.appendChild(cleanChild);
    });
    return clean;
  };

  const container = document.createElement('div');
  Array.from(document.body.childNodes).forEach((child) => {
    const cleanChild = cleanNode(child);
    if (cleanChild) container.appendChild(cleanChild);
  });
  return container.innerHTML || EMPTY_RICH_TEXT;
}

export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return '';
  if (typeof DOMParser === 'undefined') {
    return value
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<hr\s*\/?\s*>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|pre|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
  const document = new DOMParser().parseFromString(value, 'text/html');
  const text = document.body.innerHTML
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<hr\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|pre|blockquote)>/gi, '\n');
  const parsed = new DOMParser().parseFromString(text, 'text/html');
  return (parsed.body.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function hasRichTextContent(value: string | null | undefined): boolean {
  return Boolean(richTextToPlainText(value));
}

export function buildRichTextPrintDocument(title: string, content: string): string {
  const safeTitle = escapeHtml(title || 'Notes');
  const safeContent = sanitizeRichTextHtml(normalizeRichTextHtml(content));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    @page{margin:18mm}body{background:#fff;color:#000;font-family:Arial,sans-serif;line-height:1.55;max-width:760px;margin:0 auto}h1{font-size:24px;margin:0 0 20px;border-bottom:1px solid #000;padding-bottom:10px}h2{font-size:19px}h3{font-size:16px}h4{font-size:15px}h5{font-size:14px}h6{font-size:13px}p{margin:0 0 10px}blockquote{border-left:4px solid #000;margin:12px 0;padding:4px 14px;color:#000}pre{background:#fff;color:#000;border:1px solid #000;border-radius:6px;padding:12px;white-space:pre-wrap}code{font-family:ui-monospace,monospace;background:#fff;color:#000;border:1px solid #000;border-radius:3px;padding:1px 4px}ul{list-style-type:disc}ol{list-style-type:decimal}ul,ol{padding-left:24px}ul::marker,ol::marker{color:#000}hr{border:0;border-top:1px solid #000;margin:18px 0}a{color:#000}
  </style></head><body><h1>${safeTitle}</h1><main>${safeContent}</main></body></html>`;
}

export function openPrintDocument(title: string, content: string): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.alert('Please allow pop-ups to export your notes as a PDF.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(buildRichTextPrintDocument(title, content));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onafterprint = () => printWindow.close();
  window.setTimeout(() => printWindow.print(), 250);
}
