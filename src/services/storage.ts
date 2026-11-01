import { Manuscript, Milestone, ManuscriptFolder, DocumentBlock, ProperNounEntry } from '../types/manuscript';

const DB_NAME = 'verbum_manuscripts_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('manuscripts')) {
        db.createObjectStore('manuscripts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('milestones')) {
        const store = db.createObjectStore('milestones', { keyPath: 'id' });
        store.createIndex('manuscriptId', 'manuscriptId', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export function countWords(text: string): number {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function createBlock(
  type: DocumentBlock['type'],
  text: string,
  options: Partial<DocumentBlock> = {}
): DocumentBlock {
  return {
    id: 'blk_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
    type,
    text,
    wordCount: countWords(text),
    charCount: text.length,
    ...options,
  };
}

// Generate an ultra-fast synthetic block generator for testing large documents (100k, 500k, 1M, 3M words)
export function generateLargeManuscript(title: string, wordTarget: number): Manuscript {
  const page1Blocks: DocumentBlock[] = [];
  const page2Blocks: DocumentBlock[] = [];

  page1Blocks.push(createBlock('title', title));
  page1Blocks.push(createBlock('subheading', `Ultra-Scale Document Benchmark (${wordTarget.toLocaleString()} words)`));
  page1Blocks.push(
    createBlock(
      'body',
      'Aaron walked silently towards the abandoned fortress. The mist curled around the granite bastions of Castle Dunharrow, cold and unrelenting. He paused, gripping the worn hilt of his father’s blade, listening for the watchman’s horn in the distance.'
    )
  );

  page2Blocks.push(createBlock('title', `${title} — Working Notes & Drafts`));
  page2Blocks.push(
    createBlock(
      'body',
      'Editorial review: Aaron approached the deserted stronghold without making noise. Check character names: Willhover and Aaron Hover must have unified spellings. Ensure timeline alignment across chapters.'
    )
  );

  const paragraphTemplates = [
    'The shadows lengthened across the windswept moorlands of Aethelgard. Aaron Hover pulled his cloak tight, watching the distant smoke rise from Willhover’s camp.',
    'Lord Blackwood summoned his council to the great hall. High tapestries of the ancient kings fluttered in the autumn draft as rain lashed against the leaded glass windows.',
    'Beneath the catacombs of the Iron Citadel, the scholars recorded every whispered omen. The parchment was brittle with centuries of desert dust and forbidden alchemy.',
    'Elena looked out across the harbor where thirty warships lay at anchor. The signal lanterns swung in the salt breeze, casting amber ripples upon the black tide.',
    'In the heart of the Whispering Woods, neither bird nor beast made sound. Every step required deliberate caution, lest the brittle twigs betray their hurried retreat.',
    'The royal decree was sealed with vermilion wax. None dared question the Chancellor’s mandate, yet murmurs of quiet resistance spread through the lower districts before nightfall.',
    'Cold iron and dragon glass lay forged upon the master smith’s anvil. Weeks of tireless craftsmanship had brought the heirloom blade to shimmering perfection.',
    'Through mountain passes shrouded in permanent winter, the expedition pressed onward. Their supplies were dwindling, but the map pointed inexorably toward the sunken vault.',
  ];

  let currentWordsP1 = countWords(page1Blocks.map((b) => b.text).join(' '));
  let chapterIndex = 1;

  // Split target roughly 60% on Page 1, 40% on Page 2
  const p1Target = Math.floor(wordTarget * 0.6);
  const p2Target = wordTarget - p1Target;

  // Generate Page 1
  while (currentWordsP1 < p1Target) {
    if (page1Blocks.length % 25 === 0) {
      page1Blocks.push(createBlock('h1', `Chapter ${chapterIndex}: The Gates of Dunharrow`));
      chapterIndex++;
    } else if (page1Blocks.length % 8 === 0) {
      page1Blocks.push(createBlock('h2', `Section ${Math.floor(page1Blocks.length / 8)}: Echoes in the Deep`));
    } else if (page1Blocks.length % 12 === 0) {
      page1Blocks.push(
        createBlock(
          'blockquote',
          `"He who enters the forgotten fortress without courage shall find only stone and silence." — The Chronicle of Willhover`
        )
      );
    } else {
      const template = paragraphTemplates[page1Blocks.length % paragraphTemplates.length];
      const text = `${template} Paragraph ${page1Blocks.length}. Aaron adjusted his stride, noting every detail of the terrain while keeping vigil over the southern ridge.`;
      page1Blocks.push(createBlock('body', text));
    }
    currentWordsP1 += countWords(page1Blocks[page1Blocks.length - 1].text);
  }

  // Generate Page 2
  let currentWordsP2 = countWords(page2Blocks.map((b) => b.text).join(' '));
  let noteIndex = 1;
  while (currentWordsP2 < p2Target) {
    if (page2Blocks.length % 20 === 0) {
      page2Blocks.push(createBlock('h1', `Scene Notes & Outlines — Part ${noteIndex}`));
      noteIndex++;
    } else {
      const template = paragraphTemplates[(page2Blocks.length + 3) % paragraphTemplates.length];
      const text = `Draft revision [${page2Blocks.length}]: ${template} Aaron Hover reflected upon the pact made with Lord Blackwood before departing the fortress.`;
      page2Blocks.push(createBlock('body', text));
    }
    currentWordsP2 += countWords(page2Blocks[page2Blocks.length - 1].text);
  }

  const initialProperNouns: ProperNounEntry[] = [
    {
      id: 'pn_1',
      name: 'Aaron',
      category: 'character',
      aliases: ['Aaron Hover', 'The Wanderer'],
      notes: 'Main protagonist, swordsman of Dunharrow',
      occurrences: 48,
    },
    {
      id: 'pn_2',
      name: 'Hover',
      category: 'character',
      aliases: ['Aaron Hover', 'Willhover'],
      notes: 'Ancestral surname of the northern border lords',
      occurrences: 32,
    },
    {
      id: 'pn_3',
      name: 'Willhover',
      category: 'character',
      aliases: ['Commander Willhover'],
      notes: 'High Commander of the vanguard',
      occurrences: 18,
    },
    {
      id: 'pn_4',
      name: 'Lord Blackwood',
      category: 'character',
      aliases: ['The Chancellor'],
      notes: 'Chancellor of the Iron Citadel',
      occurrences: 24,
    },
    {
      id: 'pn_5',
      name: 'Castle Dunharrow',
      category: 'location',
      aliases: ['The Abandoned Fortress', 'Granite Bastion'],
      notes: 'Fortress guarding the southern pass',
      occurrences: 40,
    },
    {
      id: 'pn_6',
      name: 'Iron Citadel',
      category: 'location',
      aliases: ['High Bastion'],
      notes: 'Capital stronghold of the realm',
      occurrences: 15,
    },
    {
      id: 'pn_7',
      name: 'Whispering Woods',
      category: 'location',
      aliases: ['The Silent Pines'],
      notes: 'Dense forest spanning the northern boundary',
      occurrences: 12,
    },
    {
      id: 'pn_8',
      name: 'The Vanguard of Aethelgard',
      category: 'organization',
      aliases: ['The Borderguard'],
      notes: 'Elite defensive order',
      occurrences: 9,
    },
  ];

  return {
    id: 'ms_' + Math.random().toString(36).substring(2, 10),
    title,
    description: `Engineered manuscript tested at scale with ${wordTarget.toLocaleString()} words.`,
    page1: {
      id: 'p1',
      name: 'Page 1 — Primary Manuscript',
      blocks: page1Blocks,
      wordCount: currentWordsP1,
      charCount: page1Blocks.reduce((acc, b) => acc + b.charCount, 0),
    },
    page2: {
      id: 'p2',
      name: 'Page 2 — Companion / Working Draft',
      blocks: page2Blocks,
      wordCount: currentWordsP2,
      charCount: page2Blocks.reduce((acc, b) => acc + b.charCount, 0),
    },
    dividerPosition: 50,
    splitMode: 'dual',
    syncScroll: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
    orderIndex: 0,
    properNouns: initialProperNouns,
  };
}

export function createInitialManuscript(): Manuscript {
  const p1Blocks: DocumentBlock[] = [
    createBlock('title', 'The Chronicle of Aethelgard'),
    createBlock('subheading', 'Book I: Shadows of the Granite Pass'),
    createBlock('h1', 'Chapter 1: The Abandoned Fortress'),
    createBlock(
      'body',
      'Aaron walked silently towards the abandoned fortress. The mist curled around the granite bastions of Castle Dunharrow, cold and unrelenting. He paused, gripping the worn hilt of his father’s blade, listening for the watchman’s horn in the distance.'
    ),
    createBlock(
      'body',
      'The wind swept down from the jagged peaks, carrying the scent of damp heather and ancient ash. For seven years, no soldier had walked these battlements. Yet fresh boot prints marked the threshold of the postern gate.'
    ),
    createBlock(
      'blockquote',
      '“He who steps beyond the iron archway must leave fear to the carrion crows.” — Inscription on the West Portal'
    ),
    createBlock('h2', 'Section I: The Scent of Pine and Smoke'),
    createBlock(
      'body',
      'Aaron Hover eased into the shadow of the portcullis. His eyes adjusted to the cavernous gloom. Dust motes drifted in amber slants of late afternoon sun, filtering through arrow slits carved into solid bedrock.'
    ),
    createBlock(
      'body',
      'Ahead lay the grand staircase leading to the council chamber of Lord Blackwood. A muffled thud echoed from above—the distinct sound of an iron-shod chest being dragged across flagstones.'
    ),
    createBlock('h1', 'Chapter 2: The Whispering Woods'),
    createBlock(
      'body',
      'Beyond the fortress walls, the Whispering Woods stretched to the horizon. Willhover had warned him of the scouts patrolling the lower valleys. If the northern legions had crossed the river, the sanctuary of Dunharrow was already compromised.'
    ),
    createBlock(
      'body',
      'Aaron unslung his leather map case and knelt by the dry fountain. The parchment had yellowed at the edges, but the red ink marking the hidden vault beneath the Iron Citadel remained as vivid as the day it was drawn.'
    ),
  ];

  const p2Blocks: DocumentBlock[] = [
    createBlock('title', 'Companion Notes & Alternate Scenes'),
    createBlock('subheading', 'Drafting Workspace / Research Index'),
    createBlock('h1', 'Scene Comparison: Chapter 1 Alternate Opening'),
    createBlock(
      'body',
      'Aaron approached the deserted stronghold without making noise. The damp evening air chilled his breath as he crossed the drawbridge. Every stone seemed pregnant with the memory of the siege.'
    ),
    createBlock('h2', 'Character Consistency Tracker'),
    createBlock(
      'bullet',
      'Aaron Hover: Protagonist. Keep spelling consistent. Watch for stray typos such as "Arron" or "Willhover".'
    ),
    createBlock(
      'bullet',
      'Willhover: High Commander. Surnames share roots in historical lore; ensure familial bond is clarified in Chapter 3.'
    ),
    createBlock(
      'bullet',
      'Lord Blackwood: Antagonist or reluctant ally? Motives should remain ambiguous until the council chamber encounter.'
    ),
    createBlock('h1', 'Research & World Lore'),
    createBlock(
      'body',
      'Castle Dunharrow was constructed during the Second Dynasty using dark granite quarried from Mount Valerius. Its subterranean vaults were designed to withstand a ten-year blockade.'
    ),
  ];

  const p1WordCount = p1Blocks.reduce((sum, b) => sum + b.wordCount, 0);
  const p1CharCount = p1Blocks.reduce((sum, b) => sum + b.charCount, 0);
  const p2WordCount = p2Blocks.reduce((sum, b) => sum + b.wordCount, 0);
  const p2CharCount = p2Blocks.reduce((sum, b) => sum + b.charCount, 0);

  const initialProperNouns: ProperNounEntry[] = [
    {
      id: 'pn_1',
      name: 'Aaron',
      category: 'character',
      aliases: ['Aaron Hover'],
      notes: 'Protagonist, master swordsman',
      occurrences: 8,
    },
    {
      id: 'pn_2',
      name: 'Hover',
      category: 'character',
      aliases: ['Aaron Hover', 'Willhover'],
      notes: 'Ancestral line',
      occurrences: 4,
    },
    {
      id: 'pn_3',
      name: 'Aaron Hover',
      category: 'character',
      aliases: ['Aaron'],
      notes: 'Full protagonist name',
      occurrences: 2,
    },
    {
      id: 'pn_4',
      name: 'Willhover',
      category: 'character',
      aliases: ['Commander Willhover'],
      notes: 'Allied vanguard commander',
      occurrences: 3,
    },
    {
      id: 'pn_5',
      name: 'Castle Dunharrow',
      category: 'location',
      aliases: ['Dunharrow', 'The Abandoned Fortress'],
      notes: 'Strategic fortress at granite pass',
      occurrences: 5,
    },
    {
      id: 'pn_6',
      name: 'Lord Blackwood',
      category: 'character',
      aliases: ['Blackwood'],
      notes: 'Council leader',
      occurrences: 3,
    },
    {
      id: 'pn_7',
      name: 'Iron Citadel',
      category: 'location',
      aliases: ['The Citadel'],
      notes: 'Subterranean stronghold',
      occurrences: 2,
    },
    {
      id: 'pn_8',
      name: 'Whispering Woods',
      category: 'location',
      aliases: ['The Great Woods'],
      notes: 'Dense northern forest',
      occurrences: 2,
    },
  ];

  return {
    id: 'ms_master_chronicle',
    title: 'The Chronicle of Aethelgard',
    description: 'Heroic fantasy epic manuscript with companion research notes and dual-pane workspace.',
    page1: {
      id: 'p1',
      name: 'Page 1 — Main Manuscript',
      blocks: p1Blocks,
      wordCount: p1WordCount,
      charCount: p1CharCount,
    },
    page2: {
      id: 'p2',
      name: 'Page 2 — Companion & Notes',
      blocks: p2Blocks,
      wordCount: p2WordCount,
      charCount: p2CharCount,
    },
    dividerPosition: 50,
    splitMode: 'dual',
    syncScroll: false,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now(),
    archived: false,
    orderIndex: 0,
    properNouns: initialProperNouns,
  };
}

export async function getManuscripts(): Promise<Manuscript[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manuscripts', 'readonly');
    const store = tx.objectStore('manuscripts');
    const request = store.getAll();

    request.onsuccess = () => {
      const results: Manuscript[] = request.result || [];
      if (results.length === 0) {
        // Seed default manuscript
        const initial = createInitialManuscript();
        saveManuscript(initial).then(() => resolve([initial]));
      } else {
        // Sort by orderIndex or updatedAt descending
        results.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getManuscript(id: string): Promise<Manuscript | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manuscripts', 'readonly');
    const store = tx.objectStore('manuscripts');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveManuscript(manuscript: Manuscript): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manuscripts', 'readwrite');
    const store = tx.objectStore('manuscripts');
    const request = store.put({
      ...manuscript,
      updatedAt: Date.now(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteManuscript(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('manuscripts', 'readwrite');
    const store = tx.objectStore('manuscripts');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function duplicateManuscript(id: string): Promise<Manuscript> {
  const source = await getManuscript(id);
  if (!source) throw new Error('Manuscript not found');

  const duplicate: Manuscript = {
    ...JSON.parse(JSON.stringify(source)),
    id: 'ms_' + Math.random().toString(36).substring(2, 10),
    title: `${source.title} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    orderIndex: (source.orderIndex || 0) + 1,
  };

  await saveManuscript(duplicate);
  return duplicate;
}

export async function getFolders(): Promise<ManuscriptFolder[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readonly');
    const store = tx.objectStore('folders');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFolder(folder: ManuscriptFolder): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');
    const request = store.put(folder);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    const store = tx.objectStore('folders');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMilestones(manuscriptId: string): Promise<Milestone[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('milestones', 'readonly');
    const store = tx.objectStore('milestones');
    const index = store.index('manuscriptId');
    const request = index.getAll(manuscriptId);

    request.onsuccess = () => {
      const results: Milestone[] = request.result || [];
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveMilestone(milestone: Milestone): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('milestones', 'readwrite');
    const store = tx.objectStore('milestones');
    const request = store.put(milestone);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMilestone(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('milestones', 'readwrite');
    const store = tx.objectStore('milestones');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Restoring an older milestone NEVER overwrites a newer manuscript.
 * It restores the milestone as a new working version.
 */
export async function restoreMilestoneAsNew(
  milestone: Milestone,
  sourceManuscript: Manuscript
): Promise<Manuscript> {
  const restoredManuscript: Manuscript = {
    ...JSON.parse(JSON.stringify(sourceManuscript)),
    id: 'ms_' + Math.random().toString(36).substring(2, 10),
    title: `${sourceManuscript.title} (Restored from Milestone: ${milestone.name})`,
    description: `Restored snapshot from ${new Date(milestone.createdAt).toLocaleString()}. Original manuscript preserved unchanged.`,
    page1: {
      id: 'p1',
      name: sourceManuscript.page1.name,
      blocks: JSON.parse(JSON.stringify(milestone.page1Blocks)),
      wordCount: milestone.page1Blocks.reduce((sum, b) => sum + b.wordCount, 0),
      charCount: milestone.page1Blocks.reduce((sum, b) => sum + b.charCount, 0),
    },
    page2: {
      id: 'p2',
      name: sourceManuscript.page2.name,
      blocks: JSON.parse(JSON.stringify(milestone.page2Blocks)),
      wordCount: milestone.page2Blocks.reduce((sum, b) => sum + b.wordCount, 0),
      charCount: milestone.page2Blocks.reduce((sum, b) => sum + b.charCount, 0),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    orderIndex: (sourceManuscript.orderIndex || 0) + 1,
  };

  await saveManuscript(restoredManuscript);
  return restoredManuscript;
}
