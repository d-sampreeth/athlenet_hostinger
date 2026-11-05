import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, MapPin, RefreshCw, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API, API_ORIGIN } from '../api';
import PostActions from './PostActions';

function PostCard({ post, currentUserId, onDeleted }) {
  const author = post.author;
  const image = post.image ? new URL(post.image, API_ORIGIN).href : null;

  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600">
          {(author?.name || author?.username || 'A').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <Link to={`/profile/${author?.username}`} className="font-black hover:text-orange-600">
            {author?.name || author?.username || 'Athlenet member'}
          </Link>
          <div className="text-xs capitalize text-slate-400">
            {author?.role || 'member'} · {post.post_type} · {new Date(post.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
      {image && <img src={image} alt="" className="max-h-80 w-full object-cover" />}
      <p className="whitespace-pre-line px-5 pb-4 text-sm leading-6 text-slate-700">{post.content}</p>
      <PostActions post={post} currentUserId={currentUserId} onDeleted={onDeleted} />
    </article>
  );
}

function OpportunityCard({ opportunity }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="pill">{opportunity.sport}</span>
        {opportunity.coach_verified && <span className="text-xs font-bold text-emerald-700">Verified coach</span>}
      </div>
      <h3 className="mt-3 text-lg font-black text-slate-900">{opportunity.title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{opportunity.description}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1"><MapPin size={14} />{opportunity.location}</span>
        <span className="flex items-center gap-1"><CalendarDays size={14} />{opportunity.event_date}</span>
      </div>
      <div className="mt-3 text-xs text-slate-500">
        Posted by <span className="font-bold text-slate-700">{opportunity.coach_name}</span>
      </div>
      <Link to="/opportunities" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700">
        View opportunities <Target size={16} />
      </Link>
    </article>
  );
}

export default function LocalHub({ user }) {
  const [posts, setPosts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/local-hub/');
      setPosts(response.data.posts);
      setOpportunities(response.data.opportunities);
    } catch (e) {
      const status = e.response?.status;
      setError(status === 401
        ? 'Please log in again to load local posts and opportunities.'
        : `Could not load local posts and opportunities${status ? ` (${status})` : ''}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const locationSet = Boolean(user?.pincode || user?.location);
  const currentUserId = user?.user?.id;

  return (
    <div className="page-wide">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Local Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Posts from local players and coaches, plus opportunities shared by coaches in your area.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading local updates…</p>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-black text-slate-900">Local posts <span className="text-sm font-semibold text-slate-400">({posts.length})</span></h2>
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUserId}
                  onDeleted={(id) => setPosts((current) => current.filter((item) => item.id !== id))}
                />
              ))}
              {!posts.length && (
                <p className="card p-6 text-sm text-slate-500">
                  {locationSet ? 'No posts from players or coaches in your area yet.' : 'Add your PIN code or location to your profile to see local posts.'}
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-xl font-black text-slate-900">Local opportunities <span className="text-sm font-semibold text-slate-400">({opportunities.length})</span></h2>
            <div className="space-y-4">
              {opportunities.map((opportunity) => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
              {!opportunities.length && (
                <p className="card p-6 text-sm text-slate-500">
                  {locationSet ? 'No active opportunities from coaches in your area yet.' : 'Add your PIN code or location to your profile to see local opportunities.'}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
