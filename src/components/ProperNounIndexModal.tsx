import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import {
  Manuscript,
  ProperNounEntry,
  EntityCategory,
  ConsistencyIssue,
} from '../types/manuscript';
import { executeReplace } from '../services/searchEngine';
import { performSearch } from '../services/searchEngine';

interface ProperNounIndexModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
  onUpdateManuscript: (updated: Manuscript) => void;
  onSearchEntity: (name: string) => void;
}

export const ProperNounIndexModal: React.FC<ProperNounIndexModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onUpdateManuscript,
  onSearchEntity,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<EntityCategory | 'all'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<EntityCategory>('character');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);

  if (!isOpen) return null;

  const properNouns = manuscript.properNouns || [];

  const filteredNouns = properNouns.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleAddEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newEntry: ProperNounEntry = {
      id: 'pn_' + Math.random().toString(36).substring(2, 9),
      name: newName.trim(),
      category: newCategory,
      aliases: [],
    };

    onUpdateManuscript({
      ...manuscript,
      properNouns: [...properNouns, newEntry],
    });
    setNewName('');
  };

  const handleDeleteEntity = (id: string) => {
    onUpdateManuscript({
      ...manuscript,
      properNouns: properNouns.filter((item) => item.id !== id),
    });
  };

  const handleScanNames = async () => {
    setIsAnalyzing(true);
    try {
      const sampleText = [...manuscript.page1.blocks, ...manuscript.page2.blocks]
        .map((b) => b.text)
        .join('\n\n')
        .slice(0, 16000);

      const knownNames = properNouns.map((p) => p.name);

      const res = await fetch('/api/gemini/proper-nouns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          existingNames: knownNames,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const detected = (data.entities || []) as ProperNounEntry[];
        const issuesFound = (data.consistencyIssues || []) as ConsistencyIssue[];

        const existingSet = new Set(properNouns.map((p) => p.name.toLowerCase()));
        const toAdd = detected
          .filter((d) => !existingSet.has(d.name.toLowerCase()))
          .map((d) => ({
            id: 'pn_' + Math.random().toString(36).substring(2, 9),
            name: d.name,
            category: d.category || 'character',
            aliases: d.aliases || [],
          }));

        if (toAdd.length > 0) {
          onUpdateManuscript({
            ...manuscript,
            properNouns: [...properNouns, ...toAdd],
          });
        }
        setIssues(issuesFound);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFixIssue = async (issue: ConsistencyIssue) => {
    const searchRes = await performSearch(
      manuscript,
      {
        query: issue.variantFound,
        type: 'exact',
        caseSensitive: true,
        wholeWord: true,
        exactPhrase: true,
        regex: false,
        scope: 'both',
        pageTarget: 'both',
      },
      properNouns
    );

    if (searchRes.length > 0) {
      const { updatedManuscript } = executeReplace(
        manuscript,
        searchRes,
        issue.primaryName
      );
      onUpdateManuscript(updatedManuscript);
      setIssues((prev) => prev.filter((i) => i.primaryName !== issue.primaryName));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100 font-sans">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl max-w-xl w-full flex flex-col max-h-[80vh] overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* Header */}
        <div className="h-11 px-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <span className="font-semibold text-neutral-900 dark:text-white">
            Proper Nouns & Characters
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleScanNames}
              disabled={isAnalyzing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 text-xs transition disabled:opacity-40"
              title="Scan manuscript for names and spelling variants"
            >
              {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>Scan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search names…"
              className="w-full pl-7 pr-3 py-1 bg-neutral-100 dark:bg-white/10 border-none rounded-md outline-none text-xs"
            />
            <Search size={12} className="absolute left-2.5 top-2 text-neutral-400" />
          </div>

          <div className="flex bg-neutral-100 dark:bg-white/10 p-0.5 rounded-md text-[11px]">
            {(['all', 'character', 'location'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded capitalize transition ${
                  categoryFilter === cat
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs font-medium'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'character' ? 'Characters' : 'Places'}
              </button>
            ))}
          </div>
        </div>

        {/* Consistency alerts if any */}
        {issues.length > 0 && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 space-y-2">
            {issues.map((iss, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                <span>
                  Variant: <strong>"{iss.variantFound}"</strong> → Standard: <strong>"{iss.primaryName}"</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleFixIssue(iss)}
                  className="px-2 py-0.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded text-[11px] font-medium"
                >
                  Normalize
                </button>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredNouns.length === 0 ? (
            <div className="text-center py-10 text-neutral-400 text-xs">
              No entries.
            </div>
          ) : (
            filteredNouns.map((entry) => (
              <div
                key={entry.id}
                className="p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center justify-between transition group"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSearchEntity(entry.name);
                    onClose();
                  }}
                  className="font-medium text-neutral-900 dark:text-white hover:underline text-left text-xs"
                >
                  @{entry.name}
                  <span className="font-mono text-[10px] text-neutral-400 uppercase ml-2 opacity-60">
                    {entry.category}
                  </span>
                </button>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => {
                      onSearchEntity(entry.name);
                      onClose();
                    }}
                    className="px-2 py-0.5 rounded text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    Find
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntity(entry.id)}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Add Form */}
        <form
          onSubmit={handleAddEntity}
          className="p-3 border-t border-neutral-200 dark:border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add name…"
            className="flex-1 px-2.5 py-1 bg-neutral-100 dark:bg-white/10 rounded-md outline-none text-xs"
            required
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as any)}
            className="bg-transparent border border-neutral-200 dark:border-white/10 rounded px-2 py-1 text-xs outline-none"
          >
            <option value="character">Character</option>
            <option value="location">Place</option>
            <option value="organization">Organization</option>
          </select>
          <button
            type="submit"
            className="px-3 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md font-medium text-xs shadow-2xs"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
};
