import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Bookmark, CheckCircle2, Clock, MessageSquare, Minus, Plus } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function StoryDetailPage() {
  const { slug } = useParams();
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [fontSize, setFontSize] = useState(20);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    apiFetch(`/api/stories/${slug}`).then(setData).catch(() => setData(null));
  }, [slug, user?.id]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      if (total <= 0) return setProgress(100);
      setProgress(Math.min(100, Math.round((window.scrollY / total) * 100)));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!data) {
    return <div className="h-64 rounded-3xl bg-white/5 animate-pulse" />;
  }

  const { item: story, related, linkedTopic } = data;

  const toggleBookmark = async () => {
    if (!user) return openAuthModal('login');
    try {
      const res = await apiFetch('/api/bookmarks/toggle', {
        method: 'POST',
        body: { item_type: 'story', item_id: story.id },
      });
      setData((prev) => ({ ...prev, item: { ...prev.item, bookmarked: res.bookmarked } }));
      showToast(res.bookmarked ? 'حُفظت القصة في مفضلتك' : 'أُزيلت من المفضلة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Reading Progress Bar */}
      <div className="fixed top-16 right-0 left-0 z-30 h-1 bg-black/20">
        <div
          className="h-full bg-gradient-to-l from-amber-400 to-emerald-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/stories" className="text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1.5 hover:underline">
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى القصص الإسلامية</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="glass-panel rounded-xl px-2 py-1 flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(16, s - 2))}
              className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              title="تصغير الخط"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-bold px-1">حجم الخط</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(28, s + 2))}
              className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              title="تكبير الخط"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleBookmark}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
              story.bookmarked
                ? 'bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{story.bookmarked ? 'محفوظة' : 'حفظ'}</span>
          </button>
        </div>
      </div>

      <article className="glass-panel rounded-3xl p-6 sm:p-10 border border-[var(--border-gold)]">
        <div className="flex items-center gap-2 text-xs text-[var(--gold)] font-bold mb-2">
          <Clock className="w-4 h-4" />
          <span>وقت القراءة المقدر: {story.reading_minutes} دقائق</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3 leading-snug">{story.title}</h1>
        <p className="text-sm text-[var(--text-secondary)] bg-white/5 rounded-2xl p-4 border border-[var(--border-subtle)] mb-6">
          {story.summary}
        </p>

        <div className="space-y-5 font-amiri leading-[2] text-[var(--text-primary)]" style={{ fontSize: `${fontSize}px` }}>
          {story.paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>

        {story.lessons?.length > 0 && (
          <div className="mt-8 rounded-2xl p-5 bg-[var(--emerald-soft)] border border-[var(--border-gold)]">
            <h2 className="text-base font-extrabold text-[var(--gold)] mb-3">العِبر والفوائد المستخلصة</h2>
            <ul className="space-y-2 text-sm text-[var(--text-primary)]">
              {story.lessons.map((l, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--emerald-bright)] shrink-0 mt-1" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-muted)]">ما أكثر عبرة استوقفتك في هذه القصة؟</span>
          {linkedTopic ? (
            <Link
              to={`/forum/topic/${linkedTopic.id}`}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              <span>انتقل لنقاش القصة في المنتدى</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                navigate(`/forum?new=1&linked_type=story&linked_id=${story.id}&title=${encodeURIComponent(`تأملات في قصة: ${story.title}`)}`)
              }
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--gold-soft)] border border-[var(--border-gold)] text-[var(--gold)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>ناقش القصة في المنتدى</span>
            </button>
          )}
        </div>
      </article>

      {related?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-extrabold">قصص أخرى قد تهمك</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {related.map((r) => (
              <Link key={r.id} to={`/stories/${r.slug}`} className="glass-card rounded-2xl p-4 block">
                <div className="font-bold text-sm mb-1">{r.title}</div>
                <div className="text-xs text-[var(--text-muted)] line-clamp-2">{r.summary}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
