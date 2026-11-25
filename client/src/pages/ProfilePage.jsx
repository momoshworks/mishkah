import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Award, Bell, Bookmark, CheckCheck, LogOut, MessageSquare, Save } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatDateAr } from '../utils/arabic.js';

export default function ProfilePage() {
  const { user, logout, refreshUser, refreshNotifications, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') || 'bookmarks');
  const [bookmarks, setBookmarks] = useState({ hadiths: [], stories: [], sermons: [], topics: [] });
  const [myTopics, setMyTopics] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profileForm, setProfileForm] = useState({ display_name: '', bio: '' });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({ display_name: user.display_name || '', bio: user.bio || '' });
    Promise.all([
      apiFetch('/api/bookmarks'),
      apiFetch(`/api/forum/topics?author_id=${user.id}`),
      apiFetch('/api/notifications'),
    ])
      .then(([bm, tp, nf]) => {
        setBookmarks(bm);
        setMyTopics(tp.items || []);
        setNotifications(nf.items || []);
      })
      .catch(() => {});
  }, [user?.id]);

  if (!user) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center space-y-4 max-w-lg mx-auto">
        <h1 className="text-xl font-extrabold text-[var(--gold)]">حسابك الشخصي في مِشكاة</h1>
        <p className="text-sm text-[var(--text-secondary)]">سجل الدخول لعرض مفضلتك، مواضيعك، نقاطك، وإشعارات المنتدى.</p>
        <button
          type="button"
          onClick={() => openAuthModal('login')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white cursor-pointer"
        >
          تسجيل الدخول
        </button>
      </div>
    );
  }

  const nextThreshold = user.points < 30 ? 30 : user.points < 100 ? 100 : user.points < 250 ? 250 : 250;
  const pct = Math.min(100, Math.round((user.points / nextThreshold) * 100));

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/profile', { method: 'PATCH', body: profileForm });
      await refreshUser();
      showToast('تم حفظ بيانات ملفك الشخصي');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read', { method: 'POST' });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    await refreshNotifications(user);
    showToast('تم تحديد جميع الإشعارات كمقروءة');
  };

  const handleLogout = async () => {
    await logout();
    showToast('تم تسجيل الخروج');
    navigate('/');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header Card */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-[var(--border-gold)] flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl text-2xl font-extrabold text-slate-950 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: user.avatar_color || '#10b981' }}
          >
            {user.display_name?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold">{user.display_name}</h1>
              <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-[var(--gold-soft)] text-[var(--gold)]">
                {user.badge}
              </span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">@{user.username} · {user.email}</div>
            <div className="mt-2.5 flex items-center gap-3">
              <span className="text-xs font-bold text-[var(--emerald-bright)] inline-flex items-center gap-1">
                <Award className="w-4 h-4" /> {user.points} نقطة
              </span>
              {user.role === 'member' && user.points < 250 && (
                <div className="w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl text-xs font-bold border border-rose-500/35 text-rose-300 hover:bg-rose-500/15 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'bookmarks', label: 'المفضلة المحفوظة', icon: Bookmark },
          { id: 'topics', label: `مواضيعي (${myTopics.length})`, icon: MessageSquare },
          { id: 'notifications', label: `الإشعارات (${notifications.filter((n) => !n.is_read).length})`, icon: Bell },
          { id: 'settings', label: 'تعديل الملف الشخصي', icon: Save },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setSearchParams({ tab: item.id });
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === item.id
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white'
                  : 'glass-card text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'bookmarks' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-5 space-y-2.5">
            <h2 className="font-bold text-sm text-[var(--gold)]">الأحاديث المحفوظة ({bookmarks.hadiths.length})</h2>
            {bookmarks.hadiths.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">لا توجد أحاديث محفوظة.</p>
            ) : (
              bookmarks.hadiths.map((h) => (
                <Link key={h.id} to={`/hadiths?q=${encodeURIComponent(h.title)}`} className="block glass-card rounded-xl p-3 text-xs">
                  <div className="font-bold">{h.title}</div>
                  <div className="text-[var(--text-muted)] line-clamp-1">{h.text_diacritics}</div>
                </Link>
              ))
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-2.5">
            <h2 className="font-bold text-sm text-[var(--emerald-bright)]">القصص والمواعظ ({bookmarks.stories.length + bookmarks.sermons.length})</h2>
            {bookmarks.stories.length + bookmarks.sermons.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">لا توجد قصص أو مواعظ محفوظة.</p>
            ) : (
              <>
                {bookmarks.stories.map((s) => (
                  <Link key={`s-${s.id}`} to={`/stories/${s.slug}`} className="block glass-card rounded-xl p-3 text-xs">
                    <span className="text-[var(--emerald-bright)] font-bold">قصة: </span>
                    {s.title}
                  </Link>
                ))}
                {bookmarks.sermons.map((m) => (
                  <Link key={`m-${m.id}`} to={`/sermons?q=${encodeURIComponent(m.title)}`} className="block glass-card rounded-xl p-3 text-xs">
                    <span className="text-[var(--gold)] font-bold">موعظة: </span>
                    {m.title}
                  </Link>
                ))}
              </>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5 space-y-2.5 md:col-span-2">
            <h2 className="font-bold text-sm text-[var(--gold)]">مواضيع المنتدى المحفوظة ({bookmarks.topics.length})</h2>
            {bookmarks.topics.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">لا توجد مواضيع منتدى محفوظة.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {bookmarks.topics.map((t) => (
                  <Link key={t.id} to={`/forum/topic/${t.id}`} className="block glass-card rounded-xl p-3 text-xs">
                    <div className="font-bold">{t.title}</div>
                    <div className="text-[var(--text-muted)]">{t.category_name}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'topics' && (
        <div className="glass-panel rounded-3xl p-5 space-y-3">
          {myTopics.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">لم تنشر مواضيع في المنتدى بعد.</p>
          ) : (
            myTopics.map((t) => (
              <Link key={t.id} to={`/forum/topic/${t.id}`} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm">{t.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">{t.category_name} · {formatDateAr(t.created_at)}</div>
                </div>
                <span className="text-xs font-bold text-[var(--emerald-bright)]">💬 {t.replies_count}</span>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="glass-panel rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-[var(--gold)]">التنبيهات</h2>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-bold text-[var(--emerald-bright)] inline-flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>تحديد الكل كمقروء</span>
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">لا توجد إشعارات حالياً.</p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                to={n.link}
                className={`block rounded-2xl p-3.5 border text-xs ${
                  n.is_read ? 'glass-card' : 'gold-card border-[var(--gold)]'
                }`}
              >
                <div className="font-bold">{n.title}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-1">{formatDateAr(n.created_at)}</div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={saveProfile} className="glass-panel rounded-3xl p-6 max-w-lg space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">الاسم الظاهر</label>
            <input
              required
              value={profileForm.display_name}
              onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">نبذة تعريفية</label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white cursor-pointer"
          >
            حفظ التغييرات
          </button>
        </form>
      )}
    </div>
  );
}
