import "../styles/reactions.css";
import React, { useEffect, useState } from "react";

const reactionsList = [
  { id: "love", emoji: "❤️" },
  { id: "haha", emoji: "😂" },
  { id: "wow", emoji: "🤯" },
  { id: "sad", emoji: "😢" },
  { id: "angry", emoji: "😠" },
];

export default function ReactionPanel({ movieId }) {
  const [counts, setCounts] = useState({});
  const [selected, setSelected] = useState<string | null>(null);

  // 🔥 Step 1: Fetch counts from backend
  const fetchCounts = async () => {
    try {
      const res = await fetch(
        `/api/getReactions?movieId=${encodeURIComponent(movieId)}`
      );
      const data = await res.json();
      setCounts(data);
    } catch (e) {
      console.log("Error fetching reactions", e);
    }
  };

  useEffect(() => {
    fetchCounts();

    // user ka last reaction yaad rakho
    const saved = localStorage.getItem(`reaction-${movieId}`);
    if (saved) setSelected(saved);
  }, [movieId]);

  // 🔥 Step 2: Reaction click handler
  const handleReaction = async (reactionId: string) => {
    const previous = selected;

    // 🔥🔥 UI ko turant update karo (optimistic update)
    let updated = { ...counts };

    if (previous === reactionId) {
      // same reaction again click → remove reaction
      updated[reactionId] = Math.max(0, updated[reactionId] - 1);
      setSelected(null);
      localStorage.removeItem(`reaction-${movieId}`);
    } else {
      // new reaction click
      updated[reactionId] = (updated[reactionId] || 0) + 1;

      if (previous) {
        updated[previous] = Math.max(0, (updated[previous] || 1) - 1);
      }

      setSelected(reactionId);
      localStorage.setItem(`reaction-${movieId}`, reactionId);
    }

    // UI instantly update
    setCounts(updated);

    // 🔥🔥 Backend ko background me update bhejo
    try {
      await fetch("/api/addReaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId,
          reaction: reactionId,
          previousReaction: previous,
        }),
      });

      // Optional: fresh data fetch
      fetchCounts();
    } catch (e) {
      console.log("Error saving reaction");
    }
  };

  return (
    <div className="flex gap-5 justify-center mt-4">
      {reactionsList.map((r) => (
        <div key={r.id} className="text-center">
          <button
            onClick={() => handleReaction(r.id)}
            className={`text-3xl transition-all duration-200 ${
              selected === r.id ? "scale-125" : "scale-100"
            }`}
          >
            {r.emoji}
          </button>
          <div className="mt-1 font-bold">{counts[r.id] || 0}</div>
        </div>
      ))}
    </div>
  );
}
