import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageSquare,
  Search,
  Share2,
  Sparkles,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import QuoteCardModal from '../components/QuoteCardModal.jsx';

export default function HadithsPage() {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('');
  const [grade, setGrade] = useState('');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [quoteItem, setQuoteItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const paramQ = searchParams.get('q') || '';
    if (paramQ !== q) setQ(paramQ);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (grade) params.set('grade', grade);

    apiFetch(`/api/hadiths?${params.toString()}`)
      .then((res) => {
        if (!active) return;
        setItems(res.items || []);
        setCategories(res.categories || []);
        setGrades(res.grades || []);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, category, grade, user?.id]);

  const toggleBookmark = async (id) => {
    if (!user) return openAuthModal('login');
    try {
      const res = await apiFetch('/api/bookmarks/toggle', {
        method: 'POST',
        body: { item_type: 'hadith', item_id: id },
      });
      setItems((prev) => prev.map((h) => (h.id === id ? { ...h, bookmarked: res.bookmarked } : h)));
      showToast(res.bookmarked ? 'حُفظ الحديث في مفضلتك' : 'أُزيل من المفضلة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const copyHadith = async (h) => {
    const text = `«${h.text_diacritics}»\n— ${h.narrator} (${h.source} - ${h.grade})`;
    await navigator.clipboard.writeText(text);
    showToast('تم نسخ الحديث مع التخريج');
  };

  return (
    <div className="space-y-6 pb-14">
      <div className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)]">
        <h1 className="text-2xl font-extrabold text-[var(--gold)] mb-1">موسوعة الأحاديث النبوية</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-5">
          أحاديث صحيحة موثقة مع الشرح المبسط والفوائد، وتدعم البحث الفوري بالتشكيل أو بدونه.
        </p>

        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSearchParams(e.target.value ? { q: e.target.value } : {});
              }}
              placeholder="ابحث بكلمة أو مقطع (مثال: انما الاعمال، التوبة، الصبر)..."
              className="w-full input-mishkah rounded-xl pr-10 pl-4 py-2.5 text-sm"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            >
              <option value="">كل الدرجات</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-[var(--text-muted)]">
          لم يُعثر على أحاديث مطابقة لبحثك. جرّب كلمة أخرى أو امسح الفلاتر.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((h) => {
            const isOpen = Boolean(expanded[h.id]);
            return (
              <article key={h.id} className="glass-card rounded-3xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                      {h.category}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                      {h.grade}
                    </span>
                    {h.is_featured && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> مميز
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{h.source}</span>
                </div>

                <h2 className="text-base font-extrabold text-[var(--text-primary)] mb-2">{h.title}</h2>
                <blockquote className="font-amiri text-xl sm:text-2xl leading-[1.95] text-[var(--text-primary)] bg-black/15 rounded-2xl p-4 border border-[var(--border-subtle)] mb-3">
                  «{h.text_diacritics}»
                </blockquote>
                <div className="text-xs font-semibold text-[var(--gold)] mb-4">الراوي: {h.narrator}</div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [h.id]: !prev[h.id] }))}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--emerald-soft)] text-[var(--emerald-bright)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span>{isOpen ? 'إخفاء الشرح والفوائد' : 'الشرح والفوائد المستخلصة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setQuoteItem({
                          badge: `${h.category} · ${h.grade}`,
                          quote: h.text_diacritics,
                          footer: h.narrator,
                          subtitle: h.source,
                        })
                      }
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] hover:border-[var(--border-gold)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>بطاقة اقتباس</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyHadith(h)}
                      className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] hover:border-[var(--border-gold)] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleBookmark(h.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                        h.bookmarked
                          ? 'bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{h.bookmarked ? 'محفوظ' : 'حفظ'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/forum?new=1&linked_type=hadith&linked_id=${h.id}&title=${encodeURIComponent(`تدبر حديث: ${h.title}`)}`)
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--gold-soft)] border border-[var(--border-gold)] text-[var(--gold)] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>ناقش في المنتدى</span>
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] space-y-3 text-sm">
                    <div>
                      <div className="text-xs font-bold text-[var(--gold)] mb-1">الشرح الميسر:</div>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{h.explanation}</p>
                    </div>
                    {h.benefits?.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-[var(--emerald-bright)] mb-1.5">فوائد عملية:</div>
                        <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] list-disc list-inside">
                          {h.benefits.map((b, idx) => (
                            <li key={idx}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <QuoteCardModal item={quoteItem} onClose={() => setQuoteItem(null)} />
    </div>
  );
}
