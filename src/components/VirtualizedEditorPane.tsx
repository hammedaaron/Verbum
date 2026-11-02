import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Upload,
  Maximize2,
  Minimize2,
  Copy,
  Undo2,
  Redo2,
  Hash,
} from 'lucide-react';
import { DocumentBlock, SearchResult } from '../types/manuscript';
import { parseImportFile } from '../services/documentParser';
import {
  renderBlocksToDocumentHtml,
  parseDocumentHtmlToBlocks,
  domFragmentToMarkdown,
  domFragmentToSmartBlocks,
  markdownTextToBlocks,
  renderBlockToHtml,
  renderInlineMarkdownToHtml,
} from '../services/markdownRenderer';
import { ContextualToolbar } from './ContextualToolbar';
import { InlineDocumentImportModal } from './InlineDocumentImportModal';
import { TableOfContentsView } from './TableOfContentsView';

interface VirtualizedEditorPaneProps {
  pageId: 'page1' | 'page2';
  pageName: string;
  otherPageName: string;
  currentManuscriptId: string;
  blocks: DocumentBlock[];
  otherPageBlocks?: DocumentBlock[];
  onUpdateBlocks: (newBlocks: DocumentBlock[], recordHistory?: boolean) => void;
  onMoveBlockToOtherPage: (block: DocumentBlock, sourceIndex: number) => void;
  onCopyAllToOtherPage: () => void;
  onCopySelectedToOtherPage?: (blocks: DocumentBlock[]) => void;
  onOpenDocInOtherPage?: (docBlocks: DocumentBlock[], docTitle: string) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  renderMarkdown: boolean;
  onToggleRenderMarkdown?: () => void;
  activeSearchResult?: SearchResult | null;
  syncScrollTop?: number;
  onScroll?: (scrollTop: number) => void;
}

export const VirtualizedEditorPane: React.FC<VirtualizedEditorPaneProps> = ({
  pageId,
  pageName,
  otherPageName,
  currentManuscriptId,
  blocks,
  otherPageBlocks = [],
  onUpdateBlocks,
  onMoveBlockToOtherPage,
  onCopyAllToOtherPage,
  onCopySelectedToOtherPage,
  isMaximized,
  onToggleMaximize,
  fontFamily,
  fontSize,
  lineSpacing,
  activeSearchResult,
  syncScrollTop,
  onScroll,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCaretRangeRef = useRef<Range | null>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLocalUpdateRef = useRef(false);

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [importChoiceModal, setImportChoiceModal] = useState<{ file: File } | null>(null);
  const [inlineImportTargetIndex, setInlineImportTargetIndex] = useState<number | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);

  // Independent Undo/Redo tracking using refs to prevent stale closure issues
  const historyRef = useRef<DocumentBlock[][]>([JSON.parse(JSON.stringify(blocks))]);
  const historyIndexRef = useRef<number>(0);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLen, setHistoryLen] = useState(1);
  const beforeTypingSnapshotRef = useRef<DocumentBlock[] | null>(null);
  const isUndoRedoAction = useRef(false);
  const isTypingRef = useRef(false);

  const pageWordCount = useMemo(() => {
    return blocks.reduce((acc, b) => acc + (b.embeddedDocWords || b.wordCount), 0);
  }, [blocks]);

  // Reset history stack when document or page changes
  useEffect(() => {
    historyRef.current = [JSON.parse(JSON.stringify(blocks))];
    historyIndexRef.current = 0;
    setHistoryIndex(0);
    setHistoryLen(1);
    beforeTypingSnapshotRef.current = null;
  }, [currentManuscriptId, pageId]);

  // Synchronize blocks to continuous document HTML when blocks change externally or on undo/redo/TOC
  useEffect(() => {
    if (!editorRootRef.current) return;

    // Never wipe the live DOM if this update was triggered by local typing or pasting in this pane!
    if (isLocalUpdateRef.current) {
      isLocalUpdateRef.current = false;
      return;
    }

    if (isUndoRedoAction.current) {
      editorRootRef.current.innerHTML = renderBlocksToDocumentHtml(blocks);
      return;
    }

    // External change (e.g. document load, cross-page transfer, TOC jump)
    if (!isTypingRef.current) {
      const generatedHtml = renderBlocksToDocumentHtml(blocks);
      if (editorRootRef.current.innerHTML !== generatedHtml) {
        editorRootRef.current.innerHTML = generatedHtml;
      }
    }
  }, [blocks, isTocOpen]);

  // Sync scroll positions if enabled without jitter loops
  useEffect(() => {
    if (syncScrollTop !== undefined && containerRef.current && !isUserScrollingRef.current) {
      if (Math.abs(containerRef.current.scrollTop - syncScrollTop) > 5) {
        containerRef.current.scrollTop = syncScrollTop;
      }
    }
  }, [syncScrollTop]);

  // Global document selection listener: keeps caret range and active block ID accurate anywhere in viewport
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRootRef.current) return;

      if (editorRootRef.current.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        lastCaretRangeRef.current = range.cloneRange();

        const blockEl = (sel.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement).closest('[data-block-id]')
          : sel.anchorNode?.parentElement?.closest('[data-block-id]')) as HTMLElement | null;

        if (blockEl) {
          const id = blockEl.getAttribute('data-block-id');
          if (id) setActiveBlockId(id);
        }

        if (!sel.isCollapsed) {
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setToolbarPos({
              top: Math.max(12, rect.top - 46),
              left: Math.max(12, Math.min(window.innerWidth - 380, rect.left)),
            });
            return;
          }
        }
      }
      setToolbarPos(null);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);

  // Scroll to active search result
  useEffect(() => {
    if (activeSearchResult && activeSearchResult.pageId === pageId && editorRootRef.current) {
      const targetEl = editorRootRef.current.querySelector(
        `[data-block-id="${activeSearchResult.blockId}"]`
      ) as HTMLElement | null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.add('bg-amber-500/20', 'ring-1', 'ring-amber-500');
        setTimeout(() => {
          targetEl.classList.remove('bg-amber-500/20', 'ring-1', 'ring-amber-500');
        }, 2000);
      }
    }
  }, [activeSearchResult, pageId]);

  const pushHistory = useCallback((newBlocks: DocumentBlock[]) => {
    const currentIdx = historyIndexRef.current;
    const currentHistory = historyRef.current.slice(0, currentIdx + 1);

    // Guard: don't push identical snapshot to avoid unnecessary steps
    const lastSnapshot = currentHistory[currentHistory.length - 1];
    if (lastSnapshot) {
      if (
        lastSnapshot.length === newBlocks.length &&
        lastSnapshot.every((blk, idx) => {
          const t = newBlocks[idx];
          return (
            t &&
            blk.text === t.text &&
            blk.type === t.type &&
            blk.bold === t.bold &&
            blk.italic === t.italic &&
            blk.underline === t.underline &&
            blk.strikethrough === t.strikethrough
          );
        })
      ) {
        return;
      }
    }

    currentHistory.push(JSON.parse(JSON.stringify(newBlocks)));
    if (currentHistory.length > 60) {
      currentHistory.shift();
    }
    historyRef.current = currentHistory;
    historyIndexRef.current = currentHistory.length - 1;
    setHistoryIndex(historyIndexRef.current);
    setHistoryLen(currentHistory.length);
  }, []);

  const handleUpdateBlocksInternal = useCallback(
    (newBlocks: DocumentBlock[], recordHistory = true) => {
      if (recordHistory && !isUndoRedoAction.current) {
        pushHistory(newBlocks);
      }
      onUpdateBlocks(newBlocks);
    },
    [onUpdateBlocks, pushHistory]
  );

  const handleUndo = useCallback(() => {
    // If user was actively typing and triggered Undo:
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
      if (beforeTypingSnapshotRef.current) {
        const revertTarget = beforeTypingSnapshotRef.current;
        beforeTypingSnapshotRef.current = null;
        isUndoRedoAction.current = true;
        if (editorRootRef.current) {
          editorRootRef.current.innerHTML = renderBlocksToDocumentHtml(revertTarget);
        }
        onUpdateBlocks(JSON.parse(JSON.stringify(revertTarget)));
        setTimeout(() => {
          isUndoRedoAction.current = false;
          isTypingRef.current = false;
        }, 60);
        return;
      }
    }

    if (historyIndexRef.current > 0) {
      isUndoRedoAction.current = true;
      historyIndexRef.current -= 1;
      const target = historyRef.current[historyIndexRef.current];
      setHistoryIndex(historyIndexRef.current);

      if (editorRootRef.current) {
        editorRootRef.current.innerHTML = renderBlocksToDocumentHtml(target);
      }
      onUpdateBlocks(JSON.parse(JSON.stringify(target)));

      setTimeout(() => {
        isUndoRedoAction.current = false;
        isTypingRef.current = false;
      }, 60);
      return;
    }

    // Native fallback if at root
    try {
      document.execCommand('undo');
      if (editorRootRef.current) {
        onUpdateBlocks(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
    } catch (err) {}
  }, [onUpdateBlocks]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      isUndoRedoAction.current = true;
      historyIndexRef.current += 1;
      const target = historyRef.current[historyIndexRef.current];
      setHistoryIndex(historyIndexRef.current);

      if (editorRootRef.current) {
        editorRootRef.current.innerHTML = renderBlocksToDocumentHtml(target);
      }
      onUpdateBlocks(JSON.parse(JSON.stringify(target)));

      setTimeout(() => {
        isUndoRedoAction.current = false;
        isTypingRef.current = false;
      }, 60);
      return;
    }

    // Native fallback if at end
    try {
      document.execCommand('redo');
      if (editorRootRef.current) {
        onUpdateBlocks(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
    } catch (err) {}
  }, [onUpdateBlocks]);

  // Unified continuous document input handler
  const handleContinuousInput = (e?: React.FormEvent<HTMLDivElement>) => {
    if (!editorRootRef.current) return;
    isTypingRef.current = true;

    // Capture pre-typing snapshot if starting a new burst
    if (!beforeTypingSnapshotRef.current) {
      const currentTip = historyRef.current[historyIndexRef.current];
      if (currentTip) {
        beforeTypingSnapshotRef.current = JSON.parse(JSON.stringify(currentTip));
      }
    }

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    const inputEvent = e?.nativeEvent as InputEvent | undefined;
    const isWordBoundary = inputEvent?.data === ' ' || inputEvent?.inputType === 'insertParagraph';
    const debounceMs = isWordBoundary ? 150 : 350;

    syncTimeoutRef.current = setTimeout(() => {
      if (!editorRootRef.current || isTocOpen) return;
      const parsed = parseDocumentHtmlToBlocks(editorRootRef.current);
      if (parsed.length === 0 && blocks.length > 0) return;
      pushHistory(parsed);
      beforeTypingSnapshotRef.current = null;
      isLocalUpdateRef.current = true;
      handleUpdateBlocksInternal(parsed, false);
      setTimeout(() => {
        isTypingRef.current = false;
      }, 50);
    }, debounceMs);
  };

  // Selection handler: tracks selection and cursor anywhere across sections to display floating toolbar and preserve caret
  const handleSelectionUpdate = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRootRef.current) return;

    if (editorRootRef.current.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      lastCaretRangeRef.current = range.cloneRange();

      const startBlock = (sel.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (sel.anchorNode as HTMLElement).closest('[data-block-id]')
        : sel.anchorNode?.parentElement?.closest('[data-block-id]')) as HTMLElement | null;

      if (startBlock) {
        const id = startBlock.getAttribute('data-block-id');
        if (id) setActiveBlockId(id);
      }

      if (!sel.isCollapsed) {
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setToolbarPos({
            top: Math.max(12, rect.top - 46),
            left: Math.max(12, Math.min(window.innerWidth - 380, rect.left)),
          });
          return;
        }
      }
    }
    setToolbarPos(null);
  };

  const handleUpdateActiveBlock = (patch: Partial<DocumentBlock>) => {
    if (editorRootRef.current) {
      pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
    }
    if (patch.bold !== undefined) document.execCommand('bold');
    if (patch.italic !== undefined) document.execCommand('italic');
    if (patch.underline !== undefined) document.execCommand('underline');
    if (patch.strikethrough !== undefined) document.execCommand('strikeThrough');
    if (patch.type) {
      if (patch.type === 'h1' || patch.type === 'title') document.execCommand('formatBlock', false, '<h1>');
      else if (patch.type === 'h2') document.execCommand('formatBlock', false, '<h2>');
      else if (patch.type === 'h3') document.execCommand('formatBlock', false, '<h3>');
      else if (patch.type === 'blockquote') document.execCommand('formatBlock', false, '<blockquote>');
      else if (patch.type === 'bullet') document.execCommand('insertUnorderedList');
      else if (patch.type === 'numbered') document.execCommand('insertOrderedList');
      else document.execCommand('formatBlock', false, '<p>');
    }
    handleContinuousInput();
  };

  // Move or copy selected text across sections to the other page preserving exact formats and weights
  const handleSendSelectionToOtherPage = (selectedBlocks?: DocumentBlock[]) => {
    let blocksToSend = selectedBlocks;

    if (!blocksToSend || blocksToSend.length === 0) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const cloned = sel.getRangeAt(0).cloneContents();
        blocksToSend = domFragmentToSmartBlocks(cloned);
      }
    }

    if (!blocksToSend || blocksToSend.length === 0) {
      // If nothing selected, send active block
      if (activeBlockId) {
        const blk = blocks.find((b) => b.id === activeBlockId);
        if (blk) {
          const idx = blocks.findIndex((b) => b.id === activeBlockId);
          onMoveBlockToOtherPage(blk, idx);
        }
      }
      setToolbarPos(null);
      return;
    }

    if (onCopySelectedToOtherPage) {
      onCopySelectedToOtherPage(blocksToSend);
    }
    setToolbarPos(null);
  };

  // Comprehensive Keyboard shortcuts / controls handler (all controls work)
  const handleContinuousKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // 1. Undo: Ctrl+Z / ⌘Z (without Shift)
    if (isMod && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }

    // 2. Redo: Ctrl+Shift+Z / ⌘Shift+Z OR Ctrl+Y / ⌘Y
    if ((isMod && key === 'z' && e.shiftKey) || (isMod && key === 'y')) {
      e.preventDefault();
      handleRedo();
      return;
    }

    // 3. Bold: Ctrl+B / ⌘B
    if (isMod && key === 'b') {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('bold', false);
      handleContinuousInput();
      handleSelectionUpdate();
      return;
    }

    // 4. Italic: Ctrl+I / ⌘I
    if (isMod && key === 'i') {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('italic', false);
      handleContinuousInput();
      handleSelectionUpdate();
      return;
    }

    // 5. Underline: Ctrl+U / ⌘U
    if (isMod && key === 'u') {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('underline', false);
      handleContinuousInput();
      handleSelectionUpdate();
      return;
    }

    // 6. Strikethrough: Ctrl+Shift+X / ⌘Shift+X or Ctrl+Shift+S
    if (isMod && e.shiftKey && (key === 'x' || key === 's')) {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('strikeThrough', false);
      handleContinuousInput();
      handleSelectionUpdate();
      return;
    }

    // 7. Headings: Ctrl+Alt+1..3 or Ctrl+Shift+1..3 (1=H1, 2=H2, 3=H3, 0=Body)
    if (isMod && (e.altKey || e.shiftKey) && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '0')) {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      if (e.key === '1') document.execCommand('formatBlock', false, '<h1>');
      else if (e.key === '2') document.execCommand('formatBlock', false, '<h2>');
      else if (e.key === '3') document.execCommand('formatBlock', false, '<h3>');
      else document.execCommand('formatBlock', false, '<p>');
      handleContinuousInput();
      handleSelectionUpdate();
      return;
    }

    // 8. Bullet & Numbered lists: Ctrl+Shift+8 (*) / Ctrl+Shift+7 (&)
    if (isMod && e.shiftKey && (e.key === '8' || e.key === '*')) {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('insertUnorderedList', false);
      handleContinuousInput();
      return;
    }
    if (isMod && e.shiftKey && (e.key === '7' || e.key === '&')) {
      e.preventDefault();
      if (editorRootRef.current) {
        pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
      }
      document.execCommand('insertOrderedList', false);
      handleContinuousInput();
      return;
    }

    // 9. Tab / Shift+Tab for Indent & Outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        document.execCommand('outdent', false);
      } else {
        document.execCommand('insertText', false, '    ');
      }
      handleContinuousInput();
      return;
    }

    // 10. Escape: Close toolbar
    if (e.key === 'Escape') {
      setToolbarPos(null);
    }
  };

  // Copy handler: extracts multi-format blocks, preserving titles, subtitles, bold, italics, monospace, and casing
  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const cloned = range.cloneContents();
    const smartBlocks = domFragmentToSmartBlocks(cloned);
    const markdown = domFragmentToMarkdown(cloned);

    e.preventDefault();

    // 1. Structured blocks for intelligent cross-screen and cross-section pasting
    if (smartBlocks.length > 0) {
      e.clipboardData.setData('application/x-verbum-blocks', JSON.stringify(smartBlocks));
      (window as any).__VERBUM_CLIPBOARD_BLOCKS__ = smartBlocks;
      try {
        localStorage.setItem('verbum_clipboard_blocks', JSON.stringify(smartBlocks));
      } catch (err) {}
    }

    // 2. Pure markdown representation
    e.clipboardData.setData('text/plain', markdown);

    // 3. HTML representation
    const div = document.createElement('div');
    div.appendChild(cloned.cloneNode(true));
    e.clipboardData.setData('text/html', div.innerHTML);
  };

  // Cut handler: copies exact multi-format blocks and removes selection
  const handleCut = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editorRootRef.current) {
      pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
    }
    handleCopy(e);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      sel.getRangeAt(0).deleteContents();
      handleContinuousInput();
    }
  };

  // Paste handler: recognizes titles, subtitles, bold, italics, monospace, and quotes individually.
  // Pastes EXACTLY wherever the cursor is placed in the document rather than at the bottom of the page.
  const handleContinuousPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (editorRootRef.current) {
      pushHistory(parseDocumentHtmlToBlocks(editorRootRef.current));
    }
    e.preventDefault();

    let blocksToInsert: DocumentBlock[] = [];

    // 1. First check structured custom MIME type
    const customBlocksJson = e.clipboardData.getData('application/x-verbum-blocks');
    if (customBlocksJson) {
      try {
        const parsed = JSON.parse(customBlocksJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          blocksToInsert = parsed;
        }
      } catch (err) {}
    }

    // 2. Window global memory fallback (works perfectly across split panes)
    if (blocksToInsert.length === 0 && (window as any).__VERBUM_CLIPBOARD_BLOCKS__) {
      const globalBlocks = (window as any).__VERBUM_CLIPBOARD_BLOCKS__;
      if (Array.isArray(globalBlocks) && globalBlocks.length > 0) {
        blocksToInsert = globalBlocks;
      }
    }

    // 3. LocalStorage fallback
    if (blocksToInsert.length === 0) {
      try {
        const local = localStorage.getItem('verbum_clipboard_blocks');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            blocksToInsert = parsed;
          }
        }
      } catch (err) {}
    }

    // 4. HTML fallback (Google Docs, Word, web pages)
    if (blocksToInsert.length === 0) {
      const html = e.clipboardData.getData('text/html');
      if (html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const smart = domFragmentToSmartBlocks(tempDiv);
        if (smart.length > 0) {
          blocksToInsert = smart;
        }
      }
    }

    // 5. Plain text / markdown fallback
    if (blocksToInsert.length === 0) {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        blocksToInsert = markdownTextToBlocks(text);
      }
    }

    if (blocksToInsert.length === 0) return;

    // Refresh block IDs so they are completely unique in target page
    blocksToInsert = blocksToInsert.map((b) => ({
      ...b,
      id: 'blk_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    }));

    if (!editorRootRef.current) return;

    // Determine current selection range inside this editor
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount > 0 && editorRootRef.current.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else if (
      lastCaretRangeRef.current &&
      editorRootRef.current.contains(lastCaretRangeRef.current.startContainer)
    ) {
      range = lastCaretRangeRef.current;
    }

    // If still no range, position at the end of the editor root
    if (!range) {
      range = document.createRange();
      if (editorRootRef.current.lastElementChild) {
        range.selectNodeContents(editorRootRef.current.lastElementChild);
        range.collapse(false);
      } else {
        range.selectNodeContents(editorRootRef.current);
        range.collapse(false);
      }
    }

    // If user has a selected range, delete selected contents first
    if (range && !range.collapsed) {
      range.deleteContents();
    }

    // Check if it's purely a single inline fragment (e.g. bold or italic phrase, word, single sentence)
    const isSingleInline =
      blocksToInsert.length === 1 &&
      blocksToInsert[0].type === 'body' &&
      !blocksToInsert[0].text.includes('\n');

    if (isSingleInline && range && editorRootRef.current.contains(range.startContainer)) {
      const inlineHtml = renderInlineMarkdownToHtml(blocksToInsert[0].text);
      const span = document.createElement('span');
      span.innerHTML = inlineHtml;
      const frag = document.createDocumentFragment();
      let lastNode: Node | null = null;
      while (span.firstChild) {
        lastNode = frag.appendChild(span.firstChild);
      }
      range.insertNode(frag);
      if (lastNode && sel) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        lastCaretRangeRef.current = range.cloneRange();
      }

      // Keep newly pasted inline content smoothly in view
      if (lastNode instanceof HTMLElement) {
        lastNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (lastNode?.parentElement) {
        lastNode.parentElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      const parsed = parseDocumentHtmlToBlocks(editorRootRef.current);
      isLocalUpdateRef.current = true;
      handleUpdateBlocksInternal(parsed, true);
      return;
    }

    // Multi-block or multi-line paste (paragraphs from Docs, web pages, headings, lists):
    // Insert EXACTLY where the cursor is placed in the live DOM
    let currentBlockEl: HTMLElement | null = null;
    if (range) {
      currentBlockEl = (range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as HTMLElement).closest('[data-block-id]')
        : range.startContainer.parentElement?.closest('[data-block-id]')) as HTMLElement | null;
    }

    // Render the new blocks into a real DOM fragment
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = renderBlocksToDocumentHtml(blocksToInsert);
    const frag = document.createDocumentFragment();
    let firstPastedNode: Node | null = null;
    let lastPastedNode: Node | null = null;
    while (tempContainer.firstChild) {
      const node = tempContainer.firstChild;
      if (!firstPastedNode) firstPastedNode = node;
      lastPastedNode = node;
      frag.appendChild(node);
    }

    if (currentBlockEl && editorRootRef.current.contains(currentBlockEl)) {
      const blockText = (currentBlockEl.textContent || '').trim();

      if (!blockText) {
        // Current block is empty: replace it directly in place
        currentBlockEl.replaceWith(frag);
      } else {
        // Current block has text: split at cursor position
        const afterRange = document.createRange();
        afterRange.selectNodeContents(currentBlockEl);
        afterRange.setStart(range.endContainer, range.endOffset);
        const afterFrag = afterRange.extractContents();

        const afterText = (afterFrag.textContent || '').trim();
        const beforeText = (currentBlockEl.textContent || '').trim();

        if (!beforeText && afterText) {
          // Cursor was at the start of the block: insert before
          currentBlockEl.before(frag);
        } else if (beforeText && !afterText) {
          // Cursor was at the end of the block: insert after
          currentBlockEl.after(frag);
        } else if (beforeText && afterText) {
          // Cursor was in the middle: create a continuation block for the remaining after-text
          const continuationEl = currentBlockEl.cloneNode(false) as HTMLElement;
          continuationEl.setAttribute(
            'data-block-id',
            'blk_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
          );
          continuationEl.appendChild(afterFrag);

          currentBlockEl.after(frag, continuationEl);
        } else {
          currentBlockEl.after(frag);
        }
      }
    } else {
      // Not inside an existing block: append to editor root
      editorRootRef.current.appendChild(frag);
    }

    // Set cursor to the end of the last inserted block and scroll into view smoothly
    if (lastPastedNode && sel) {
      const newRange = document.createRange();
      newRange.selectNodeContents(lastPastedNode);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
      lastCaretRangeRef.current = newRange.cloneRange();

      const lastId = (lastPastedNode as HTMLElement).getAttribute?.('data-block-id');
      if (lastId) setActiveBlockId(lastId);

      // Smart scroll: smoothly ensure the pasted content and caret are in view without jumping
      if (lastPastedNode instanceof HTMLElement) {
        lastPastedNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Sync state from the transformed live DOM
    const parsed = parseDocumentHtmlToBlocks(editorRootRef.current);
    isLocalUpdateRef.current = true;
    handleUpdateBlocksInternal(parsed, true);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setImportChoiceModal({ file });
    }
  };

  const handleExecuteImport = async (replace: boolean) => {
    if (!importChoiceModal) return;
    try {
      const result = await parseImportFile(importChoiceModal.file);
      if (replace) {
        handleUpdateBlocksInternal(result.blocks, true);
      } else {
        handleUpdateBlocksInternal([...blocks, ...result.blocks], true);
      }
    } catch (err: any) {
      alert(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setImportChoiceModal(null);
    }
  };

  const handleInsertDocumentInline = (
    importedTitle: string,
    importedBlocks: DocumentBlock[],
    mode: 'embed' | 'expand'
  ) => {
    if (inlineImportTargetIndex === null) return;
    const targetBlock = blocks[inlineImportTargetIndex];
    const totalWords = importedBlocks.reduce((sum, b) => sum + b.wordCount, 0);
    const updated = [...blocks];

    if (mode === 'expand') {
      const isTargetEmpty = !targetBlock.text || targetBlock.text.trim() === '[ ]' || targetBlock.text.trim() === '[]';
      if (isTargetEmpty) {
        updated.splice(inlineImportTargetIndex, 1, ...importedBlocks);
      } else {
        updated.splice(inlineImportTargetIndex + 1, 0, ...importedBlocks);
      }
    } else {
      const embedBlock: DocumentBlock = {
        id: 'blk_embed_' + Math.random().toString(36).substring(2, 9),
        type: 'embedded-doc',
        text: `[doc: ${importedTitle}]`,
        wordCount: totalWords,
        charCount: 0,
        embeddedDocTitle: importedTitle,
        embeddedDocWords: totalWords,
        embeddedDocBlocks: importedBlocks,
      };

      const isTargetEmpty = !targetBlock.text || targetBlock.text.trim() === '[ ]' || targetBlock.text.trim() === '[]';
      if (isTargetEmpty) {
        updated[inlineImportTargetIndex] = embedBlock;
      } else {
        updated.splice(inlineImportTargetIndex + 1, 0, embedBlock);
      }
    }

    handleUpdateBlocksInternal(updated, true);
    setInlineImportTargetIndex(null);
  };

  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0] || null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col h-full border-r border-neutral-200/60 dark:border-white/10 bg-white dark:bg-[#121214] overflow-hidden transition-all ${
        isDraggingOver ? 'ring-1 ring-amber-500/60 bg-amber-500/5' : ''
      }`}
    >
      {/* Sleek macOS Pane Header */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-xs select-none">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-600 dark:text-neutral-400 text-[11px]">
            {pageId === 'page1' ? 'Page 1' : 'Page 2'}
          </span>
          <span className="text-neutral-400 dark:text-neutral-600 text-[11px] font-mono">
            {pageWordCount.toLocaleString()}w
          </span>
        </div>

        <div className="flex items-center gap-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 disabled:opacity-20 transition"
            title="Undo (⌘Z)"
          >
            <Undo2 size={12} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= historyLen - 1}
            className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 disabled:opacity-20 transition"
            title="Redo (⇧⌘Z)"
          >
            <Redo2 size={12} />
          </button>

          <div className="h-3 w-px bg-neutral-200 dark:bg-white/10 mx-1" />

          {/* Table of Contents Hashtag Button (#) */}
          <button
            type="button"
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`p-1 rounded transition flex items-center justify-center ${
              isTocOpen
                ? 'bg-neutral-200/90 dark:bg-white/20 text-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-white/10'
            }`}
            title={isTocOpen ? 'Normal Editor' : 'Table of Contents (#)'}
          >
            <Hash size={13} />
          </button>

          {/* Copy to Other Page */}
          <button
            type="button"
            onClick={onCopyAllToOtherPage}
            className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 transition"
            title={`Copy all to ${otherPageName}`}
          >
            <Copy size={12} />
          </button>

          {/* Insert Document [ ] */}
          <button
            type="button"
            onClick={() => setInlineImportTargetIndex(blocks.length - 1)}
            className="px-1.5 py-0.5 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 font-mono text-[11px] font-semibold transition"
            title="Insert Document [ ]"
          >
            [ ]
          </button>

          {/* File Upload */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 transition"
            title="Import File"
          >
            <Upload size={12} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.pdf,.txt,.md,.markdown,.rtf,.odt,image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImportChoiceModal({ file: e.target.files[0] });
                e.target.value = '';
              }
            }}
          />

          {/* Maximize */}
          <button
            type="button"
            onClick={onToggleMaximize}
            className="p-1 rounded hover:bg-neutral-200/60 dark:hover:bg-white/10 transition"
            title={isMaximized ? 'Restore Split' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Floating Contextual Toolbar */}
      {!isTocOpen && (
        <ContextualToolbar
          position={toolbarPos}
          activeBlock={activeBlock}
          onUpdateBlock={handleUpdateActiveBlock}
          onMoveToOtherPage={handleSendSelectionToOtherPage}
          onImportDocumentInline={() => {
            setInlineImportTargetIndex(blocks.length - 1);
            setToolbarPos(null);
          }}
          otherPageName={otherPageName}
        />
      )}

      {/* Table of Contents View (when toggled on) */}
      {isTocOpen && (
        <TableOfContentsView
          currentBlocks={blocks}
          fontFamily={fontFamily}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          onJumpToSection={(blockId) => {
            setIsTocOpen(false);
            setTimeout(() => {
              if (!editorRootRef.current) return;
              const targetEl = editorRootRef.current.querySelector(
                `[data-block-id="${blockId}"]`
              ) as HTMLElement | null;
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.classList.add('bg-amber-500/20', 'ring-1', 'ring-amber-500');
                setTimeout(() => {
                  targetEl.classList.remove('bg-amber-500/20', 'ring-1', 'ring-amber-500');
                }, 2000);
              }
            }, 60);
          }}
          onClose={() => setIsTocOpen(false)}
        />
      )}

      {/* Continuous Document Canvas: KEPT MOUNTED AT ALL TIMES so text is NEVER deleted */}
      <div
        ref={containerRef}
        style={{ display: isTocOpen ? 'none' : 'block' }}
        onScroll={(e) => {
          isUserScrollingRef.current = true;
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            isUserScrollingRef.current = false;
          }, 150);
          if (onScroll) onScroll(e.currentTarget.scrollTop);
        }}
        onMouseUp={handleSelectionUpdate}
        onKeyUp={handleSelectionUpdate}
        className="flex-1 overflow-y-auto px-6 sm:px-12 py-10 custom-scrollbar focus:outline-none scroll-smooth [overflow-anchor:auto]"
        onClick={(e) => {
          const target = e.target as HTMLElement;

          // Expand embedded doc
          if (target.getAttribute('data-action') === 'expand-embedded') {
            const card = target.closest('[data-embedded-doc]');
            if (card) {
              const raw = card.getAttribute('data-embedded-blocks');
              if (raw) {
                try {
                  const embBlocks: DocumentBlock[] = JSON.parse(raw);
                  const blockId = card.getAttribute('data-block-id');
                  const idx = blocks.findIndex((b) => b.id === blockId);
                  if (idx !== -1) {
                    const updated = [...blocks];
                    updated.splice(idx, 1, ...embBlocks);
                    handleUpdateBlocksInternal(updated, true);
                  }
                } catch (err) {}
              }
            }
            return;
          }

          // Inline document trigger
          if (target.closest('.inline-doc-trigger')) {
            setInlineImportTargetIndex(blocks.length - 1);
            return;
          }

          // If clicked outside text in container: place caret accurately at nearest point
          if (e.target === containerRef.current || target.classList.contains('max-w-2xl')) {
            setToolbarPos(null);
            if (editorRootRef.current) {
              const sel = window.getSelection();
              let placed = false;
              if ((document as any).caretRangeFromPoint) {
                try {
                  const ptRange = (document as any).caretRangeFromPoint(e.clientX, e.clientY) as Range | null;
                  if (ptRange && editorRootRef.current.contains(ptRange.startContainer)) {
                    sel?.removeAllRanges();
                    sel?.addRange(ptRange);
                    lastCaretRangeRef.current = ptRange.cloneRange();
                    const blockEl = (ptRange.startContainer.nodeType === Node.ELEMENT_NODE
                      ? (ptRange.startContainer as HTMLElement).closest('[data-block-id]')
                      : ptRange.startContainer.parentElement?.closest('[data-block-id]')) as HTMLElement | null;
                    if (blockEl) {
                      const id = blockEl.getAttribute('data-block-id');
                      if (id) setActiveBlockId(id);
                    }
                    placed = true;
                  }
                } catch (err) {}
              }

              if (!placed) {
                // If clicked below all content, place caret at the end of the last block
                const lastEl = editorRootRef.current.lastElementChild as HTMLElement | null;
                if (lastEl && sel) {
                  const range = document.createRange();
                  range.selectNodeContents(lastEl);
                  range.collapse(false);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  lastCaretRangeRef.current = range.cloneRange();
                  const id = lastEl.getAttribute('data-block-id');
                  if (id) setActiveBlockId(id);
                }
              }
            }
          }
        }}
      >
          <div className="max-w-2xl mx-auto">
            {/* Continuous Unified Document Root: Drag mouse freely across all sections and formats */}
            <div
              ref={editorRootRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              spellCheck={true}
              onInput={handleContinuousInput}
              onKeyDown={handleContinuousKeyDown}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handleContinuousPaste}
              onMouseUp={handleSelectionUpdate}
              onKeyUp={handleSelectionUpdate}
              style={{
                fontFamily:
                  fontFamily === 'serif'
                    ? "'Merriweather', 'Georgia', serif"
                    : fontFamily === 'garamond'
                    ? "'Crimson Pro', 'Garamond', serif"
                    : fontFamily === 'mono'
                    ? "'JetBrains Mono', monospace"
                    : 'system-ui, -apple-system, sans-serif',
                fontSize: `${fontSize}px`,
                lineHeight: lineSpacing,
              }}
              className="w-full min-h-[70vh] outline-none focus:outline-none rendered-markdown cursor-text select-text"
            />
          </div>

          {/* Quiet breathing room at bottom */}
          <div className="h-32" />
        </div>

      {/* Inline Document Import [ ] Sheet */}
      {inlineImportTargetIndex !== null && (
        <InlineDocumentImportModal
          isOpen={true}
          onClose={() => setInlineImportTargetIndex(null)}
          targetPageIndex={inlineImportTargetIndex}
          currentManuscriptId={currentManuscriptId}
          onInsertDocument={handleInsertDocumentInline}
        />
      )}

      {/* Simple Import Choice Sheet */}
      {importChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-xl shadow-2xl p-5 max-w-sm w-full text-xs">
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-1">
              Import "{importChoiceModal.file.name}"
            </h3>
            <p className="text-neutral-500 mb-4">
              How would you like to place this document?
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleExecuteImport(false)}
                className="w-full text-left p-2.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 transition font-medium"
              >
                Append to Existing
              </button>
              <button
                type="button"
                onClick={() => handleExecuteImport(true)}
                className="w-full text-left p-2.5 rounded-lg border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10 transition font-medium"
              >
                Replace Current Page
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setImportChoiceModal(null)}
                className="px-3 py-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
