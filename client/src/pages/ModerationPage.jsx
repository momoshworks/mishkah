import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  BookOpen,
  CheckCircle,
  Eye,
  EyeOff,
  Flag,
  Flame,
  Plus,
  ScrollText,
  Shield,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function ModerationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';
  const isStaff = user && ['moderator', 'admin'].includes(user.role);

  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [cmsSub, setCmsSub] = useState('hadiths');
  const [cmsItems, setCmsItems] = useState([]);
  const [categories, setCategories] = useState([]);

  // Forms for CMS
  const [hadithForm, setHadithForm] = useState({
    id: null,
    title: '',
    text_diacritics: '',
    narrator: '',
    source: '',
    grade: 'صحيح',
    category: 'الأخلاق والمعاملات',
    explanation: '',
    benefitsText: '',
    mood_tags: ['serenity'],
    is_featured: false,
    is_published: true,
  });
  const [storyForm, setStoryForm] = useState({
    id: null,
    title: '',
    category: 'lessons',
    summary: '',
    paragraphsText: '',
    lessonsText: '',
    reading_minutes: 4,
    mood_tags: ['serenity'],
    is_published: true,
  });
  const [sermonForm, setSermonForm] = useState({
    id: null,
    title: '',
    category: 'السكينة والطمأنينة',
    excerpt: '',
    paragraphsText: '',
    reflection_question: '',
    reading_minutes: 3,
    mood_tags: ['serenity'],
    is_published: true,
  });
  const [catForm, setCatForm] = useState({ slug: '', name: '', description: '', sort_order: 10 });

  const loadReportsAndUsers = async () => {
    const [rp, us] = await Promise.all([apiFetch('/api/moderation/reports'), apiFetch('/api/moderation/users')]);
    setReports(rp.items || []);
    setUsers(us.items || []);
  };

  const loadCms = async (sub = cmsSub) => {
    if (!isAdmin) return;
    if (sub === 'categories') {
      const res = await apiFetch('/api/forum/categories');
      setCategories(res.items || []);
    } else {
      const res = await apiFetch(`/api/admin/${sub}`);
      setCmsItems(res.items || []);
    }
  };

  useEffect(() => {
    if (!isStaff) return;
    loadReportsAndUsers().catch(() => {});
  }, [isStaff]);

  useEffect(() => {
    if (tab === 'cms' && isAdmin) loadCms(cmsSub).catch(() => {});
  }, [tab, cmsSub, isAdmin]);

  if (!isStaff) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center text-sm text-rose-300">
        هذه الصفحة مخصصة للمشرفين والمديرين فقط.
      </div>
    );
  }

  const handleReport = async (id, status, hideTarget) => {
    try {
      await apiFetch(`/api/moderation/reports/${id}`, {
        method: 'PATCH',
        body: { status, hideTarget },
      });
      showToast(hideTarget ? 'تم إخفاء المحتوى وإغلاق البلاغ' : 'تم تحديث حالة البلاغ');
      await loadReportsAndUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBanToggle = async (targetUser) => {
    const reason = targetUser.is_banned ? '' : window.prompt('سبب الحظر:', 'مخالفة ضوابط الحوار') || 'مخالفة الضوابط';
    try {
      await apiFetch(`/api/moderation/users/${targetUser.id}/ban`, {
        method: 'PATCH',
        body: { is_banned: !targetUser.is_banned, ban_reason: reason },
      });
      showToast(targetUser.is_banned ? 'تم فك حظر العضو' : 'تم حظر العضو وإلغاء جلساته');
      await loadReportsAndUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRoleToggle = async (targetUser) => {
    const nextRole = targetUser.role === 'moderator' ? 'member' : 'moderator';
    try {
      await apiFetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        body: { role: nextRole },
      });
      showToast(`تم تغيير رتبة ${targetUser.display_name} إلى ${nextRole === 'moderator' ? 'مشرف' : 'عضو'}`);
      await loadReportsAndUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitHadith = async (e) => {
    e.preventDefault();
    const benefits = hadithForm.benefitsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { ...hadithForm, benefits };
    try {
      if (hadithForm.id) {
        await apiFetch(`/api/admin/hadiths/${hadithForm.id}`, { method: 'PATCH', body: payload });
        showToast('تم تحديث الحديث');
      } else {
        await apiFetch('/api/admin/hadiths', { method: 'POST', body: payload });
        showToast('تمت إضافة الحديث للمكتبة');
      }
      setHadithForm({
        id: null,
        title: '',
        text_diacritics: '',
        narrator: '',
        source: '',
        grade: 'صحيح',
        category: 'الأخلاق والمعاملات',
        explanation: '',
        benefitsText: '',
        mood_tags: ['serenity'],
        is_featured: false,
        is_published: true,
      });
      await loadCms('hadiths');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitStory = async (e) => {
    e.preventDefault();
    const paragraphs = storyForm.paragraphsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const lessons = storyForm.lessonsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { ...storyForm, paragraphs, lessons };
    try {
      if (storyForm.id) {
        await apiFetch(`/api/admin/stories/${storyForm.id}`, { method: 'PATCH', body: payload });
        showToast('تم تحديث القصة');
      } else {
        await apiFetch('/api/admin/stories', { method: 'POST', body: payload });
        showToast('تمت إضافة القصة');
      }
      setStoryForm({
        id: null,
        title: '',
        category: 'lessons',
        summary: '',
        paragraphsText: '',
        lessonsText: '',
        reading_minutes: 4,
        mood_tags: ['serenity'],
        is_published: true,
      });
      await loadCms('stories');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitSermon = async (e) => {
    e.preventDefault();
    const body_paragraphs = sermonForm.paragraphsText.split('\n').map((s) => s.trim()).filter(Boolean);
    const payload = { ...sermonForm, body_paragraphs };
    try {
      if (sermonForm.id) {
        await apiFetch(`/api/admin/sermons/${sermonForm.id}`, { method: 'PATCH', body: payload });
        showToast('تم تحديث الموعظة');
      } else {
        await apiFetch('/api/admin/sermons', { method: 'POST', body: payload });
        showToast('تمت إضافة الموعظة');
      }
      setSermonForm({
        id: null,
        title: '',
        category: 'السكينة والطمأنينة',
        excerpt: '',
        paragraphsText: '',
        reflection_question: '',
        reading_minutes: 3,
        mood_tags: ['serenity'],
        is_published: true,
      });
      await loadCms('sermons');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const submitCategory = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/categories', { method: 'POST', body: catForm });
      showToast('تم إنشاء قسم جديد في المنتدى');
      setCatForm({ slug: '', name: '', description: '', sort_order: 10 });
      await loadCms('categories');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const togglePublish = async (type, item) => {
    try {
      await apiFetch(`/api/admin/${type}/${item.id}`, {
        method: 'PATCH',
        body: { is_published: !item.is_published },
      });
      showToast(item.is_published ? 'تم إخفاء العنصر من المكتبة' : 'تم نشر العنصر');
      await loadCms(type);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteCmsItem = async (type, id) => {
    try {
      await apiFetch(`/api/admin/${type}/${id}`, { method: 'DELETE' });
      showToast('تم الحذف');
      await loadCms(type);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="glass-panel rounded-3xl p-6 border border-[var(--border-gold)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--gold)] flex items-center gap-2">
            <Shield className="w-6 h-6" />
            <span>لوحة الإشراف وإدارة المنصة</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            مراجعة بلاغات الأعضاء، إدارة الحسابات، {isAdmin ? 'وإضافة/تعديل محتوى المكتبة الإسلامية.' : 'وضبط المنتدى.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'reports' ? 'bg-[var(--emerald)] text-white' : 'glass-card text-[var(--text-secondary)]'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>البلاغات ({reports.filter((r) => r.status === 'open').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
              tab === 'users' ? 'bg-[var(--emerald)] text-white' : 'glass-card text-[var(--text-secondary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>الأعضاء ({users.length})</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTab('cms')}
              className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                tab === 'cms' ? 'bg-amber-500 text-slate-950' : 'glass-card text-[var(--gold)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>إدارة محتوى المكتبة (CMS)</span>
            </button>
          )}
        </div>
      </div>

      {/* Reports Tab */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="glass-panel rounded-3xl p-8 text-center text-xs text-[var(--text-muted)]">
              لا توجد بلاغات مسجلة حالياً.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="glass-card rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold ${
                        r.status === 'open'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {r.status === 'open' ? 'مفتوح' : r.status === 'resolved' ? 'تمت المعالجة' : 'مرفوض'}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      بلاغ من {r.reporter_name} على {r.target_type === 'topic' ? 'موضوع' : 'رد'}
                    </span>
                  </div>
                  <div className="font-bold text-sm">{r.targetPreview}</div>
                  <div className="text-xs text-rose-300">السبب: {r.reason}</div>
                  {r.topicId && (
                    <Link to={`/forum/topic/${r.topicId}`} className="text-[11px] text-[var(--gold)] underline">
                      معاينة الموضوع ←
                    </Link>
                  )}
                </div>

                {r.status === 'open' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleReport(r.id, 'resolved', true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>إخفاء وإغلاق</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReport(r.id, 'dismissed', false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[var(--border-subtle)] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رفض البلاغ</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="glass-panel rounded-3xl p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                <th className="py-3 px-2">العضو</th>
                <th className="py-3 px-2">الرتبة / الشارة</th>
                <th className="py-3 px-2">النقاط</th>
                <th className="py-3 px-2">الحالة</th>
                <th className="py-3 px-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 px-2">
                    <div className="font-bold text-sm">{u.display_name}</div>
                    <div className="text-[var(--text-muted)]">{u.email}</div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--emerald-soft)] text-[var(--emerald-bright)] font-bold">
                      {u.badge}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-bold text-[var(--gold)]">{u.points}</td>
                  <td className="py-3 px-2">
                    {u.is_banned ? (
                      <span className="text-rose-400 font-bold">محظور ({u.ban_reason})</span>
                    ) : (
                      <span className="text-emerald-400 font-bold">نشط</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-2">
                      {u.role !== 'admin' && u.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleBanToggle(u)}
                          className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer ${
                            u.is_banned
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {u.is_banned ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                          <span>{u.is_banned ? 'فك الحظر' : 'حظر'}</span>
                        </button>
                      )}
                      {isAdmin && u.role !== 'admin' && u.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleRoleToggle(u)}
                          className="px-2.5 py-1 rounded-lg font-bold bg-[var(--gold-soft)] text-[var(--gold)] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{u.role === 'moderator' ? 'إرجاع لعضو' : 'ترقية لمشرف'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin CMS Tab */}
      {tab === 'cms' && isAdmin && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'hadiths', label: 'الأحاديث', icon: ScrollText },
              { id: 'stories', label: 'القصص', icon: BookOpen },
              { id: 'sermons', label: 'المواعظ', icon: Flame },
              { id: 'categories', label: 'أقسام المنتدى', icon: Plus },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCmsSub(s.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    cmsSub === s.id ? 'bg-[var(--gold)] text-slate-950' : 'glass-card text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {cmsSub === 'hadiths' && (
            <div className="grid lg:grid-cols-12 gap-5">
              <form onSubmit={submitHadith} className="lg:col-span-5 glass-panel rounded-3xl p-5 space-y-3 h-fit">
                <h2 className="font-extrabold text-sm text-[var(--gold)]">
                  {hadithForm.id ? 'تعديل حديث' : 'إضافة حديث نبوي جديد'}
                </h2>
                <input required placeholder="عنوان الحديث" value={hadithForm.title} onChange={(e) => setHadithForm({ ...hadithForm, title: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea required rows={3} placeholder="نص الحديث بالتشكيل" value={hadithForm.text_diacritics} onChange={(e) => setHadithForm({ ...hadithForm, text_diacritics: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="الراوي" value={hadithForm.narrator} onChange={(e) => setHadithForm({ ...hadithForm, narrator: e.target.value })} className="input-mishkah rounded-xl px-3 py-2 text-xs" />
                  <input required placeholder="الدرجة (متفق عليه...)" value={hadithForm.grade} onChange={(e) => setHadithForm({ ...hadithForm, grade: e.target.value })} className="input-mishkah rounded-xl px-3 py-2 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input required placeholder="المصدر" value={hadithForm.source} onChange={(e) => setHadithForm({ ...hadithForm, source: e.target.value })} className="input-mishkah rounded-xl px-3 py-2 text-xs" />
                  <input required placeholder="التصنيف" value={hadithForm.category} onChange={(e) => setHadithForm({ ...hadithForm, category: e.target.value })} className="input-mishkah rounded-xl px-3 py-2 text-xs" />
                </div>
                <textarea required rows={2} placeholder="الشرح المبسط" value={hadithForm.explanation} onChange={(e) => setHadithForm({ ...hadithForm, explanation: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea rows={2} placeholder="فوائد (كل فائدة في سطر)" value={hadithForm.benefitsText} onChange={(e) => setHadithForm({ ...hadithForm, benefitsText: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={hadithForm.is_featured} onChange={(e) => setHadithForm({ ...hadithForm, is_featured: e.target.checked })} />
                  <span>تمييز كحديث اليوم في الرئيسية</span>
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer">
                    {hadithForm.id ? 'تحديث' : 'إضافة الحديث'}
                  </button>
                  {hadithForm.id && (
                    <button
                      type="button"
                      onClick={() =>
                        setHadithForm({
                          id: null, title: '', text_diacritics: '', narrator: '', source: '', grade: 'صحيح',
                          category: 'الأخلاق والمعاملات', explanation: '', benefitsText: '', mood_tags: ['serenity'], is_featured: false, is_published: true,
                        })
                      }
                      className="px-3 py-2 rounded-xl text-xs border border-[var(--border-subtle)] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-7 space-y-2.5 max-h-[70vh] overflow-y-auto">
                {cmsItems.map((item) => (
                  <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm">{item.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{item.source} · {item.grade}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setHadithForm({
                            ...item,
                            benefitsText: (item.benefits || []).join('\n'),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs border border-[var(--border-subtle)] cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePublish('hadiths', item)}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white/5 cursor-pointer"
                      >
                        {item.is_published ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCmsItem('hadiths', item.id)}
                        className="px-2.5 py-1 rounded-lg text-xs text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cmsSub === 'stories' && (
            <div className="grid lg:grid-cols-12 gap-5">
              <form onSubmit={submitStory} className="lg:col-span-5 glass-panel rounded-3xl p-5 space-y-3 h-fit">
                <h2 className="font-extrabold text-sm text-[var(--gold)]">
                  {storyForm.id ? 'تعديل قصة' : 'إضافة قصة إسلامية جديدة'}
                </h2>
                <input required placeholder="عنوان القصة" value={storyForm.title} onChange={(e) => setStoryForm({ ...storyForm, title: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <select value={storyForm.category} onChange={(e) => setStoryForm({ ...storyForm, category: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs">
                  <option value="prophets">قصص الأنبياء</option>
                  <option value="companions">سير الصحابة</option>
                  <option value="seerah">السيرة النبوية</option>
                  <option value="lessons">قصص وعبر</option>
                </select>
                <textarea required rows={2} placeholder="ملخص القصة" value={storyForm.summary} onChange={(e) => setStoryForm({ ...storyForm, summary: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea required rows={4} placeholder="فقرات القصة (كل فقرة في سطر)" value={storyForm.paragraphsText} onChange={(e) => setStoryForm({ ...storyForm, paragraphsText: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea rows={2} placeholder="الدروس المستفادة (كل درس في سطر)" value={storyForm.lessonsText} onChange={(e) => setStoryForm({ ...storyForm, lessonsText: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer">
                  {storyForm.id ? 'تحديث القصة' : 'إضافة القصة'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-2.5 max-h-[70vh] overflow-y-auto">
                {cmsItems.map((item) => (
                  <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm">{item.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)] line-clamp-1">{item.summary}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setStoryForm({
                            ...item,
                            paragraphsText: (item.paragraphs || []).join('\n'),
                            lessonsText: (item.lessons || []).join('\n'),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs border border-[var(--border-subtle)] cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button type="button" onClick={() => togglePublish('stories', item)} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 cursor-pointer">
                        {item.is_published ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                      <button type="button" onClick={() => deleteCmsItem('stories', item.id)} className="px-2.5 py-1 rounded-lg text-xs text-rose-400 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cmsSub === 'sermons' && (
            <div className="grid lg:grid-cols-12 gap-5">
              <form onSubmit={submitSermon} className="lg:col-span-5 glass-panel rounded-3xl p-5 space-y-3 h-fit">
                <h2 className="font-extrabold text-sm text-[var(--gold)]">
                  {sermonForm.id ? 'تعديل موعظة' : 'إضافة موعظة جديدة'}
                </h2>
                <input required placeholder="عنوان الموعظة" value={sermonForm.title} onChange={(e) => setSermonForm({ ...sermonForm, title: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <input required placeholder="التصنيف" value={sermonForm.category} onChange={(e) => setSermonForm({ ...sermonForm, category: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea required rows={2} placeholder="مقتطف قصير" value={sermonForm.excerpt} onChange={(e) => setSermonForm({ ...sermonForm, excerpt: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea required rows={4} placeholder="فقرات الموعظة (كل فقرة في سطر)" value={sermonForm.paragraphsText} onChange={(e) => setSermonForm({ ...sermonForm, paragraphsText: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <input placeholder="سؤال تأملي في الختام" value={sermonForm.reflection_question} onChange={(e) => setSermonForm({ ...sermonForm, reflection_question: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer">
                  {sermonForm.id ? 'تحديث الموعظة' : 'إضافة الموعظة'}
                </button>
              </form>

              <div className="lg:col-span-7 space-y-2.5 max-h-[70vh] overflow-y-auto">
                {cmsItems.map((item) => (
                  <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm">{item.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{item.category}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setSermonForm({
                            ...item,
                            paragraphsText: (item.body_paragraphs || []).join('\n'),
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs border border-[var(--border-subtle)] cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button type="button" onClick={() => togglePublish('sermons', item)} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 cursor-pointer">
                        {item.is_published ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                      </button>
                      <button type="button" onClick={() => deleteCmsItem('sermons', item.id)} className="px-2.5 py-1 rounded-lg text-xs text-rose-400 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cmsSub === 'categories' && (
            <div className="grid lg:grid-cols-12 gap-5">
              <form onSubmit={submitCategory} className="lg:col-span-5 glass-panel rounded-3xl p-5 space-y-3 h-fit">
                <h2 className="font-extrabold text-sm text-[var(--gold)]">إضافة قسم منتدى جديد</h2>
                <input required placeholder="المعرف الإنجليزي (مثال: seerah-circle)" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <input required placeholder="اسم القسم" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <textarea required rows={3} placeholder="وصف القسم" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} className="w-full input-mishkah rounded-xl px-3 py-2 text-xs" />
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer">
                  إضافة القسم
                </button>
              </form>
              <div className="lg:col-span-7 space-y-2.5">
                {categories.map((c) => (
                  <div key={c.id} className="glass-card rounded-2xl p-4">
                    <div className="font-bold text-sm">{c.name} <span className="text-[11px] text-[var(--text-muted)]">({c.slug})</span></div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
