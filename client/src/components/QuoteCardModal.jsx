import { useEffect, useState } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { generateQuoteCardDataUrl } from '../utils/quoteCard.js';
import { useToast } from '../context/ToastContext.jsx';

export default function QuoteCardModal({ item, onClose }) {
  const { showToast } = useToast();
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!item) return;
    const url = generateQuoteCardDataUrl(item);
    setDataUrl(url);
  }, [item]);

  if (!item) return null;

  const handleCopyText = async () => {
    const text = `«${item.quote}»\n— ${item.footer}\nعبر منصة مِشكاة`;
    await navigator.clipboard.writeText(text);
    showToast('تم نسخ النص منسقاً للمشاركة');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-5 border border-[var(--border-gold)] relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 p-2 rounded-xl hover:bg-white/10 text-[var(--text-muted)] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-extrabold text-[var(--gold)] mb-3">بطاقة اقتباس جاهزة للمشاركة</h3>

        {dataUrl && (
          <img
            src={dataUrl}
            alt="بطاقة اقتباس مشكاة"
            className="w-full rounded-2xl border border-[var(--border-gold)] shadow-xl mb-4"
          />
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            type="button"
            onClick={handleCopyText}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] hover:border-[var(--border-gold)] flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            <span>نسخ النص المنسق</span>
          </button>
          <a
            href={dataUrl}
            download="mishkah-quote.png"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 flex items-center gap-1.5 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل البطاقة كصورة PNG</span>
          </a>
        </div>
      </div>
    </div>
  );
}
