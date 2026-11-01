import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Manuscript,
  DocumentBlock,
  EditorSettings,
  SearchResult,
} from './types/manuscript';
import {
  getManuscripts,
  saveManuscript,
  createInitialManuscript,
  getMilestones,
  saveMilestone,
} from './services/storage';
import { VirtualizedEditorPane } from './components/VirtualizedEditorPane';
import { TopBar } from './components/TopBar';
import { ManuscriptsDrawer } from './components/ManuscriptsDrawer';
import { SearchReplaceModal } from './components/SearchReplaceModal';
import { ProperNounIndexModal } from './components/ProperNounIndexModal';
import { MilestonesModal } from './components/MilestonesModal';
import { ExportModal } from './components/ExportModal';
import { StatisticsModal } from './components/StatisticsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [currentManuscript, setCurrentManuscript] = useState<Manuscript | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Split-screen & Layout States
  const [splitMode, setSplitMode] = useState<'dual' | 'page1' | 'page2'>('dual');
  const [dividerPercent, setDividerPercent] = useState<number>(50);
  const [isResizing, setIsResizing] = useState(false);
  const [syncScroll, setSyncScroll] = useState(false);
  const [syncedScrollTop, setSyncedScrollTop] = useState<number>(0);

  // Autosave Status
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals & Panels State
  const [isManuscriptsOpen, setIsManuscriptsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProperNounsOpen, setIsProperNounsOpen] = useState(false);
  const [isMilestonesOpen, setIsMilestonesOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Active search highlight
  const [activeSearchResult, setActiveSearchResult] = useState<SearchResult | null>(null);

  // Editor Display Settings
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    theme: 'dark',
    fontFamily: 'serif',
    fontSize: 16,
    lineSpacing: 1.6,
    focusMode: false,
    renderMarkdown: true,
  });

  // Apply theme class to document root
  useEffect(() => {
    if (editorSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [editorSettings.theme]);

  // Initial load from IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        const list = await getManuscripts();
        setManuscripts(list);
        if (list.length > 0) {
          setCurrentManuscript(list[0]);
          setSplitMode(list[0].splitMode || 'dual');
          setDividerPercent(list[0].dividerPosition || 50);
          setSyncScroll(list[0].syncScroll || false);
        }
      } catch (err) {
        console.error('Failed to load initial manuscript:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Global Keyboard Shortcuts (Ctrl+F, Ctrl+H, Ctrl+S, Ctrl+\)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          setIsMilestonesOpen(true);
        } else {
          setSaveStatus('saving');
          setTimeout(() => setSaveStatus('saved'), 150);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setSplitMode((prev) => (prev === 'dual' ? 'page1' : 'dual'));
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Continuous Autosave Debouncer
  const triggerAutosave = useCallback((updated: Manuscript) => {
    setSaveStatus('saving');
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveManuscript(updated);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('unsaved');
      }
    }, 450);
  }, []);

  // Update Page 1 Blocks
  const handleUpdatePage1Blocks = useCallback(
    (newBlocks: DocumentBlock[]) => {
      if (!currentManuscript) return;
      const wCount = newBlocks.reduce((acc, b) => acc + b.wordCount, 0);
      const cCount = newBlocks.reduce((acc, b) => acc + b.charCount, 0);

      const updated: Manuscript = {
        ...currentManuscript,
        page1: {
          ...currentManuscript.page1,
          blocks: newBlocks,
          wordCount: wCount,
          charCount: cCount,
        },
        updatedAt: Date.now(),
      };

      setCurrentManuscript(updated);
      triggerAutosave(updated);
    },
    [currentManuscript, triggerAutosave]
  );

  // Update Page 2 Blocks
  const handleUpdatePage2Blocks = useCallback(
    (newBlocks: DocumentBlock[]) => {
      if (!currentManuscript) return;
      const wCount = newBlocks.reduce((acc, b) => acc + b.wordCount, 0);
      const cCount = newBlocks.reduce((acc, b) => acc + b.charCount, 0);

      const updated: Manuscript = {
        ...currentManuscript,
        page2: {
          ...currentManuscript.page2,
          blocks: newBlocks,
          wordCount: wCount,
          charCount: cCount,
        },
        updatedAt: Date.now(),
      };

      setCurrentManuscript(updated);
      triggerAutosave(updated);
    },
    [currentManuscript, triggerAutosave]
  );

  // Move block from Page 1 to Page 2
  const handleMoveBlockP1ToP2 = useCallback(
    (block: DocumentBlock, sourceIndex: number) => {
      if (!currentManuscript) return;
      const p1Updated = currentManuscript.page1.blocks.filter((_, idx) => idx !== sourceIndex);
      const p2Updated = [...currentManuscript.page2.blocks, block];

      const updated: Manuscript = {
        ...currentManuscript,
        page1: {
          ...currentManuscript.page1,
          blocks: p1Updated,
          wordCount: p1Updated.reduce((a, b) => a + b.wordCount, 0),
          charCount: p1Updated.reduce((a, b) => a + b.charCount, 0),
        },
        page2: {
          ...currentManuscript.page2,
          blocks: p2Updated,
          wordCount: p2Updated.reduce((a, b) => a + b.wordCount, 0),
          charCount: p2Updated.reduce((a, b) => a + b.charCount, 0),
        },
        updatedAt: Date.now(),
      };

      setCurrentManuscript(updated);
      triggerAutosave(updated);
    },
    [currentManuscript, triggerAutosave]
  );

  // Move block from Page 2 to Page 1
  const handleMoveBlockP2ToP1 = useCallback(
    (block: DocumentBlock, sourceIndex: number) => {
      if (!currentManuscript) return;
      const p2Updated = currentManuscript.page2.blocks.filter((_, idx) => idx !== sourceIndex);
      const p1Updated = [...currentManuscript.page1.blocks, block];

      const updated: Manuscript = {
        ...currentManuscript,
        page1: {
          ...currentManuscript.page1,
          blocks: p1Updated,
          wordCount: p1Updated.reduce((a, b) => a + b.wordCount, 0),
          charCount: p1Updated.reduce((a, b) => a + b.charCount, 0),
        },
        page2: {
          ...currentManuscript.page2,
          blocks: p2Updated,
          wordCount: p2Updated.reduce((a, b) => a + b.wordCount, 0),
          charCount: p2Updated.reduce((a, b) => a + b.charCount, 0),
        },
        updatedAt: Date.now(),
      };

      setCurrentManuscript(updated);
      triggerAutosave(updated);
    },
    [currentManuscript, triggerAutosave]
  );

  // Copy entire contents of Page 1 into Page 2 (Append without overwriting)
  const handleCopyP1ToP2 = () => {
    if (!currentManuscript) return;
    const clonedP1Blocks: DocumentBlock[] = JSON.parse(
      JSON.stringify(currentManuscript.page1.blocks)
    ).map((b: DocumentBlock) => ({
      ...b,
      id: 'blk_' + Math.random().toString(36).substring(2, 9),
    }));

    handleUpdatePage2Blocks([...currentManuscript.page2.blocks, ...clonedP1Blocks]);
  };

  // Copy entire contents of Page 2 into Page 1 (Append without overwriting)
  const handleCopyP2ToP1 = () => {
    if (!currentManuscript) return;
    const clonedP2Blocks: DocumentBlock[] = JSON.parse(
      JSON.stringify(currentManuscript.page2.blocks)
    ).map((b: DocumentBlock) => ({
      ...b,
      id: 'blk_' + Math.random().toString(36).substring(2, 9),
    }));

    handleUpdatePage1Blocks([...currentManuscript.page1.blocks, ...clonedP2Blocks]);
  };

  // Append selected blocks to Page 2
  const handleAppendBlocksToP2 = useCallback(
    (newBlocks: DocumentBlock[]) => {
      if (!currentManuscript) return;
      const existing = currentManuscript.page2.blocks;
      const isInitialEmpty = existing.length === 1 && (!existing[0].text || !existing[0].text.trim());
      const updated = isInitialEmpty ? newBlocks : [...existing, ...newBlocks];
      handleUpdatePage2Blocks(updated);
    },
    [currentManuscript, handleUpdatePage2Blocks]
  );

  // Append selected blocks to Page 1
  const handleAppendBlocksToP1 = useCallback(
    (newBlocks: DocumentBlock[]) => {
      if (!currentManuscript) return;
      const existing = currentManuscript.page1.blocks;
      const isInitialEmpty = existing.length === 1 && (!existing[0].text || !existing[0].text.trim());
      const updated = isInitialEmpty ? newBlocks : [...existing, ...newBlocks];
      handleUpdatePage1Blocks(updated);
    },
    [currentManuscript, handleUpdatePage1Blocks]
  );

  // Mouse drag handler for resizing divider
  const handleMouseDownDivider = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const newPercent = Math.max(20, Math.min(80, (moveEvent.clientX / windowWidth) * 100));
      setDividerPercent(newPercent);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (currentManuscript) {
        const updated = { ...currentManuscript, dividerPosition: dividerPercent };
        triggerAutosave(updated);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (isLoading || !currentManuscript) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-900 text-neutral-200">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="font-serif text-lg tracking-wider font-semibold">Verbum Manuscript Engine</div>
        <div className="text-xs text-neutral-500 font-mono mt-1">Initializing High-Capacity Document Storage…</div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-[#111113] text-neutral-900 dark:text-neutral-100 ${
        isResizing ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* Minimal Top Toolbar (occupies < 5% screen height) */}
      {!editorSettings.focusMode && (
        <TopBar
          manuscript={currentManuscript}
          onUpdateTitle={(title) => {
            const updated = { ...currentManuscript, title, updatedAt: Date.now() };
            setCurrentManuscript(updated);
            triggerAutosave(updated);
          }}
          saveStatus={saveStatus}
          splitMode={splitMode}
          onSetSplitMode={(mode) => {
            setSplitMode(mode);
            const updated = { ...currentManuscript, splitMode: mode };
            setCurrentManuscript(updated);
            triggerAutosave(updated);
          }}
          syncScroll={syncScroll}
          onToggleSyncScroll={() => {
            setSyncScroll(!syncScroll);
            const updated = { ...currentManuscript, syncScroll: !syncScroll };
            setCurrentManuscript(updated);
            triggerAutosave(updated);
          }}
          onCopyP1ToP2={handleCopyP1ToP2}
          onCopyP2ToP1={handleCopyP2ToP1}
          onOpenManuscripts={() => setIsManuscriptsOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenProperNouns={() => setIsProperNounsOpen(true)}
          onOpenMilestones={() => setIsMilestonesOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          editorSettings={editorSettings}
          onUpdateEditorSettings={(patch) =>
            setEditorSettings((prev) => ({ ...prev, ...patch }))
          }
          onOpenStats={() => setIsStatsOpen(true)}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
        />
      )}

      {/* Primary Workspace: Occupies ~90%+ of the screen */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Page 1 (Primary Writing Pane) */}
        {(splitMode === 'dual' || splitMode === 'page1') && (
          <div
            style={{
              width: splitMode === 'dual' ? `${dividerPercent}%` : '100%',
            }}
            className="h-full flex flex-col overflow-hidden"
          >
            <VirtualizedEditorPane
              pageId="page1"
              pageName={currentManuscript.page1.name}
              otherPageName={currentManuscript.page2.name}
              currentManuscriptId={currentManuscript.id}
              blocks={currentManuscript.page1.blocks}
              otherPageBlocks={currentManuscript.page2.blocks}
              onUpdateBlocks={handleUpdatePage1Blocks}
              onMoveBlockToOtherPage={handleMoveBlockP1ToP2}
              onCopyAllToOtherPage={handleCopyP1ToP2}
              onCopySelectedToOtherPage={handleAppendBlocksToP2}
              onOpenDocInOtherPage={(docBlocks) => {
                handleUpdatePage2Blocks(docBlocks);
                setSplitMode('dual');
              }}
              isMaximized={splitMode === 'page1'}
              onToggleMaximize={() => setSplitMode(splitMode === 'page1' ? 'dual' : 'page1')}
              fontFamily={editorSettings.fontFamily}
              fontSize={editorSettings.fontSize}
              lineSpacing={editorSettings.lineSpacing}
              renderMarkdown={editorSettings.renderMarkdown}
              onToggleRenderMarkdown={() =>
                setEditorSettings((prev) => ({ ...prev, renderMarkdown: !prev.renderMarkdown }))
              }
              activeSearchResult={activeSearchResult}
              syncScrollTop={syncScroll ? syncedScrollTop : undefined}
              onScroll={(top) => {
                if (syncScroll) setSyncedScrollTop(top);
              }}
            />
          </div>
        )}

        {/* Resizable Split Screen Divider Handle */}
        {splitMode === 'dual' && (
          <div
            onMouseDown={handleMouseDownDivider}
            className="w-1.5 hover:w-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-amber-500 cursor-col-resize transition-all z-20 flex items-center justify-center group select-none"
            title="Drag horizontally to resize dual pages"
          >
            <div className="w-0.5 h-8 bg-neutral-400 group-hover:bg-white rounded-full transition-colors" />
          </div>
        )}

        {/* Page 2 (Companion / Working Notes Pane) */}
        {(splitMode === 'dual' || splitMode === 'page2') && (
          <div
            style={{
              width: splitMode === 'dual' ? `${100 - dividerPercent}%` : '100%',
            }}
            className="h-full flex flex-col overflow-hidden"
          >
            <VirtualizedEditorPane
              pageId="page2"
              pageName={currentManuscript.page2.name}
              otherPageName={currentManuscript.page1.name}
              currentManuscriptId={currentManuscript.id}
              blocks={currentManuscript.page2.blocks}
              otherPageBlocks={currentManuscript.page1.blocks}
              onUpdateBlocks={handleUpdatePage2Blocks}
              onMoveBlockToOtherPage={handleMoveBlockP2ToP1}
              onCopyAllToOtherPage={handleCopyP2ToP1}
              onCopySelectedToOtherPage={handleAppendBlocksToP1}
              onOpenDocInOtherPage={(docBlocks) => {
                handleUpdatePage1Blocks(docBlocks);
                setSplitMode('dual');
              }}
              isMaximized={splitMode === 'page2'}
              onToggleMaximize={() => setSplitMode(splitMode === 'page2' ? 'dual' : 'page2')}
              fontFamily={editorSettings.fontFamily}
              fontSize={editorSettings.fontSize}
              lineSpacing={editorSettings.lineSpacing}
              renderMarkdown={editorSettings.renderMarkdown}
              onToggleRenderMarkdown={() =>
                setEditorSettings((prev) => ({ ...prev, renderMarkdown: !prev.renderMarkdown }))
              }
              activeSearchResult={activeSearchResult}
              syncScrollTop={syncScroll ? syncedScrollTop : undefined}
              onScroll={(top) => {
                if (syncScroll) setSyncedScrollTop(top);
              }}
            />
          </div>
        )}

        {/* Focus Mode Exit Floating Pill */}
        {editorSettings.focusMode && (
          <button
            type="button"
            onClick={() => setEditorSettings((prev) => ({ ...prev, focusMode: false }))}
            className="fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full bg-neutral-900/80 dark:bg-neutral-100/80 text-white dark:text-neutral-900 text-xs shadow-lg backdrop-blur-md opacity-40 hover:opacity-100 transition"
          >
            Exit Focus Mode (Esc)
          </button>
        )}
      </main>

      {/* Modals and Drawers (Rendered on demand) */}
      <ManuscriptsDrawer
        isOpen={isManuscriptsOpen}
        onClose={() => setIsManuscriptsOpen(false)}
        currentManuscriptId={currentManuscript.id}
        onSelectManuscript={(m) => {
          setCurrentManuscript(m);
          setSplitMode(m.splitMode || 'dual');
          setDividerPercent(m.dividerPosition || 50);
          setSyncScroll(m.syncScroll || false);
        }}
        onOpenMilestones={() => {
          setIsManuscriptsOpen(false);
          setIsMilestonesOpen(true);
        }}
      />

      <SearchReplaceModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        manuscript={currentManuscript}
        onUpdateManuscript={(updated) => {
          setCurrentManuscript(updated);
          triggerAutosave(updated);
        }}
        onSelectResult={(res) => {
          setActiveSearchResult(res);
          // If split mode hides the target page, switch to dual or that page
          if (res.pageId === 'page1' && splitMode === 'page2') {
            setSplitMode('dual');
          } else if (res.pageId === 'page2' && splitMode === 'page1') {
            setSplitMode('dual');
          }
        }}
      />

      <ProperNounIndexModal
        isOpen={isProperNounsOpen}
        onClose={() => setIsProperNounsOpen(false)}
        manuscript={currentManuscript}
        onUpdateManuscript={(updated) => {
          setCurrentManuscript(updated);
          triggerAutosave(updated);
        }}
        onSearchEntity={(name) => {
          setIsProperNounsOpen(false);
          setIsSearchOpen(true);
        }}
      />

      <MilestonesModal
        isOpen={isMilestonesOpen}
        onClose={() => setIsMilestonesOpen(false)}
        manuscript={currentManuscript}
        onOpenRestoredManuscript={(restored) => {
          setCurrentManuscript(restored);
        }}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        manuscript={currentManuscript}
      />

      <StatisticsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        manuscript={currentManuscript}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
