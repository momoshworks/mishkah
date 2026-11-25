import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Compass,
  Flame,
  Home,
  LogIn,
  Menu,
  MessageSquareText,
  Moon,
  ScrollText,
  Search,
  Shield,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch } from '../api/client.js';

const NAV_LINKS = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/hadiths', label: 'الأحاديث', icon: ScrollText },
  { to: '/stories', label: 'القصص', icon: BookOpen },
  { to: '/sermons', label: 'المواعظ', icon: Flame },
  { to: '/forum', label: 'المنتدى', icon: MessageSquareText },
];

export default function Navbar() {
  const { user, unreadNotifications, openAuthModal } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        setResults(data);
        setSearchOpen(true);
      } catch {
        setResults(null);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults =
    results &&
    (results.hadiths.length > 0 ||
      results.stories.length > 0 ||
      results.sermons.length > 0 ||
      results.topics.length > 0);

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500/25 to-amber-400/25 border border-[var(--border-gold)] shadow-lg group-hover:scale-105 transition">
            <svg viewBox="0 0 36 36" className="w-6 h-6 text-[var(--gold)]" fill="none">
              <path
                d="M18 3L21 9H15L18 3ZM12 11C12 9.5 14.5 8.5 18 8.5C21.5 8.5 24 9.5 24 11L26 22C26 25.5 22.5 28 18 28C13.5 28 10 25.5 10 22L12 11Z"
                stroke="currentColor"
                strokeWidth="2"
                fill="rgba(229, 190, 103, 0.16)"
              />
              <circle cx="18" cy="18" r="3" fill="currentColor" />
              <path d="M13 31H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="font-amiri text-2xl font-bold leading-none text-[var(--gold)]">مِشكاة</div>
            <div className="text-[10px] text-[var(--text-muted)] tracking-wide">مكتبة ومنتدى ديني</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition ${
                    isActive
                      ? 'bg-[var(--emerald-soft)] text-[var(--emerald-bright)] border border-[var(--border-gold)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {user && (user.role === 'moderator' || user.role === 'admin') && (
            <NavLink
              to="/moderation"
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-[var(--gold-soft)] text-[var(--gold)] border border-[var(--border-gold)]'
                    : 'text-[var(--gold)]/80 hover:text-[var(--gold)] hover:bg-white/5'
                }`
              }
            >
              <Shield className="w-4 h-4" />
              <span>لوحة التحكم</span>
            </NavLink>
          )}
        </nav>

        {/* Search Box */}
        <div ref={searchRef} className="relative flex-1 max-w-xs hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => results && setSearchOpen(true)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الأحاديث والقصص والمنتدى..."
              className="w-full input-mishkah rounded-xl pr-9 pl-3 py-2 text-xs"
            />
          </div>
          {searchOpen && query.trim() && (
            <div className="absolute top-full mt-2 right-0 left-0 w-96 max-w-[90vw] glass-panel rounded-2xl p-3 shadow-2xl border border-[var(--border-gold)] max-h-96 overflow-y-auto z-50">
              {!hasResults ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  لا توجد نتائج مطابقة لـ «{query}»
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  {results.hadiths.length > 0 && (
                    <div>
                      <div className="text-[var(--gold)] font-bold mb-1">الأحاديث</div>
                      {results.hadiths.slice(0, 3).map((h) => (
                        <button
                          key={`h-${h.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(`/hadiths?q=${encodeURIComponent(query)}`);
                          }}
                          className="w-full text-right p-2 rounded-lg hover:bg-white/5 block"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">{h.title}</div>
                          <div className="text-[var(--text-muted)] line-clamp-1">{h.text_diacritics}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.stories.length > 0 && (
                    <div>
                      <div className="text-[var(--emerald-bright)] font-bold mb-1">القصص</div>
                      {results.stories.slice(0, 3).map((s) => (
                        <button
                          key={`s-${s.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(`/stories/${s.slug}`);
                          }}
                          className="w-full text-right p-2 rounded-lg hover:bg-white/5 block"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">{s.title}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.sermons.length > 0 && (
                    <div>
                      <div className="text-[var(--gold)] font-bold mb-1">المواعظ</div>
                      {results.sermons.slice(0, 3).map((m) => (
                        <button
                          key={`m-${m.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(`/sermons?q=${encodeURIComponent(query)}`);
                          }}
                          className="w-full text-right p-2 rounded-lg hover:bg-white/5 block"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">{m.title}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {results.topics.length > 0 && (
                    <div>
                      <div className="text-[var(--emerald-bright)] font-bold mb-1">نقاشات المنتدى</div>
                      {results.topics.slice(0, 3).map((t) => (
                        <button
                          key={`t-${t.id}`}
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(`/forum/topic/${t.id}`);
                          }}
                          className="w-full text-right p-2 rounded-lg hover:bg-white/5 block"
                        >
                          <div className="font-semibold text-[var(--text-primary)]">{t.title}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
            className="p-2 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-[var(--gold)] transition cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <>
              <Link
                to="/profile?tab=notifications"
                className="relative p-2 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                title="الإشعارات"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -left-1 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </span>
                )}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-gold)] bg-[var(--emerald-soft)] hover:bg-[var(--gold-soft)] transition"
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-950"
                  style={{ backgroundColor: user.avatar_color || '#10b981' }}
                >
                  {user.display_name?.[0] || <User className="w-3 h-3" />}
                </span>
                <span className="hidden sm:inline text-xs font-bold">{user.display_name}</span>
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول / تسجيل</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] cursor-pointer"
            aria-label="القائمة"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--border-subtle)] px-4 py-3 space-y-2 glass-panel">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                setMobileOpen(false);
                navigate(`/hadiths?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="ابحث في الأحاديث..."
            className="w-full input-mishkah rounded-xl px-3 py-2 text-xs mb-2"
          />
          <div className="grid grid-cols-2 gap-2">
            {NAV_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      isActive
                        ? 'bg-[var(--emerald-soft)] text-[var(--emerald-bright)] border border-[var(--border-gold)]'
                        : 'bg-white/5 text-[var(--text-secondary)]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            {user && (user.role === 'moderator' || user.role === 'admin') && (
              <NavLink
                to="/moderation"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 bg-[var(--gold-soft)] text-[var(--gold)]"
              >
                <Compass className="w-4 h-4" />
                <span>لوحة التحكم</span>
              </NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
