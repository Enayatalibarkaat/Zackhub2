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
        setError('Your comment contains inappropriate language and could not be posted. Please review and resubmit.');
        return;
    }

    // Additional check for username availability before submitting
    if (showNameInput && isUsernameTaken(name.trim())) {
        setError(`Username "${name.trim()}" is already taken. Please choose another.`);
        return;
    }

    setError(null);
    await onSubmit(commentText, name);
    setCommentText('');
    // Don't clear name, as it might be part of the main form
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showNameInput && (
        <div>
          <label htmlFor="name" className="sr-only">Your Name</label>
          <input
            id="name"
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Choose Your Permanent Name" maxLength={30}
            className="w-full p-3 bg-light-bg dark:bg-brand-bg rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors text-light-text dark:text-brand-text"
            disabled={isSubmitting}
          />
        </div>
      )}
      <div>
        <label htmlFor="comment" className="sr-only">Your Comment</label>
        <textarea
          id="comment" value={commentText} onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write your feedback here..." maxLength={500} rows={4}
          className="w-full p-3 bg-light-bg dark:bg-brand-bg rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors text-light-text dark:text-brand-text"
          disabled={isSubmitting}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="text-right">
        <button type="submit"
          className="bg-brand-primary hover:bg-opacity-80 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
    }

    return (
        <div className="flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
            {comment.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-grow">
            <div className="bg-light-bg dark:bg-brand-bg p-4 rounded-lg">
                <div className="flex justify-between items-center">
                    <p className={`font-bold text-light-text dark:text-brand-text ${comment.name === 'Admin' ? 'text-brand-primary [text-shadow:0_0_5px_theme(colors.brand-primary)]' : ''}`}>{comment.name}</p>
                    <p className="text-xs text-light-text-secondary dark:text-brand-text-secondary">
                    {formatRelativeTime(comment.timestamp)}
                    </p>
                </div>
                <p className="mt-2 text-light-text-secondary dark:text-brand-text-secondary break-words">{comment.text}</p>
                 <button onClick={() => setIsReplying(!isReplying)} className="text-xs font-bold text-brand-primary hover:underline mt-2 [text-shadow:0_0_5px_theme(colors.brand-primary/70)]">
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
                <div className="mt-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
                    {replies.map(reply => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            replies={[]} // Replies are passed flat, so we don't nest them further here
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
    try {
      const storedComments = localStorage.getItem(storageKey);
      if (storedComments) {
        setComments(JSON.parse(storedComments));
      }
    } catch (e) {
      console.error("Failed to load comments from localStorage", e);
    }
  }, [storageKey]);

  const sendTelegramNotification = async (commentData: { commenterName: string; commentText: string; movieTitle: string }) => {
    if (!NOTIFICATION_WEBHOOK_URL) {
      console.log("Webhook URL not configured. Skipping notification.");
      return;
    }
    try {
      await fetch(NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commentData),
      });
    } catch (error) {
      console.error("Failed to send Telegram notification:", error);
    }
  };

  const addComment = useCallback(async (text: string, parentId: string | null = null, name?: string) => {
    setIsSubmitting(true);
    
    let commenterName = username;

    // Handle first-time user registration
    if (!commenterName && name) {
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
        console.error("Cannot post comment without a name.");
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
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedComments));
    } catch (e) {
      console.error("Failed to save comments to localStorage", e);
    }
    
    await sendTelegramNotification({
        movieTitle: movieTitle,
        commenterName: newComment.name,
        commentText: newComment.text
    });

    setIsSubmitting(false);
  }, [username, comments, storageKey, movieTitle]);

  const commentTree = useMemo(() => {
    const commentsById: Map<string, Comment & { replies: Comment[] }> = new Map(
        comments.map(c => [c.id, { ...c, replies: [] }])
    );
    const rootComments: (Comment & { replies: Comment[] })[] = [];

    for (const comment of commentsById.values()) {
        if (comment.parentId && commentsById.has(comment.parentId)) {
            commentsById.get(comment.parentId)!.replies.push(comment);
        } else {
            rootComments.push(comment);
        }
    }
    // Sort root comments by timestamp
    rootComments.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // Sort replies by timestamp
    commentsById.forEach(c => c.replies.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));

    return rootComments;
  }, [comments]);
  
  const flattenedCommentTree = useMemo(() => {
      const flatList: {comment: Comment, replies: Comment[]}[] = [];
      const addReplies = (commentId: string) => {
          return comments.filter(c => c.parentId === commentId)
                .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      
      const roots = comments.filter(c => c.parentId === null)
        .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      roots.forEach(root => {
        flatList.push({comment: root, replies: addReplies(root.id)})
      });
      return flatList;
  }, [comments]);


  return (
    <div className="bg-light-card dark:bg-brand-card rounded-lg shadow-md p-6 mt-8">
      <h3 className="text-xl font-bold text-light-text dark:text-brand-text mb-4">Join the Discussion</h3>
      <CommentForm
        onSubmit={(text, name) => addComment(text, null, name)}
        isSubmitting={isSubmitting}
        showNameInput={!username}
        ctaText="Post Comment"
      />

      <div className="mt-8">
        {comments.length > 0 ? (
          <div className="space-y-6">
            {commentTree.map((rootComment) => (
              <CommentItem
                key={rootComment.id}
                comment={rootComment}
                replies={rootComment.replies}
                onReply={(commentId, text) => addComment(text, commentId)}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-light-text-secondary dark:text-brand-text-secondary py-4">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </div>
  );
};

export default CommentBox;
