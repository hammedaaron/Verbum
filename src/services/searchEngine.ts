import { Manuscript, SearchFilters, SearchResult, DocumentBlock, ProperNounEntry } from '../types/manuscript';

// Levenshtein distance algorithm for fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      let val = 0;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[n] = prev;
  }
  return row[n];
}

// Token-based fuzzy sentence similarity (Jaccard + Levenshtein)
export function calculateFuzzySimilarity(query: string, target: string): number {
  const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tTokens = target.toLowerCase().split(/\s+/).filter(Boolean);
  if (qTokens.length === 0 || tTokens.length === 0) return 0;

  let totalMatchScore = 0;

  for (const qWord of qTokens) {
    let bestWordScore = 0;
    for (const tWord of tTokens) {
      if (qWord === tWord) {
        bestWordScore = 1;
        break;
      }
      // Distance calculation for words > 2 chars
      if (qWord.length > 2 && tWord.length > 2) {
        const maxLen = Math.max(qWord.length, tWord.length);
        const dist = levenshteinDistance(qWord, tWord);
        const score = 1 - dist / maxLen;
        if (score > 0.65 && score > bestWordScore) {
          bestWordScore = score;
        }
      }
    }
    totalMatchScore += bestWordScore;
  }

  return totalMatchScore / qTokens.length;
}

// Extract contextual snippet around a match
export function extractSnippet(
  text: string,
  startIndex: number,
  matchLength: number,
  contextPadding = 45
): { contextBefore: string; matchText: string; contextAfter: string } {
  const beforeStart = Math.max(0, startIndex - contextPadding);
  const afterEnd = Math.min(text.length, startIndex + matchLength + contextPadding);

  const contextBefore = (beforeStart > 0 ? '… ' : '') + text.slice(beforeStart, startIndex);
  const matchText = text.slice(startIndex, startIndex + matchLength);
  const contextAfter = text.slice(startIndex + matchLength, afterEnd) + (afterEnd < text.length ? ' …' : '');

  return { contextBefore, matchText, contextAfter };
}

// Main search execution engine
export async function performSearch(
  manuscript: Manuscript,
  filters: SearchFilters,
  properNounIndex: ProperNounEntry[] = []
): Promise<SearchResult[]> {
  const query = filters.query.trim();
  if (!query) return [];

  const results: SearchResult[] = [];

  // Determine pages to inspect
  const pagesToSearch: Array<{ id: 'page1' | 'page2'; blocks: DocumentBlock[] }> = [];
  if (filters.pageTarget === 'page1' || filters.pageTarget === 'both') {
    pagesToSearch.push({ id: 'page1', blocks: manuscript.page1.blocks });
  }
  if (filters.pageTarget === 'page2' || filters.pageTarget === 'both') {
    pagesToSearch.push({ id: 'page2', blocks: manuscript.page2.blocks });
  }

  // Filter blocks by scope
  const targetBlocks: Array<{ pageId: 'page1' | 'page2'; block: DocumentBlock; index: number }> = [];
  for (const page of pagesToSearch) {
    page.blocks.forEach((block, index) => {
      if (filters.scope === 'headings') {
        if (!['title', 'h1', 'h2', 'h3', 'subheading'].includes(block.type)) return;
      } else if (filters.scope === 'body') {
        if (['title', 'h1', 'h2', 'h3'].includes(block.type)) return;
      }
      targetBlocks.push({ pageId: page.id, block, index });
    });
  }

  // 1. @ Proper-Noun Search Operator
  if (query.startsWith('@') || filters.type === 'properNoun') {
    const rawTarget = query.startsWith('@') ? query.slice(1).trim() : query;
    if (!rawTarget) return [];

    // Find in proper noun index
    const matchedEntities = properNounIndex.filter((entity) => {
      const q = rawTarget.toLowerCase();
      return (
        entity.name.toLowerCase().includes(q) ||
        entity.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });

    const searchNames = matchedEntities.length > 0 
      ? Array.from(new Set(matchedEntities.flatMap(e => [e.name, ...e.aliases])))
      : [rawTarget];

    // Search blocks for any of these names
    for (const { pageId, block, index } of targetBlocks) {
      for (const name of searchNames) {
        const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(block.text)) !== null) {
          const { contextBefore, matchText, contextAfter } = extractSnippet(
            block.text,
            match.index,
            match[0].length
          );

          const matchedEntity = matchedEntities.find(
            e => e.name.toLowerCase() === name.toLowerCase() || e.aliases.some(a => a.toLowerCase() === name.toLowerCase())
          );

          results.push({
            id: `res_pn_${pageId}_${block.id}_${match.index}`,
            pageId,
            blockId: block.id,
            blockIndex: index,
            blockType: block.type,
            matchText,
            fullBlockText: block.text,
            contextBefore,
            contextAfter,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            score: 1.0,
            entityCategory: matchedEntity?.category || 'character',
            explanation: matchedEntity ? `${matchedEntity.category.toUpperCase()}: ${matchedEntity.name}` : 'Proper Noun Match',
          });
        }
      }
    }

    return results;
  }

  // 2. Semantic Search
  if (filters.type === 'semantic') {
    try {
      const candidateList = targetBlocks.slice(0, 150).map(({ block }) => ({
        id: block.id,
        text: block.text,
      }));

      const res = await fetch('/api/gemini/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, candidates: candidateList }),
      });

      if (res.ok) {
        const data = await res.json();
        const serverResults = data.results as Array<{ id: string; text: string; score: number; explanation?: string }>;

        for (const item of serverResults) {
          if (item.score > 0.45) {
            const blockInfo = targetBlocks.find((tb) => tb.block.id === item.id);
            if (blockInfo) {
              const { contextBefore, matchText, contextAfter } = extractSnippet(
                blockInfo.block.text,
                0,
                Math.min(blockInfo.block.text.length, 60)
              );
              results.push({
                id: `res_sem_${blockInfo.pageId}_${blockInfo.block.id}`,
                pageId: blockInfo.pageId,
                blockId: blockInfo.block.id,
                blockIndex: blockInfo.index,
                blockType: blockInfo.block.type,
                matchText: matchText,
                fullBlockText: blockInfo.block.text,
                contextBefore,
                contextAfter,
                startIndex: 0,
                endIndex: blockInfo.block.text.length,
                score: item.score,
                explanation: item.explanation || `Semantic similarity: ${(item.score * 100).toFixed(0)}%`,
              });
            }
          }
        }

        if (results.length > 0) return results;
      }
    } catch (err) {
      console.warn('Semantic API call failed, falling back to local fuzzy-semantic ranking:', err);
    }
  }

  // 3. Fuzzy Search
  if (filters.type === 'fuzzy') {
    for (const { pageId, block, index } of targetBlocks) {
      // Split block into sentences for fine-grained matching
      const sentences = block.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [block.text];
      let offset = 0;

      for (const sentence of sentences) {
        const score = calculateFuzzySimilarity(query, sentence);
        if (score >= 0.55) {
          const startIndex = block.text.indexOf(sentence, offset);
          const { contextBefore, matchText, contextAfter } = extractSnippet(
            block.text,
            Math.max(0, startIndex),
            sentence.length
          );

          results.push({
            id: `res_fuz_${pageId}_${block.id}_${startIndex}`,
            pageId,
            blockId: block.id,
            blockIndex: index,
            blockType: block.type,
            matchText,
            fullBlockText: block.text,
            contextBefore,
            contextAfter,
            startIndex: Math.max(0, startIndex),
            endIndex: Math.max(0, startIndex) + sentence.length,
            score,
            explanation: `Fuzzy match confidence: ${(score * 100).toFixed(0)}%`,
          });
        }
        offset += sentence.length;
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results;
  }

  // 4. Exact Search (Word, phrase, sentence, regex)
  let regex: RegExp;
  try {
    if (filters.regex) {
      regex = new RegExp(query, filters.caseSensitive ? 'g' : 'gi');
    } else {
      const escaped = escapeRegExp(query);
      const pattern = filters.wholeWord ? `\\b${escaped}\\b` : escaped;
      regex = new RegExp(pattern, filters.caseSensitive ? 'g' : 'gi');
    }
  } catch (err) {
    console.error('Invalid regular expression:', err);
    return [];
  }

  for (const { pageId, block, index } of targetBlocks) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(block.text)) !== null) {
      const { contextBefore, matchText, contextAfter } = extractSnippet(
        block.text,
        match.index,
        match[0].length
      );

      results.push({
        id: `res_ext_${pageId}_${block.id}_${match.index}`,
        pageId,
        blockId: block.id,
        blockIndex: index,
        blockType: block.type,
        matchText,
        fullBlockText: block.text,
        contextBefore,
        contextAfter,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        score: 1.0,
      });

      // Prevent infinite loop with zero-length matches
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
  }

  return results;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Replace execution with preview and undo capability
export interface ReplaceOperation {
  resultsToReplace: SearchResult[];
  replacementText: string;
}

export interface ReplaceResult {
  updatedManuscript: Manuscript;
  replacedCount: number;
  undoSnapshot: {
    page1Blocks: DocumentBlock[];
    page2Blocks: DocumentBlock[];
  };
}

export function executeReplace(
  manuscript: Manuscript,
  resultsToReplace: SearchResult[],
  replacementText: string
): ReplaceResult {
  // Store undo snapshot
  const undoSnapshot = {
    page1Blocks: JSON.parse(JSON.stringify(manuscript.page1.blocks)),
    page2Blocks: JSON.parse(JSON.stringify(manuscript.page2.blocks)),
  };

  const updatedPage1Blocks = [...manuscript.page1.blocks];
  const updatedPage2Blocks = [...manuscript.page2.blocks];

  // Group by block to avoid index shifting when replacing multiple occurrences in same block
  const grouped = new Map<string, { pageId: 'page1' | 'page2'; blockId: string; matches: SearchResult[] }>();

  for (const res of resultsToReplace) {
    const key = `${res.pageId}_${res.blockId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { pageId: res.pageId, blockId: res.blockId, matches: [] });
    }
    grouped.get(key)!.matches.push(res);
  }

  let replacedCount = 0;

  for (const { pageId, blockId, matches } of grouped.values()) {
    const blockList = pageId === 'page1' ? updatedPage1Blocks : updatedPage2Blocks;
    const blockIndex = blockList.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) continue;

    const block = blockList[blockIndex];
    // Sort matches from end to start to preserve character indices during string substitution
    matches.sort((a, b) => b.startIndex - a.startIndex);

    let newText = block.text;
    for (const match of matches) {
      newText = newText.slice(0, match.startIndex) + replacementText + newText.slice(match.endIndex);
      replacedCount++;
    }

    const words = newText.trim().match(/\S+/g);
    blockList[blockIndex] = {
      ...block,
      text: newText,
      wordCount: words ? words.length : 0,
      charCount: newText.length,
    };
  }

  const p1Words = updatedPage1Blocks.reduce((s, b) => s + b.wordCount, 0);
  const p1Chars = updatedPage1Blocks.reduce((s, b) => s + b.charCount, 0);
  const p2Words = updatedPage2Blocks.reduce((s, b) => s + b.wordCount, 0);
  const p2Chars = updatedPage2Blocks.reduce((s, b) => s + b.charCount, 0);

  const updatedManuscript: Manuscript = {
    ...manuscript,
    page1: {
      ...manuscript.page1,
      blocks: updatedPage1Blocks,
      wordCount: p1Words,
      charCount: p1Chars,
    },
    page2: {
      ...manuscript.page2,
      blocks: updatedPage2Blocks,
      wordCount: p2Words,
      charCount: p2Chars,
    },
    updatedAt: Date.now(),
  };

  return {
    updatedManuscript,
    replacedCount,
    undoSnapshot,
  };
}
