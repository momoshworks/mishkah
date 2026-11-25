import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Bookmark,
  Flame,
  Heart,
  MessageSquare,
  Pin,
  ScrollText,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import MoodCompanion from '../components/MoodCompanion.jsx';
import QuoteCardModal from '../components/QuoteCardModal.jsx';

export default function HomePage() {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [quoteItem, setQuoteItem] = useState(null);

  useEffect(() => {
    apiFetch('/api/home').then(setData).catch(() => {});
  }, [user?.id]);

  const toggleFeaturedBookmark = async () => {
    if (!user) return openAuthModal('login');
    if (!data?.featuredHadith) return;
    try {
      const res = await apiFetch('/api/bookmarks/toggle', {
        method: 'POST',
        body: { item_type: 'hadith', item_id: data.featuredHadith.id },
      });
      setData((prev) => ({
        ...prev,
        featuredHadith: { ...prev.featuredHadith, bookmarked: res.bookmarked },
      }));
      showToast(res.bookmarked ? 'تم حفظ الحديث في مفضلتك' : 'تمت إزالة الحديث من المفضلة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const featured = data?.featuredHadith;

  return (
    <div className="space-y-8 pb-14">
      {/* Hero Banner */}
      <section className="relative overflow-hidden gold-card rounded-3xl p-6 sm:p-10">
        {/* Subtle rotating geometric ornament */}
        <svg
          className="absolute -left-20 -bottom-20 w-72 h-72 opacity-10 lantern-glow pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
        >
          <circle cx="100" cy="100" r="85" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
          <polygon
            points="100,12 124,76 188,100 124,124 100,188 76,124 12,100 76,76"
            stroke="#e5be67"
            strokeWidth="2"
          />
          <rect x="42" y="42" width="116" height="116" transform="rotate(45 100 100)" stroke="#10b981" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--gold-soft)] border border-[var(--border-gold)] text-xs font-bold text-[var(--gold)] mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>إشراقة اليوم · {featured?.grade || 'حديث صحيح'}</span>
          </div>

          {featured ? (
            <>
              <blockquote className="font-amiri text-2xl sm:text-3xl md:text-4xl leading-[1.9] text-[var(--text-primary)] mb-4">
                «{featured.text_diacritics}»
              </blockquote>
              <p className="text-xs sm:text-sm text-[var(--gold)] font-semibold mb-3">
                رواه {featured.narrator} · {featured.source}
              </p>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-3xl mb-6">
                {featured.explanation}
              </p>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setQuoteItem({
                      badge: `${featured.category} · ${featured.grade}`,
                      quote: featured.text_diacritics,
                      footer: featured.narrator,
                      subtitle: featured.source,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>بطاقة اقتباس جاهزة</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/forum?new=1&linked_type=hadith&linked_id=${featured.id}&title=${encodeURIComponent(`تدبر حديث: ${featured.title}`)}`)
                  }
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--emerald-soft)] border border-[var(--border-gold)] text-[var(--emerald-bright)] flex items-center gap-1.5 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>ناقش الحديث في المنتدى</span>
                </button>
                <button
                  type="button"
                  onClick={toggleFeaturedBookmark}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                    featured.bookmarked
                      ? 'bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)]'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{featured.bookmarked ? 'محفوظ في المفضلة' : 'حفظ للمفضلة'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          )}
        </div>
      </section>

      {/* Stats Strip */}
      {data?.stats && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'حديث موثق', val: data.stats.hadiths, icon: ScrollText, to: '/hadiths' },
            { label: 'قصة وعبرة', val: data.stats.stories, icon: BookOpen, to: '/stories' },
            { label: 'موعظة للقلب', val: data.stats.sermons, icon: Flame, to: '/sermons' },
            { label: 'موضوع نقاشي', val: data.stats.topics, icon: MessageSquare, to: '/forum' },
            { label: 'عضو في المجلس', val: data.stats.members, icon: Users, to: '/forum' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                to={s.to}
                className="glass-card rounded-2xl p-4 flex items-center gap-3 hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--emerald-soft)] text-[var(--emerald-bright)] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xl font-extrabold text-[var(--text-primary)]">{s.val}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold">{s.label}</div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {/* Mood Companion Widget */}
      <MoodCompanion />

      {/* Main Content Split: Stories/Sermons + Active Forum */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Curated Stories */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--emerald-bright)]" />
                <span>مختارات القصص الإسلامية</span>
              </h2>
              <Link to="/stories" className="text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1 hover:underline">
                <span>كل القصص</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3.5">
              {(data?.stories || []).map((story) => (
                <Link
                  key={story.id}
                  to={`/stories/${story.slug}`}
                  className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:-translate-y-0.5"
                  style={{ borderRightWidth: '3px', borderRightColor: story.accent_color || '#10b981' }}
                >
                  <div>
                    <div className="text-[11px] text-[var(--gold)] font-bold mb-1">
                      ⏱ {story.reading_minutes} دقائق قراءة
                    </div>
                    <h3 className="font-bold text-sm mb-1.5 text-[var(--text-primary)]">{story.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {story.summary}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Curated Sermons */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Flame className="w-5 h-5 text-[var(--gold)]" />
                <span>رقائق ومواعظ مختارة</span>
              </h2>
              <Link to="/sermons" className="text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1 hover:underline">
                <span>كل المواعظ</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-3">
              {(data?.sermons || []).map((sermon) => (
                <Link
                  key={sermon.id}
                  to={`/sermons?q=${encodeURIComponent(sermon.title)}`}
                  className="glass-card rounded-2xl p-4 block hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                      {sermon.category}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">{sermon.reading_minutes} د</span>
                  </div>
                  <h3 className="font-bold text-sm mb-1">{sermon.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{sermon.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Forum Highlights Column */}
        <div className="lg:col-span-5">
          <div className="glass-panel rounded-3xl p-5 sm:p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-extrabold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[var(--emerald-bright)]" />
                  <span>أحدث نقاشات المنتدى</span>
                </h2>
                <Link to="/forum" className="text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1 hover:underline">
                  <span>دخول المنتدى</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {(data?.activeTopics || []).map((topic) => (
                  <Link
                    key={topic.id}
                    to={`/forum/topic/${topic.id}`}
                    className="glass-card rounded-2xl p-4 block hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {Boolean(topic.is_pinned) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                          <Pin className="w-3 h-3" /> مثبت
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                        {topic.category_name}
                      </span>
                      {topic.best_reply_id && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          ✓ تمت الإجابة
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm leading-snug mb-2">{topic.title}</h3>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full text-[10px] font-bold text-slate-950 inline-flex items-center justify-center"
                          style={{ backgroundColor: topic.author_color || '#10b981' }}
                        >
                          {topic.author_name?.[0]}
                        </span>
                        <span className="font-semibold text-[var(--text-secondary)]">{topic.author_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>💬 {topic.replies_count}</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Heart className="w-3 h-3 text-amber-400" /> {topic.thanks_count}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
              <p className="text-[11px] text-[var(--text-muted)]">
                تنويه: المنتدى مجلس حوار وتعلم مجتمعي، وللفتاوى الخاصة يُرجع إلى دور الإفتاء المعتمدة.
              </p>
              <Link
                to="/forum?new=1"
                className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow"
              >
                + موضوع جديد
              </Link>
            </div>
          </div>
        </div>
      </div>

      <QuoteCardModal item={quoteItem} onClose={() => setQuoteItem(null)} />
    </div>
  );
}
