import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    e.stopPropagation();

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
    <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
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

// --- Single Comment Item (recursive) ---
const CommentItem: React.FC<{
  comment: Comment & { id?: string; replies?: Comment[]; likes?: number; dislikes?: number; isAdminReply?: boolean };
  onReply: (commentId: string, text: string) => Promise<void>;
  onVote: (commentId: string, voteType: 'like' | 'dislike') => Promise<void>;
  isSubmitting: boolean;
  voteLoadingId: string | null;
}> = ({ comment, onReply, onVote, isSubmitting, voteLoadingId }) => {
  const [isReplying, setIsReplying] = useState(false);

  const handleReplySubmit = async (text: string) => {
    const id = comment.id || (comment as any)._id;
    await onReply(id, text);
    setIsReplying(false);
  };

  const commentId = String(comment.id || (comment as any)._id);
  const isVoting = voteLoadingId === commentId;

  return (
    <div className="flex gap-4" onClick={(e) => e.stopPropagation()}>
      <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
        {(comment.username && comment.username.charAt(0).toUpperCase()) || 'U'}
      </div>

      <div className="flex-grow">
        <div className="bg-light-bg dark:bg-brand-bg p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="font-bold">
              {comment.username}
              {(comment as any).isAdminReply ? <span className="ml-2 text-xs text-brand-primary">(Admin)</span> : null}
            </p>
            <p className="text-xs">{formatRelativeTime(comment.createdAt || comment.timestamp)}</p>
          </div>

          {comment.parentId && (
            <p className="text-xs text-gray-400">↳ Reply</p>
          )}

          <p className="mt-2 break-words">{comment.text}</p>

          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={(e) => { e.stopPropagation(); setIsReplying(!isReplying); }}
              className="text-xs font-bold text-brand-primary"
            >
              {isReplying ? 'Cancel' : 'Reply'}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote(commentId, 'like');
              }}
              disabled={isVoting}
              className="text-xs font-semibold text-green-600 disabled:opacity-60"
            >
              👍 {Number((comment as any).likes || 0)}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onVote(commentId, 'dislike');
              }}
              disabled={isVoting}
              className="text-xs font-semibold text-red-500 disabled:opacity-60"
            >
              👎 {Number((comment as any).dislikes || 0)}
            </button>
          </div>
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

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 pl-6 border-l-2 border-gray-300 dark:border-gray-700 space-y-4">
            {comment.replies.map((r) => (
              <CommentItem
                key={r.id || (r as any)._id}
                comment={r as Comment & { id?: string; replies?: Comment[] }}
                onReply={onReply}
                onVote={onVote}
                isSubmitting={isSubmitting}
                voteLoadingId={voteLoadingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CommentBox: React.FC<CommentBoxProps> = ({ movieId, movieTitle }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [reactorId, setReactorId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voteLoadingId, setVoteLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('username');
    if (saved) setUsername(saved);

    let savedReactorId = localStorage.getItem('comment_reactor_id');
    if (!savedReactorId) {
      savedReactorId = `r_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      localStorage.setItem('comment_reactor_id', savedReactorId);
    }
    setReactorId(savedReactorId);
  }, []);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/.netlify/functions/getComments?movieId=${movieId}`);
      const data = await res.json();
      if (data && data.success) {
        setComments(Array.isArray(data.comments) ? data.comments : []);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Error loading comments:', err);
      setComments([]);
    }
  }, [movieId]);

  useEffect(() => {
    fetchComments();
    const t = setTimeout(fetchComments, 1000);
    return () => clearTimeout(t);
  }, [fetchComments]);

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
        if (!regData.success && !regData.message?.includes('exists')) {
          alert(regData.message || 'Registration failed');
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

      try {
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
        if (data && data.success) {
          await fetchComments();
        } else {
          alert(data?.message || 'Failed to post comment');
        }
      } catch (err) {
        console.error('addComment error:', err);
        alert('Network error while posting comment');
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, movieId, fetchComments]
  );

  const handleVote = useCallback(async (commentId: string, voteType: 'like' | 'dislike') => {
    if (!reactorId) return;
    setVoteLoadingId(commentId);
    try {
      const res = await fetch('/.netlify/functions/voteComment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, voteType, reactorId }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || 'Vote failed ❌');
      }
      await fetchComments();
    } catch (err) {
      console.error('vote comment error', err);
      alert('Network error while voting ❌');
    } finally {
      setVoteLoadingId(null);
    }
  }, [reactorId, fetchComments]);

  const commentTree = useMemo(() => {
    const map = new Map<string, Comment & { id: string; replies: Comment[] }>();
    comments.forEach((c) => {
      const id = (c as any).id ? String((c as any).id) : ((c as any)._id ? String((c as any)._id) : String(Math.random()));
      const normalized: any = {
        ...c,
        id,
        replies: [],
        parentId: c.parentId ? String(c.parentId) : null,
        createdAt: (c as any).createdAt || (c as any).timestamp || new Date().toISOString(),
        likes: Number((c as any).likes || 0),
        dislikes: Number((c as any).dislikes || 0),
      };
      map.set(id, normalized);
    });

    const roots: (Comment & { replies: Comment[] })[] = [];
    map.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.replies.push(c);
      } else {
        roots.push(c);
      }
    });

    roots.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
    const sortReplies = (list: any[]) => {
      list.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
      list.forEach(child => {
        if (child.replies && child.replies.length) sortReplies(child.replies);
      });
    };
    sortReplies(roots as any);

    return roots;
  }, [comments]);

  return (
    <div className="bg-light-card dark:bg-brand-card rounded-lg shadow-md p-6 mt-8" onClick={(e) => e.stopPropagation()}>
      <h3 className="text-xl font-bold mb-4">Join the Discussion</h3>

      <CommentForm
        onSubmit={(text, name) => addComment(text, name)}
        isSubmitting={isSubmitting}
        showNameInput={!username}
        ctaText="Post Comment"
      />

      <div className="mt-8">
        {commentTree.length > 0 ? (
          <div className="space-y-6">
            {commentTree.map((c) => (
              <CommentItem
                key={c.id}
                comment={c as Comment & { id?: string; replies?: Comment[] }}
                onReply={(id, text) => addComment(text, undefined, id)}
                onVote={handleVote}
                isSubmitting={isSubmitting}
                voteLoadingId={voteLoadingId}
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
