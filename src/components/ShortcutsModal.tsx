import React from 'react';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: 'Editing',
      items: [
        { key: '⌘ Z', desc: 'Undo' },
        { key: '⇧ ⌘ Z / ⌘ Y', desc: 'Redo' },
        { key: '⌘ B', desc: 'Bold' },
        { key: '⌘ I', desc: 'Italic' },
        { key: '⌘ U', desc: 'Underline' },
        { key: '⇧ ⌘ X', desc: 'Strikethrough' },
        { key: '⌥ ⌘ 1 / 2 / 3', desc: 'Heading 1, 2, or 3' },
        { key: '⌥ ⌘ 0', desc: 'Body paragraph' },
        { key: '⇧ ⌘ 8 / 7', desc: 'Bullet / Numbered list' },
        { key: 'Tab / ⇧ Tab', desc: 'Indent / Outdent' },
        { key: '⌘ A', desc: 'Select all' },
        { key: '⌘ C / ⌘ X / ⌘ V', desc: 'Smart copy / cut / paste' },
      ],
    },
    {
      category: 'Search & Navigation',
      items: [
        { key: '⌘ F / ⌘ K', desc: 'Find & Replace' },
        { key: '@ (query)', desc: 'Proper-noun character search' },
        { key: '↑ / ↓', desc: 'Navigate paragraphs' },
      ],
    },
    {
      category: 'Workspace',
      items: [
        { key: '# (TOC button)', desc: 'Toggle Table of Contents' },
        { key: '⌘ S', desc: 'Quick save document' },
        { key: '⇧ ⌘ S', desc: 'Save milestone snapshot' },
        { key: '⌘ \\', desc: 'Toggle split screen' },
        { key: '⌘ /', desc: 'Show keyboard shortcuts' },
        { key: 'Drag & Drop', desc: 'Move paragraph between pages' },
        { key: 'File Drop', desc: 'Import file (.docx, .pdf, .md, .txt)' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200/80 dark:border-white/10 bg-neutral-50/70 dark:bg-white/[0.03]">
          <h2 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-white/10 transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {shortcutGroups.map((group) => (
            <div key={group.category} className="space-y-1">
              <div className="font-semibold text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-1">
                {group.category}
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-white/5 border border-neutral-200/70 dark:border-white/10 rounded-lg overflow-hidden bg-neutral-50/40 dark:bg-white/[0.02]">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-neutral-600 dark:text-neutral-300 text-[11px]">{item.desc}</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 font-mono text-[10px] shadow-2xs font-medium text-neutral-700 dark:text-neutral-200">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
