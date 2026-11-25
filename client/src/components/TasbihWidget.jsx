import { useEffect, useState } from 'react';
import { RotateCcw, ChevronDown, Sparkles } from 'lucide-react';

const PHRASES = [
  'سبحان الله وبحمده',
  'سبحان الله العظيم',
  'الحمد لله رب العالمين',
  'لا إله إلا الله',
  'أستغفر الله وأتوب إليه',
];

export default function TasbihWidget() {
  const [open, setOpen] = useState(false);
  const [phraseIdx, setPhraseIdx] = useState(() => Number(localStorage.getItem('mishkah_tasbih_phrase') || 0));
  const [count, setCount] = useState(() => Number(localStorage.getItem('mishkah_tasbih_count') || 0));
  const [total, setTotal] = useState(() => Number(localStorage.getItem('mishkah_tasbih_total') || 0));
  const target = 33;

  useEffect(() => {
    localStorage.setItem('mishkah_tasbih_phrase', String(phraseIdx));
    localStorage.setItem('mishkah_tasbih_count', String(count));
    localStorage.setItem('mishkah_tasbih_total', String(total));
  }, [phraseIdx, count, total]);

  const progress = Math.min(100, ((count % target || (count > 0 && count % target === 0 ? target : 0)) / target) * 100);
  const displayRingCount = count === 0 ? 0 : count % target === 0 ? target : count % target;

  const increment = () => {
    setCount((c) => c + 1);
    setTotal((t) => t + 1);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-40 glass-panel border border-[var(--border-gold)] rounded-full px-4 py-2.5 flex items-center gap-2 shadow-2xl hover:scale-105 transition cursor-pointer"
      >
        <span className="text-lg">📿</span>
        <span className="text-xs font-bold text-[var(--gold)]">سبحة الذكر</span>
        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
          {total}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 w-72 glass-panel border border-[var(--border-gold)] rounded-3xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--gold)]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>مسبحة مشكاة</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCount(0)}
            title="تصفير الدورة"
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      <select
        value={phraseIdx}
        onChange={(e) => {
          setPhraseIdx(Number(e.target.value));
          setCount(0);
        }}
        className="w-full input-mishkah rounded-xl px-3 py-2 text-xs font-semibold mb-4"
      >
        {PHRASES.map((p, i) => (
          <option key={p} value={i}>
            {p}
          </option>
        ))}
      </select>

      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={increment}
          className="relative w-28 h-28 rounded-full flex flex-col items-center justify-center bg-[var(--emerald-soft)] border-2 border-[var(--border-gold)] hover:scale-105 active:scale-95 transition cursor-pointer shadow-lg"
        >
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" stroke="rgba(255,255,255,0.08)" strokeWidth="5" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="var(--gold)"
              strokeWidth="5"
              fill="none"
              strokeDasharray="276.46"
              strokeDashoffset={276.46 - (276.46 * progress) / 100}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-2xl font-extrabold text-[var(--text-primary)]">{displayRingCount}</span>
          <span className="text-[10px] text-[var(--gold)] font-bold">من {target}</span>
        </button>
        <div className="mt-3 text-[11px] text-[var(--text-muted)]">
          إجمالي التسبيحات المحفوظة: <strong className="text-[var(--emerald-bright)]">{total}</strong>
        </div>
      </div>
    </div>
  );
}
