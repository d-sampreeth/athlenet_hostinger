import { useState } from 'react';
import { Heart, MessageSquare, Send, Trash2 } from 'lucide-react';
import { API } from '../api';

function errorMessage(error, fallback) {
  return error.response?.data?.detail || fallback;
}

export default function PostActions({ post, currentUserId, onDeleted }) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [comments, setComments] = useState([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleLike = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await API.post(`/posts/${post.id}/like/`);
      setLiked(response.data.liked);
      setLikeCount(response.data.count);
    } catch (e) {
      setError(errorMessage(e, 'Unable to update your like.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    setError('');
    if (!opening || commentsLoaded) return;

    try {
      const response = await API.get(`/posts/${post.id}/comments/`);
      setComments(response.data);
      setCommentsCount(response.data.length);
      setCommentsLoaded(true);
    } catch (e) {
      setError(errorMessage(e, 'Unable to load comments.'));
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    setBusy(true);
    setError('');
    try {
      const response = await API.post(`/posts/${post.id}/comments/`, { text });
      setComments((current) => [...current, response.data]);
      setCommentsCount((count) => count + 1);
      setCommentsLoaded(true);
      setCommentText('');
      setCommentsOpen(true);
    } catch (e) {
      setError(errorMessage(e, 'Unable to post your comment.'));
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await API.delete(`/posts/${post.id}/`);
      onDeleted?.(post.id);
    } catch (e) {
      setError(errorMessage(e, 'Unable to delete this post.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-5 border-t border-slate-100 px-5 py-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          disabled={busy}
          aria-pressed={liked}
          className={`flex items-center gap-2 font-bold disabled:opacity-50 ${liked ? 'text-orange-600' : 'text-slate-500'}`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className="flex items-center gap-2 font-bold text-slate-500 hover:text-orange-600"
          aria-expanded={commentsOpen}
        >
          <MessageSquare size={18} />
          {commentsCount}
        </button>
        {currentUserId === post.author?.id && (
          <button
            type="button"
            onClick={deletePost}
            disabled={busy}
            className="ml-auto flex items-center gap-2 font-bold text-slate-500 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={17} />
            Delete
          </button>
        )}
      </div>

      {error && <p role="alert" className="px-5 pb-3 text-sm text-red-600">{error}</p>}

      {commentsOpen && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="text-sm">
                <span className="font-bold text-slate-800">{comment.user?.name || comment.user?.username || 'Member'}</span>
                <span className="ml-2 text-slate-600">{comment.text}</span>
              </div>
            ))}
            {commentsLoaded && comments.length === 0 && (
              <p className="text-sm text-slate-500">No comments yet. Start the conversation.</p>
            )}
          </div>
          <form onSubmit={submitComment} className="mt-4 flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              maxLength={10000}
              placeholder="Write a comment..."
              aria-label="Write a comment"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="submit"
              disabled={busy || !commentText.trim()}
              aria-label="Post comment"
              className="rounded-xl bg-orange-500 px-3 text-white hover:bg-orange-600 disabled:opacity-50"
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
