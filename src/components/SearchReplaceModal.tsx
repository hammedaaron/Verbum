import React, { useState, useEffect } from 'react';
import {
  Search,
  Replace,
  Sparkles,
  Filter,
  Undo2,
  X,
  Loader2,
} from 'lucide-react';
import { Manuscript, SearchFilters, SearchResult, SearchType } from '../types/manuscript';
import { performSearch, executeReplace, ReplaceResult } from '../services/searchEngine';

interface SearchReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
  onUpdateManuscript: (updated: Manuscript) => void;
  onSelectResult: (result: SearchResult) => void;
}

export const SearchReplaceModal: React.FC<SearchReplaceModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onUpdateManuscript,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('exact');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [pageTarget, setPageTarget] = useState<'both' | 'page1' | 'page2'>('both');
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [activeResultIndex, setActiveResultIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [lastReplaceUndo, setLastReplaceUndo] = useState<ReplaceResult['undoSnapshot'] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!query.trim()) {
      setResults([]);
      setSelectedResultIds(new Set());
      setActiveResultIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const filters: SearchFilters = {
          query,
          type: query.startsWith('@') ? 'properNoun' : searchType,
          caseSensitive,
          wholeWord,
          exactPhrase: true,
          regex,
          scope: 'both',
          pageTarget,
        };

        const res = await performSearch(manuscript, filters, manuscript.properNouns);
        setResults(res);
        setSelectedResultIds(new Set(res.map((r) => r.id)));
        setActiveResultIndex(res.length > 0 ? 0 : -1);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, searchType === 'semantic' ? 350 : 150);

    return () => clearTimeout(timer);
  }, [query, searchType, caseSensitive, wholeWord, regex, pageTarget, manuscript, isOpen]);

  if (!isOpen) return null;

  const handleSelect = (result: SearchResult, index: number) => {
    setActiveResultIndex(index);
    onSelectResult(result);
  };

  const handleReplaceOne = (targetResult: SearchResult) => {
    const { updatedManuscript, undoSnapshot } = executeReplace(
      manuscript,
      [targetResult],
      replaceText
    );
    setLastReplaceUndo(undoSnapshot);
    onUpdateManuscript(updatedManuscript);
  };

  const handleReplaceAll = () => {
    if (results.length === 0) return;
    const { updatedManuscript, undoSnapshot } = executeReplace(
      manuscript,
      results,
      replaceText
    );
    setLastReplaceUndo(undoSnapshot);
    onUpdateManuscript(updatedManuscript);
  };

  const handleUndoReplace = () => {
    if (!lastReplaceUndo) return;
    const restored: Manuscript = {
      ...manuscript,
      page1: {
        ...manuscript.page1,
        blocks: lastReplaceUndo.page1Blocks,
        wordCount: lastReplaceUndo.page1Blocks.reduce((s, b) => s + b.wordCount, 0),
        charCount: lastReplaceUndo.page1Blocks.reduce((s, b) => s + b.charCount, 0),
      },
      page2: {
        ...manuscript.page2,
        blocks: lastReplaceUndo.page2Blocks,
        wordCount: lastReplaceUndo.page2Blocks.reduce((s, b) => s + b.wordCount, 0),
        charCount: lastReplaceUndo.page2Blocks.reduce((s, b) => s + b.charCount, 0),
      },
      updatedAt: Date.now(),
    };
    onUpdateManuscript(restored);
    setLastReplaceUndo(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100 font-sans">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl max-w-xl w-full flex flex-col max-h-[80vh] overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* Header & Search Input */}
        <div className="p-3 border-b border-neutral-200 dark:border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find in manuscript…"
                className="w-full pl-8 pr-16 py-1.5 bg-neutral-100 dark:bg-white/10 rounded-lg outline-none text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400"
                autoFocus
              />
              <Search size={13} className="absolute left-2.5 top-2 text-neutral-400" />
              {isSearching && (
                <Loader2 size={13} className="absolute right-9 top-2 animate-spin text-neutral-400" />
              )}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`absolute right-2 top-1.5 p-0.5 rounded transition ${
                  showFilters || caseSensitive || wholeWord || regex || pageTarget !== 'both'
                    ? 'text-amber-500'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                }`}
                title="Filters"
              >
                <Filter size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded"
            >
              <X size={15} />
            </button>
          </div>

          {/* Replace Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with…"
                className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-white/10 rounded-lg outline-none text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400"
              />
              <Replace size={13} className="absolute left-2.5 top-2 text-neutral-400" />
            </div>

            <button
              type="button"
              disabled={results.length === 0 || !replaceText}
              onClick={handleReplaceAll}
              className="px-3 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg font-medium text-xs disabled:opacity-30 transition"
            >
              Replace All
            </button>

            {lastReplaceUndo && (
              <button
                type="button"
                onClick={handleUndoReplace}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded"
                title="Undo Replace"
              >
                <Undo2 size={14} />
              </button>
            )}
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center bg-neutral-100 dark:bg-white/5 p-0.5 rounded-md text-[11px]">
              {(['exact', 'semantic', 'fuzzy', 'properNoun'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSearchType(t);
                    if (t === 'properNoun' && !query.startsWith('@')) setQuery('@' + query.replace(/^@/, ''));
                  }}
                  className={`px-2 py-0.5 rounded capitalize transition ${
                    searchType === t
                      ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-medium'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
                  }`}
                >
                  {t === 'properNoun' ? '@ Names' : t}
                </button>
              ))}
            </div>

            <span className="font-mono text-[11px] text-neutral-400">
              {results.length} match{results.length === 1 ? '' : 'es'}
            </span>
          </div>

          {/* Compact Filters */}
          {showFilters && (
            <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-500">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={(e) => setCaseSensitive(e.target.checked)}
                  className="rounded"
                />
                <span>Case Sensitive</span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wholeWord}
                  onChange={(e) => setWholeWord(e.target.checked)}
                  className="rounded"
                />
                <span>Whole Word</span>
              </label>

              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regex}
                  onChange={(e) => setRegex(e.target.checked)}
                  className="rounded"
                />
                <span>Regex</span>
              </label>

              <select
                value={pageTarget}
                onChange={(e) => setPageTarget(e.target.value as any)}
                className="bg-transparent border border-neutral-200 dark:border-white/10 rounded px-1 text-[11px] outline-none"
              >
                <option value="both">Both Pages</option>
                <option value="page1">Page 1</option>
                <option value="page2">Page 2</option>
              </select>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {results.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              {query ? 'No results.' : 'Type to search manuscript.'}
            </div>
          ) : (
            results.map((result, idx) => {
              const isActive = activeResultIndex === idx;

              return (
                <div
                  key={result.id}
                  onClick={() => handleSelect(result, idx)}
                  className={`p-2 rounded-lg cursor-pointer transition flex items-start justify-between gap-2 text-xs ${
                    isActive
                      ? 'bg-neutral-100 dark:bg-white/10'
                      : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-neutral-700 dark:text-neutral-300 font-serif leading-snug line-clamp-2">
                      <span className="opacity-50">{result.contextBefore}</span>
                      <mark className="bg-amber-300 dark:bg-amber-500/40 text-neutral-900 dark:text-white font-semibold px-0.5 rounded">
                        {result.matchText}
                      </mark>
                      <span className="opacity-50">{result.contextAfter}</span>
                    </div>

                    <div className="text-[10px] text-neutral-400 font-mono mt-1 flex items-center gap-2">
                      <span>{result.pageId === 'page1' ? 'P1' : 'P2'}</span>
                      {result.score !== undefined && result.score < 1.0 && (
                        <span>{Math.round(result.score * 100)}% match</span>
                      )}
                    </div>
                  </div>

                  {replaceText && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReplaceOne(result);
                      }}
                      className="px-2 py-0.5 rounded bg-neutral-200 dark:bg-white/15 text-[11px] font-medium shrink-0"
                    >
                      Replace
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
