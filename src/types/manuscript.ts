/**
 * Core type definitions for Verbum Manuscript Editor
 */

export type BlockType = 
  | 'title'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'subheading'
  | 'body'
  | 'blockquote'
  | 'bullet'
  | 'numbered'
  | 'code'
  | 'embedded-doc';

export interface DocumentBlock {
  id: string;
  type: BlockType;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: number; // 0 to 4
  wordCount: number;
  charCount: number;
  embeddedDocId?: string;
  embeddedDocTitle?: string;
  embeddedDocWords?: number;
  embeddedDocBlocks?: DocumentBlock[];
}

export interface DocumentPage {
  id: string;
  name: string;
  blocks: DocumentBlock[];
  wordCount: number;
  charCount: number;
}

export type EntityCategory = 'character' | 'location' | 'organization' | 'entity';

export interface ProperNounEntry {
  id: string;
  name: string;
  category: EntityCategory;
  aliases: string[];
  notes?: string;
  occurrences?: number;
}

export interface ConsistencyIssue {
  id: string;
  primaryName: string;
  variantFound: string;
  recommendation: string;
  contextSnippet?: string;
}

export interface Milestone {
  id: string;
  manuscriptId: string;
  name: string;
  description?: string;
  createdAt: number;
  page1Blocks: DocumentBlock[];
  page2Blocks: DocumentBlock[];
  wordCount: number;
  charCount: number;
}

export interface ManuscriptFolder {
  id: string;
  name: string;
  orderIndex: number;
}

export interface Manuscript {
  id: string;
  title: string;
  description?: string;
  folderId?: string;
  page1: DocumentPage;
  page2: DocumentPage;
  dividerPosition: number; // percentage, e.g. 50
  splitMode: 'dual' | 'page1' | 'page2';
  syncScroll: boolean;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  orderIndex: number;
  properNouns: ProperNounEntry[];
}

export type SearchType = 'exact' | 'fuzzy' | 'semantic' | 'properNoun';

export interface SearchFilters {
  query: string;
  type: SearchType;
  caseSensitive: boolean;
  wholeWord: boolean;
  exactPhrase: boolean;
  regex: boolean;
  scope: 'current' | 'both' | 'all' | 'headings' | 'body' | 'selected';
  pageTarget: 'page1' | 'page2' | 'both';
}

export interface SearchResult {
  id: string;
  pageId: 'page1' | 'page2';
  blockId: string;
  blockIndex: number;
  blockType: BlockType;
  matchText: string;
  fullBlockText: string;
  contextBefore: string;
  contextAfter: string;
  startIndex: number;
  endIndex: number;
  score?: number; // For fuzzy and semantic search (0-1)
  explanation?: string;
  entityCategory?: EntityCategory;
}

export interface ExportSettings {
  formats: ('docx' | 'doc' | 'pdf' | 'md' | 'txt' | 'rtf' | 'odt' | 'html')[];
  scope: 'entire' | 'page1' | 'page2' | 'selected';
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includePageNumbers: boolean;
  headerText: string;
  footerText: string;
  pageSize: 'a4' | 'letter' | 'novel'; // novel = 6x9 in
  margins: 'normal' | 'wide' | 'compact';
  fontFamily: 'serif' | 'sans' | 'mono' | 'garamond';
  fontSize: number;
  lineSpacing: number; // 1.2, 1.5, 2.0
  pageBreakBetweenChapters: boolean;
}

export interface EditorSettings {
  theme: 'light' | 'dark';
  fontFamily: 'serif' | 'sans' | 'mono' | 'garamond';
  fontSize: number; // 14, 16, 18, 20
  lineSpacing: number; // 1.4, 1.6, 1.8, 2.0
  focusMode: boolean;
  renderMarkdown: boolean; // Toggle global markdown HTML rendering vs raw markdown source
}
