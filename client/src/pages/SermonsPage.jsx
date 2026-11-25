import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronDown, ChevronUp, Flame, MessageSquare, Search, Share2 } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import QuoteCardModal from '../components/QuoteCardModal.jsx';

export default function SermonsPage() {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [openIds, setOpenIds] = useState({});
  const [quoteItem, setQuoteItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const paramQ = searchParams.get('q') || '';
    if (paramQ) setQ(paramQ);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    apiFetch(`/api/sermons?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setItems(res.items || []);
        setCategories(res.categories || []);
        if (res.items?.length === 1) {
          setOpenIds({ [res.items[0].id]: true });
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, category, user?.id]);

  const toggleBookmark = async (id) => {
    if (!user) return openAuthModal('login');
    try {
      const res = await apiFetch('/api/bookmarks/toggle', {
        method: 'POST',
        body: { item_type: 'sermon', item_id: id },
      });
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, bookmarked: res.bookmarked } : m)));
      showToast(res.bookmarked ? 'حُفظت الموعظة في المفضلة' : 'أُزيلت من المفضلة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-14">
      <div className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)]">
        <h1 className="text-2xl font-extrabold text-[var(--gold)] mb-1 flex items-center gap-2">
          <Flame className="w-6 h-6" />
          <span>المواعظ والرقائق الإيمانية</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          خواطر ومواعظ قصيرة تلامس القلب، مع سؤال تأملي في نهاية كل موعظة لتجديد الإيمان.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer ${
                !category
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950'
                  : 'bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer ${
                  category === c
                    ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950'
                    : 'bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في المواعظ..."
              className="w-full input-mishkah rounded-xl pr-9 pl-3 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-[var(--text-muted)]">
          لا توجد مواعظ مطابقة لبحثك.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((m) => {
            const isOpen = Boolean(openIds[m.id]);
            return (
              <article key={m.id} className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                      {m.category}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{m.reading_minutes} دقائق قراءة</span>
                  </div>
                  <h2 className="text-lg font-extrabold mb-2">{m.title}</h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{m.excerpt}</p>

                  {isOpen && (
                    <div className="space-y-3 mb-4 pt-3 border-t border-[var(--border-subtle)]">
                      {m.body_paragraphs.map((p, idx) => (
                        <p key={idx} className="text-sm text-[var(--text-primary)] leading-[1.9]">
                          {p}
                        </p>
                      ))}
                      {m.reflection_question && (
                        <div className="rounded-2xl p-3.5 bg-[var(--emerald-soft)] border border-[var(--border-gold)] text-xs">
                          <strong className="text-[var(--gold)] block mb-1">وقفـة تأملية:</strong>
                          <span className="text-[var(--text-primary)]">{m.reflection_question}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenIds((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--emerald-soft)] text-[var(--emerald-bright)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isOpen ? 'طـي' : 'اقرأ الموعظة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteItem({
                          badge: m.category,
                          quote: m.excerpt,
                          footer: m.title,
                          subtitle: 'من مواعظ منصة مِشكاة',
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>بطاقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(m.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1 cursor-pointer ${
                        m.bookmarked
                          ? 'bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/forum?new=1&linked_type=sermon&linked_id=${m.id}&title=${encodeURIComponent(`تأملات حول موعظة: ${m.title}`)}`)
                    }
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--gold)] hover:bg-[var(--gold-soft)] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>ناقش</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <QuoteCardModal item={quoteItem} onClose={() => setQuoteItem(null)} />
    </div>
  );
}
