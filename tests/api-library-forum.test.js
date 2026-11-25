import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';
import { createApp } from '../server/app.js';

async function startTestServer({ demoMode = false } = {}) {
  const db = openDatabase(':memory:');
  seedDatabase(db, { demoMode });
  const app = createApp(db, { demoMode, disableRateLimit: true });
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    db,
    baseUrl,
    async close() {
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}

class ClientJar {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = '';
  }

  async req(path, { method = 'GET', body } = {}) {
    const headers = {};
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0];
      if (pair.includes('=;') || pair.endsWith('=') || setCookie.includes('Max-Age=0')) {
        this.cookie = '';
      } else {
        this.cookie = pair;
      }
    }
    const data = await res.json().catch(() => null);
    return { status: res.status, data, headers: res.headers };
  }
}

test('auth config and demo-login respect demoMode=false and registration/login flow works', async () => {
  const srv = await startTestServer({ demoMode: false });
  try {
    const c = new ClientJar(srv.baseUrl);
    const cfg = await c.req('/api/auth/config');
    assert.equal(cfg.status, 200);
    assert.equal(cfg.data.demoMode, false);

    const demoBlocked = await c.req('/api/auth/demo-login', {
      method: 'POST',
      body: { role: 'admin' },
    });
    assert.equal(demoBlocked.status, 403);

    const reg = await c.req('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'zaid_m',
        display_name: 'زيد محمد',
        email: 'zaid@example.com',
        password: 'Password123',
      },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.user.role, 'member');
    assert.ok(c.cookie.includes('mishkah_session='));

    const dup = await c.req('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'zaid_m2',
        display_name: 'زيد آخر',
        email: 'zaid@example.com',
        password: 'Password123',
      },
    });
    assert.equal(dup.status, 409);

    const me = await c.req('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, 'zaid@example.com');

    const upd = await c.req('/api/auth/profile', {
      method: 'PATCH',
      body: { display_name: 'زيد أبو عبد الله', bio: 'محب للسنة' },
    });
    assert.equal(upd.status, 200);
    assert.equal(upd.data.user.display_name, 'زيد أبو عبد الله');

    await c.req('/api/auth/logout', { method: 'POST' });
    const meAfterLogout = await c.req('/api/auth/me');
    assert.equal(meAfterLogout.data.user, null);

    const login = await c.req('/api/auth/login', {
      method: 'POST',
      body: { email: 'zaid@example.com', password: 'Password123' },
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.user.username, 'zaid_m');
  } finally {
    await srv.close();
  }
});

test('library search normalizes Arabic variants, mood companion responds, and bookmarks persist', async () => {
  const srv = await startTestServer({ demoMode: true });
  try {
    const c = new ClientJar(srv.baseUrl);
    await c.req('/api/auth/demo-login', { method: 'POST', body: { role: 'member' } });

    const home = await c.req('/api/home');
    assert.equal(home.status, 200);
    assert.ok(home.data.featuredHadith);
    assert.ok(home.data.stats.hadiths >= 24);

    const h1 = await c.req('/api/hadiths?q=' + encodeURIComponent('انما الاعمال'));
    assert.equal(h1.status, 200);
    assert.ok(h1.data.items.some((x) => x.title.includes('النيات')));

    // Variant test: الجنه -> الْجَنَّةِ (taa marbuta + diacritics normalization)
    const h2 = await c.req('/api/hadiths?q=' + encodeURIComponent('الجنه'));
    assert.equal(h2.status, 200);
    assert.ok(h2.data.items.length >= 1);

    const comp = await c.req('/api/companion?mood=serenity');
    assert.equal(comp.status, 200);
    assert.ok(comp.data.hadith);
    assert.ok(comp.data.story);
    assert.ok(comp.data.sermon);

    const story = await c.req('/api/stories/yusuf-patience-and-forgiveness');
    assert.equal(story.status, 200);
    assert.ok(Array.isArray(story.data.item.paragraphs));

    const b1 = await c.req('/api/bookmarks/toggle', {
      method: 'POST',
      body: { item_type: 'hadith', item_id: home.data.featuredHadith.id },
    });
    assert.equal(b1.status, 200);
    assert.equal(b1.data.bookmarked, true);

    const blist = await c.req('/api/bookmarks');
    assert.equal(blist.status, 200);
    assert.equal(blist.data.hadiths.length, 1);

    const search = await c.req('/api/search?q=' + encodeURIComponent('يوسف'));
    assert.equal(search.status, 200);
    assert.ok(search.data.stories.length >= 1);
  } finally {
    await srv.close();
  }
});

test('forum lifecycle: create topic, nested reply, thanks, best answer, edit, delete, and notifications', async () => {
  const srv = await startTestServer({ demoMode: false });
  try {
    const userA = new ClientJar(srv.baseUrl);
    const userB = new ClientJar(srv.baseUrl);
    await userA.req('/api/auth/register', {
      method: 'POST',
      body: { username: 'user_a', display_name: 'أحمد', email: 'a@test.com', password: 'Password123' },
    });
    await userB.req('/api/auth/register', {
      method: 'POST',
      body: { username: 'user_b', display_name: 'بلال', email: 'b@test.com', password: 'Password123' },
    });

    const cats = await userA.req('/api/forum/categories');
    assert.equal(cats.status, 200);
    const catId = cats.data.items[0].id;

    // User A creates topic (+10 points)
    const createRes = await userA.req('/api/forum/topics', {
      method: 'POST',
      body: {
        category_id: catId,
        title: 'فضل الصدقة الخفية في تفريج الهموم',
        body: 'شاركونا مواقف وتأملات في أثر الصدقة.',
        tags: ['الصدقة', 'التزكية'],
      },
    });
    assert.equal(createRes.status, 201);
    const topicId = createRes.data.item.id;

    let meA = await userA.req('/api/auth/me');
    assert.equal(meA.data.user.points, 10);

    // Non-author B cannot edit A's topic
    const badEdit = await userB.req(`/api/forum/topics/${topicId}`, {
      method: 'PATCH',
      body: { title: 'تعديل غير مصرح', body: 'نص آخر' },
    });
    assert.equal(badEdit.status, 403);

    // Author A edits own topic
    const goodEdit = await userA.req(`/api/forum/topics/${topicId}`, {
      method: 'PATCH',
      body: { title: 'فضل الصدقة الخفية وأثرها', body: 'شاركونا مواقف وتأملات في أثر الصدقة الخفية.' },
    });
    assert.equal(goodEdit.status, 200);
    assert.equal(goodEdit.data.item.title, 'فضل الصدقة الخفية وأثرها');

    // User B replies (+5) and User A gets notification
    const rep1 = await userB.req(`/api/forum/topics/${topicId}/replies`, {
      method: 'POST',
      body: { body: 'الصدقة تطفئ غضب الرب وتشرح الصدر.' },
    });
    assert.equal(rep1.status, 201);
    const replyId = rep1.data.item.id;

    const notifs = await userA.req('/api/notifications');
    assert.equal(notifs.status, 200);
    assert.ok(notifs.data.items.some((n) => n.is_read === 0));

    // User A thanks B's reply (+3 to B -> 8) and marks best answer (+15 to B -> 23)
    const thx = await userA.req('/api/forum/thanks', {
      method: 'POST',
      body: { target_type: 'reply', target_id: replyId },
    });
    assert.equal(thx.status, 200);
    assert.equal(thx.data.thanked, true);

    const best = await userA.req(`/api/forum/topics/${topicId}/best-reply`, {
      method: 'POST',
      body: { reply_id: replyId },
    });
    assert.equal(best.status, 200);

    let meB = await userB.req('/api/auth/me');
    assert.equal(meB.data.user.points, 23);

    // User B deletes own reply -> best_reply_id clears and B's points return to 0
    const delRep = await userB.req(`/api/forum/replies/${replyId}`, { method: 'DELETE' });
    assert.equal(delRep.status, 200);

    meB = await userB.req('/api/auth/me');
    assert.equal(meB.data.user.points, 0);

    const topicAfter = await userA.req(`/api/forum/topics/${topicId}`);
    assert.equal(topicAfter.data.item.best_reply_id, null);
  } finally {
    await srv.close();
  }
});
