import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  Heart,
  Lock,
  MessageSquarePlus,
  MessagesSquare,
  Pin,
  Search,
  X,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateAr } from '../utils/arabic.js';

const SORTS = [
  { id: 'recent', label: 'الأحدث نشاطاً' },
  { id: 'active', label: 'الأكثر تفاعلاً' },
  { id: 'unanswered', label: 'بانتظار إجابة' },
  { id: 'pinned', label: 'المثبتة' },
];

export default function ForumPage() {
  const { user, openAuthModal, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [sort, setSort] = useState('recent');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({
    category_id: '',
    title: '',
    body: '',
    tagsInput: '',
    linked_type: null,
    linked_id: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch('/api/forum/categories').then((res) => {
      setCategories(res.items || []);
      if (res.items?.length && !form.category_id) {
        setForm((f) => ({ ...f, category_id: String(res.items[0].id) }));
      }
    });
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      const linkedType = searchParams.get('linked_type') || null;
      const linkedId = searchParams.get('linked_id') ? Number(searchParams.get('linked_id')) : null;
      const preTitle = searchParams.get('title') || '';
      setForm((f) => ({
        ...f,
        title: preTitle || f.title,
        linked_type: linkedType,
        linked_id: linkedId,
      }));
      if (user) {
        setNewOpen(true);
      } else {
        openAuthModal('login');
      }
    }
  }, [searchParams, user]);

  const loadTopics = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCat) params.set('category', selectedCat);
    if (sort) params.set('sort', sort);
    if (q.trim()) params.set('q', q.trim());
    if (tag) params.set('tag', tag);
    apiFetch(`/api/forum/topics?${params.toString()}`)
      .then((res) => setTopics(res.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTopics();
  }, [selectedCat, sort, q, tag]);

  const handleOpenCreate = () => {
    if (!user) return openAuthModal('login');
    setNewOpen(true);
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const tags = form.tagsInput
        .split(/[،,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await apiFetch('/api/forum/topics', {
        method: 'POST',
        body: {
          category_id: Number(form.category_id),
          title: form.title,
          body: form.body,
          tags,
          linked_type: form.linked_type,
          linked_id: form.linked_id,
        },
      });
      showToast('تم نشر موضوعك بنجاح (+10 نقاط)');
      setNewOpen(false);
      setSearchParams({});
      setForm((f) => ({ ...f, title: '', body: '', tagsInput: '', linked_type: null, linked_id: null }));
      await refreshUser();
      navigate(`/forum/topic/${res.item.id}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gold)] mb-1 flex items-center gap-2">
            <MessagesSquare className="w-6 h-6" />
            <span>المنتدى الديني والحوار المجتمعي</span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            تواصل مع الأعضاء في أقسام السؤال والجواب، تدبر القرآن والحديث، التجارب الإيمانية، والأسرة.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white flex items-center gap-2 shadow-lg cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>إضافة موضوع جديد</span>
        </button>
      </div>

      {/* Categories Strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => setSelectedCat('')}
          className={`text-right rounded-2xl p-3.5 border transition cursor-pointer ${
            selectedCat === ''
              ? 'gold-card border-[var(--gold)]'
              : 'glass-card border-[var(--border-subtle)]'
          }`}
        >
          <div className="font-extrabold text-sm text-[var(--gold)]">كل الأقسام</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">عرض جميع النقاشات</div>
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCat(cat.slug)}
            className={`text-right rounded-2xl p-3.5 border transition cursor-pointer ${
              selectedCat === cat.slug
                ? 'gold-card border-[var(--gold)]'
                : 'glass-card border-[var(--border-subtle)]'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-bold text-xs text-[var(--text-primary)]">{cat.name}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                {cat.topics_count}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-1">{cat.description}</p>
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer ${
                sort === s.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950'
                  : 'bg-white/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {s.label}
            </button>
          ))}
          {tag && (
            <button
              type="button"
              onClick={() => setTag('')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--emerald-soft)] text-[var(--emerald-bright)] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>وسم: #{tag}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في مواضيع المنتدى..."
            className="w-full input-mishkah rounded-xl pr-9 pl-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* Topics List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="glass-panel rounded-3xl p-10 text-center text-sm text-[var(--text-muted)]">
          لا توجد مواضيع مطابقة الآن. كن أول من يبدأ نقاشاً نافعاً!
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <div key={t.id} className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-[240px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {t.is_pinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                        <Pin className="w-3 h-3" /> مثبت
                      </span>
                    )}
                    {t.is_locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-300">
                        <Lock className="w-3 h-3" /> مغلق
                      </span>
                    )}
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                      {t.category_name}
                    </span>
                    {t.best_reply_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" /> مجاب
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/forum/topic/${t.id}`}
                    className="block text-base sm:text-lg font-extrabold text-[var(--text-primary)] hover:text-[var(--gold)] transition"
                  >
                    {t.title}
                  </Link>

                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{t.body}</p>

                  {t.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {t.tags.map((tg) => (
                        <button
                          key={tg}
                          type="button"
                          onClick={() => setTag(tg)}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-muted)] hover:text-[var(--gold)] cursor-pointer"
                        >
                          #{tg}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 text-xs text-[var(--text-muted)] shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-full text-xs font-bold text-slate-950 flex items-center justify-center"
                      style={{ backgroundColor: t.author_color || '#10b981' }}
                    >
                      {t.author_name?.[0]}
                    </span>
                    <div className="text-right">
                      <div className="font-bold text-[var(--text-primary)]">{t.author_name}</div>
                      <div className="text-[10px] text-[var(--gold)]">{t.author_badge}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span title="الردود">💬 {t.replies_count}</span>
                    <span className="inline-flex items-center gap-1" title="جزاك الله خيراً">
                      <Heart className="w-3.5 h-3.5 text-amber-400" /> {t.thanks_count}
                    </span>
                    <span className="inline-flex items-center gap-1" title="المشاهدات">
                      <Eye className="w-3.5 h-3.5" /> {t.views_count}
                    </span>
                  </div>
                  <div className="text-[10px] hidden sm:block">{formatDateAr(t.updated_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Topic Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 border border-[var(--border-gold)] relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setNewOpen(false);
                setSearchParams({});
              }}
              className="absolute left-4 top-4 p-2 rounded-xl hover:bg-white/10 text-[var(--text-muted)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-extrabold text-[var(--gold)] mb-4">إنشاء موضوع جديد في المنتدى</h2>

            {form.linked_type && (
              <div className="mb-4 rounded-xl bg-[var(--emerald-soft)] border border-[var(--border-gold)] px-3.5 py-2 text-xs text-[var(--emerald-bright)] font-semibold">
                مرتبط بمحتوى من المكتبة ({form.linked_type === 'hadith' ? 'حديث نبوي' : form.linked_type === 'story' ? 'قصة' : 'موعظة'} #{form.linked_id})
              </div>
            )}

            <form onSubmit={handleCreateTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">القسم</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">عنوان الموضوع</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="اكتب عنواناً واضحاً..."
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">تفاصيل الموضوع أو السؤال</label>
                <textarea
                  required
                  rows={6}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="شارك سؤالك أو تأملك بأسلوب واضح..."
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  وسوم (مفصولة بفاصلة، اختياري)
                </label>
                <input
                  value={form.tagsInput}
                  onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
                  placeholder="مثال: تزكية، ذكر، تربية"
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewOpen(false);
                    setSearchParams({});
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'جارٍ النشر...' : 'نشر الموضوع الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
