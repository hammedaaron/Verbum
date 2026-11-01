import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Bookmark,
  Share2,
  Columns,
  Square,
  Sun,
  Moon,
  Maximize2,
  BarChart2,
  Sparkles,
  Eye,
  Code,
  Check,
  RefreshCw,
  HelpCircle,
  MoreHorizontal,
} from 'lucide-react';
import { Manuscript, EditorSettings } from '../types/manuscript';

interface TopBarProps {
  manuscript: Manuscript;
  onUpdateTitle: (title: string) => void;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  splitMode: 'dual' | 'page1' | 'page2';
  onSetSplitMode: (mode: 'dual' | 'page1' | 'page2') => void;
  syncScroll: boolean;
  onToggleSyncScroll: () => void;
  onCopyP1ToP2: () => void;
  onCopyP2ToP1: () => void;
  onOpenManuscripts: () => void;
  onOpenSearch: () => void;
  onOpenProperNouns: () => void;
  onOpenMilestones: () => void;
  onOpenExport: () => void;
  editorSettings: EditorSettings;
  onUpdateEditorSettings: (settings: Partial<EditorSettings>) => void;
  onOpenStats: () => void;
  onOpenShortcuts: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  manuscript,
  onUpdateTitle,
  saveStatus,
  splitMode,
  onSetSplitMode,
  syncScroll,
  onToggleSyncScroll,
  onOpenManuscripts,
  onOpenSearch,
  onOpenProperNouns,
  onOpenMilestones,
  onOpenExport,
  editorSettings,
  onUpdateEditorSettings,
  onOpenStats,
  onOpenShortcuts,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(manuscript.title);

  const totalWords = manuscript.page1.wordCount + manuscript.page2.wordCount;

  return (
    <header className="h-10 border-b border-neutral-200/70 dark:border-white/10 bg-white/80 dark:bg-[#161618]/80 backdrop-blur-xl px-3 flex items-center justify-between text-xs select-none z-30 shrink-0 font-sans">
      {/* Left: Library Button & Document Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenManuscripts}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 font-medium transition text-xs"
          title="Manuscript Library (⌘O)"
        >
          <BookOpen size={14} className="opacity-70" />
          <span className="font-medium">Library</span>
        </button>

        <div className="h-3.5 w-px bg-neutral-200 dark:bg-white/10" />

        {/* Inline Editable Document Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isEditingTitle ? (
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={() => {
                onUpdateTitle(tempTitle.trim() || 'Untitled');
                setIsEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onUpdateTitle(tempTitle.trim() || 'Untitled');
                  setIsEditingTitle(false);
                }
              }}
              className="px-1.5 py-0.5 bg-neutral-100 dark:bg-white/10 border border-neutral-300 dark:border-white/20 rounded text-xs font-semibold outline-none max-w-[200px]"
              autoFocus
            />
          ) : (
            <span
              onClick={() => {
                setTempTitle(manuscript.title);
                setIsEditingTitle(true);
              }}
              className="font-semibold text-neutral-800 dark:text-neutral-200 hover:text-neutral-950 dark:hover:text-white cursor-pointer truncate max-w-[140px] sm:max-w-[220px]"
              title="Click to rename"
            >
              {manuscript.title}
            </span>
          )}

          {/* Clean macOS Status Indicator */}
          <span
            className="flex items-center text-[10px] text-neutral-400 font-mono ml-0.5"
            title={saveStatus === 'saving' ? 'Saving…' : 'All changes saved locally'}
          >
            {saveStatus === 'saving' ? (
              <RefreshCw size={10} className="animate-spin text-amber-500" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
            )}
          </span>
        </div>
      </div>

      {/* Center: Apple-style Segmented View Controls */}
      <div className="hidden md:flex items-center gap-2">
        {/* Split Screen Segmented Control */}
        <div className="flex items-center bg-neutral-200/50 dark:bg-white/10 p-0.5 rounded-lg text-neutral-600 dark:text-neutral-300">
          <button
            type="button"
            onClick={() => onSetSplitMode('dual')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
              splitMode === 'dual'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                : 'hover:text-neutral-900 dark:hover:text-white'
            }`}
            title="Split View"
          >
            Dual
          </button>
          <button
            type="button"
            onClick={() => onSetSplitMode('page1')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
              splitMode === 'page1'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                : 'hover:text-neutral-900 dark:hover:text-white'
            }`}
            title="Left Page Only"
          >
            Page 1
          </button>
          <button
            type="button"
            onClick={() => onSetSplitMode('page2')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
              splitMode === 'page2'
                ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-2xs'
                : 'hover:text-neutral-900 dark:hover:text-white'
            }`}
            title="Right Page Only"
          >
            Page 2
          </button>
        </div>

        {/* Sync Scroll Toggle */}
        <button
          type="button"
          onClick={onToggleSyncScroll}
          className={`px-2 py-1 rounded-md text-[11px] font-medium transition ${
            syncScroll
              ? 'bg-neutral-200 dark:bg-white/15 text-neutral-900 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
          title="Synchronize Scrolling"
        >
          Sync
        </button>
      </div>

      {/* Right: Word Count, Tools & Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* Word Count */}
        <button
          type="button"
          onClick={onOpenStats}
          className="px-2 py-0.5 rounded-md text-[11px] font-mono text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/10 transition"
          title="Document Statistics"
        >
          {totalWords.toLocaleString()} words
        </button>

        {/* Markdown Rendered / Source Toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdateEditorSettings({
              renderMarkdown: !editorSettings.renderMarkdown,
            })
          }
          className={`p-1.5 rounded-md transition ${
            editorSettings.renderMarkdown
              ? 'bg-neutral-200/70 dark:bg-white/15 text-neutral-900 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10'
          }`}
          title={editorSettings.renderMarkdown ? 'Markdown Preview (Active)' : 'Markdown Source'}
        >
          {editorSettings.renderMarkdown ? <Eye size={14} /> : <Code size={14} />}
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition"
          title="Find & Replace (⌘F)"
        >
          <Search size={14} />
        </button>

        {/* @ Proper Noun / Entities */}
        <button
          type="button"
          onClick={onOpenProperNouns}
          className="px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition"
          title="Proper Nouns (@)"
        >
          @
        </button>

        {/* Milestones */}
        <button
          type="button"
          onClick={onOpenMilestones}
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition"
          title="Milestones & Versions (⌘S)"
        >
          <Bookmark size={14} />
        </button>

        {/* Export */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90 transition font-medium text-xs shadow-2xs"
          title="Export Manuscript"
        >
          <Share2 size={12} />
          <span>Export</span>
        </button>

        {/* More Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition"
            title="Options"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div className="absolute top-full right-0 mt-1.5 w-48 bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-xl shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  onUpdateEditorSettings({
                    theme: editorSettings.theme === 'dark' ? 'light' : 'dark',
                  });
                  setShowMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition text-neutral-700 dark:text-neutral-200"
              >
                <span>Theme</span>
                <span className="opacity-50 capitalize">{editorSettings.theme}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onUpdateEditorSettings({ focusMode: !editorSettings.focusMode });
                  setShowMenu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition text-neutral-700 dark:text-neutral-200"
              >
                <span>Focus Mode</span>
                <span className="opacity-50">{editorSettings.focusMode ? 'On' : 'Off'}</span>
              </button>

              <div className="h-px bg-neutral-200 dark:bg-white/10 my-1" />

              <button
                type="button"
                onClick={() => {
                  onOpenStats();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition text-neutral-700 dark:text-neutral-200"
              >
                Statistics
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenShortcuts();
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-white/10 transition text-neutral-700 dark:text-neutral-200"
              >
                Shortcuts
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
