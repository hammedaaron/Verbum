import { Manuscript, DocumentBlock, ExportSettings } from '../types/manuscript';
import JSZip from 'jszip';

export function getExportBlocks(manuscript: Manuscript, settings: ExportSettings): DocumentBlock[] {
  if (settings.scope === 'page1') {
    return manuscript.page1.blocks;
  }
  if (settings.scope === 'page2') {
    return manuscript.page2.blocks;
  }
  // Default: Entire manuscript (combines Page 1 followed by Page 2 in logical manuscript order)
  return [...manuscript.page1.blocks, ...manuscript.page2.blocks];
}

// Generate Markdown format
export function generateMarkdown(blocks: DocumentBlock[], settings: ExportSettings, title: string): string {
  let md = '';
  if (settings.includeTitlePage) {
    md += `# ${title}\n\n`;
    if (settings.headerText) md += `*${settings.headerText}*\n\n`;
    md += `---\n\n`;
  }

  if (settings.includeTableOfContents) {
    md += `## Table of Contents\n\n`;
    blocks.forEach((b) => {
      if (['title', 'h1', 'h2'].includes(b.type)) {
        const indent = b.type === 'h2' ? '  - ' : '- ';
        md += `${indent}[${b.text}](#${b.text.toLowerCase().replace(/[^\w]+/g, '-')})\n`;
      }
    });
    md += `\n---\n\n`;
  }

  for (const b of blocks) {
    if (b.type === 'title') {
      md += `# ${b.text}\n\n`;
    } else if (b.type === 'h1') {
      if (settings.pageBreakBetweenChapters) md += `\n---\n\n`;
      md += `## ${b.text}\n\n`;
    } else if (b.type === 'h2') {
      md += `### ${b.text}\n\n`;
    } else if (b.type === 'h3' || b.type === 'subheading') {
      md += `#### ${b.text}\n\n`;
    } else if (b.type === 'blockquote') {
      md += `> ${b.text}\n\n`;
    } else if (b.type === 'bullet') {
      md += `- ${b.text}\n`;
    } else if (b.type === 'numbered') {
      md += `1. ${b.text}\n`;
    } else if (b.type === 'code') {
      md += `\`\`\`\n${b.text}\n\`\`\`\n\n`;
    } else {
      let formatted = b.text;
      if (b.bold) formatted = `**${formatted}**`;
      if (b.italic) formatted = `*${formatted}*`;
      md += `${formatted}\n\n`;
    }
  }

  return md.trim();
}

// Generate Plain Text format
export function generatePlainText(blocks: DocumentBlock[], settings: ExportSettings, title: string): string {
  let txt = '';
  if (settings.includeTitlePage) {
    txt += `${title.toUpperCase()}\n`;
    txt += '='.repeat(title.length) + '\n\n';
  }

  for (const b of blocks) {
    if (['title', 'h1'].includes(b.type)) {
      if (settings.pageBreakBetweenChapters) txt += '\n\n' + '='.repeat(40) + '\n\n';
      txt += `${b.text.toUpperCase()}\n\n`;
    } else if (b.type === 'h2' || b.type === 'h3' || b.type === 'subheading') {
      txt += `${b.text}\n\n`;
    } else if (b.type === 'bullet') {
      txt += `  • ${b.text}\n`;
    } else if (b.type === 'numbered') {
      txt += `  1. ${b.text}\n`;
    } else if (b.type === 'blockquote') {
      txt += `    "${b.text}"\n\n`;
    } else {
      // Standard manuscript paragraph indent
      const indent = b.indent ? ' '.repeat(b.indent * 4) : '    ';
      txt += `${indent}${b.text}\n\n`;
    }
  }

  return txt.trim();
}

// Generate clean semantic HTML format with styling
export function generateHTML(blocks: DocumentBlock[], settings: ExportSettings, title: string): string {
  const fontStyle = settings.fontFamily === 'serif' 
    ? "'Merriweather', 'Georgia', serif" 
    : settings.fontFamily === 'garamond' 
    ? "'Garamond', 'Crimson Text', serif"
    : settings.fontFamily === 'mono'
    ? "'JetBrains Mono', monospace"
    : "system-ui, -apple-system, sans-serif";

  const marginMap = {
    normal: '2.5cm',
    wide: '3.5cm',
    compact: '1.8cm',
  };

  const margin = marginMap[settings.margins];

  let bodyContent = '';

  if (settings.includeTitlePage) {
    bodyContent += `
      <section class="title-page">
        <h1 class="book-title">${escapeHtml(title)}</h1>
        ${settings.headerText ? `<p class="author">${escapeHtml(settings.headerText)}</p>` : ''}
        <div class="page-break"></div>
      </section>
    `;
  }

  if (settings.includeTableOfContents) {
    bodyContent += `
      <nav class="toc">
        <h2>Table of Contents</h2>
        <ul>
          ${blocks
            .filter((b) => ['title', 'h1', 'h2'].includes(b.type))
            .map((b) => `<li>${escapeHtml(b.text)}</li>`)
            .join('')}
        </ul>
        <div class="page-break"></div>
      </nav>
    `;
  }

  for (const b of blocks) {
    const alignStyle = b.align ? ` style="text-align: ${b.align};"` : '';
    const textHtml = escapeHtml(b.text);

    if (b.type === 'title') {
      bodyContent += `<h1 class="doc-title"${alignStyle}>${textHtml}</h1>\n`;
    } else if (b.type === 'h1') {
      if (settings.pageBreakBetweenChapters) bodyContent += `<div class="page-break"></div>\n`;
      bodyContent += `<h2 class="chapter-h1"${alignStyle}>${textHtml}</h2>\n`;
    } else if (b.type === 'h2') {
      bodyContent += `<h3 class="section-h2"${alignStyle}>${textHtml}</h3>\n`;
    } else if (b.type === 'h3' || b.type === 'subheading') {
      bodyContent += `<h4 class="subheading-h3"${alignStyle}>${textHtml}</h4>\n`;
    } else if (b.type === 'blockquote') {
      bodyContent += `<blockquote${alignStyle}>${textHtml}</blockquote>\n`;
    } else if (b.type === 'bullet') {
      bodyContent += `<ul><li>${textHtml}</li></ul>\n`;
    } else if (b.type === 'numbered') {
      bodyContent += `<ol><li>${textHtml}</li></ol>\n`;
    } else if (b.type === 'code') {
      bodyContent += `<pre><code>${textHtml}</code></pre>\n`;
    } else {
      let inlineStyle = '';
      if (b.bold) inlineStyle += 'font-weight: bold; ';
      if (b.italic) inlineStyle += 'font-style: italic; ';
      if (b.underline) inlineStyle += 'text-decoration: underline; ';
      bodyContent += `<p${alignStyle}${inlineStyle ? ` style="${inlineStyle}"` : ''}>${textHtml}</p>\n`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${settings.pageSize === 'a4' ? 'A4' : settings.pageSize === 'letter' ? 'letter' : '6in 9in'};
      margin: ${margin};
      @bottom-center {
        content: ${settings.includePageNumbers ? 'counter(page)' : '""'};
      }
    }
    body {
      font-family: ${fontStyle};
      font-size: ${settings.fontSize}px;
      line-height: ${settings.lineSpacing};
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: ${margin};
    }
    .title-page { text-align: center; padding-top: 25vh; }
    .book-title { font-size: 2.4em; margin-bottom: 0.5em; font-weight: bold; }
    .author { font-size: 1.2em; color: #555; }
    .page-break { page-break-after: always; break-after: page; height: 0; }
    h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.8em; margin-bottom: 0.6em; }
    .chapter-h1 { font-size: 1.7em; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
    p { margin-top: 0; margin-bottom: 0.9em; text-indent: 1.5em; }
    h1 + p, h2 + p, h3 + p { text-indent: 0; }
    blockquote {
      margin: 1.5em 2em;
      font-style: italic;
      color: #444;
      border-left: 3px solid #888;
      padding-left: 1em;
    }
    ul, ol { margin: 1em 2em; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; font-family: monospace; }
    @media print {
      body { padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

// Generate RTF (Rich Text Format)
export function generateRTF(blocks: DocumentBlock[], title: string): string {
  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += '{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}{\\f1\\fswiss\\fcharset0 Arial;}}\n';
  rtf += '{\\colortbl ;\\red0\\green0\\blue0;}\n';
  rtf += `\\viewkind4\\uc1\\pard\\sb200\\sa200\\qc\\b\\f1\\fs36 ${escapeRtf(title)}\\b0\\par\n`;

  for (const b of blocks) {
    if (['title', 'h1'].includes(b.type)) {
      rtf += `\\pard\\sb300\\sa150\\b\\fs30 ${escapeRtf(b.text)}\\b0\\par\n`;
    } else if (['h2', 'h3'].includes(b.type)) {
      rtf += `\\pard\\sb200\\sa100\\b\\fs26 ${escapeRtf(b.text)}\\b0\\par\n`;
    } else if (b.type === 'blockquote') {
      rtf += `\\pard\\li720\\ri720\\i\\fs22 ${escapeRtf(b.text)}\\i0\\par\n`;
    } else {
      let prefix = '\\pard\\fi720\\sa120\\fs24 ';
      if (b.bold) prefix += '\\b ';
      if (b.italic) prefix += '\\i ';
      if (b.underline) prefix += '\\ul ';
      rtf += `${prefix}${escapeRtf(b.text)}\\b0\\i0\\ul0\\par\n`;
    }
  }

  rtf += '}';
  return rtf;
}

// Generate real DOCX package using JSZip
export async function generateDocxBlob(blocks: DocumentBlock[], settings: ExportSettings, title: string): Promise<Blob> {
  const zip = new JSZip();

  let pXml = '';
  if (settings.includeTitlePage) {
    pXml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="3600" w:after="400"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="56"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r></w:p>`;
    if (settings.headerText) {
      pXml += `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="1200"/></w:pPr><w:r><w:rPr><w:sz w:val="28"/><w:i/></w:rPr><w:t>${escapeXml(settings.headerText)}</w:t></w:r></w:p>`;
    }
    pXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  }

  for (const b of blocks) {
    if (b.type === 'title') {
      pXml += `<w:p><w:pPr><w:pStyle w:val="Title"/><w:spacing w:before="400" w:after="200"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="44"/></w:rPr><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;
    } else if (b.type === 'h1') {
      const pageBreak = settings.pageBreakBetweenChapters ? `<w:r><w:br w:type="page"/></w:r>` : '';
      pXml += `<w:p>${pageBreak}<w:pPr><w:pStyle w:val="Heading1"/><w:spacing w:before="400" w:after="160"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="34"/></w:rPr><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;
    } else if (b.type === 'h2') {
      pXml += `<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:spacing w:before="300" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;
    } else if (b.type === 'blockquote') {
      pXml += `<w:p><w:pPr><w:ind w:left="720" w:right="720"/><w:spacing w:before="160" w:after="160"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="555555"/></w:rPr><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;
    } else {
      let rPr = '';
      if (b.bold) rPr += '<w:b/>';
      if (b.italic) rPr += '<w:i/>';
      if (b.underline) rPr += '<w:u w:val="single"/>';
      rPr += `<w:sz w:val="${settings.fontSize * 2}"/>`;
      pXml += `<w:p><w:pPr><w:ind w:firstLine="480"/><w:spacing w:after="160" w:line="${Math.round(settings.lineSpacing * 240)}" w:lineRule="auto"/></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${pXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// Generate real ODT package using JSZip
export async function generateOdtBlob(blocks: DocumentBlock[], title: string): Promise<Blob> {
  const zip = new JSZip();

  let pXml = `<text:h text:outline-level="1">${escapeXml(title)}</text:h>`;
  for (const b of blocks) {
    if (['title', 'h1'].includes(b.type)) {
      pXml += `<text:h text:outline-level="1">${escapeXml(b.text)}</text:h>`;
    } else if (['h2', 'h3'].includes(b.type)) {
      pXml += `<text:h text:outline-level="2">${escapeXml(b.text)}</text:h>`;
    } else {
      pXml += `<text:p>${escapeXml(b.text)}</text:p>`;
    }
  }

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      ${pXml}
    </office:text>
  </office:body>
</office:document-content>`;

  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

  zip.file('mimetype', 'application/vnd.oasis.opendocument.text');
  zip.file('content.xml', contentXml);
  zip.file('META-INF/manifest.xml', manifestXml);

  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' });
}

// Helper to trigger browser download
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Master exporter supporting Single and Multiple Formats (ZIP archive)
export async function executeExport(
  manuscript: Manuscript,
  settings: ExportSettings
): Promise<void> {
  const blocks = getExportBlocks(manuscript, settings);
  const cleanTitle = manuscript.title.replace(/[^\w\s-]/g, '').trim() || 'Manuscript';

  // If single format
  if (settings.formats.length === 1) {
    const fmt = settings.formats[0];
    await exportSingleFormat(fmt, blocks, settings, cleanTitle);
    return;
  }

  // Multiple format export: generate all into a ZIP archive
  const zip = new JSZip();

  for (const fmt of settings.formats) {
    if (fmt === 'md') {
      zip.file(`${cleanTitle}.md`, generateMarkdown(blocks, settings, manuscript.title));
    } else if (fmt === 'txt') {
      zip.file(`${cleanTitle}.txt`, generatePlainText(blocks, settings, manuscript.title));
    } else if (fmt === 'html') {
      zip.file(`${cleanTitle}.html`, generateHTML(blocks, settings, manuscript.title));
    } else if (fmt === 'rtf' || fmt === 'doc') {
      zip.file(`${cleanTitle}.${fmt}`, generateRTF(blocks, manuscript.title));
    } else if (fmt === 'docx') {
      const docxBlob = await generateDocxBlob(blocks, settings, manuscript.title);
      zip.file(`${cleanTitle}.docx`, docxBlob);
    } else if (fmt === 'odt') {
      const odtBlob = await generateOdtBlob(blocks, manuscript.title);
      zip.file(`${cleanTitle}.odt`, odtBlob);
    } else if (fmt === 'pdf') {
      // PDF as formatted HTML print-ready file
      zip.file(`${cleanTitle}_print_pdf.html`, generateHTML(blocks, settings, manuscript.title));
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `${cleanTitle}_Manuscript_Bundle.zip`);
}

async function exportSingleFormat(
  fmt: ExportSettings['formats'][0],
  blocks: DocumentBlock[],
  settings: ExportSettings,
  title: string
) {
  if (fmt === 'md') {
    const content = generateMarkdown(blocks, settings, title);
    triggerDownload(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${title}.md`);
  } else if (fmt === 'txt') {
    const content = generatePlainText(blocks, settings, title);
    triggerDownload(new Blob([content], { type: 'text/plain;charset=utf-8' }), `${title}.txt`);
  } else if (fmt === 'html') {
    const content = generateHTML(blocks, settings, title);
    triggerDownload(new Blob([content], { type: 'text/html;charset=utf-8' }), `${title}.html`);
  } else if (fmt === 'rtf') {
    const content = generateRTF(blocks, title);
    triggerDownload(new Blob([content], { type: 'application/rtf;charset=utf-8' }), `${title}.rtf`);
  } else if (fmt === 'doc') {
    // Word 97-compatible RTF container
    const content = generateRTF(blocks, title);
    triggerDownload(new Blob([content], { type: 'application/msword;charset=utf-8' }), `${title}.doc`);
  } else if (fmt === 'docx') {
    const blob = await generateDocxBlob(blocks, settings, title);
    triggerDownload(blob, `${title}.docx`);
  } else if (fmt === 'odt') {
    const blob = await generateOdtBlob(blocks, title);
    triggerDownload(blob, `${title}.odt`);
  } else if (fmt === 'pdf') {
    // Open a formatted print preview window so user can print to PDF directly with true vector fonts!
    const htmlContent = generateHTML(blocks, settings, title);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    } else {
      triggerDownload(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }), `${title}_print.html`);
    }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeRtf(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}
