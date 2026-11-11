import { useCallback, useEffect, useState } from 'react';
import { API } from '../api';
import PersistentImage from './PersistentImage';

function MyImageGallery({ userId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/me/media/');
      setImages(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to load your uploaded images.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return <section className="card mt-6 p-5 sm:p-6">
    <h2 className="text-lg font-black">Your uploaded images</h2>
    <p className="mt-1 text-sm text-slate-500">Images saved to your Athlenet media storage.</p>
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading images...</p>
      : error ? <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-red-700"><span role="alert">{error}</span><button type="button" onClick={load} className="btn-ghost">Try again</button></div>
        : images.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map(image => <a key={image.name} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200">
            <PersistentImage src={image.url} alt="Uploaded image" className="aspect-square w-full object-cover"/>
          </a>)}
        </div> : <p className="mt-4 text-sm text-slate-500">No uploaded images found.</p>}
  </section>;
}

export default MyImageGallery;
