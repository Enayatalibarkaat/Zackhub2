import React, { useState, useEffect, useCallback } from 'react';
import { Comment } from './types';
import { formatRelativeTime, containsProfanity } from './utils';

interface CommentBoxProps {
  movieId: string;
  movieTitle: string;
}

// --- Reusable Comment Form Component ---
const CommentForm: React.FC<{
  onSubmit: (text: string, name?: string) => Promise<void>;
  isSubmitting: boolean;
  showNameInput: boolean;
  ctaText: string;
}> = ({ onSubmit, isSubmitting, showNameInput, ctaText }) => {
  const [name, setName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // 🚫 Prevent parent form from triggering

    if (showNameInput && !name.trim()) {
      setError('Username required ❌');
      return;
    }
    if (!commentText.trim()) {
      setError('Comment cannot be empty ❌');
      return;
    }

    const usernameRegex = /^[a-z0-9_]{5,}$/;
    if (showNameInput && !usernameRegex.test(name.trim())) {
      setError('Use a-z, 0-9, underscore, min 5 chars ❌');
      return;
    }

    if (containsProfanity(commentText) || (showNameInput && containsProfanity(name))) {
      setError('Inappropriate words not allowed ❌');
      return;
    }

    setError(null);
    await onSubmit(commentText, name);
    setCommentText('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showNameInput && (
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter Username"
            maxLength={30}
            className="w-full p-3 bg-light-bg dark:bg-brand-bg rounded border border-gray-300 dark:border-gray-600"
            disabled={isSubmitting}
          />
        </div>
      )}
      <div>
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write your comment..."
          maxLength={500}
          rows={4}
          className="w-full p-3 bg-light-bg dark:bg-brand-bg rounded border border-gray-300 dark:border-gray-600"
          disabled={isSubmitting}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="text-right">
        <button
          type="submit"
          className="bg-brand-primary text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Posting...' : ctaText}
        </button>
      </div>
    </form>
  );
};

// --- Single Comment Item ---
const CommentItem: React.FC<{
  comment: Comment;
  onReply: (commentId: string, text: string) => Promise<void>;
  isSubmitting: boolean;
}> = ({ comment, onReply, isSubmitting }) => {
  const [isReplying, setIsReplying] = useState(false);

  const handleReplySubmit = async (text: string) => {
    await onReply(comment.id, text);
    setIsReplying(false);
  };

  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
        {comment.username?.charAt(0).toUpperCase()}
      </div>

      <div className="flex-grow">
        <div className="bg-light-bg dark:bg-brand-bg p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="font-bold">{comment.username}</p>
            <p className="text-xs">{formatRelativeTime(comment.createdAt)}</p>
          </div>
          {comment.parentId && (
            <p className="text-xs text-gray-400">↳ Reply to {comment.parentId}</p>
          )}
          <p className="mt-2 break-words">{comment.text}</p>

          <button
            onClick={() => setIsReplying(!isReplying)}
            className="text-xs font-bold text-brand-primary mt-2"
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
        </div>

        {isReplying && (
          <div className="mt-4">
            <CommentForm
              onSubmit={(text) => handleReplySubmit(text)}
              isSubmitting={isSubmitting}
              showNameInput={false}
              ctaText="Post Reply"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main CommentBox Component ---
const CommentBox: React.FC<CommentBoxProps> = ({ movieId, movieTitle }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load username from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('username');
    if (saved) setUsername(saved);
  }, []);

  // Fetch all comments for this movie
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/.netlify/functions/getComments?movieId=${movieId}`);
      const data = await res.json();
      if (data.success) setComments(data.comments);
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }, [movieId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Add or reply to comment
  const addComment = useCallback(
    async (text: string, name?: string, parentId: string | null = null) => {
      setIsSubmitting(true);
      let currentName = username;

      if (!currentName && name) {
        const regRes = await fetch('/.netlify/functions/registerUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: name.trim() }),
        });
        const regData = await regRes.json();
        if (!regData.success && !regData.message.includes('exists')) {
          alert(regData.message);
          setIsSubmitting(false);
          return;
        }
        currentName = name.trim();
        localStorage.setItem('username', currentName);
        setUsername(currentName);
      }

      if (!currentName) {
        setIsSubmitting(false);
        return;
      }

      const res = await fetch('/.netlify/functions/addComment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentName,
          movieId,
          text: text.trim(),
          parentId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchComments();
      } else {
        alert(data.message);
      }
      setIsSubmitting(false);
    },
    [username, movieId, fetchComments]
  );

  return (
    <div className="bg-light-card dark:bg-brand-card rounded-lg shadow-md p-6 mt-8">
      <h3 className="text-xl font-bold mb-4">Join the Discussion</h3>

      <CommentForm
        onSubmit={(text, name) => addComment(text, name)}
        isSubmitting={isSubmitting}
        showNameInput={!username}
        ctaText="Post Comment"
      />

      <div className="mt-8">
        {comments.length > 0 ? (
          <div className="space-y-6">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onReply={(id, text) => addComment(text, undefined, id)}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        ) : (
          <p className="text-center py-4">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  );
};

export default CommentBox;
