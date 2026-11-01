import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  BookOpen,
  X,
  Search,
  Check,
  FileText,
} from 'lucide-react';
import { Manuscript, DocumentBlock } from '../types/manuscript';
import { getManuscripts } from '../services/storage';
import { parseImportFile } from '../services/documentParser';

interface InlineDocumentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPageIndex: number;
  currentManuscriptId: string;
  onInsertDocument: (
    importedTitle: string,
    importedBlocks: DocumentBlock[],
    mode: 'embed' | 'expand'
  ) => void;
}

export const InlineDocumentImportModal: React.FC<InlineDocumentImportModalProps> = ({
  isOpen,
  onClose,
  targetPageIndex,
  currentManuscriptId,
  onInsertDocument,
}) => {
  const [tab, setTab] = useState<'upload' | 'library'>('library');
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedManuscript, setSelectedManuscript] = useState<Manuscript | null>(null);
  const [uploadedBlocks, setUploadedBlocks] = useState<{ title: string; blocks: DocumentBlock[]; wordCount: number } | null>(null);
  const [insertMode, setInsertMode] = useState<'expand' | 'embed'>('expand');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getManuscripts().then((list) => {
        setManuscripts(list.filter((m) => m.id !== currentManuscriptId));
      });
      setSelectedManuscript(null);
      setUploadedBlocks(null);
      setSearchFilter('');
    }
  }, [isOpen, currentManuscriptId]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    try {
      const parsed = await parseImportFile(file);
      setUploadedBlocks({
        title: file.name.replace(/\.[^/.]+$/, ''),
        blocks: parsed.blocks,
        wordCount: parsed.wordCount,
      });
      setSelectedManuscript(null);
    } catch (err: any) {
      alert(`Error: ${err.message || 'Could not parse'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (uploadedBlocks) {
      onInsertDocument(uploadedBlocks.title, uploadedBlocks.blocks, insertMode);
      onClose();
    } else if (selectedManuscript) {
      const combined = [...selectedManuscript.page1.blocks, ...selectedManuscript.page2.blocks];
      onInsertDocument(selectedManuscript.title, combined, insertMode);
      onClose();
    }
  };

  const filteredManuscripts = manuscripts.filter((m) => {
    if (!searchFilter.trim()) return true;
    return m.title.toLowerCase().includes(searchFilter.toLowerCase());
  });

  const hasSelection = !!selectedManuscript || !!uploadedBlocks;
  const currentTitle = uploadedBlocks?.title || selectedManuscript?.title || '';
  const currentWords = uploadedBlocks
    ? uploadedBlocks.wordCount
    : selectedManuscript
    ? selectedManuscript.page1.wordCount + selectedManuscript.page2.wordCount
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100 font-sans">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* Header */}
        <div className="h-11 px-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <span className="font-semibold text-neutral-900 dark:text-white">
            Insert Document
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded"
          >
            <X size={15} />
          </button>
        </div>

        {/* Segmented Mode: Library vs Upload */}
        <div className="p-4 pb-2 space-y-3">
          <div className="flex bg-neutral-100 dark:bg-white/10 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setTab('library');
                setUploadedBlocks(null);
              }}
              className={`flex-1 py-1 rounded-md font-medium transition ${
                tab === 'library'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('upload');
                setSelectedManuscript(null);
              }}
              className={`flex-1 py-1 rounded-md font-medium transition ${
                tab === 'upload'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              File
            </button>
          </div>

          {tab === 'library' ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter manuscripts…"
                  className="w-full pl-7 pr-3 py-1 bg-neutral-100 dark:bg-white/10 rounded-md outline-none text-xs"
                />
                <Search size={12} className="absolute left-2.5 top-2 text-neutral-400" />
              </div>

              <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                {filteredManuscripts.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400 text-xs">
                    No manuscripts.
                  </div>
                ) : (
                  filteredManuscripts.map((m) => {
                    const isSelected = selectedManuscript?.id === m.id;
                    const words = m.page1.wordCount + m.page2.wordCount;
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedManuscript(m);
                          setUploadedBlocks(null);
                        }}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium'
                            : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <span className="truncate">{m.title}</span>
                        <span className="font-mono text-[10px] opacity-60 ml-2">
                          {words.toLocaleString()}w
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 border border-dashed border-neutral-300 dark:border-white/15 rounded-xl text-center flex flex-col items-center justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,.pdf,.txt,.md,.markdown,.rtf,.odt,image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
              />
              <Upload size={20} className="text-neutral-400 mb-2" />
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md font-medium text-xs hover:opacity-90 transition shadow-2xs disabled:opacity-40"
              >
                {isProcessing ? 'Reading…' : 'Choose File'}
              </button>
              {uploadedBlocks && (
                <div className="mt-2 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  {uploadedBlocks.title} ({uploadedBlocks.wordCount}w)
                </div>
              )}
            </div>
          )}

          {/* Insertion Type */}
          {hasSelection && (
            <div className="pt-2 border-t border-neutral-200 dark:border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-mono truncate max-w-[180px]">
                {currentTitle} ({currentWords.toLocaleString()}w)
              </span>

              <div className="flex bg-neutral-100 dark:bg-white/10 p-0.5 rounded-md text-[11px]">
                <button
                  type="button"
                  onClick={() => setInsertMode('expand')}
                  className={`px-2 py-0.5 rounded transition ${
                    insertMode === 'expand'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-medium'
                      : 'text-neutral-500'
                  }`}
                >
                  Insert Text
                </button>
                <button
                  type="button"
                  onClick={() => setInsertMode('embed')}
                  className={`px-2 py-0.5 rounded transition ${
                    insertMode === 'embed'
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-medium'
                      : 'text-neutral-500'
                  }`}
                >
                  Link Card
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-11 px-5 border-t border-neutral-200 dark:border-white/10 flex items-center justify-end gap-2 bg-neutral-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!hasSelection}
            onClick={handleConfirm}
            className="px-3.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs disabled:opacity-40 transition shadow-2xs"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
};
