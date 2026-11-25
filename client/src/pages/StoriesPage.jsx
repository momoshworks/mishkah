import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Clock, Search } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const CATEGORIES = [
  { id: '', label: 'كل القصص' },
  { id: 'prophets', label: 'قصص الأنبياء' },
  { id: 'companions', label: 'سير الصحابة' },
  { id: 'seerah', label: 'السيرة النبوية' },
  { id: 'lessons', label: 'قصص وعبر' },
];

const CAT_NAMES = {
  prophets: 'قصص الأنبياء',
  companions: 'سير الصحابة',
  seerah: 'السيرة النبوية',
  lessons: 'قصص وعبر',
};

export default function StoriesPage() {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (q.trim()) params.set('q', q.trim());
    apiFetch(`/api/stories?${params.toString()}`)
      .then((res) => active && setItems(res.items || []))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, q, user?.id]);

  const toggleBookmark = async (e, id) => {
    e.preventDefault();
    if (!user) return openAuthModal('login');
    try {
      const res = await apiFetch('/api/bookmarks/toggle', {
        method: 'POST',
        body: { item_type: 'story', item_id: id },
      });
      setItems((prev) => prev.map((s) => (s.id === id ? { ...s, bookmarked: res.bookmarked } : s)));
      showToast(res.bookmarked ? 'تم حفظ القصة في المفضلة' : 'تمت إزالة القصة من المفضلة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-14">
      <div className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)]">
        <h1 className="text-2xl font-extrabold text-[var(--gold)] mb-1">القصص الإسلامية والعِبر</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          مواقف خالدة من قصص الأنبياء وسيرة المصطفى ﷺ والصحابة والصالحين بتجربة قراءة مريحة وهادئة.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition cursor-pointer ${
                  category === c.id
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow'
                    : 'bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن قصة..."
              className="w-full input-mishkah rounded-xl pr-9 pl-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-[var(--text-muted)]">
          لا توجد قصص مطابقة لهذا التصنيف أو البحث.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((story) => (
            <Link
              key={story.id}
              to={`/stories/${story.slug}`}
              className="glass-card rounded-3xl p-5 flex flex-col justify-between hover:-translate-y-1"
              style={{ borderTopWidth: '3px', borderTopColor: story.accent_color || '#10b981' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                    {CAT_NAMES[story.category] || story.category}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => toggleBookmark(e, story.id)}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      story.bookmarked
                        ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--gold-soft)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                    }`}
                    title="حفظ"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h2 className="text-base font-extrabold mb-2 text-[var(--text-primary)]">{story.title}</h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                  {story.summary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                  {story.reading_minutes} دقائق قراءة
                </span>
                <span className="font-bold text-[var(--gold)]">اقرأ القصة ←</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
