import { DocumentBlock, BlockType } from '../types/manuscript';
import { createBlock } from './storage';

export interface ParseResult {
  blocks: DocumentBlock[];
  title?: string;
  wordCount: number;
}

// Parse Markdown content into structured blocks
export function parseMarkdown(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const blocks: DocumentBlock[] = [];
  let buffer: string[] = [];
  let currentType: BlockType = 'body';

  function flushBuffer() {
    if (buffer.length === 0) return;
    const content = buffer.join('\n').trim();
    if (content) {
      blocks.push(createBlock(currentType, content));
    }
    buffer = [];
    currentType = 'body';
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushBuffer();
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushBuffer();
      blocks.push(createBlock('title', trimmed.substring(2)));
    } else if (trimmed.startsWith('## ')) {
      flushBuffer();
      blocks.push(createBlock('h1', trimmed.substring(3)));
    } else if (trimmed.startsWith('### ')) {
      flushBuffer();
      blocks.push(createBlock('h2', trimmed.substring(4)));
    } else if (trimmed.startsWith('#### ')) {
      flushBuffer();
      blocks.push(createBlock('h3', trimmed.substring(5)));
    } else if (trimmed.startsWith('> ')) {
      flushBuffer();
      blocks.push(createBlock('blockquote', trimmed.substring(2)));
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushBuffer();
      blocks.push(createBlock('bullet', trimmed.substring(2)));
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushBuffer();
      const match = trimmed.match(/^\d+\.\s(.*)/);
      blocks.push(createBlock('numbered', match ? match[1] : trimmed));
    } else if (trimmed.startsWith('```')) {
      flushBuffer();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(createBlock('code', codeLines.join('\n')));
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  const totalWords = blocks.reduce((sum, b) => sum + b.wordCount, 0);
  return { blocks, wordCount: totalWords };
}

// Parse Plain Text into chapters and paragraphs
export function parsePlainText(text: string): ParseResult {
  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  const blocks: DocumentBlock[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const raw = paragraphs[i].trim();
    if (!raw) continue;

    // Detect heading patterns
    if (i === 0 && raw.length < 80 && !/[.!?]$/.test(raw)) {
      blocks.push(createBlock('title', raw));
    } else if (/^chapter\s+\d+/i.test(raw) || /^book\s+\d+/i.test(raw)) {
      blocks.push(createBlock('h1', raw));
    } else if (/^section\s+[0-9ivxlcdm]+/i.test(raw)) {
      blocks.push(createBlock('h2', raw));
    } else if (raw.length < 60 && !/[.!?]$/.test(raw) && raw.toUpperCase() === raw) {
      blocks.push(createBlock('h2', raw));
    } else {
      blocks.push(createBlock('body', raw));
    }
  }

  const totalWords = blocks.reduce((sum, b) => sum + b.wordCount, 0);
  return { blocks, wordCount: totalWords };
}

// Parse RTF (Rich Text Format)
export function parseRTF(rtfContent: string): ParseResult {
  // Strip RTF control words and groups
  let text = rtfContent
    .replace(/\\par[d]?/g, '\n\n')
    .replace(/\\tab/g, '\t')
    .replace(/\\line/g, '\n')
    .replace(/\{\*?\\[^{}]+;?\}/g, '')
    .replace(/\\[a-z0-9-]+ ?/gi, '')
    .replace(/[{}]/g, '')
    .trim();

  return parsePlainText(text);
}

// Parse DOCX via JSZip structure or extraction
export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) {
    throw new Error('Invalid DOCX format: word/document.xml not found');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXml, 'application/xml');
  const paragraphs = xmlDoc.getElementsByTagName('w:p');

  const blocks: DocumentBlock[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const textNodes = p.getElementsByTagName('w:t');
    let fullText = '';
    for (let j = 0; j < textNodes.length; j++) {
      fullText += textNodes[j].textContent || '';
    }
    fullText = fullText.trim();
    if (!fullText) continue;

    // Detect heading styles in w:pStyle
    const pStyle = p.getElementsByTagName('w:pStyle')[0];
    const styleVal = pStyle?.getAttribute('w:val')?.toLowerCase() || '';

    let type: BlockType = 'body';
    if (styleVal.includes('title')) type = 'title';
    else if (styleVal.includes('heading1') || styleVal.includes('heading 1')) type = 'h1';
    else if (styleVal.includes('heading2') || styleVal.includes('heading 2')) type = 'h2';
    else if (styleVal.includes('heading3') || styleVal.includes('heading 3')) type = 'h3';
    else if (styleVal.includes('quote')) type = 'blockquote';

    blocks.push(createBlock(type, fullText));
  }

  const totalWords = blocks.reduce((sum, b) => sum + b.wordCount, 0);
  return { blocks, wordCount: totalWords };
}

// Parse ODT (OpenDocument Text)
export async function parseOdt(arrayBuffer: ArrayBuffer): Promise<ParseResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) {
    throw new Error('Invalid ODT format: content.xml not found');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(contentXml, 'application/xml');
  const paragraphs = xmlDoc.querySelectorAll('text\\:p, p, text\\:h, h');

  const blocks: DocumentBlock[] = [];
  paragraphs.forEach((p) => {
    const text = (p.textContent || '').trim();
    if (!text) return;
    const tagName = p.tagName.toLowerCase();
    let type: BlockType = 'body';
    if (tagName.includes('h')) {
      const level = p.getAttribute('text:outline-level') || '1';
      type = level === '1' ? 'h1' : level === '2' ? 'h2' : 'h3';
    }
    blocks.push(createBlock(type, text));
  });

  const totalWords = blocks.reduce((sum, b) => sum + b.wordCount, 0);
  return { blocks, wordCount: totalWords };
}

// Master file parser supporting all formats
export async function parseImportFile(file: File): Promise<ParseResult> {
  const filename = file.name.toLowerCase();

  if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
    const text = await file.text();
    return parseMarkdown(text);
  }

  if (filename.endsWith('.txt')) {
    const text = await file.text();
    return parsePlainText(text);
  }

  if (filename.endsWith('.rtf')) {
    const text = await file.text();
    return parseRTF(text);
  }

  if (filename.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    return parseDocx(buffer);
  }

  if (filename.endsWith('.odt')) {
    const buffer = await file.arrayBuffer();
    return parseOdt(buffer);
  }

  // PDF or DOC or image files with server OCR / Gemini multimodal processing
  if (filename.endsWith('.pdf') || filename.endsWith('.doc') || file.type.startsWith('image/')) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    try {
      const res = await fetch('/api/gemini/ocr-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type || 'application/pdf',
          filename: file.name,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return parseMarkdown(data.text);
      }
    } catch (err) {
      console.warn('Backend OCR failed, attempting basic text decoding:', err);
    }

    // Fallback: decode text stream from arrayBuffer if text-based PDF
    const text = await file.text();
    // Filter printable ascii characters
    const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    return parsePlainText(printable);
  }

  // Default fallback to text parser
  const fallbackText = await file.text();
  return parsePlainText(fallbackText);
}
