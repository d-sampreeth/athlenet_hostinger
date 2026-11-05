import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API, API_ORIGIN } from '../api';
import PostActions from './PostActions';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'interest', label: 'My sports' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'connections', label: 'Connections' },
];
const BADGES = { interest: 'Your sport', nearby: 'Near you', connection: 'Connection' };
const ROLE_LABELS = { coach: 'Coach', player: 'Athlete', user: 'Community member' };

function authorName(p) {
  const a = p.author;
  if (a && typeof a === 'object') {
    const full = a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim();
    return full || a.username || 'Member';
  }
  return p.author_name || p.author_username || p.username || 'Member';
}

export default function CommunityFeed({ currentUserId }) {
  const [source, setSource] = useState('all');
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async (src, pg) => {
    const request = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/feed/', { params: { source: src, page: pg, limit: 10 } });
      const data = res.data;
      if (request !== requestId.current) return;
      const results = Array.isArray(data.results) ? data.results : [];
      setPosts((prev) => {
        const merged = pg === 1 ? results : [...prev, ...results];
        return [...new Map(merged.map((post) => [post.id, post])).values()];
      });
      setHasNext(data.has_next);
      setFallback(data.fallback);
      setNotice(data.notice || '');
      setPage(pg);
    } catch (e) {
      if (request !== requestId.current) return;
      const status = e.response?.status;
      setError(e.response?.data?.detail || (status === 401
        ? 'Please log in again.'
        : `Could not load the feed${status ? ` (${status})` : ''}.`));
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPosts([]);
    setHasNext(false);
    load(source, 1);
    return () => { requestId.current += 1; };
  }, [source, load]);

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-xl font-bold text-slate-900">Community feed</h2>
        <p className="text-sm text-slate-500">Explore posts from across Athlenet, tailored to your sports, area and connections.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSource(t.key)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-semibold border ' +
              (source === t.key
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-orange-300')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {fallback && source === 'all' && (
        <p className="mb-3 rounded-xl bg-orange-50 px-4 py-2 text-sm text-orange-700">
          Add your sport and PIN code in your profile to personalise this feed. Showing the latest posts for now.
        </p>
      )}
      {notice && (
        <p className="mb-3 rounded-xl bg-orange-50 px-4 py-2 text-sm text-orange-700">{notice}</p>
      )}

      {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {posts.map((p) => {
          const name = authorName(p);
          const img = p.image ? new URL(p.image, API_ORIGIN).href : null;
          const author = p.author;
          return (
            <article key={p.id} className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 p-5 pb-3">
                {author?.username ? (
                  <Link to={`/profile/${author.username}`} aria-label={`View ${name}'s profile`}>
                    {author.photo
                      ? <img src={new URL(author.photo, API_ORIGIN).href} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">{name.charAt(0).toUpperCase()}</div>}
                  </Link>
                ) : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">{name.charAt(0).toUpperCase()}</div>}
                <div>
                  {author?.username
                    ? <Link to={`/profile/${author.username}`} className="font-bold text-slate-900 hover:text-orange-600">{name}</Link>
                    : <div className="font-bold text-slate-900">{name}</div>}
                  <div className="text-xs text-slate-400">
                    {ROLE_LABELS[author?.role] || 'Athlenet member'} · {p.post_type}
                    {p.sport ? ` · ${p.sport}` : ''} · {new Date(p.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <p className="whitespace-pre-line px-5 pb-3 text-slate-800">{p.content}</p>
              {img && <img src={img} alt="" className="w-full object-cover" />}

              {p.reasons && p.reasons.length > 0 && (
                <div className="flex flex-wrap gap-2 px-5 pb-3">
                  {p.reasons.map((r) => (
                    <span key={r} className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-600">
                      {BADGES[r] || r}
                    </span>
                  ))}
                </div>
              )}

              <PostActions
                post={p}
                currentUserId={currentUserId}
                onDeleted={(id) => setPosts((current) => current.filter((post) => post.id !== id))}
              />
            </article>
          );
        })}
      </div>

      {!loading && !error && posts.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {source === 'connections'
            ? 'No posts from your connections yet. Connect with Athlenet members to see their updates here.'
            : source === 'interest'
              ? 'No posts match your selected sports yet.'
              : source === 'nearby'
                ? 'No posts from your area yet.'
                : 'No community posts yet. Be the first to share an update.'}
        </p>
      )}

      {loading && <p className="py-4 text-center text-slate-400">Loading…</p>}

      {hasNext && !loading && (
        <div className="py-4 text-center">
          <button
            onClick={() => load(source, page + 1)}
            className="rounded-full border border-orange-500 px-6 py-2 font-semibold text-orange-600 hover:bg-orange-50"
          >
            Load more
          </button>
        </div>
      )}
    </section>
  );
}