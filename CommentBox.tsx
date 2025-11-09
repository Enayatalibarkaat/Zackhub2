import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Comment } from './types';
import { formatRelativeTime, getUsername, checkAndRegisterUsername, containsProfanity } from './utils';

interface CommentBoxProps {
  movieId: string;
  movieTitle: string;
}

// IMPORTANT: Replace this with your actual Webhook URL from a service like Make.com or Zapier.
const NOTIFICATION_WEBHOOK_URL = 'https://hook.eu2.make.com/2kd4wt2zdo5d2f336b9tg9s91ckvamh4';

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

    if (showNameInput && !name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    if (!commentText.trim()) {
      setError('Comment cannot be empty.');
      return;
    }
    if (showNameInput && name.trim().length > 30) {
      setError('Name cannot be longer than 30 characters.');
      return;
    }
    if (commentText.trim().length > 500) {
      setError('Comment cannot be longer than 500 characters.');
      return;
    }

    // Profanity check
    if (containsProfanity(commentText) || (showNameInput && containsProfanity(name))) {
      setError('Your comment contains inappropriate language. Please edit and try again.');
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
            placeholder="Choose Your Permanent Name"
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
          placeholder="Write your feedback here..."
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

// --- Recursive Comment Item Component ---
const CommentItem: React.FC<{
  comment: Comment;
  replies: Comment[];
  onReply: (commentId: string, text: string) => Promise<void>;
  isSubmitting: boolean;
}> = ({ comment, replies, onReply, isSubmitting }) => {
  const [isReplying, setIsReplying] = useState(false);

  const handleReplySubmit = async (text: string) => {
    await onReply(comment.id, text);
    setIsReplying(false);
  };

  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
        {comment.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-grow">
        <div className="bg-light-bg dark:bg-brand-bg p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="font-bold">{comment.name}</p>
            <p className="text-xs">{formatRelativeTime(comment.timestamp)}</p>
          </div>
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

        {replies.length > 0 && (
          <div className="mt-4 pl-6 border-l-2 border-gray-300 dark:border-gray-700 space-y-4">
            {replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={[]}
                onReply={onReply}
                isSubmitting={isSubmitting}
              />
            ))}
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

  const storageKey = `zackhub-comments-${movieId}`;

  useEffect(() => {
    setUsername(getUsername());
    const storedComments = localStorage.getItem(storageKey);
    if (storedComments) setComments(JSON.parse(storedComments));
  }, [storageKey]);

  // Auto delete 60-days-old comments
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;

    const now = Date.now();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;

    const parsed: Comment[] = JSON.parse(stored);
    const filtered = parsed.filter(c => now - new Date(c.timestamp).getTime() < sixtyDays);

    if (filtered.length !== parsed.length) {
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      setComments(filtered);
    }
  }, [storageKey]);

  const sendTelegramNotification = async (commentData: { commenterName: string; commentText: string; movieTitle: string }) => {
    try {
      await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });
    } catch (error) {
      console.error("Telegram webhook failed:", error);
    }
  };

  const addComment = useCallback(async (text: string, parentId: string | null = null, name?: string) => {
    setIsSubmitting(true);

    let commenterName = username;

    if (!commenterName && name) {
      const errorMsg = await checkAndRegisterUsername(name.trim());
      if (errorMsg) {
        alert(errorMsg);
        setIsSubmitting(false);
        return;
      }
      commenterName = name.trim();
      setUsername(commenterName);
    }

    if (!commenterName) {
      setIsSubmitting(false);
      return;
    }

    const newComment: Comment = {
      id: new Date().toISOString(),
      name: commenterName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      parentId: parentId,
    };

    const updatedComments = [...comments, newComment];
    setComments(updatedComments);
    localStorage.setItem(storageKey, JSON.stringify(updatedComments));

    await sendTelegramNotification({
      movieTitle,
      commenterName: newComment.name,
      commentText: newComment.text
    });

    setIsSubmitting(false);
  }, [username, comments, storageKey, movieTitle]);

  const commentTree = useMemo(() => {
    const map = new Map<string, Comment & { replies: Comment[] }>();
    comments.forEach(c => map.set(c.id, { ...c, replies: [] }));

    const roots: (Comment & { replies: Comment[] })[] = [];
    map.forEach(c => {
      if (c.parentId && map.has(c.parentId)) map.get(c.parentId)!.replies.push(c);
      else roots.push(c);
    });

    roots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return roots;
  }, [comments]);

  return (
    <div className="bg-light-card dark:bg-brand-card rounded-lg shadow-md p-6 mt-8">
      <h3 className="text-xl font-bold mb-4">Join the Discussion</h3>

      <CommentForm
        onSubmit={(text, name) => addComment(text, null, name)}
        isSubmitting={isSubmitting}
        showNameInput={!username}
        ctaText="Post Comment"
      />

      <div className="mt-8">
        {comments.length > 0 ? (
          <div className="space-y-6">
            {commentTree.map(c => (
              <CommentItem
                key={c.id}
                comment={c}
                replies={c.replies}
                onReply={(id, text) => addComment(text, id)}
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
