import React, { useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  RemoveFormatting,
  Code,
  Quote,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Type as TypeIcon,
  ChevronDown,
  ArrowRightLeft,
  Copy,
} from 'lucide-react';
import { BlockType, DocumentBlock } from '../types/manuscript';
import { domFragmentToSmartBlocks } from '../services/markdownRenderer';

interface ContextualToolbarProps {
  position: { top: number; left: number } | null;
  activeBlock: DocumentBlock | null;
  onUpdateBlock: (updated: Partial<DocumentBlock>) => void;
  onMoveToOtherPage?: (selectedBlocks?: DocumentBlock[]) => void;
  otherPageName?: string;
  onImportDocumentInline?: () => void;
  onClose?: () => void;
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  position,
  activeBlock,
  onUpdateBlock,
  onMoveToOtherPage,
  otherPageName = 'Other Page',
  onImportDocumentInline,
}) => {
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [showAlignMenu, setShowAlignMenu] = useState(false);

  if (!position || !activeBlock) return null;

  const currentType = activeBlock.type;

  const blockTypes: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: 'title', label: 'Title', icon: <TypeIcon size={14} className="font-bold" /> },
    { type: 'h1', label: 'Heading 1', icon: <Heading1 size={14} /> },
    { type: 'h2', label: 'Heading 2', icon: <Heading2 size={14} /> },
    { type: 'h3', label: 'Heading 3', icon: <Heading3 size={14} /> },
    { type: 'subheading', label: 'Subheading', icon: <TypeIcon size={14} className="opacity-80" /> },
    { type: 'body', label: 'Body Text', icon: <TypeIcon size={14} /> },
    { type: 'blockquote', label: 'Blockquote', icon: <Quote size={14} /> },
    { type: 'bullet', label: 'Bulleted List', icon: <List size={14} /> },
    { type: 'numbered', label: 'Numbered List', icon: <ListOrdered size={14} /> },
    { type: 'code', label: 'Code Block', icon: <Code size={14} /> },
  ];

  const currentTypeLabel = blockTypes.find((b) => b.type === currentType)?.label || 'Format';

  return (
    <div
      style={{
        top: `${Math.max(12, position.top)}px`,
        left: `${Math.max(12, Math.min(window.innerWidth - 380, position.left))}px`,
      }}
      className="fixed z-50 flex items-center gap-0.5 px-1.5 py-1 bg-neutral-900/90 dark:bg-[#1e1e20]/95 text-neutral-100 rounded-lg shadow-xl border border-white/10 backdrop-blur-md text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Block Type Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowStyleMenu(!showStyleMenu);
            setShowAlignMenu(false);
          }}
          className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-white/10 transition font-medium text-[11px] text-neutral-200"
          title="Paragraph Style"
        >
          <span>{currentTypeLabel}</span>
          <ChevronDown size={11} className="opacity-60" />
        </button>

        {showStyleMenu && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-neutral-900/95 dark:bg-[#1e1e20]/95 border border-white/10 rounded-lg shadow-2xl py-1 z-50 backdrop-blur-md">
            {blockTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => {
                  onUpdateBlock({ type: item.type });
                  setShowStyleMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-white/10 transition ${
                  currentType === item.type ? 'text-amber-400 font-semibold' : 'text-neutral-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Copy Selection */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const sel = window.getSelection();
          const selectedText = sel ? sel.toString() : '';
          const textToCopy = selectedText || activeBlock.text;
          navigator.clipboard.writeText(textToCopy);
        }}
        className="p-1 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition"
        title="Copy Selected Text (⌘C)"
      >
        <Copy size={13} />
      </button>

      <div className="h-3.5 w-px bg-white/10 mx-0.5" />

      {/* Inline Formatting: Bold, Italic, Underline, Strikethrough */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onUpdateBlock({ bold: !activeBlock.bold })}
        className={`p-1 rounded hover:bg-white/10 transition ${activeBlock.bold ? 'bg-white/20 text-white' : 'text-neutral-300'}`}
        title="Bold (⌘B)"
      >
        <Bold size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onUpdateBlock({ italic: !activeBlock.italic })}
        className={`p-1 rounded hover:bg-white/10 transition ${activeBlock.italic ? 'bg-white/20 text-white' : 'text-neutral-300'}`}
        title="Italic (⌘I)"
      >
        <Italic size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onUpdateBlock({ underline: !activeBlock.underline })}
        className={`p-1 rounded hover:bg-white/10 transition ${activeBlock.underline ? 'bg-white/20 text-white' : 'text-neutral-300'}`}
        title="Underline (⌘U)"
      >
        <Underline size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onUpdateBlock({ strikethrough: !activeBlock.strikethrough })}
        className={`p-1 rounded hover:bg-white/10 transition ${activeBlock.strikethrough ? 'bg-white/20 text-white' : 'text-neutral-300'}`}
        title="Strikethrough"
      >
        <Strikethrough size={13} />
      </button>

      <div className="h-3.5 w-px bg-white/10 mx-0.5" />

      {/* Text Alignment */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setShowAlignMenu(!showAlignMenu);
            setShowStyleMenu(false);
          }}
          className="p-1 rounded hover:bg-white/10 text-neutral-300 transition"
          title="Alignment"
        >
          {activeBlock.align === 'center' ? (
            <AlignCenter size={13} />
          ) : activeBlock.align === 'right' ? (
            <AlignRight size={13} />
          ) : activeBlock.align === 'justify' ? (
            <AlignJustify size={13} />
          ) : (
            <AlignLeft size={13} />
          )}
        </button>

        {showAlignMenu && (
          <div className="absolute top-full left-0 mt-1 flex gap-0.5 p-1 bg-neutral-900/95 dark:bg-[#1e1e20]/95 border border-white/10 rounded-lg shadow-2xl z-50 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                onUpdateBlock({ align: 'left' });
                setShowAlignMenu(false);
              }}
              className="p-1 hover:bg-white/10 rounded text-neutral-200"
              title="Align Left"
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateBlock({ align: 'center' });
                setShowAlignMenu(false);
              }}
              className="p-1 hover:bg-white/10 rounded text-neutral-200"
              title="Align Center"
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateBlock({ align: 'right' });
                setShowAlignMenu(false);
              }}
              className="p-1 hover:bg-white/10 rounded text-neutral-200"
              title="Align Right"
            >
              <AlignRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateBlock({ align: 'justify' });
                setShowAlignMenu(false);
              }}
              className="p-1 hover:bg-white/10 rounded text-neutral-200"
              title="Justify"
            >
              <AlignJustify size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Indentation */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const currentIndent = activeBlock.indent || 0;
          if (currentIndent > 0) onUpdateBlock({ indent: currentIndent - 1 });
        }}
        className="p-1 rounded hover:bg-white/10 text-neutral-300 transition"
        title="Decrease Indent"
      >
        <Outdent size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const currentIndent = activeBlock.indent || 0;
          if (currentIndent < 4) onUpdateBlock({ indent: currentIndent + 1 });
        }}
        className="p-1 rounded hover:bg-white/10 text-neutral-300 transition"
        title="Increase Indent"
      >
        <Indent size={13} />
      </button>

      <div className="h-3.5 w-px bg-white/10 mx-0.5" />

      {/* Clear Formatting */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          onUpdateBlock({
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            align: 'left',
            indent: 0,
            type: 'body',
          })
        }
        className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-red-400 transition"
        title="Clear Formatting"
      >
        <RemoveFormatting size={13} />
      </button>

      {/* Move / Send Selection to Other Split Screen Pane */}
      {onMoveToOtherPage && (
        <>
          <div className="h-3.5 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const sel = window.getSelection();
              if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
                const cloned = sel.getRangeAt(0).cloneContents();
                const smartBlocks = domFragmentToSmartBlocks(cloned);
                onMoveToOtherPage(smartBlocks);
              } else {
                onMoveToOtherPage();
              }
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-neutral-300 hover:text-white transition"
            title={`Send selection to ${otherPageName}`}
          >
            <ArrowRightLeft size={12} />
            <span className="text-[10px] font-medium">Send</span>
          </button>
        </>
      )}

      {/* Inline Additional Document Import [ ] */}
      {onImportDocumentInline && (
        <>
          <div className="h-3.5 w-px bg-white/10 mx-0.5" />
          <button
            type="button"
            onClick={onImportDocumentInline}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/15 text-neutral-200 transition"
            title="Insert Document [ ]"
          >
            <span className="font-mono text-[11px] font-semibold">[ ]</span>
          </button>
        </>
      )}
    </div>
  );
};
