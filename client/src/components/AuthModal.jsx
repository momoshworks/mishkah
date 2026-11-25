import { useEffect, useState } from 'react';
import { X, Sparkles, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function AuthModal() {
  const { authModalOpen, authModalMode, closeAuthModal, login, register, demoLogin, demoMode } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState(authModalMode);
  const [form, setForm] = useState({ username: '', display_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(authModalMode);
    setError('');
  }, [authModalMode, authModalOpen]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const u = await login(form.email, form.password);
        showToast(`مرحباً بعودتك يا ${u.display_name}`);
      } else {
        const u = await register(form);
        showToast(`أهلاً بك في مشكاة يا ${u.display_name}`);
      }
    } catch (err) {
      setError(err.message || 'تعذر إتمام الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async (role) => {
    setError('');
    setSubmitting(true);
    try {
      const u = await demoLogin(role);
      showToast(`تم الدخول بحساب ${u.display_name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-[var(--border-gold)] relative">
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute left-4 top-4 p-2 rounded-xl hover:bg-white/10 text-[var(--text-muted)] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="font-amiri text-3xl font-bold text-[var(--gold)]">۞ مِشكاة</div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            انضم إلى مجالس الذكر والحوار الديني الهادف
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/20 border border-[var(--border-subtle)] mb-5">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
              mode === 'login' ? 'bg-[var(--emerald)] text-white' : 'text-[var(--text-secondary)]'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
              mode === 'register' ? 'bg-[var(--emerald)] text-white' : 'text-[var(--text-secondary)]'
            }`}
          >
            حساب جديد
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-500/15 border border-rose-400/40 px-3.5 py-2.5 text-xs text-rose-200 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  اسم المستخدم (بالإنجليزية)
                </label>
                <input
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="مثال: ahmad_noor"
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  الاسم الظاهر
                </label>
                <input
                  required
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="مثال: أحمد الصالح"
                  className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              {mode === 'login' ? 'البريد الإلكتروني أو اسم المستخدم' : 'البريد الإلكتروني'}
            </label>
            <input
              required
              type={mode === 'register' ? 'email' : 'text'}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              كلمة المرور
            </label>
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="w-full input-mishkah rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg transition cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'جارٍ المتابعة...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </form>

        {demoMode && (
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-[11px] font-bold text-[var(--gold)] mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>دخول سريع للتجربة المحلية:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemo('member')}
                className="px-2 py-2 rounded-xl text-[11px] font-bold bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] cursor-pointer flex flex-col items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>عضو نشط</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemo('moderator')}
                className="px-2 py-2 rounded-xl text-[11px] font-bold bg-white/5 hover:bg-white/10 border border-[var(--border-subtle)] cursor-pointer flex flex-col items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>مشرف</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleDemo('admin')}
                className="px-2 py-2 rounded-xl text-[11px] font-bold bg-[var(--gold-soft)] hover:bg-amber-500/25 border border-[var(--border-gold)] text-[var(--gold)] cursor-pointer flex flex-col items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>مدير عام</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
