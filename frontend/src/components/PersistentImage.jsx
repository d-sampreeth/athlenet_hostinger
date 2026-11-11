import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../api';

function PersistentImage({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div role="img" aria-label={alt || 'Image unavailable'} className={`${className} flex items-center justify-center bg-slate-100 text-xs font-semibold text-slate-400`}>Image unavailable</div>;
  return <img src={new URL(src, API_ORIGIN).href} alt={alt} className={className} onError={() => setFailed(true)} />;
}

export default PersistentImage;
