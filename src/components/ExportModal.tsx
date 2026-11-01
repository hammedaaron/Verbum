import React, { useState } from 'react';
import {
  Download,
  X,
  Check,
} from 'lucide-react';
import { Manuscript, ExportSettings } from '../types/manuscript';
import { executeExport } from '../services/documentExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
}

const FORMAT_OPTIONS: { id: ExportSettings['formats'][0]; label: string; ext: string }[] = [
  { id: 'pdf', label: 'PDF Document', ext: '.pdf' },
  { id: 'docx', label: 'Microsoft Word', ext: '.docx' },
  { id: 'md', label: 'Markdown', ext: '.md' },
  { id: 'txt', label: 'Plain Text', ext: '.txt' },
  { id: 'html', label: 'HTML Webpage', ext: '.html' },
  { id: 'rtf', label: 'Rich Text Format', ext: '.rtf' },
  { id: 'odt', label: 'OpenDocument', ext: '.odt' },
  { id: 'doc', label: 'Legacy Word', ext: '.doc' },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  manuscript,
}) => {
  const [selectedFormats, setSelectedFormats] = useState<ExportSettings['formats']>(['docx']);
  const [scope, setScope] = useState<ExportSettings['scope']>('entire');
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeTableOfContents, setIncludeTableOfContents] = useState(true);
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [pageSize, setPageSize] = useState<ExportSettings['pageSize']>('novel');
  const [margins, setMargins] = useState<ExportSettings['margins']>('normal');
  const [fontFamily, setFontFamily] = useState<ExportSettings['fontFamily']>('serif');
  const [fontSize, setFontSize] = useState(12);
  const [lineSpacing, setLineSpacing] = useState(1.5);
  const [pageBreakBetweenChapters, setPageBreakBetweenChapters] = useState(true);

  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const totalWords =
    scope === 'page1'
      ? manuscript.page1.wordCount
      : scope === 'page2'
      ? manuscript.page2.wordCount
      : manuscript.page1.wordCount + manuscript.page2.wordCount;

  const toggleFormat = (fmt: ExportSettings['formats'][0]) => {
    if (selectedFormats.includes(fmt)) {
      if (selectedFormats.length > 1) {
        setSelectedFormats(selectedFormats.filter((f) => f !== fmt));
      }
    } else {
      setSelectedFormats([...selectedFormats, fmt]);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const settings: ExportSettings = {
        formats: selectedFormats,
        scope,
        includeTitlePage,
        includeTableOfContents,
        includePageNumbers,
        headerText: manuscript.title,
        footerText: '',
        pageSize,
        margins,
        fontFamily,
        fontSize,
        lineSpacing,
        pageBreakBetweenChapters,
      };

      await executeExport(manuscript, settings);
      onClose();
    } catch (err: any) {
      alert(`Export error: ${err.message || 'Unknown'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100 font-sans">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* macOS Sheet Header */}
        <div className="h-11 px-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <span className="font-semibold text-neutral-900 dark:text-white">
            Export
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Formats Grid */}
          <div>
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block mb-2">
              Formats
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((fmt) => {
                const isSelected = selectedFormats.includes(fmt.id);
                return (
                  <div
                    key={fmt.id}
                    onClick={() => toggleFormat(fmt.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-white/10 text-neutral-900 dark:text-white font-medium'
                        : 'border-neutral-200 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    <span>{fmt.label}</span>
                    <span className="font-mono text-[10px] opacity-40">{fmt.ext}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scope Segmented Control */}
          <div>
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider block mb-2">
              Scope
            </span>
            <div className="flex bg-neutral-100 dark:bg-white/10 p-0.5 rounded-lg">
              {[
                { id: 'entire', label: 'Entire Manuscript' },
                { id: 'page1', label: 'Page 1' },
                { id: 'page2', label: 'Page 2' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScope(s.id as any)}
                  className={`flex-1 py-1 rounded-md text-xs font-medium transition ${
                    scope === s.id
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-600 dark:text-neutral-300 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTitlePage}
                onChange={(e) => setIncludeTitlePage(e.target.checked)}
                className="rounded"
              />
              <span>Title Page</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTableOfContents}
                onChange={(e) => setIncludeTableOfContents(e.target.checked)}
                className="rounded"
              />
              <span>Table of Contents</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePageNumbers}
                onChange={(e) => setIncludePageNumbers(e.target.checked)}
                className="rounded"
              />
              <span>Page Numbers</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pageBreakBetweenChapters}
                onChange={(e) => setPageBreakBetweenChapters(e.target.checked)}
                className="rounded"
              />
              <span>Chapter Breaks</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <span className="font-mono text-[11px] text-neutral-400">
            {totalWords.toLocaleString()} words
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs disabled:opacity-40 transition shadow-2xs"
            >
              <Download size={13} />
              <span>{isExporting ? 'Exporting…' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
