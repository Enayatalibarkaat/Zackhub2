import React, { useEffect, useState } from 'react';

const reactions = [
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'haha', emoji: '😂', label: 'Haha' },
  { id: 'wow', emoji: '🤯', label: 'Wow' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'angry', emoji: '😠', label: 'Angry' },
];

interface ReactionPanelProps {
  movieId: string; // movie._id that you fixed earlier
}

type Counts = { [key: string]: number };

const API_BASE = '/.netlify/functions'; // Netlify functions root

// helper: ensure a persistent user id in localStorage
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
  const [loading, setLoading] = useState(false);
  const userId = getOrCreateUserId();

  // Fetch counts + user reaction from server on mount / movieId change
  useEffect(() => {
    let mounted = true;
    async function fetchReactions() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/get-reactions?movieId=${encodeURIComponent(movieId)}&userId=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error('Failed fetch');
        const body = await res.json();
        if (!mounted) return;
        // server returns { counts: {...}, userReaction: 'love' | null }
        setCounts((prev) => ({ ...prev, ...body.counts }));
        setSelectedReaction(body.userReaction ?? null);
      } catch (e) {
        // leave local state as-is; we still want UI to show something
        console.error('Failed to load reactions', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchReactions();
    return () => { mounted = false; };
  }, [movieId, userId]);

  // Optimistic UI + background save to server
  const handleReactionClick = async (reactionId: string) => {
    const prevSelected = selectedReaction;
    const prevCounts = { ...counts };

    // Build optimistic counts update
    const newCounts = { ...counts };
    let newSelected: string | null = null;

    if (prevSelected === reactionId) {
      // deselect
      newCounts[reactionId] = Math.max(0, (newCounts[reactionId] || 1) - 1);
      newSelected = null;
    } else {
      if (prevSelected) {
        newCounts[prevSelected] = Math.max(0, (newCounts[prevSelected] || 1) - 1);
      }
      newCounts[reactionId] = (newCounts[reactionId] || 0) + 1;
      newSelected = reactionId;
    }

    // apply optimistic UI immediately
    setCounts(newCounts);
    setSelectedReaction(newSelected);

    // Background call to save change
    try {
      const payload = {
        movieId,
        userId,
        reaction: newSelected, // null for deselect
      };
      // Post with short timeout/fetch
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
      const res = await fetch(`${API_BASE}/post-reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error('Save failed');
      }
      // Optionally update counts using server response (authoritative)
      const data = await res.json();
      if (data?.counts) {
        setCounts((prev) => ({ ...prev, ...data.counts }));
      }
    } catch (err) {
      console.error('Failed to save reaction, will retry later', err);
      // rollback to prev - OR you may choose to keep optimistic and queue retry.
      // We'll keep optimistic and enqueue a retry in background.
      retrySaveInBackground({ movieId, userId, reaction: newSelected });
    }
  };

  // retry helper: store intent in localStorage queue and attempt periodically
  const retrySaveInBackground = (payload: { movieId: string; userId: string; reaction: string | null }) => {
    try {
      const qKey = 'zackhub_reaction_queue';
      const raw = localStorage.getItem(qKey);
      const q = raw ? JSON.parse(raw) : [];
      q.push({ ...payload, ts: Date.now() });
      localStorage.setItem(qKey, JSON.stringify(q));
      // Attempt immediate flush (fire and forget)
      flushQueue();
    } catch (e) {
      console.error('queue fail', e);
    }
  };

  // flush queued requests
  const flushQueue = async () => {
    const qKey = 'zackhub_reaction_queue';
    const raw = localStorage.getItem(qKey);
    if (!raw) return;
    let q = JSON.parse(raw) as any[];
    if (!q.length) return;
    const remaining: any[] = [];
    for (const item of q) {
      try {
        const res = await fetch(`${API_BASE}/post-reaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movieId: item.movieId, userId: item.userId, reaction: item.reaction }),
        });
        if (!res.ok) throw new Error('server error');
        const data = await res.json();
        if (data?.counts) {
          setCounts((prev) => ({ ...prev, ...data.counts }));
        }
      } catch (e) {
        remaining.push(item); // keep for next attempt
      }
    }
    localStorage.setItem(qKey, JSON.stringify(remaining));
  };

  // run flush periodically (simple)
  useEffect(() => {
    const iv = setInterval(() => flushQueue(), 10_000); // every 10s
    flushQueue(); // try immediately
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
      {reactions.map((reaction) => {
        const isSelected = selectedReaction === reaction.id;
        return (
          <div key={reaction.id} className="flex flex-col items-center gap-2">
            <button
              onClick={() => handleReactionClick(reaction.id)}
              className={`
                relative p-3 rounded-full transition-all duration-300 transform 
                hover:scale-125 hover:-translate-y-1 focus:outline-none focus:ring-4 focus:ring-opacity-50
                ${
                  isSelected 
                    ? 'bg-brand-primary/20 ring-2 ring-brand-primary scale-125 -translate-y-1'
                    : 'bg-light-sidebar dark:bg-brand-card shadow-sm hover:shadow-md focus:ring-brand-primary/50'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`React with ${reaction.label}`}
            >
              <span className="text-3xl sm:text-4xl" role="img" aria-label={reaction.label}>
                {reaction.emoji}
              </span>
            </button>
            <span className="font-bold text-light-text dark:text-brand-text">
              {counts[reaction.id] ?? 0}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ReactionPanel;
