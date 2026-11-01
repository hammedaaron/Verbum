import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { DocumentBlock, BlockType } from '../types/manuscript';
import { renderInlineMarkdownToHtml } from '../services/markdownRenderer';

interface CollapsedSection {
  id: string;
  type: BlockType;
  title: string;
  level: number; // 0: Title, 1: H1, 2: H2, 3: H3, 4: Subheading
  contentBlocks: DocumentBlock[];
}

interface TableOfContentsViewProps {
  currentBlocks: DocumentBlock[];
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  onJumpToSection: (blockId: string) => void;
  onClose: () => void;
}

export const TableOfContentsView: React.FC<TableOfContentsViewProps> = ({
  currentBlocks,
  fontFamily,
  fontSize,
  lineSpacing,
  onJumpToSection,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Group blocks into clean title sections with their collapsed text underneath
  const sections: CollapsedSection[] = useMemo(() => {
    const result: CollapsedSection[] = [];
    let current: CollapsedSection | null = null;

    for (const block of currentBlocks) {
      const trimmed = (block.text || '').trim();
      let isHeading = false;
      let level = 1;
      let type: BlockType = block.type;
      let cleanTitle = trimmed;

      if (block.type === 'title' || trimmed.startsWith('# ')) {
        isHeading = true;
        level = 0;
        type = 'title';
        cleanTitle = trimmed.replace(/^#\s*/, '').trim() || 'Untitled';
      } else if (block.type === 'h1' || trimmed.startsWith('## ')) {
        isHeading = true;
        level = 1;
        type = 'h1';
        cleanTitle = trimmed.replace(/^##\s*/, '').trim() || 'Untitled Chapter';
      } else if (block.type === 'h2' || trimmed.startsWith('### ')) {
        isHeading = true;
        level = 2;
        type = 'h2';
        cleanTitle = trimmed.replace(/^###\s*/, '').trim() || 'Untitled Section';
      } else if (block.type === 'h3' || trimmed.startsWith('#### ')) {
        isHeading = true;
        level = 3;
        type = 'h3';
        cleanTitle = trimmed.replace(/^####\s*/, '').trim() || 'Untitled Subsection';
      } else if (block.type === 'subheading') {
        isHeading = true;
        level = 4;
        type = 'subheading';
        cleanTitle = trimmed || 'Subheading';
      }

      if (isHeading) {
        current = {
          id: block.id,
          type,
          title: cleanTitle,
          level,
          contentBlocks: [],
        };
        result.push(current);
      } else {
        if (current) {
          current.contentBlocks.push(block);
        } else if (trimmed) {
          current = {
            id: 'intro_' + block.id,
            type: 'body',
            title: 'Intro',
            level: 1,
            contentBlocks: [block],
          };
          result.push(current);
        }
      }
    }

    return result;
  }, [currentBlocks]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div
      style={{
        fontFamily:
          fontFamily === 'serif'
            ? "'Merriweather', 'Georgia', serif"
            : fontFamily === 'garamond'
            ? "'Crimson Pro', 'Garamond', serif"
            : fontFamily === 'mono'
            ? "'JetBrains Mono', monospace"
            : 'system-ui, -apple-system, sans-serif',
      }}
      className="flex-1 overflow-y-auto px-6 sm:px-12 py-10 custom-scrollbar select-text bg-white dark:bg-[#121214] text-neutral-900 dark:text-neutral-100"
    >
      <div className="max-w-2xl mx-auto">
        {/* Collapsed text: title first, toggle button placed at the back of the title in that order */}
        {sections.length === 0 ? (
          <div className="py-12 text-sm text-neutral-400 italic">
            No headings found on this page.
          </div>
        ) : (
          <div className="space-y-5">
            {sections.map((section) => {
              const isExpanded = !!expandedSections[section.id];

              const headingClass =
                section.level === 0
                  ? 'text-2xl sm:text-3xl font-bold tracking-tight'
                  : section.level === 1
                  ? 'text-xl sm:text-2xl font-bold tracking-tight'
                  : section.level === 2
                  ? 'text-lg sm:text-xl font-semibold'
                  : section.level === 3
                  ? 'text-base font-semibold'
                  : 'text-sm font-medium text-neutral-600 dark:text-neutral-400';

              const indentClass =
                section.level === 0
                  ? 'ml-0'
                  : section.level === 1
                  ? 'ml-0'
                  : section.level === 2
                  ? 'ml-4 sm:ml-6'
                  : section.level === 3
                  ? 'ml-8 sm:ml-12'
                  : 'ml-10 sm:ml-14';

              return (
                <div key={section.id} className={`${indentClass}`}>
                  {/* Title text first, toggle button placed at the back in that order */}
                  <div className="inline-flex items-baseline gap-2">
                    <span
                      onClick={() => toggleSection(section.id)}
                      onDoubleClick={() => onJumpToSection(section.id)}
                      className={`${headingClass} cursor-pointer hover:opacity-80 transition select-text`}
                    >
                      {section.title}
                    </span>

                    {/* Toggle button behind the text */}
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition select-none inline-flex items-center"
                      title={isExpanded ? 'Collapse text' : 'Reveal text underneath'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>

                  {/* Revealed text underneath when expanded */}
                  {isExpanded && (
                    <div
                      className="mt-3 pl-3 space-y-3 animate-in fade-in duration-100"
                      style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: lineSpacing,
                      }}
                    >
                      {section.contentBlocks.length === 0 ? (
                        <div className="text-xs text-neutral-400 italic">
                          (No content under this heading)
                        </div>
                      ) : (
                        section.contentBlocks.map((block) => (
                          <div
                            key={block.id}
                            className={`leading-relaxed text-neutral-800 dark:text-neutral-200 ${
                              block.type === 'blockquote'
                                ? 'pl-3 border-l-2 border-neutral-300 dark:border-neutral-700 italic text-neutral-600 dark:text-neutral-400'
                                : block.type === 'code'
                                ? 'p-2 rounded bg-neutral-100 dark:bg-neutral-900 font-mono text-xs'
                                : block.type === 'bullet'
                                ? 'flex items-start gap-2'
                                : block.type === 'numbered'
                                ? 'flex items-start gap-2'
                                : ''
                            }`}
                          >
                            {block.type === 'bullet' && <span className="text-neutral-400">•</span>}
                            <div
                              dangerouslySetInnerHTML={{
                                __html: renderInlineMarkdownToHtml(block.text || ''),
                              }}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="h-32" />
      </div>
    </div>
  );
};
