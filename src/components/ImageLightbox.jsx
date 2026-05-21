import { X, Download } from 'lucide-react';
import { useEffect } from 'react';

export default function ImageLightbox({ url, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownload = async () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = url.split('/').pop() || 'image';
    a.target = '_blank';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
        <img
          src={url}
          alt="Preview"
          className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
        />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={handleDownload}
          className="absolute bottom-3 right-3 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}