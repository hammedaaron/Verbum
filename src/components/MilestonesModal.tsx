import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Plus,
  RotateCcw,
  Trash2,
  X,
  GitCompare,
} from 'lucide-react';
import { Manuscript, Milestone } from '../types/manuscript';
import { getMilestones, saveMilestone, deleteMilestone, restoreMilestoneAsNew } from '../services/storage';

interface MilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  manuscript: Manuscript;
  onOpenRestoredManuscript: (newManuscript: Manuscript) => void;
}

export const MilestonesModal: React.FC<MilestonesModalProps> = ({
  isOpen,
  onClose,
  manuscript,
  onOpenRestoredManuscript,
}) => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activeMilestoneId, setActiveMilestoneId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');

  const fetchMilestones = async () => {
    try {
      const list = await getMilestones(manuscript.id);
      setMilestones(list);
      if (list.length > 0 && !activeMilestoneId) {
        setActiveMilestoneId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load milestones:', err);
    }
  };

  useEffect(() => {
    if (isOpen) fetchMilestones();
  }, [isOpen, manuscript.id]);

  if (!isOpen) return null;

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const totalWords = manuscript.page1.wordCount + manuscript.page2.wordCount;
    const totalChars = manuscript.page1.charCount + manuscript.page2.charCount;

    const newMilestone: Milestone = {
      id: 'ms_stone_' + Math.random().toString(36).substring(2, 9),
      manuscriptId: manuscript.id,
      name: name.trim(),
      createdAt: Date.now(),
      page1Blocks: JSON.parse(JSON.stringify(manuscript.page1.blocks)),
      page2Blocks: JSON.parse(JSON.stringify(manuscript.page2.blocks)),
      wordCount: totalWords,
      charCount: totalChars,
    };

    await saveMilestone(newMilestone);
    await fetchMilestones();
    setActiveMilestoneId(newMilestone.id);
    setName('');
    setIsCreating(false);
  };

  const handleRestoreMilestone = async (milestone: Milestone) => {
    const restored = await restoreMilestoneAsNew(milestone, manuscript);
    onOpenRestoredManuscript(restored);
    onClose();
  };

  const handleDeleteMilestone = async (id: string) => {
    await deleteMilestone(id);
    await fetchMilestones();
    if (activeMilestoneId === id) setActiveMilestoneId(null);
  };

  const selectedMilestone = milestones.find((m) => m.id === activeMilestoneId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-100 font-sans">
      <div className="bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[80vh] overflow-hidden text-neutral-800 dark:text-neutral-200 text-xs">
        {/* Header */}
        <div className="h-11 px-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/50 dark:bg-white/[0.02]">
          <span className="font-semibold text-neutral-900 dark:text-white">
            Milestones
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs transition shadow-2xs"
            >
              <Plus size={12} />
              <span>Save Version</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {isCreating && (
          <form
            onSubmit={handleSaveMilestone}
            className="p-3 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.01] flex items-center gap-2"
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Milestone name…"
              className="flex-1 px-2.5 py-1 bg-white dark:bg-white/10 border border-neutral-200 dark:border-white/10 rounded-md outline-none text-xs"
              autoFocus
              required
            />
            <button
              type="submit"
              className="px-3 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-md font-medium text-xs shadow-2xs"
            >
              Save
            </button>
          </form>
        )}

        {/* Master-Detail */}
        <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-neutral-200 dark:divide-white/10">
          {/* Snapshots List */}
          <div className="w-56 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {milestones.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-xs">
                No saved milestones.
              </div>
            ) : (
              milestones.map((m) => {
                const isSelected = activeMilestoneId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveMilestoneId(m.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition text-xs ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-white/10'
                        : 'hover:bg-neutral-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="font-medium text-neutral-900 dark:text-white truncate">
                      {m.name}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono mt-1">
                      <span>{m.wordCount.toLocaleString()}w</span>
                      <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Snapshot Content Preview */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {selectedMilestone ? (
              <>
                <div className="h-10 px-4 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/30 dark:bg-white/[0.01]">
                  <span className="font-mono text-[11px] text-neutral-400">
                    {new Date(selectedMilestone.createdAt).toLocaleString()} · {selectedMilestone.wordCount.toLocaleString()} words
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRestoreMilestone(selectedMilestone)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs transition shadow-2xs"
                    >
                      <RotateCcw size={11} />
                      <span>Restore Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMilestone(selectedMilestone.id)}
                      className="p-1 text-neutral-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 font-serif text-xs leading-relaxed custom-scrollbar">
                  {selectedMilestone.page1Blocks.map((b) => (
                    <p key={b.id} className="text-neutral-700 dark:text-neutral-300">
                      {b.text}
                    </p>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-neutral-400 text-xs">
                Select a milestone.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
