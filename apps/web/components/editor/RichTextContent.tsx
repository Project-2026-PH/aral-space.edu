import React from 'react';
import { normalizeRichTextHtml, sanitizeRichTextHtml } from '@/lib/richText';

export default function RichTextContent({ html, className = '' }: { html: string | null | undefined; className?: string }) {
  return <div className={`rich-text-content ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(normalizeRichTextHtml(html)) }} />;
}
