import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 1. Semantic Search API with vector embeddings
app.post('/api/gemini/semantic-search', async (req, res) => {
  try {
    const { query, candidates } = req.body as { query: string; candidates: Array<{ id: string; text: string }> };

    if (!query || !candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Query and candidate chunks are required.' });
    }

    // Limit candidates to up to 80 chunks per batch for performance
    const sampleCandidates = candidates.slice(0, 80);

    if (process.env.GEMINI_API_KEY) {
      try {
        // Embed query
        const queryRes = await ai.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: [query],
        });
        const queryVector = queryRes.embeddings?.[0]?.values;

        if (queryVector && queryVector.length > 0) {
          // Embed candidate chunks
          const candTexts = sampleCandidates.map((c) => c.text);
          const candRes = await ai.models.embedContent({
            model: 'gemini-embedding-2-preview',
            contents: candTexts,
          });

          const results = sampleCandidates.map((cand, idx) => {
            const candVector = candRes.embeddings?.[idx]?.values;
            const score = candVector ? cosineSimilarity(queryVector, candVector) : 0;
            return {
              id: cand.id,
              text: cand.text,
              score,
            };
          });

          // Sort by similarity descending
          results.sort((a, b) => b.score - a.score);
          return res.json({ results });
        }
      } catch (embErr) {
        console.warn('Embedding API failed, falling back to Gemini generative semantic matching:', embErr);
      }

      // Generative semantic similarity ranking fallback
      const prompt = `You are a high-accuracy semantic text search engine for a novel manuscript.
Find and rank the candidates that are semantically equivalent or similar in meaning to the search query.

Search Query: "${query}"

Candidates:
${sampleCandidates.map((c, i) => `[${i}] ${c.text}`).join('\n')}

Return a JSON array of objects with the index, similarity score (0.0 to 1.0), and a brief explanation why it matches.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                score: { type: Type.NUMBER },
                explanation: { type: Type.STRING },
              },
              required: ['index', 'score'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '[]') as Array<{ index: number; score: number; explanation?: string }>;
      const results = parsed
        .filter((item) => item.index >= 0 && item.index < sampleCandidates.length)
        .map((item) => ({
          id: sampleCandidates[item.index].id,
          text: sampleCandidates[item.index].text,
          score: item.score,
          explanation: item.explanation,
        }))
        .sort((a, b) => b.score - a.score);

      return res.json({ results });
    } else {
      // Local heuristic fallback when API key is not present
      const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const results = sampleCandidates.map(cand => {
        const text = cand.text.toLowerCase();
        let matches = 0;
        for (const w of queryWords) {
          if (text.includes(w)) matches++;
        }
        return {
          id: cand.id,
          text: cand.text,
          score: queryWords.length > 0 ? matches / queryWords.length : 0,
        };
      }).sort((a, b) => b.score - a.score);

      return res.json({ results });
    }
  } catch (error: any) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: error.message || 'Semantic search processing failed' });
  }
});

// 2. Named Entity & Proper Noun Extraction with Consistency Analysis
app.post('/api/gemini/proper-nouns', async (req, res) => {
  try {
    const { text, existingNames = [] } = req.body as { text: string; existingNames?: string[] };
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Heuristic extraction
      const capitalizedWords = Array.from(text.matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g))
        .map(m => m[0])
        .filter(name => !['The', 'Then', 'There', 'When', 'What', 'Where', 'After', 'Before', 'And', 'But'].includes(name));
      const uniqueNames = Array.from(new Set(capitalizedWords));
      return res.json({
        entities: uniqueNames.map(name => ({
          name,
          category: 'character',
          occurrences: 1,
          aliases: [],
        })),
        consistencyIssues: [],
      });
    }

    const prompt = `Analyze this manuscript excerpt and extract proper nouns.
Focus on:
1. Character names (first names, surnames, full names, nicknames)
2. Locations / places
3. Organizations / factions
4. Key named entities

Also identify any potential spelling inconsistencies or variant spellings (e.g. "Aaron" vs "Arron", "Hover" vs "Willhover").
Existing known names in manuscript: ${JSON.stringify(existingNames.slice(0, 50))}

Manuscript excerpt:
"""
${text.slice(0, 15000)}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: 'character, location, organization, or entity',
                  },
                  aliases: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  occurrences: { type: Type.INTEGER },
                  notes: { type: Type.STRING },
                },
                required: ['name', 'category'],
              },
            },
            consistencyIssues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  primaryName: { type: Type.STRING },
                  variantFound: { type: Type.STRING },
                  contextSnippet: { type: Type.STRING },
                  recommendation: { type: Type.STRING },
                },
                required: ['primaryName', 'variantFound', 'recommendation'],
              },
            },
          },
          required: ['entities'],
        },
      },
    });

    const data = JSON.parse(response.text || '{"entities":[], "consistencyIssues":[]}');
    res.json(data);
  } catch (error: any) {
    console.error('Proper noun analysis error:', error);
    res.status(500).json({ error: error.message || 'Entity analysis failed' });
  }
});

// 3. OCR and Document Text Extraction for PDF / Scanned files
app.post('/api/gemini/ocr-extract', async (req, res) => {
  try {
    const { base64Data, mimeType, filename } = req.body as {
      base64Data: string;
      mimeType: string;
      filename?: string;
    };

    if (!base64Data) {
      return res.status(400).json({ error: 'Base64 data is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'GEMINI_API_KEY is not configured for OCR service' });
    }

    // Clean data if it contains data URI prefix
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'application/pdf',
              data: cleanBase64,
            },
          },
          {
            text: `Extract all text and structure from this document (${filename || 'document'}).
Preserve headings (Title, Chapter, H1, H2, H3), paragraphs, lists, and formatting.
Format your output as clean Markdown so headings, blockquotes, and paragraphs are clearly demarcated. Do not add commentary.`,
          },
        ],
      },
    });

    const extractedText = response.text || '';
    res.json({ text: extractedText });
  } catch (error: any) {
    console.error('OCR Extraction error:', error);
    res.status(500).json({ error: error.message || 'OCR extraction failed' });
  }
});

// Development vs Production Setup
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (production: ${isProduction})`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer();
}
