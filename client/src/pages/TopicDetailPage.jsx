import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Bookmark,
  CheckCircle2,
  Edit3,
  EyeOff,
  Flag,
  Heart,
  Lock,
  Pin,
  Reply,
  Send,
  Trash2,
  Unlock,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateAr } from '../utils/arabic.js';

export default function TopicDetailPage() {
  const { id } = useParams();
  const { user, openAuthModal, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [topic, setTopic] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicEditForm, setTopicEditForm] = useState({ title: '', body: '' });
  const [editingReplyId, setEditingReplyId] = useState(null);
  const [editingReplyBody, setEditingReplyBody] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');

  const loadTopic = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/forum/topics/${id}`);
      setTopic(res.item);
      setReplies(res.replies || []);
      setTopicEditForm({ title: res.item.title, body: res.item.body });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopic();
  }, [id, user?.id]);

  if (loading) {
    return <div className="h-72 rounded-3xl bg-white/5 animate-pulse" />;
  }
  if (!topic) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center space-y-3">
        <p className="text-sm text-[var(--text-muted)]">الموضوع غير موجود أو تم إخفاؤه.</p>
        <Link to="/forum" className="text-xs font-bold text-[var(--gold)] underline">
          العودة للمنتدى
        </Link>
      </div>
    );
  }

  const isStaff = user && ['moderator', 'admin'].includes(user.role);
  const isAuthor = user && user.id === topic.author_id;

  const toggleThanks = async (targetType, targetId) => {
    if (!user) return openAuthModal('login');
    try {
      const res = await apiFetch('/api/forum/thanks', {
        method: 'POST',
        body: { target_type: targetType, target_id: targetId },
      });
      if (targetType === 'topic') {
        setTopic((t) => ({ ...t, userThanked: res.thanked, thanks_count: res.thanks_count }));
      } else {
        setReplies((rs) =>
          rs.map((r) => (r.id === targetId ? { ...r, userThanked: res.thanked, thanks_count: res.thanks_count } : r))
        );
      }
      showToast(res.thanked ? 'جزاك الله خيراً — تم إرسال التقدير' : 'تم سحب التقدير');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleBookmark = async () => {
    if (!user) return openAuthModal('login');
    const res = await apiFetch('/api/bookmarks/toggle', {
      method: 'POST',
      body: { item_type: 'topic', item_id: topic.id },
    });
    setTopic((t) => ({ ...t, bookmarked: res.bookmarked }));
    showToast(res.bookmarked ? 'تم حفظ الموضوع في المفضلة' : 'تمت الإزالة من المفضلة');
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!user) return openAuthModal('login');
    try {
      await apiFetch(`/api/forum/topics/${topic.id}/replies`, {
        method: 'POST',
        body: { body: replyBody, parent_reply_id: replyTo?.id || null },
      });
      setReplyBody('');
      setReplyTo(null);
      showToast('تمت إضافة ردك بنجاح (+5 نقاط)');
      await refreshUser();
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBestAnswer = async (replyId) => {
    try {
      await apiFetch(`/api/forum/topics/${topic.id}/best-reply`, {
        method: 'POST',
        body: { reply_id: replyId },
      });
      showToast('تم تحديث أفضل إجابة');
      await refreshUser();
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveTopicEdit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/forum/topics/${topic.id}`, {
        method: 'PATCH',
        body: topicEditForm,
      });
      setEditingTopic(false);
      showToast('تم تعديل الموضوع');
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTopic = async () => {
    try {
      await apiFetch(`/api/forum/topics/${topic.id}`, { method: 'DELETE' });
      showToast('تم حذف الموضوع');
      await refreshUser();
      navigate('/forum');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaveReplyEdit = async (replyId) => {
    try {
      await apiFetch(`/api/forum/replies/${replyId}`, {
        method: 'PATCH',
        body: { body: editingReplyBody },
      });
      setEditingReplyId(null);
      showToast('تم تعديل الرد');
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteReply = async (replyId) => {
    try {
      await apiFetch(`/api/forum/replies/${replyId}`, { method: 'DELETE' });
      showToast('تم حذف الرد');
      await refreshUser();
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleModTopic = async (patch) => {
    try {
      await apiFetch(`/api/moderation/topics/${topic.id}`, { method: 'PATCH', body: patch });
      showToast('تم تحديث حالة الموضوع');
      if (patch.is_hidden) return navigate('/forum');
      await loadTopic();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/forum/reports', {
        method: 'POST',
        body: { target_type: reportTarget.type, target_id: reportTarget.id, reason: reportReason },
      });
      setReportTarget(null);
      setReportReason('');
      showToast('تم إرسال البلاغ للإشراف للمراجعة');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const replyMap = new Map(replies.map((r) => [r.id, r]));

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3">
        <Link to="/forum" className="text-xs font-bold text-[var(--gold)] inline-flex items-center gap-1.5 hover:underline">
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى المنتدى</span>
        </Link>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
          {topic.category_name}
        </span>
      </div>

      {/* Main Topic Card */}
      <article className="glass-panel rounded-3xl p-6 sm:p-8 border border-[var(--border-gold)]">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {topic.is_pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
              <Pin className="w-3.5 h-3.5" /> مثبت
            </span>
          )}
          {topic.is_locked && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-500/20 text-slate-300">
              <Lock className="w-3.5 h-3.5" /> مغلق
            </span>
          )}
          {topic.best_reply_id && (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> موضوع مجاب
            </span>
          )}
        </div>

        {editingTopic ? (
          <form onSubmit={handleSaveTopicEdit} className="space-y-3 mb-4">
            <input
              required
              value={topicEditForm.title}
              onChange={(e) => setTopicEditForm({ ...topicEditForm, title: e.target.value })}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-base font-bold"
            />
            <textarea
              required
              rows={5}
              value={topicEditForm.body}
              onChange={(e) => setTopicEditForm({ ...topicEditForm, body: e.target.value })}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingTopic(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs border border-[var(--border-subtle)] cursor-pointer"
              >
                إلغاء
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer">
                حفظ التعديل
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 className="text-xl sm:text-2xl font-extrabold mb-4 leading-snug">{topic.title}</h1>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[var(--border-subtle)]">
              <span
                className="w-10 h-10 rounded-full text-sm font-bold text-slate-950 flex items-center justify-center"
                style={{ backgroundColor: topic.author_color || '#10b981' }}
              >
                {topic.author_name?.[0]}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{topic.author_name}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                    {topic.author_badge}
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {formatDateAr(topic.created_at)} · {topic.views_count} مشاهدة
                </div>
              </div>
            </div>

            <div className="text-sm sm:text-base text-[var(--text-primary)] leading-[1.95] whitespace-pre-line mb-5">
              {topic.body}
            </div>
          </>
        )}

        {/* Linked Library Card */}
        {topic.linkedItem && (
          <div className="mb-5 rounded-2xl p-4 bg-[var(--emerald-soft)] border border-[var(--border-gold)]">
            <div className="text-[11px] font-bold text-[var(--gold)] mb-1">مرتبط بمحتوى من مكتبة مشكاة</div>
            <div className="font-bold text-sm mb-1">{topic.linkedItem.title}</div>
            {topic.linkedItem.text_diacritics && (
              <p className="font-amiri text-base text-[var(--text-secondary)]">«{topic.linkedItem.text_diacritics}»</p>
            )}
            {topic.linkedItem.summary && (
              <p className="text-xs text-[var(--text-secondary)] mb-2">{topic.linkedItem.summary}</p>
            )}
            {topic.linkedItem.slug && (
              <Link to={`/stories/${topic.linkedItem.slug}`} className="text-xs font-bold text-[var(--emerald-bright)] underline">
                اقرأ القصة كاملة ←
              </Link>
            )}
          </div>
        )}

        {/* Topic Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => toggleThanks('topic', topic.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                topic.userThanked
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-gold)]'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>جزاك الله خيراً ({topic.thanks_count})</span>
            </button>
            <button
              type="button"
              onClick={toggleBookmark}
              className={`px-3 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                topic.bookmarked
                  ? 'bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{topic.bookmarked ? 'محفوظ' : 'حفظ'}</span>
            </button>
            {user && !isAuthor && (
              <button
                type="button"
                onClick={() => setReportTarget({ type: 'topic', id: topic.id })}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>تبليغ</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isAuthor && !topic.is_locked && (
              <button
                type="button"
                onClick={() => setEditingTopic(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-[var(--border-subtle)] hover:border-[var(--gold)] inline-flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
            )}
            {(isAuthor || isStaff) && (
              <button
                type="button"
                onClick={handleDeleteTopic}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-rose-500/30 text-rose-300 hover:bg-rose-500/15 inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            )}
            {isStaff && (
              <>
                <button
                  type="button"
                  onClick={() => handleModTopic({ is_pinned: !topic.is_pinned })}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[var(--gold-soft)] text-[var(--gold)] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{topic.is_pinned ? 'إلغاء التثبيت' : 'تثبيت'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModTopic({ is_locked: !topic.is_locked })}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 text-[var(--text-secondary)] inline-flex items-center gap-1 cursor-pointer"
                >
                  {topic.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{topic.is_locked ? 'فتح' : 'إغلاق'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </article>

      {/* Replies */}
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">المشاركات والردود ({replies.length})</h2>
        {replies.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6 text-center text-xs text-[var(--text-muted)]">
            لا توجد ردود بعد. شارك برأيك أو علمك النافع!
          </div>
        ) : (
          replies.map((r) => {
            const parent = r.parent_reply_id ? replyMap.get(r.parent_reply_id) : null;
            const isRepAuthor = user && user.id === r.author_id;
            return (
              <div
                key={r.id}
                className={`rounded-2xl p-5 border ${
                  r.isBestAnswer
                    ? 'gold-card border-[var(--gold)]'
                    : 'glass-card border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-8 h-8 rounded-full text-xs font-bold text-slate-950 flex items-center justify-center"
                      style={{ backgroundColor: r.author_color || '#10b981' }}
                    >
                      {r.author_name?.[0]}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{r.author_name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)]">
                          {r.author_badge}
                        </span>
                        {r.isBestAnswer && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                            <Award className="w-3 h-3" /> أفضل إجابة
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">{formatDateAr(r.created_at)}</div>
                    </div>
                  </div>
                </div>

                {parent && (
                  <div className="mb-3 rounded-xl bg-black/20 border-r-2 border-[var(--gold)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    <strong className="text-[var(--gold)]">رداً على {parent.author_name}:</strong>{' '}
                    <span className="line-clamp-2">{parent.body}</span>
                  </div>
                )}

                {editingReplyId === r.id ? (
                  <div className="space-y-2 mb-3">
                    <textarea
                      rows={3}
                      value={editingReplyBody}
                      onChange={(e) => setEditingReplyBody(e.target.value)}
                      className="w-full input-mishkah rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingReplyId(null)}
                        className="px-3 py-1 rounded-lg text-xs border border-[var(--border-subtle)] cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveReplyEdit(r.id)}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-line mb-3">{r.body}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleThanks('reply', r.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold border inline-flex items-center gap-1 cursor-pointer ${
                        r.userThanked
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <Heart className="w-3 h-3" />
                      <span>جزاك الله خيراً ({r.thanks_count})</span>
                    </button>
                    {!topic.is_locked && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) return openAuthModal('login');
                          setReplyTo(r);
                        }}
                        className="px-2.5 py-1 rounded-lg font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Reply className="w-3 h-3" />
                        <span>رد</span>
                      </button>
                    )}
                    {(isAuthor || isStaff) && (
                      <button
                        type="button"
                        onClick={() => handleBestAnswer(r.id)}
                        className="px-2.5 py-1 rounded-lg font-bold bg-[var(--gold-soft)] text-[var(--gold)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Award className="w-3 h-3" />
                        <span>{r.isBestAnswer ? 'إلغاء التحديد' : 'أفضل إجابة'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isRepAuthor && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReplyId(r.id);
                          setEditingReplyBody(r.body);
                        }}
                        className="text-[var(--text-muted)] hover:text-[var(--gold)] cursor-pointer"
                      >
                        تعديل
                      </button>
                    )}
                    {(isRepAuthor || isStaff) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(r.id)}
                        className="text-rose-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isStaff && !isRepAuthor ? <EyeOff className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                        <span>{isStaff && !isRepAuthor ? 'إخفاء' : 'حذف'}</span>
                      </button>
                    )}
                    {user && !isRepAuthor && (
                      <button
                        type="button"
                        onClick={() => setReportTarget({ type: 'reply', id: r.id })}
                        className="text-[var(--text-muted)] hover:text-rose-300 cursor-pointer"
                      >
                        تبليغ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Reply Composer */}
      <section className="glass-panel rounded-3xl p-5 sm:p-6 border border-[var(--border-gold)]">
        {topic.is_locked ? (
          <div className="text-center text-xs font-bold text-[var(--text-muted)] py-2">
            هذا الموضوع مغلق حالياً ولا يقبل ردوداً جديدة.
          </div>
        ) : !user ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-[var(--text-secondary)]">سجّل دخولك للمشاركة بالرد والتقييم في هذا النقاش.</span>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white cursor-pointer"
            >
              تسجيل الدخول للمشاركة
            </button>
          </div>
        ) : (
          <form onSubmit={handleReplySubmit} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--gold)]">أضف مشاركتك النافعة</h3>
              {replyTo && (
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-xs text-rose-300 hover:underline cursor-pointer"
                >
                  إلغاء الرد على {replyTo.author_name} ×
                </button>
              )}
            </div>
            <textarea
              required
              rows={4}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="اكتب ردك بأدب ووضوح..."
              className="w-full input-mishkah rounded-2xl px-4 py-3 text-sm"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white inline-flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال الرد</span>
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form onSubmit={handleSubmitReport} className="glass-panel w-full max-w-md rounded-3xl p-6 border border-[var(--border-gold)] space-y-4">
            <h3 className="text-base font-extrabold text-[var(--gold)]">إبلاغ الإشراف عن مخالفة</h3>
            <textarea
              required
              rows={3}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="اذكر سبب البلاغ باختصار..."
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="px-4 py-2 rounded-xl text-xs border border-[var(--border-subtle)] cursor-pointer"
              >
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white cursor-pointer">
                إرسال البلاغ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
