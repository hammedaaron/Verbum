import React from 'react';
import { X } from 'lucide-react';
import { Manuscript } from '../types/manuscript';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  manuscript,
}) => {
  if (!isOpen) return null;

  const p1 = manuscript.page1;
  const p2 = manuscript.page2;

  const totalWords = p1.wordCount + p2.wordCount;
  const totalChars = p1.charCount + p2.charCount;
  const totalBlocks = p1.blocks.length + p2.blocks.length;

  const p1Chapters = p1.blocks.filter((b) => b.type === 'h1').length;
  const p2Chapters = p2.blocks.filter((b) => b.type === 'h1').length;
  const totalChapters = p1Chapters + p2Chapters;

  const readingTimeMin = Math.ceil(totalWords / 250);
  const readingTimeHours = (readingTimeMin / 60).toFixed(1);
  const bookPagesEstimate = Math.ceil(totalWords / 250);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-200">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200/80 dark:border-white/10 bg-neutral-50/70 dark:bg-white/[0.03]">
          <h2 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Statistics
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-white/10 transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10">
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                {totalWords.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider font-medium">
                Total Words
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10">
              <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
                ~{bookPagesEstimate.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-500 mt-0.5 uppercase tracking-wider font-medium">
                Book Pages (est.)
              </div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-neutral-200/80 dark:border-white/10 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50/70 dark:bg-white/[0.03] text-neutral-500 text-[10px] uppercase tracking-wider border-b border-neutral-200/80 dark:border-white/10">
                <tr>
                  <th className="py-1.5 px-3">Metric</th>
                  <th className="py-1.5 px-3">Page 1</th>
                  <th className="py-1.5 px-3">Page 2</th>
                  <th className="py-1.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">Combined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/60 dark:divide-white/5 font-mono text-[11px]">
                <tr>
                  <td className="py-1.5 px-3 font-sans text-neutral-600 dark:text-neutral-300">Words</td>
                  <td className="py-1.5 px-3">{p1.wordCount.toLocaleString()}</td>
                  <td className="py-1.5 px-3">{p2.wordCount.toLocaleString()}</td>
                  <td className="py-1.5 px-3 font-semibold text-neutral-900 dark:text-neutral-100">{totalWords.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans text-neutral-600 dark:text-neutral-300">Characters</td>
                  <td className="py-1.5 px-3">{p1.charCount.toLocaleString()}</td>
                  <td className="py-1.5 px-3">{p2.charCount.toLocaleString()}</td>
                  <td className="py-1.5 px-3">{totalChars.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans text-neutral-600 dark:text-neutral-300">Blocks</td>
                  <td className="py-1.5 px-3">{p1.blocks.length.toLocaleString()}</td>
                  <td className="py-1.5 px-3">{p2.blocks.length.toLocaleString()}</td>
                  <td className="py-1.5 px-3">{totalBlocks.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans text-neutral-600 dark:text-neutral-300">Chapters</td>
                  <td className="py-1.5 px-3">{p1Chapters}</td>
                  <td className="py-1.5 px-3">{p2Chapters}</td>
                  <td className="py-1.5 px-3">{totalChapters}</td>
                </tr>
                <tr>
                  <td className="py-1.5 px-3 font-sans text-neutral-600 dark:text-neutral-300">Reading Time</td>
                  <td className="py-1.5 px-3">~{Math.ceil(p1.wordCount / 250)}m</td>
                  <td className="py-1.5 px-3">~{Math.ceil(p2.wordCount / 250)}m</td>
                  <td className="py-1.5 px-3">~{readingTimeHours}h</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-3 border-t border-neutral-200/80 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium text-xs shadow-xs hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
