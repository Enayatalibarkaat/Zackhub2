import React, { useEffect, useState } from 'react';

const reactions = [
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'haha', emoji: '😂', label: 'Haha' },
  { id: 'wow', emoji: '🤯', label: 'Wow' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
];

interface ReactionPanelProps {
  movieId: string;
}

type Counts = { [key: string]: number };

const API_BASE = '/.netlify/functions';

const getOrCreateUserId = () => {
  let uid = localStorage.getItem('zackhub_user_id');
  if (!uid) {
    uid = 'u_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('zackhub_user_id', uid);
  }
  return uid;
};

const ReactionPanel: React.FC<ReactionPanelProps> = ({ movieId }) => {
  const [counts, setCounts] = useState<Counts>(() =>
    reactions.reduce((acc, r) => ({ ...acc, [r.id]: 0 }), {})
  );
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const userId = getOrCreateUserId();

  // Load from MongoDB
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `${API_BASE}/get-reactions?movieId=${movieId}&userId=${userId}`
        );
        const data = await res.json();
        setCounts({ ...counts, ...data.counts });
        setSelectedReaction(data.userReaction || null);
      } catch (e) {
        console.error("Failed", e);
      }
    }
    load();
  }, [movieId]);

  const handleClick = async (reactionId: string) => {
    // Optimistic update
    const prev = selectedReaction;
    const newCounts = { ...counts };

    if (prev === reactionId) {
      newCounts[reactionId] = Math.max(0, newCounts[reactionId] - 1);
      setSelectedReaction(null);
    } else {
      if (prev) newCounts[prev] = Math.max(0, newCounts[prev] - 1);
      newCounts[reactionId] = (newCounts[reactionId] || 0) + 1;
      setSelectedReaction(reactionId);
    }

    setCounts(newCounts);

    // Save to MongoDB (background)
    try {
      const res = await fetch(`${API_BASE}/post-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movieId,
          userId,
          reaction: prev === reactionId ? null : reactionId
        }),
      });
      const body = await res.json();
      setCounts(body.counts);
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
      {reactions.map((reaction) => {
        const isSelected = selectedReaction === reaction.id;

        return (
          <div key={reaction.id} className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleClick(reaction.id)}
              className={`
                relative p-3 rounded-full transition-all duration-300 transform
                hover:scale-125 hover:-translate-y-1
                ${
                  isSelected
                    ? 'bg-brand-primary/20 ring-2 ring-brand-primary scale-125 -translate-y-1'
                    : 'bg-light-sidebar dark:bg-brand-card shadow-sm hover:shadow-md'
                }
              `}
            >
              <span className="text-3xl sm:text-4xl">{reaction.emoji}</span>
            </button>

            <span className="font-bold">
              {counts[reaction.id] || 0}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ReactionPanel;
