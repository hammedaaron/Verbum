import { marked } from 'marked';
import { DocumentBlock } from '../types/manuscript';
import { countWords, createBlock } from './storage';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Losslessly converts a DOM Node into Markdown text while preserving exact casing.
 */
export function domNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Embedded document card
  if (el.getAttribute('data-embedded-doc') === 'true') {
    const title = el.getAttribute('data-embedded-title') || 'Document';
    return `[doc: ${title}]`;
  }

  // Inline import document badge
  if (el.classList.contains('inline-doc-trigger')) {
    return '[ ]';
  }

  // Recursively process child nodes
  let childMarkdown = '';
  for (const child of Array.from(el.childNodes)) {
    childMarkdown += domNodeToMarkdown(child);
  }

  switch (tag) {
    case 'h1': {
      const clean = childMarkdown.trim().replace(/^#+\s*/, '');
      return `# ${clean}\n\n`;
    }
    case 'h2': {
      const clean = childMarkdown.trim().replace(/^#+\s*/, '');
      return `## ${clean}\n\n`;
    }
    case 'h3': {
      const clean = childMarkdown.trim().replace(/^#+\s*/, '');
      return `### ${clean}\n\n`;
    }
    case 'h4':
    case 'h5':
    case 'h6': {
      const clean = childMarkdown.trim().replace(/^#+\s*/, '');
      return `#### ${clean}\n\n`;
    }
    case 'strong':
    case 'b': {
      const trimmed = childMarkdown.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) return childMarkdown;
      return `**${childMarkdown}**`;
    }
    case 'em':
    case 'i': {
      const trimmed = childMarkdown.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('*') && trimmed.endsWith('*')) return childMarkdown;
      return `*${childMarkdown}*`;
    }
    case 's':
    case 'del':
    case 'strike': {
      const trimmed = childMarkdown.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('~~') && trimmed.endsWith('~~')) return childMarkdown;
      return `~~${childMarkdown}~~`;
    }
    case 'code': {
      if (el.parentElement?.tagName.toLowerCase() === 'pre') {
        return childMarkdown;
      }
      const trimmed = childMarkdown.trim();
      if (!trimmed) return '';
      return `\`${childMarkdown}\``;
    }
    case 'pre':
      return `\`\`\`\n${childMarkdown.trim()}\n\`\`\`\n\n`;
    case 'blockquote': {
      const clean = childMarkdown.trim().replace(/^>\s*/, '');
      return `> ${clean}\n\n`;
    }
    case 'li': {
      const parentTag = el.parentElement?.tagName.toLowerCase();
      const clean = childMarkdown.trim().replace(/^([-*+]|\d+\.)\s*/, '');
      if (parentTag === 'ol') {
        return `1. ${clean}\n`;
      }
      return `- ${clean}\n`;
    }
    case 'ul':
    case 'ol':
      return `${childMarkdown.trim()}\n\n`;
    case 'span': {
      const trimmed = childMarkdown.trim();
      if (!trimmed) return '';
      let res = childMarkdown;
      const fontWeight = el.style.fontWeight || '';
      const isBold = fontWeight === 'bold' || parseInt(fontWeight, 10) >= 600 || el.classList.contains('font-bold');
      const isItalic = el.style.fontStyle === 'italic' || el.classList.contains('italic');
      const isStrike = el.style.textDecoration?.includes('line-through') || el.classList.contains('line-through');
      const isMono = el.style.fontFamily?.toLowerCase().includes('mono') || el.classList.contains('font-mono');

      if (isMono && !res.startsWith('`') && !res.endsWith('`')) {
        res = `\`${res}\``;
      }
      if (isBold && !res.startsWith('**') && !res.endsWith('**')) {
        res = `**${res}**`;
      }
      if (isItalic && !res.startsWith('*') && !res.endsWith('*')) {
        res = `*${res}*`;
      }
      if (isStrike && !res.startsWith('~~') && !res.endsWith('~~')) {
        res = `~~${res}~~`;
      }
      return res;
    }
    case 'p':
    case 'div': {
      if (el.classList.contains('doc-title')) {
        const clean = childMarkdown.trim().replace(/^#+\s*/, '');
        return `# ${clean}\n\n`;
      }
      if (el.classList.contains('doc-subheading')) {
        const clean = childMarkdown.trim().replace(/^#+\s*/, '');
        return `### ${clean}\n\n`;
      }
      const trimmed = childMarkdown.trim();
      return trimmed ? `${trimmed}\n\n` : '';
    }
    case 'br':
      return '\n';
    case 'a': {
      const href = el.getAttribute('href') || '';
      return href ? `[${childMarkdown}](${href})` : childMarkdown;
    }
    default:
      return childMarkdown;
  }
}

/**
 * Converts a DOM fragment or element hierarchy into clean Markdown.
 */
export function domFragmentToMarkdown(fragment: DocumentFragment | HTMLElement): string {
  let md = '';
  for (const child of Array.from(fragment.childNodes)) {
    md += domNodeToMarkdown(child);
  }
  return md.trim();
}

/**
 * Converts a DOM selection fragment or HTML into structured, multi-format DocumentBlocks.
 * Recognizes titles, subtitles, bold, italics, monospace, blockquotes, and lists individually
 * without collapsing them into a single dominant format or altering casing.
 */
function hasBlockLevelChildren(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return false;
  const element = node as HTMLElement;
  const blockSelector = 'p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, div, table, tr, td, th, section, article, header, footer, [data-block-id], [data-embedded-doc]';
  return Boolean(element.querySelector?.(blockSelector));
}

/**
 * Converts a DOM selection fragment or HTML into structured, multi-format DocumentBlocks.
 * Recognizes titles, subtitles, bold, italics, monospace, blockquotes, and lists individually
 * without collapsing them into a single dominant format or altering casing.
 * Handles nested wrappers from Google Docs (<b id="docs-internal-guid-...">), Microsoft Word,
 * Wikipedia, blogs, and rich web pages seamlessly.
 */
export function domFragmentToSmartBlocks(container: DocumentFragment | HTMLElement): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  // Helper function to recursively extract blocks from any DOM subtree
  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        blocks.push(createBlock('body', text.trim()));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    // 1. Embedded doc card
    if (el.getAttribute('data-embedded-doc') === 'true') {
      const title = el.getAttribute('data-embedded-title') || 'Document';
      const words = parseInt(el.getAttribute('data-embedded-words') || '0', 10);
      let embeddedBlocks: DocumentBlock[] = [];
      try {
        const rawJson = el.getAttribute('data-embedded-blocks');
        if (rawJson) embeddedBlocks = JSON.parse(rawJson);
      } catch (e) {}

      blocks.push({
        id: 'blk_' + Math.random().toString(36).substring(2, 9),
        type: 'embedded-doc',
        text: `[doc: ${title}]`,
        wordCount: words,
        charCount: 0,
        embeddedDocTitle: title,
        embeddedDocWords: words,
        embeddedDocBlocks: embeddedBlocks,
      });
      return;
    }

    // 2. Containers with block-level children (Google Docs <b id="docs-internal-guid-...>, <div>, <section>, <article>, lists, tables)
    if (hasBlockLevelChildren(el)) {
      // List container
      if (tagName === 'ul' || tagName === 'ol') {
        const listType: DocumentBlock['type'] = tagName === 'ol' ? 'numbered' : 'bullet';
        const lis = Array.from(el.querySelectorAll('li'));
        for (const li of lis) {
          let liMd = '';
          for (const c of Array.from(li.childNodes)) {
            liMd += domNodeToMarkdown(c);
          }
          const clean = liMd.trim().replace(/^([-*+]|\d+\.)\s*/, '');
          if (clean) {
            blocks.push(createBlock(listType, clean));
          }
        }
        return;
      }

      // Table container: extract rows as clean markdown rows
      if (tagName === 'table') {
        const rows = Array.from(el.querySelectorAll('tr'));
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('th, td')).map((c) => {
            let cellMd = '';
            for (const child of Array.from(c.childNodes)) {
              cellMd += domNodeToMarkdown(child);
            }
            return cellMd.trim();
          });
          if (cells.length > 0 && cells.some((c) => c.length > 0)) {
            blocks.push(createBlock('body', `| ${cells.join(' | ')} |`));
          }
        }
        return;
      }

      // Transparent wrapper elements (e.g. Google Docs <b id="docs-internal-guid-...>, <div>, <section>, <article>):
      // Recursively process each child node to preserve the genuine block sequence
      for (const child of Array.from(el.childNodes)) {
        processNode(child);
      }
      return;
    }

    // 3. Leaf Element without block descendants (e.g. <p>, <h1>, <h2>, <h3>, <blockquote>, <pre>, <li>, or inline-only <div>)
    if (tagName === 'li') {
      let liMd = '';
      for (const c of Array.from(el.childNodes)) {
        liMd += domNodeToMarkdown(c);
      }
      const clean = liMd.trim().replace(/^([-*+]|\d+\.)\s*/, '');
      if (clean) {
        blocks.push(createBlock('bullet', clean));
      }
      return;
    }

    // Determine semantic block type
    let type: DocumentBlock['type'] = 'body';
    if (tagName === 'h1') {
      type = el.classList.contains('doc-title') ? 'title' : 'h1';
    } else if (tagName === 'h2') {
      type = 'h2';
    } else if (tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
      type = 'h3';
    } else if (tagName === 'blockquote') {
      type = 'blockquote';
    } else if (tagName === 'pre' || tagName === 'code' || el.classList.contains('font-mono')) {
      type = 'code';
    } else if (el.classList.contains('doc-subheading')) {
      type = 'subheading';
    } else if (el.classList.contains('doc-title')) {
      type = 'title';
    }

    // Extract inline markdown of element contents (preserving bold, italics, monospace, strikethrough, links)
    let innerMarkdown = '';
    for (const child of Array.from(el.childNodes)) {
      innerMarkdown += domNodeToMarkdown(child);
    }
    let cleanText = innerMarkdown.trim();

    // Strip leading markdown prefixes for block tags
    if (type === 'title' || type === 'h1' || type === 'h2' || type === 'h3' || type === 'subheading') {
      cleanText = cleanText.replace(/^#+\s*/, '');
    } else if (type === 'blockquote') {
      cleanText = cleanText.replace(/^>\s*/, '');
    }

    // If type was body, check if innerText started with markdown prefix
    if (type === 'body') {
      if (cleanText.startsWith('# ')) {
        type = 'title';
        cleanText = cleanText.slice(2).trim();
      } else if (cleanText.startsWith('## ')) {
        type = 'h1';
        cleanText = cleanText.slice(3).trim();
      } else if (cleanText.startsWith('### ')) {
        type = 'h2';
        cleanText = cleanText.slice(4).trim();
      } else if (cleanText.startsWith('#### ')) {
        type = 'h3';
        cleanText = cleanText.slice(5).trim();
      } else if (cleanText.startsWith('> ')) {
        type = 'blockquote';
        cleanText = cleanText.slice(2).trim();
      } else if (cleanText.startsWith('- ') || cleanText.startsWith('* ')) {
        type = 'bullet';
        cleanText = cleanText.slice(2).trim();
      } else if (/^\d+\.\s+/.test(cleanText)) {
        type = 'numbered';
        cleanText = cleanText.replace(/^\d+\.\s+/, '').trim();
      }
    }

    // If leaf block contains double newlines (e.g. from <br><br> in a single div or paragraph), split into paragraphs
    if (type === 'body' && cleanText.includes('\n\n')) {
      const parts = cleanText.split(/\n{2,}/);
      for (const p of parts) {
        if (p.trim()) {
          blocks.push(createBlock('body', p.trim()));
        }
      }
      return;
    }

    if (cleanText) {
      blocks.push(createBlock(type, cleanText));
    }
  }

  // Check if container has only purely inline elements (no block level descendants at all)
  const isPureInline = !hasBlockLevelChildren(container) && Array.from(container.childNodes).every((n) => {
    if (n.nodeType === Node.TEXT_NODE) return true;
    if (n.nodeType === Node.ELEMENT_NODE) {
      const tag = (n as HTMLElement).tagName.toLowerCase();
      return ['strong', 'b', 'em', 'i', 's', 'del', 'code', 'span', 'a', 'br'].includes(tag);
    }
    return false;
  });

  if (isPureInline && container.childNodes.length > 0) {
    let inlineMd = '';
    for (const n of Array.from(container.childNodes)) {
      inlineMd += domNodeToMarkdown(n);
    }
    const trimmed = inlineMd.trim();
    if (trimmed) {
      return [createBlock('body', trimmed)];
    }
    return [];
  }

  // Process all top-level child nodes
  for (const node of Array.from(container.childNodes)) {
    processNode(node);
  }

  return blocks;
}

/**
 * Line-aware parser that accurately converts markdown text into DocumentBlocks.
 * Ensures titles, subheadings, quotes, lists, and monospace never swallow each other.
 */
export function markdownTextToBlocks(markdown: string): DocumentBlock[] {
  if (!markdown || !markdown.trim()) {
    return [createBlock('body', '')];
  }

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: DocumentBlock[] = [];
  let currentBodyLines: string[] = [];

  const flushBody = () => {
    if (currentBodyLines.length > 0) {
      const text = currentBodyLines.join('\n').trim();
      if (text) {
        blocks.push(createBlock('body', text));
      }
      currentBodyLines = [];
    }
  };

  let inCodeFence = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code fence block ```
    if (trimmed.startsWith('```')) {
      if (inCodeFence) {
        inCodeFence = false;
        blocks.push(createBlock('code', codeLines.join('\n')));
        codeLines = [];
        continue;
      } else {
        flushBody();
        inCodeFence = true;
        codeLines = [];
        continue;
      }
    }

    if (inCodeFence) {
      codeLines.push(line);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushBody();
      continue;
    }

    // Heading tags
    if (trimmed.startsWith('# ')) {
      flushBody();
      blocks.push(createBlock('title', trimmed.slice(2).trim()));
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushBody();
      blocks.push(createBlock('h1', trimmed.slice(3).trim()));
      continue;
    }
    if (trimmed.startsWith('### ')) {
      flushBody();
      blocks.push(createBlock('h2', trimmed.slice(4).trim()));
      continue;
    }
    if (trimmed.startsWith('#### ')) {
      flushBody();
      blocks.push(createBlock('h3', trimmed.slice(5).trim()));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushBody();
      blocks.push(createBlock('blockquote', trimmed.slice(2).trim()));
      continue;
    }

    // Bullet list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushBody();
      blocks.push(createBlock('bullet', trimmed.slice(2).trim()));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      flushBody();
      blocks.push(createBlock('numbered', trimmed.replace(/^\d+\.\s+/, '').trim()));
      continue;
    }

    // Single-line monospace code `code`
    if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length > 2 && !trimmed.slice(1, -1).includes('`')) {
      flushBody();
      blocks.push(createBlock('code', trimmed.slice(1, -1)));
      continue;
    }

    // Normal body line
    currentBodyLines.push(line);
  }

  if (inCodeFence && codeLines.length > 0) {
    blocks.push(createBlock('code', codeLines.join('\n')));
  }

  flushBody();

  return blocks.length > 0 ? blocks : [createBlock('body', '')];
}

/**
 * Renders a single DocumentBlock to clean, valid HTML with no nested block-tag violations.
 */
export function renderBlockToHtml(block: DocumentBlock): string {
  if (block.type === 'embedded-doc') {
    const title = block.embeddedDocTitle || 'Document';
    const words = (block.embeddedDocWords || block.wordCount).toLocaleString();
    const rawBlocks = block.embeddedDocBlocks
      ? JSON.stringify(block.embeddedDocBlocks).replace(/"/g, '&quot;')
      : '[]';
    return `<div contenteditable="false" data-block-id="${block.id}" data-embedded-doc="true" data-embedded-title="${title}" data-embedded-words="${block.embeddedDocWords || block.wordCount}" data-embedded-blocks="${rawBlocks}" class="my-3 p-3 rounded-lg border border-neutral-200 dark:border-white/10 bg-neutral-50/80 dark:bg-white/[0.04] flex items-center justify-between gap-3 select-none">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-amber-500 font-bold">📄</span>
        <span class="font-medium text-xs text-neutral-800 dark:text-neutral-200 truncate">${title}</span>
        <span class="text-[11px] text-neutral-400 font-mono">${words}w</span>
      </div>
      <div class="flex items-center gap-1.5 text-xs">
        <button type="button" data-action="expand-embedded" class="px-2 py-0.5 rounded bg-neutral-200/60 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-700 dark:text-neutral-200 transition">Expand</button>
      </div>
    </div>`;
  }

  // Parse inline markdown: renders **bold**, *italic*, ~~strikethrough~~, `code`, [links]
  let inlineHtml = marked.parseInline(block.text || '') as string;

  // Convert empty [ ] signs or [import: ...] into interactive document badges
  inlineHtml = inlineHtml.replace(
    /\[\s*\]|\[import(?::\s*([^\]]+))?\]/gi,
    (_match, docName) => {
      const label = docName ? `[ 📄 Import Document: ${docName.trim()} ]` : '[ 📄 Import Additional Document ]';
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-sans font-semibold text-[11px] cursor-pointer hover:bg-amber-500/25 transition select-none inline-doc-trigger">${label}</span>`;
    }
  );

  const inner = inlineHtml || '<br>';

  let tag = 'p';
  let extraClass = 'doc-block ';
  if (block.type === 'title') {
    tag = 'h1';
    extraClass += 'doc-title text-2xl font-bold tracking-tight text-neutral-950 dark:text-white mb-3 mt-1 ';
  } else if (block.type === 'h1') {
    tag = 'h1';
    extraClass += 'text-xl font-bold text-neutral-900 dark:text-white mt-5 mb-2 ';
  } else if (block.type === 'h2') {
    tag = 'h2';
    extraClass += 'text-lg font-semibold text-neutral-800 dark:text-neutral-100 mt-4 mb-2 ';
  } else if (block.type === 'h3') {
    tag = 'h3';
    extraClass += 'text-base font-medium text-neutral-700 dark:text-neutral-200 mt-3 mb-1 ';
  } else if (block.type === 'subheading') {
    tag = 'p';
    extraClass += 'doc-subheading text-base font-medium text-neutral-500 dark:text-neutral-400 mb-3 ';
  } else if (block.type === 'blockquote') {
    tag = 'blockquote';
    extraClass += 'italic pl-3.5 border-l-2 border-amber-500 text-neutral-700 dark:text-neutral-300 my-3 ';
  } else if (block.type === 'code') {
    tag = 'pre';
    extraClass += 'font-mono text-xs bg-neutral-100 dark:bg-white/5 p-3 rounded text-neutral-800 dark:text-neutral-200 my-3 overflow-x-auto ';
  } else if (block.type === 'bullet') {
    tag = 'p';
    extraClass += 'list-item list-disc ml-5 text-neutral-800 dark:text-neutral-200 my-1 ';
  } else if (block.type === 'numbered') {
    tag = 'p';
    extraClass += 'list-item list-decimal ml-5 text-neutral-800 dark:text-neutral-200 my-1 ';
  } else {
    tag = 'p';
    extraClass += 'text-neutral-800 dark:text-neutral-200 my-2 leading-relaxed ';
  }

  if (block.bold) extraClass += 'font-bold ';
  if (block.italic) extraClass += 'italic ';
  if (block.underline) extraClass += 'underline ';
  if (block.strikethrough) extraClass += 'line-through ';

  const alignStyle = block.align ? `text-align: ${block.align};` : '';
  const indentStyle = block.indent ? `margin-left: ${block.indent * 1.5}rem;` : '';
  const styleAttr = alignStyle || indentStyle ? ` style="${alignStyle} ${indentStyle}"` : '';

  return `<${tag} data-block-id="${block.id}" class="${extraClass.trim()}"${styleAttr}>${inner}</${tag}>`;
}

/**
 * Serializes DocumentBlock array into continuous HTML for unified multi-section selection.
 */
export function renderBlocksToDocumentHtml(blocks: DocumentBlock[]): string {
  if (!blocks || blocks.length === 0) {
    return '<p class="doc-block" data-block-id="blk_init"><br></p>';
  }

  return blocks.map((b) => renderBlockToHtml(b)).join('\n');
}

/**
 * Parses continuous document HTML back into DocumentBlock array using the smart block engine.
 */
export function parseDocumentHtmlToBlocks(container: HTMLElement): DocumentBlock[] {
  const parsed = domFragmentToSmartBlocks(container);
  if (parsed.length === 0) {
    return [createBlock('body', '')];
  }
  return parsed;
}

/**
 * Backward compatibility helper
 */
export function renderMarkdownToHtml(text: string, block?: DocumentBlock): string {
  if (block) {
    return renderBlockToHtml({ ...block, text });
  }
  return marked.parse(text) as string;
}

/**
 * Parses inline markdown (strong, em, code, strike) without wrapping in <p>
 */
export function renderInlineMarkdownToHtml(text: string): string {
  return marked.parseInline(text || '') as string;
}

