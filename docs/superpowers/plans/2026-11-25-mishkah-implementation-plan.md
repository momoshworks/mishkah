# Mishkah («مِشكاة») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **«مِشكاة» (Mishkah)** — a full-stack Arabic RTL Islamic knowledge library (Hadiths, Stories, Sermons + Mood Companion + Dhikr Tasbih + Quote Card PNG generator) and integrated religious community forum (real accounts, nested replies, thanks votes, best answers, notifications, reporting, user bans, and Admin CMS) served from `D:\AntiyGravity\projects\mishkah` on port `8090`.

**Architecture:** A single unified Node.js (Express 5) backend using built-in `node:sqlite` (`DatabaseSync`) and `crypto.scryptSync` serves JSON APIs under `/api/*` and builds/serves a React 19 + Vite + Tailwind CSS v4 SPA from `client/dist` on port `8090`. Arabic normalization powers diacritic-insensitive search across all library and forum content, while `MISHKAH_DEMO_MODE=true` isolates local 1-click demo accounts from production deployments.

**Tech Stack:** Node.js `v26.13.1`, Express 5, `node:sqlite`, `node:test`, React + Vite + React Router + Tailwind CSS + Lucide React, Google Fonts (`Amiri` + `Cairo`).

**Spec:** `D:\AntiyGravity\projects\mishkah\docs\superpowers\specs\2026-11-25-mishkah-design.md`

## Global Constraints

- Directory & port: project lives at `D:\AntiyGravity\projects\mishkah`, runs on unified port `8090` (with Vite dev proxy on `5210` if needed), registered in `D:\AntiyGravity\projects\PORTS_REGISTRY.json`, with one-click Windows launcher `run_web.bat`.
- Zero native C++ build dependencies on Windows: use built-in `node:sqlite` (`DatabaseSync`) and `crypto.scryptSync` — never `better-sqlite3` or `bcrypt`.
- Full Arabic `dir="rtl" lang="ar"` experience using `Amiri` for religious texts/Hadiths and `Cairo` for UI, default Luminous Night Glass theme («مِشكاة») with persisted Light Mode toggle.
- Authentic Hadith attribution: all 24 seeded Hadiths carry full diacritics, narrator, exact source (Bukhari/Muslim/Muttafaqun 'Alayh/Nawawi/Riyad al-Salihin), grade, explanation, and benefits.
- Security separation: hardcoded demo users & 1-click demo login exist ONLY when `MISHKAH_DEMO_MODE=true` (active locally in `run_web.bat`, disabled by default in production); production bootstrap reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env; auth/write endpoints enforce rate limiting and `HttpOnly` cookies.

## Review Focus

- **Arabic search variants:** Searching `"انما الاعمال بالنيات"`, `"إنّما الأعمالُ"`, `"الصلاه"`, or `"الهدى"` must match diacritized texts containing `إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ`, `الصَّلَاة`, and `الهُدَى` alike.
- **Banned-user session invalidation:** Banning an active user must immediately delete their rows in `sessions` so subsequent requests with their existing cookie receive `401`/`403` and cannot post, reply, thank, or log back in.
- **Point & badge recalculation on hide/delete:** When a reply marked as `best_reply_id` or a thanked topic/reply is hidden by a moderator or deleted by its author, awarded points (`+10/+5/+3/+15`) and derived badges (`عضو جديد`, `مشارك نشط`, `محبّ للخير`, `طالب علم`) must recompute accurately and `best_reply_id` clear if the reply is hidden/deleted.
- **Demo mode gating:** When `MISHKAH_DEMO_MODE` is unset or `'false'`, `/api/auth/demo-login` must return `403`, `/api/auth/config` must report `demoMode: false`, and demo accounts must not be seeded.
- **Admin CMS malformed input validation:** Submitting empty titles/text or invalid JSON structures (`benefits`, `paragraphs`, `mood_tags`) to `POST/PATCH /api/admin/{hadiths,stories,sermons}` must return HTTP `400` with a clear Arabic validation message without corrupting SQLite.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | Root Express dependencies, scripts (`start`, `build`, `test`, `dev`) |
| `run_web.bat` | One-click Windows launcher (`MISHKAH_DEMO_MODE=true`, port `8090`, auto-open browser) |
| `server/arabic.js` & `client/src/utils/arabic.js` | Identical `normalizeArabic(str)` & `formatArabicNumber(n)` helpers |
| `server/db.js` | `openDatabase(dbPath)` with `node:sqlite`, PRAGMA setup, and all 12 tables + indexes |
| `server/auth.js` | `scrypt` password hashing, session token helpers, auth/role middleware, `recalculateUserPoints(db, userId)` |
| `server/rateLimit.js` | Sliding-window in-memory rate limiter middleware |
| `server/data/hadiths.json`, `stories.json`, `sermons.json`, `forum.json` | Curated Arabic content datasets |
| `server/seed.js` | Idempotent `seedDatabase(db, { demoMode, adminEmail, adminPassword })` |
| `server/routes/auth.js` | Register, login, demo-login (gated), logout, me, profile update, config |
| `server/routes/library.js` | Home summary, hadiths, stories, sermons, mood companion, bookmarks, unified search |
| `server/routes/forum.js` | Categories, topics, replies, edit/delete own, thanks toggle, best reply, reports, notifications |
| `server/routes/moderation.js` | Reports resolution, topic/reply pin/lock/hide, user ban/role, Admin Library CMS + categories |
| `server/app.js` & `server/index.js` | Express app factory (testable) and HTTP listener serving API + `client/dist` on `8090` |
| `client/index.html`, `client/vite.config.js`, `client/src/index.css` | RTL HTML shell, Vite proxy, Mishkah Luminous Night + Parchment Day theme CSS |
| `client/src/api/client.js`, `client/src/context/*` | API fetch helper, `AuthContext`, `ThemeContext` |
| `client/src/components/*` | `Navbar`, `AuthModal`, `TasbihWidget`, `MoodCompanion`, `QuoteCardModal`, `Toast` |
| `client/src/pages/*` | `Home`, `Hadiths`, `Stories`, `StoryDetail`, `Sermons`, `Forum`, `TopicDetail`, `Profile`, `Moderation` |
| `tests/*.test.js` | Automated `node:test` suites covering Arabic search, DB/auth, library, forum, moderation, CMS |

---

### Task 1: Project Scaffolding, Arabic Utilities, and `PORTS_REGISTRY.json`

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\package.json`
- Create: `D:\AntiyGravity\projects\mishkah\server\arabic.js`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\utils\arabic.js`
- Create: `D:\AntiyGravity\projects\mishkah\run_web.bat`
- Modify: `D:\AntiyGravity\projects\PORTS_REGISTRY.json`
- Test: `D:\AntiyGravity\projects\mishkah\tests\arabic.test.js`

**Interfaces:**
- Produces `server/arabic.js`:
  - `normalizeArabic(text: string): string`
  - `matchesArabicQuery(haystack: string, query: string): boolean`
- Produces `client/src/utils/arabic.js`:
  - `normalizeArabic(text: string): string`
  - `formatDateAr(isoString: string): string`

- [ ] **Step 1: Write the failing Arabic normalization tests**

Create `tests/arabic.test.js` using `node:test` and `node:assert/strict`:
- Test `'diacritics and tatweel stripped'`: `normalizeArabic('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ — صَلَّى')` equals `'انما الاعمال بالنيات صلى'` (with punctuation trimmed/normalized cleanly) or contains normalized tokens `'انما الاعمال بالنيات'`.
- Test `'hamza, taa marbuta, and alef maqsura variants'`:
  - `normalizeArabic('الصلاة على النبي') === normalizeArabic('الصلاه علي النبي')`
  - `normalizeArabic('أُحِبُّ الهدى والآخرة') === normalizeArabic('احب الهدي والاخره')`
- Test `'matchesArabicQuery handles multi-word queries and empty input'`:
  - `matchesArabicQuery('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', 'اعمال نيات')` -> `true` (all tokens present) or substring/token match. Let's pin: `matchesArabicQuery(haystack, query)` returns `true` when every whitespace-separated normalized token in `query` appears in `normalizeArabic(haystack)` (and returns `true` if `query` is empty/whitespace).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/arabic.test.js` in `D:\AntiyGravity\projects\mishkah`
Expected: FAIL (`Cannot find module '../server/arabic.js'`)

- [ ] **Step 3: Initialize project files, `server/arabic.js`, `client/src/utils/arabic.js`, `run_web.bat`, and update `PORTS_REGISTRY.json`**

- `package.json`: `"type": "module"`, scripts `start` (`node server/index.js`), `dev` (`node --watch server/index.js`), `build` (`npm --prefix client run build`), `test` (`node --test tests/*.test.js`), dependencies `express` (`^5.1.0`), `cookie-parser` (`^1.4.7`).
- `server/arabic.js`: implement `normalizeArabic(text)` removing tashkeel `[\u064B-\u065F\u0670\u06D6-\u06ED]`, tatweel `\u0640`, unifying `[أإآٱ]`->`ا`, `ى`->`ي`, `ة`->`ه`, `ؤ`->`و`, `ئ`->`ي`, stripping non-letter punctuation (keeping Arabic/ASCII alphanumeric + spaces), collapsing whitespace, lowercasing; and `matchesArabicQuery(haystack, query)`.
- `client/src/utils/arabic.js`: export `normalizeArabic` and `formatDateAr(isoString)` using `Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })`.
- `run_web.bat`: sets `MISHKAH_DEMO_MODE=true`, `PORT=8090`, starts `http://localhost:8090`, runs `node server/index.js`.
- Add `"mishkah"` entry to `D:\AntiyGravity\projects\PORTS_REGISTRY.json` on port `8090`.
- Install root npm dependencies (`npm install`) and scaffold `client` React + Vite + Tailwind CSS v4 + `lucide-react` + `react-router-dom`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/arabic.test.js`
Expected: PASS (all assertions green).

---

### Task 2: SQLite Schema (`node:sqlite`), Auth, Rate Limiter, and Points Engine

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\server\db.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\auth.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\rateLimit.js`
- Test: `D:\AntiyGravity\projects\mishkah\tests\auth-db.test.js`

**Interfaces:**
- Consumes: `server/arabic.js`
- Produces `server/db.js`:
  - `openDatabase(dbPath?: string): DatabaseSync` (runs schema + indexes; defaults to `data/mishkah.db`; supports `':memory:'`)
- Produces `server/auth.js`:
  - `hashPassword(password: string): string`
  - `verifyPassword(password: string, stored: string): boolean`
  - `computeBadge(points: number, role: string): string`
  - `recalculateUserPoints(db: DatabaseSync, userId: number): { points: number, badge: string }`
  - `createSession(db: DatabaseSync, userId: number): { rawToken: string, expiresAt: string }`
  - `deleteSessionByToken(db: DatabaseSync, rawToken: string): void`
  - `invalidateUserSessions(db: DatabaseSync, userId: number): void`
  - `attachAuth(db: DatabaseSync): RequestHandler` (sets `req.user` or `null`; if banned, deletes session and leaves `req.bannedSession = true`)
  - `requireAuth(req, res, next)` (401 if unauthenticated, 403 if banned)
  - `requireRole(...roles)` (401/403)
  - `setSessionCookie(req, res, rawToken, expiresAt)` / `clearSessionCookie(req, res)`
- Produces `server/rateLimit.js`:
  - `createRateLimiter({ windowMs, max }): RequestHandler`

- [ ] **Step 1: Write failing tests in `tests/auth-db.test.js`**

Test cases:
1. Schema creates all 12 expected tables in `:memory:` SQLite DB and enforces foreign keys (`PRAGMA foreign_keys = ON`).
2. `hashPassword` + `verifyPassword` verifies matching password, rejects wrong password, uses unique random salt per call.
3. `createSession` + `attachAuth` resolves non-banned user; `invalidateUserSessions` immediately invalidates cookie; setting `users.is_banned = 1` blocks auth with `403` and deletes active session.
4. `recalculateUserPoints` awards `+10` per active non-hidden topic, `+5` per active non-hidden reply, `+3` per thanks vote on non-hidden content, `+15` per non-hidden reply set as `best_reply_id`, and revokes points + updates badge when a topic/reply is marked `is_hidden = 1` or deleted.
5. `createRateLimiter({ windowMs: 60000, max: 2 })` allows 2 requests and returns `429` on the 3rd.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/auth-db.test.js`
Expected: FAIL (`Cannot find module '../server/db.js'`)

- [ ] **Step 3: Implement `server/db.js`, `server/auth.js`, and `server/rateLimit.js`**

Implement all 12 tables in `db.js` (including `is_published`, `created_by`, `updated_at` on library tables and `is_banned`, `ban_reason`, `banned_at` on `users`), implement `scryptSync` + `timingSafeEqual` + session & role middlewares + `recalculateUserPoints` in `auth.js`, and sliding-window limiter in `rateLimit.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/auth-db.test.js`
Expected: PASS.

---

### Task 3: Verified Arabic Content Datasets & Idempotent Seeder

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\server\data\hadiths.json` (24 verified authentic hadiths with full diacritics, exact source/book, narrator, grade, category, mood_tags, explanation, benefits)
- Create: `D:\AntiyGravity\projects\mishkah\server\data\stories.json` (12 complete Islamic stories: Prophets, Companions, Seerah, Lessons)
- Create: `D:\AntiyGravity\projects\mishkah\server\data\sermons.json` (15 soulful sermons with reflection questions & mood_tags)
- Create: `D:\AntiyGravity\projects\mishkah\server\data\forum.json` (5 forum categories, 8 rich initial topics including pinned & linked topics, 16 replies, sample thanks & best answers)
- Create: `D:\AntiyGravity\projects\mishkah\server\seed.js`
- Test: `D:\AntiyGravity\projects\mishkah\tests\seed.test.js`

**Interfaces:**
- Consumes: `server/db.js`, `server/auth.js`, `server/arabic.js`
- Produces `server/seed.js`:
  - `seedDatabase(db: DatabaseSync, options?: { demoMode?: boolean, adminEmail?: string, adminPassword?: string }): void`

- [ ] **Step 1: Write failing tests in `tests/seed.test.js`**

Test cases:
1. `seedDatabase(db, { demoMode: true })` populates exactly >= 24 hadiths, >= 12 stories, >= 15 sermons, >= 5 forum categories, >= 8 forum topics, >= 16 replies, and 4 demo users (1 admin, 1 moderator, 2 members), with non-empty `text_plain` normalized fields.
2. Calling `seedDatabase(db, { demoMode: true })` a second time is idempotent (row counts stay identical, no duplicate emails/slugs/topics).
3. `seedDatabase(db, { demoMode: false })` seeds the library and forum categories without creating hardcoded demo accounts or demo passwords; when `{ demoMode: false, adminEmail, adminPassword }` is passed, creates only that configured admin account.
4. Every seeded hadith has non-empty `text_diacritics`, `text_plain`, `narrator`, `source`, `grade`, `explanation`, and valid JSON `benefits_json` & `mood_tags`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/seed.test.js`
Expected: FAIL (`Cannot find module '../server/seed.js'`)

- [ ] **Step 3: Author verified `hadiths.json`, `stories.json`, `sermons.json`, `forum.json`, and implement `server/seed.js`**

Verify accuracy of every Hadith text, narrator, source book (Bukhari/Muslim/Muttafaqun 'Alayh/Al-Arba'in al-Nawawiyyah/Riyad al-Salihin), and grade; craft rich literary Arabic stories and sermons; implement idempotent transactional `seedDatabase` in `server/seed.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/seed.test.js`
Expected: PASS.

---

### Task 4: Express App, Auth, Library & Forum API Routes

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\server\routes\auth.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\routes\library.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\routes\forum.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\app.js`
- Create: `D:\AntiyGravity\projects\mishkah\server\index.js`
- Test: `D:\AntiyGravity\projects\mishkah\tests\api-library-forum.test.js`

**Interfaces:**
- Consumes: `server/db.js`, `server/auth.js`, `server/rateLimit.js`, `server/arabic.js`, `server/seed.js`
- Produces `server/app.js`:
  - `createApp(db: DatabaseSync, options?: { demoMode?: boolean, staticDir?: string, disableRateLimit?: boolean }): Express.Application`

- [ ] **Step 1: Write failing HTTP integration tests in `tests/api-library-forum.test.js`**

Using ephemeral `app.listen(0)` + native `fetch` with cookie persistence:
1. Auth & demo gating:
   - When `demoMode: false`, `GET /api/auth/config` returns `{ demoMode: false }`, and `POST /api/auth/demo-login` returns `403`.
   - Register (`POST /api/auth/register`) creates member, sets `HttpOnly` cookie, returns user profile; duplicate email returns `409`; login works and logout clears session.
2. Library & Arabic search:
   - `GET /api/hadiths?q=انما الاعمال` matches `"إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ..."` and `GET /api/hadiths?q=الصلاه` matches `الصَّلَاة`.
   - `GET /api/companion?mood=serenity` returns matching hadith, story, and sermon.
   - `POST /api/bookmarks/toggle` persists bookmark in DB and returns updated list on `GET /api/bookmarks`.
   - `GET /api/search?q=...` returns unified hits across hadiths, stories, sermons, and forum topics.
3. Forum lifecycle & points:
   - Authenticated user creates topic (`POST /api/forum/topics`), gets `+10` points; replies (`POST /api/forum/topics/:id/replies`) with `parent_reply_id`, triggers notification for topic author, adds `+5` points.
   - Another user toggles `POST /api/forum/thanks` (`+3` points to content author, toggling off removes `-3`).
   - Topic author sets `POST /api/forum/topics/:id/best-reply` (`+15` points to reply author).
   - Author edits own topic (`PATCH`) and deletes own reply (`DELETE`), verifying points decrease accordingly and non-authors receive `403`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/api-library-forum.test.js`
Expected: FAIL (`Cannot find module '../server/app.js'`)

- [ ] **Step 3: Implement `routes/auth.js`, `routes/library.js`, `routes/forum.js`, `app.js`, and `index.js`**

Include `trust proxy` configuration, JSON body limit (`1mb`), strict validation returning `400` Arabic messages, rate limiting on auth & write routes (with `disableRateLimit` option only for tests or high thresholds), and SPA fallback to `client/dist/index.html` when present.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/api-library-forum.test.js`
Expected: PASS.

---

### Task 5: Admin CMS & Moderation API (`routes/moderation.js`)

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\server\routes\moderation.js`
- Modify: `D:\AntiyGravity\projects\mishkah\server\app.js` (mount `/api/moderation` and `/api/admin`)
- Test: `D:\AntiyGravity\projects\mishkah\tests\moderation.test.js`

**Interfaces:**
- Consumes: `server/auth.js`, `server/arabic.js`, `server/routes/moderation.js`
- Produces: `/api/moderation/*` (for `moderator` + `admin`) and `/api/admin/*` (for `admin` only)

- [ ] **Step 1: Write failing tests in `tests/moderation.test.js`**

Test cases:
1. RBAC guards: `member` receives `403` on all `/api/moderation/*` and `/api/admin/*`; `moderator` succeeds on `/api/moderation/*` (reports, pin/lock/hide, ban member) but receives `403` on `/api/admin/*` (CMS & role promotion).
2. Ban enforcement: `moderator` bans a `member` via `PATCH /api/moderation/users/:id/ban`; banned member's existing cookie immediately fails `POST /api/forum/topics` (`403`) and cannot log in (`403`). Unbanning restores login.
3. Report & hide point revocation: hiding a topic or best reply via `PATCH /api/moderation/topics/:id` or `replies/:id` clears `best_reply_id` if needed and revokes the author's points & updates badge immediately.
4. Admin CMS: `admin` creates, updates, unpublishes (`is_published: 0`), and deletes hadith/story/sermon via `/api/admin/{hadiths,stories,sermons}`; unpublished items are hidden from public `/api/hadiths` while visible in admin list; malformed/missing fields (e.g. empty `title` or non-array `benefits`) return `400`.
5. Admin category management & role promotion: `admin` creates/updates forum category and promotes a member to `moderator`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/moderation.test.js`
Expected: FAIL (`404` on `/api/admin/hadiths` / missing `routes/moderation.js`)

- [ ] **Step 3: Implement `server/routes/moderation.js` and mount in `server/app.js`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/moderation.test.js`
Expected: PASS.

---

### Task 6: Frontend Shell, «المشكاة المضيئة» Theme, Light/Dark Toggle, Auth & Interactive Widgets

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\client\index.html`
- Create: `D:\AntiyGravity\projects\mishkah\client\vite.config.js`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\index.css`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\api\client.js`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\context\ThemeContext.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\context\AuthContext.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\utils\quoteCard.js`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\components\Navbar.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\components\AuthModal.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\components\TasbihWidget.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\components\MoodCompanion.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\components\QuoteCardModal.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\App.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\main.jsx`

**Interfaces:**
- Consumes backend `/api/auth/*`, `/api/companion`, `/api/notifications`, `/api/search`
- Produces shared contexts (`useAuth`, `useTheme`), `apiFetch(path, options)`, `generateQuoteCardDataUrl(item)`

- [ ] **Step 1: Set up `client/index.html`, `client/vite.config.js`, and `client/src/index.css`**

Configure `dir="rtl" lang="ar"`, load Google Fonts `Amiri` + `Cairo`, set Tailwind v4 + Mishkah Luminous Night Glass CSS variables (deep emerald/slate aurora, translucent glass borders, antique gold `#e5be67` accents, smooth geometric watermarks) plus Light Mode (`data-theme="light"`) warm ivory parchment variables.

- [ ] **Step 2: Implement `api/client.js`, `ThemeContext.jsx`, `AuthContext.jsx`, `utils/quoteCard.js`, and core components**

- `Navbar`: Mishkah lantern SVG logo, route links (الرئيسية، الأحاديث، القصص، المواعظ، المنتدى، لوحة التحكم للمشرف/المدير), global search bar dropdown/navigation, theme toggle (`☀ نهاري` / `🌙 مشكاة`), unread notifications bell, user badge/profile menu.
- `AuthModal`: Tabbed Login / Register forms + conditional 1-click Demo Login buttons shown ONLY when `/api/auth/config` returns `demoMode: true`.
- `TasbihWidget`: Interactive floating/dockable Dhikr counter with 5 phrases, target ring (33 / 100), reset, and `localStorage` persistence.
- `MoodCompanion`: Interactive heart-mood selector (`طمأنينة`، `همّ وضيق`، `توبة`، `صبر`، `همّة`) calling `/api/companion` to display matched Hadith + Story + Sermon cards with quick navigation.
- `QuoteCardModal`: Canvas-generated Mishkah quote card PNG preview, 1-click download PNG, and copy formatted Arabic text.

- [ ] **Step 3: Build frontend to verify zero syntax/Vite errors**

Run: `npm --prefix client run build`
Expected: `dist/` builds cleanly with exit code 0.

---

### Task 7: Frontend Library Pages (Home, Hadiths, Stories, Story Reader, Sermons)

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\HomePage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\HadithsPage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\StoriesPage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\StoryDetailPage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\SermonsPage.jsx`
- Modify: `D:\AntiyGravity\projects\mishkah\client\src\App.jsx` (wire routes)

- [ ] **Step 1: Implement `HomePage.jsx`**

Includes glowing Featured Daily Hadith hero with Arabesque geometry, «ناقش في المنتدى» / Quote Card / Bookmark buttons, `MoodCompanion` widget, curated Stories & Sermons showcase cards, live Forum active discussions feed, and platform community stats + clear disclaimer note about scholarly Fatwa sources.

- [ ] **Step 2: Implement `HadithsPage.jsx`, `StoriesPage.jsx`, `StoryDetailPage.jsx`, and `SermonsPage.jsx`**

- `HadithsPage`: instant Arabic search without diacritics, category + mood + grade filters, expandable explanation & benefits, bookmark toggle, `QuoteCardModal`, and «ناقش في المنتدى» button that navigates directly to existing linked forum topic or opens prefilled topic creation.
- `StoriesPage` & `StoryDetailPage`: visual category badges (الأنبياء، الصحابة، السيرة، قصص وعبر), reading time, scroll reading-progress bar, Arabic font-size controls (`A-` / `A+`), extracted lessons list, bookmark, and «ناقش في المنتدى».
- `SermonsPage`: soulful sermon cards, mood & topic filtering, interactive reflection prompt card, quote sharing, bookmark, and «ناقش في المنتدى».

- [ ] **Step 3: Build client and verify no errors**

Run: `npm --prefix client run build`
Expected: PASS (exit code 0).

---

### Task 8: Frontend Forum, Topic Thread, Profile, Admin CMS / Moderation Console & Final Verification

**Files:**
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\ForumPage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\TopicDetailPage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\ProfilePage.jsx`
- Create: `D:\AntiyGravity\projects\mishkah\client\src\pages\ModerationPage.jsx`
- Modify: `D:\AntiyGravity\projects\mishkah\client\src\App.jsx` (wire routes + search page/overlay if route-based)

- [ ] **Step 1: Implement `ForumPage.jsx` and `TopicDetailPage.jsx`**

- `ForumPage`: category cards/filters, sort tabs (`الأحدث`، `الأكثر تفاعلاً`، `بانتظار إجابة`، `المثبتة`), tag filtering, search, New Topic modal (supporting pre-filled `linked_type` + `linked_id` from URL params).
- `TopicDetailPage`: topic header with badges (pinned/locked/best-answer solved), linked Hadith/Story/Sermon embed card if present, author profile badge/points, «جزاك الله خيراً» button, edit/delete for author, mod controls (pin/lock/hide), nested replies (reply to topic or reply to specific reply), mark best answer, report dialog.

- [ ] **Step 2: Implement `ProfilePage.jsx` and `ModerationPage.jsx`**

- `ProfilePage`: user summary, points & next-badge progress bar, editable display name/bio, tabs for Bookmarks, My Topics, and Notifications (with mark-as-read).
- `ModerationPage`:
  - **Reports tab** (`moderator` & `admin`): inspect open/resolved reports, hide violating content or dismiss report.
  - **Members tab** (`moderator` & `admin`): search members, ban/unban with reason; (`admin` only): promote/demote `moderator`.
  - **Library CMS tab** (`admin` only): full CRUD forms + publish/unpublish toggle for Hadiths, Stories, Sermons, and Forum Categories.

- [ ] **Step 3: Run full test suite and production build**

Run: `npm test && npm run build` in `D:\AntiyGravity\projects\mishkah`
Expected: All `node:test` suites pass 100%, and `client/dist` builds cleanly.

- [ ] **Step 4: Live server & browser E2E verification**

Start the production server on port `8090` (`MISHKAH_DEMO_MODE=true node server/index.js`) and verify via `browser` subagent:
1. Luminous Night Glass theme + Light Mode toggle in RTL Arabic across desktop & mobile viewports.
2. Arabic search without diacritics in Hadiths, reading progress in Story Detail, Mood Companion recommendations, Tasbih counter, Quote Card modal.
3. Full forum flow: demo login, create topic, reply, thank, mark best answer, persistence across hard reload, and Admin CMS adding a Hadith visible immediately in `/hadiths`.
