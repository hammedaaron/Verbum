import React, { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  Copy,
  Trash2,
  Archive,
  Search,
  BookOpen,
  X,
  Edit2,
  Check,
  FolderPlus,
  Zap,
} from 'lucide-react';
import { Manuscript, ManuscriptFolder } from '../types/manuscript';
import {
  getManuscripts,
  saveManuscript,
  deleteManuscript,
  duplicateManuscript,
  getFolders,
  saveFolder,
  deleteFolder,
  generateLargeManuscript,
  createBlock,
} from '../services/storage';

interface ManuscriptsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentManuscriptId: string;
  onSelectManuscript: (manuscript: Manuscript) => void;
  onOpenMilestones: () => void;
}

export const ManuscriptsDrawer: React.FC<ManuscriptsDrawerProps> = ({
  isOpen,
  onClose,
  currentManuscriptId,
  onSelectManuscript,
}) => {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [folders, setFolders] = useState<ManuscriptFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'words'>('date');

  const [editingManuscriptId, setEditingManuscriptId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [isGeneratingScale, setIsGeneratingScale] = useState(false);

  const reloadData = async () => {
    try {
      const [msList, fList] = await Promise.all([getManuscripts(), getFolders()]);
      setManuscripts(msList);
      setFolders(fList);
    } catch (err) {
      console.error('Failed to load manuscripts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) reloadData();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredManuscripts = manuscripts
    .filter((m) => {
      if (showArchived) return m.archived;
      if (m.archived) return false;
      if (activeFolderId && m.folderId !== activeFolderId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.title.toLowerCase().includes(q) ||
          (m.description && m.description.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'words') {
        const wA = a.page1.wordCount + a.page2.wordCount;
        const wB = b.page1.wordCount + b.page2.wordCount;
        return wB - wA;
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  const handleCreateNew = async () => {
    const newManuscript: Manuscript = {
      id: 'ms_' + Math.random().toString(36).substring(2, 10),
      title: 'Untitled Manuscript',
      folderId: activeFolderId || undefined,
      page1: {
        id: 'p1',
        name: 'Page 1',
        blocks: [createBlock('title', 'Untitled Manuscript'), createBlock('body', '')],
        wordCount: 2,
        charCount: 19,
      },
      page2: {
        id: 'p2',
        name: 'Page 2',
        blocks: [createBlock('title', 'Companion Notes'), createBlock('body', '')],
        wordCount: 2,
        charCount: 15,
      },
      dividerPosition: 50,
      splitMode: 'dual',
      syncScroll: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      archived: false,
      orderIndex: manuscripts.length,
      properNouns: [],
    };

    await saveManuscript(newManuscript);
    await reloadData();
    onSelectManuscript(newManuscript);
    onClose();
  };

  const handleGenerateScale = async (words: number) => {
    setIsGeneratingScale(true);
    try {
      const scaleManuscript = generateLargeManuscript(
        `Manuscript (${words >= 1000000 ? `${words / 1000000}M` : `${words / 1000}k`} words)`,
        words
      );
      await saveManuscript(scaleManuscript);
      await reloadData();
      onSelectManuscript(scaleManuscript);
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGeneratingScale(false);
    }
  };

  const handleSaveRename = async (m: Manuscript) => {
    if (!editingTitle.trim()) return;
    const updated = { ...m, title: editingTitle.trim(), updatedAt: Date.now() };
    await saveManuscript(updated);
    setEditingManuscriptId(null);
    reloadData();
  };

  const handleDuplicate = async (m: Manuscript) => {
    const copy = await duplicateManuscript(m.id);
    await reloadData();
    onSelectManuscript(copy);
  };

  const handleToggleArchive = async (m: Manuscript) => {
    const updated = { ...m, archived: !m.archived, updatedAt: Date.now() };
    await saveManuscript(updated);
    reloadData();
  };

  const handleDelete = async (m: Manuscript) => {
    if (confirm(`Delete "${m.title}"?`)) {
      await deleteManuscript(m.id);
      reloadData();
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder: ManuscriptFolder = {
      id: 'fld_' + Math.random().toString(36).substring(2, 9),
      name: newFolderName.trim(),
      orderIndex: folders.length,
    };
    await saveFolder(folder);
    setNewFolderName('');
    setShowNewFolderInput(false);
    reloadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/40 backdrop-blur-sm animate-in fade-in duration-100 font-sans">
      <div className="w-full max-w-3xl bg-white dark:bg-[#161618] border-r border-neutral-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* macOS Toolbar */}
        <div className="h-11 px-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md overflow-hidden bg-black ring-1 ring-white/20 shrink-0">
              <img src="/pwa-192x192.png" alt="Verbum" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-sm text-neutral-900 dark:text-white font-serif tracking-wide">
              Verbum Manuscripts
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md font-medium text-xs transition hover:opacity-90 shadow-2xs"
            >
              <Plus size={12} />
              <span>New</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="h-10 px-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between gap-3 bg-neutral-50/30 dark:bg-white/[0.01]">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="w-full pl-7 pr-3 py-1 bg-neutral-100 dark:bg-white/10 border-none rounded-md outline-none text-xs placeholder:text-neutral-400"
            />
            <Search size={12} className="absolute left-2.5 top-2 text-neutral-400" />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border border-neutral-200 dark:border-white/10 rounded px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300 outline-none"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="words">Words</option>
            </select>

            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`px-2 py-1 rounded transition text-xs ${
                showArchived
                  ? 'bg-neutral-200 dark:bg-white/15 text-neutral-900 dark:text-white font-medium'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300'
              }`}
            >
              {showArchived ? 'Active' : 'Archived'}
            </button>
          </div>
        </div>

        {/* Two-Column Area: Left Folders + Right Cards */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-neutral-200 dark:divide-white/10">
          {/* Folders Sidebar */}
          <div className="w-48 overflow-y-auto p-3 space-y-1 custom-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition text-left ${
                activeFolderId === null
                  ? 'bg-neutral-200/70 dark:bg-white/15 text-neutral-900 dark:text-white font-medium'
                  : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              <span>All</span>
              <span className="font-mono text-[11px] opacity-60">
                {manuscripts.filter((m) => !m.archived).length}
              </span>
            </button>

            {folders.map((fld) => (
              <button
                key={fld.id}
                type="button"
                onClick={() => setActiveFolderId(fld.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition text-left ${
                  activeFolderId === fld.id
                    ? 'bg-neutral-200/70 dark:bg-white/15 text-neutral-900 dark:text-white font-medium'
                    : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Folder size={12} className="opacity-70 shrink-0" />
                  <span className="truncate">{fld.name}</span>
                </div>
                <span className="font-mono text-[11px] opacity-60">
                  {manuscripts.filter((m) => m.folderId === fld.id && !m.archived).length}
                </span>
              </button>
            ))}

            {showNewFolderInput ? (
              <form onSubmit={handleCreateFolder} className="pt-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name…"
                  className="w-full px-2 py-1 bg-neutral-100 dark:bg-white/10 border-none rounded text-xs outline-none"
                  autoFocus
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewFolderInput(true)}
                className="w-full flex items-center gap-1 px-2.5 py-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition text-[11px]"
              >
                <FolderPlus size={11} />
                <span>New Folder</span>
              </button>
            )}

            {/* Benchmark Test Presets (Subtle & Unobtrusive) */}
            <div className="pt-4 border-t border-neutral-200 dark:border-white/10 mt-4">
              <span className="text-[10px] uppercase font-mono text-neutral-400 px-2 block mb-1">
                Scale Benchmarks
              </span>
              <div className="space-y-0.5">
                {[
                  { label: '50k Words', words: 50000 },
                  { label: '250k Words', words: 250000 },
                  { label: '1M Words', words: 1000000 },
                  { label: '3M Words', words: 3000000 },
                ].map((item) => (
                  <button
                    key={item.words}
                    type="button"
                    onClick={() => handleGenerateScale(item.words)}
                    disabled={isGeneratingScale}
                    className="w-full text-left px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded hover:bg-neutral-100 dark:hover:bg-white/5 transition font-mono"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clean Apple Notes-style Cards */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {filteredManuscripts.length === 0 ? (
              <div className="text-center py-20 text-neutral-400 text-xs">
                No manuscripts.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredManuscripts.map((m) => {
                  const isCurrent = m.id === currentManuscriptId;
                  const totalWords = m.page1.wordCount + m.page2.wordCount;

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        onSelectManuscript(m);
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between group ${
                        isCurrent
                          ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-white/5 shadow-xs'
                          : 'border-neutral-200/80 dark:border-white/10 bg-white dark:bg-[#1c1c1e] hover:border-neutral-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          {editingManuscriptId === m.id ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 flex-1"
                            >
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="px-1.5 py-0.5 bg-neutral-100 dark:bg-white/10 rounded text-xs font-semibold flex-1 outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(m)}
                                className="p-1 text-emerald-600"
                              >
                                <Check size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="font-semibold text-xs text-neutral-900 dark:text-white truncate">
                              {m.title}
                            </span>
                          )}
                        </div>

                        {m.description && (
                          <p className="text-[11px] text-neutral-500 line-clamp-1 mb-2">
                            {m.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                        <span>{totalWords.toLocaleString()}w</span>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingManuscriptId(m.id);
                              setEditingTitle(m.title);
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
                            title="Rename"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(m)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
                            title="Duplicate"
                          >
                            <Copy size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(m)}
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white rounded"
                            title={m.archived ? 'Restore' : 'Archive'}
                          >
                            <Archive size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(m)}
                            className="p-1 text-neutral-400 hover:text-red-500 rounded"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
