import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Sparkles, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../api/client.js';

const MOODS = [
  { id: 'serenity', label: 'أبحث عن الطمأنينة', emoji: '🕊' },
  { id: 'distress', label: 'أمرّ بهمّ وضيق', emoji: '🌧' },
  { id: 'repentance', label: 'مشتاق للتوبة والقرب', emoji: '🌱' },
  { id: 'patience', label: 'أحتاج للصبر والثبات', emoji: '⛰' },
  { id: 'resolve', label: 'أريد همّة في الطاعة', emoji: '✨' },
];

export default function MoodCompanion() {
  const [mood, setMood] = useState('serenity');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/companion?mood=${mood}&offset=${offset}`)
      .then((res) => {
        if (active) setData(res);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mood, offset]);

  return (
    <section className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--gold)] mb-1">
            <Sparkles className="w-4 h-4" />
            <span>رفيق قلبك اليوم</span>
          </div>
          <h2 className="text-xl font-extrabold">كيف تجد قلبك في هذه اللحظة؟</h2>
        </div>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)] hover:border-[var(--border-gold)] flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--gold)] transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>اقتراح آخر</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMood(m.id);
              setOffset(0);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              mood === m.id
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg'
                : 'bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)]'
            }`}
          >
            <span>{m.emoji}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {data.hadith && (
            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-[var(--gold)] mb-1">حديث يواسي قلبك</div>
                <h3 className="font-bold text-sm mb-1.5">{data.hadith.title}</h3>
                <p className="font-amiri text-base text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                  «{data.hadith.text_diacritics}»
                </p>
              </div>
              <Link
                to={`/hadiths?q=${encodeURIComponent(data.hadith.title)}`}
                className="mt-3 text-xs font-bold text-[var(--emerald-bright)] inline-flex items-center gap-1 hover:underline"
              >
                <span>اقرأ الشرح والفوائد</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {data.story && (
            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-[var(--emerald-bright)] mb-1">
                  قصة ملهمة · {data.story.reading_minutes} دقائق
                </div>
                <h3 className="font-bold text-sm mb-1.5">{data.story.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                  {data.story.summary}
                </p>
              </div>
              <Link
                to={`/stories/${data.story.slug}`}
                className="mt-3 text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1 hover:underline"
              >
                <span>ابدأ القراءة</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {data.sermon && (
            <div className="glass-card rounded-2xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-bold text-[var(--gold)] mb-1">موعظة للقلب</div>
                <h3 className="font-bold text-sm mb-1.5">{data.sermon.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                  {data.sermon.excerpt}
                </p>
              </div>
              <Link
                to={`/sermons?q=${encodeURIComponent(data.sermon.title)}`}
                className="mt-3 text-xs font-bold text-[var(--emerald-bright)] inline-flex items-center gap-1 hover:underline"
              >
                <span>تأمل في الموعظة</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
