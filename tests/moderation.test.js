import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';
import { createApp } from '../server/app.js';

async function startTestServer() {
  const db = openDatabase(':memory:');
  seedDatabase(db, { demoMode: true });
  const app = createApp(db, { demoMode: true, disableRateLimit: true });
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
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
      this.cookie = setCookie.includes('Max-Age=0') ? '' : pair;
    }
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
}

test('moderation RBAC blocks members and allows moderator reports, hiding, and ban enforcement', async () => {
  const srv = await startTestServer();
  try {
    const member = new ClientJar(srv.baseUrl);
    const mod = new ClientJar(srv.baseUrl);
    const admin = new ClientJar(srv.baseUrl);

    await member.req('/api/auth/demo-login', { method: 'POST', body: { role: 'member' } });
    await mod.req('/api/auth/demo-login', { method: 'POST', body: { role: 'moderator' } });
    await admin.req('/api/auth/demo-login', { method: 'POST', body: { role: 'admin' } });

    const memberMe = await member.req('/api/auth/me');
    const adminMe = await admin.req('/api/auth/me');

    // Member blocked from moderation & admin endpoints
    assert.equal((await member.req('/api/moderation/reports')).status, 403);
    assert.equal((await member.req('/api/admin/hadiths', { method: 'POST', body: {} })).status, 403);
    // Moderator blocked from admin CMS & role endpoints
    assert.equal((await mod.req('/api/admin/hadiths', { method: 'POST', body: {} })).status, 403);
    assert.equal((await mod.req(`/api/admin/users/${memberMe.data.user.id}/role`, { method: 'PATCH', body: { role: 'moderator' } })).status, 403);

    // Member creates topic & reply; admin reports reply
    const cats = await member.req('/api/forum/categories');
    const topicRes = await member.req('/api/forum/topics', {
      method: 'POST',
      body: { category_id: cats.data.items[0].id, title: 'موضوع للاختبار الإشرافي', body: 'نص الموضوع التجريبي الكامل.' },
    });
    const topicId = topicRes.data.item.id;
    const repRes = await member.req(`/api/forum/topics/${topicId}/replies`, {
      method: 'POST',
      body: { body: 'رد يحتاج مراجعة إشرافية' },
    });
    const replyId = repRes.data.item.id;
    await member.req(`/api/forum/topics/${topicId}/best-reply`, { method: 'POST', body: { reply_id: replyId } });

    const pointsBeforeHide = (await member.req('/api/auth/me')).data.user.points;

    const reportRes = await admin.req('/api/forum/reports', {
      method: 'POST',
      body: { target_type: 'reply', target_id: replyId, reason: 'مشاركة مخالفة لضوابط الحوار' },
    });
    assert.equal(reportRes.status, 201);

    const reports = await mod.req('/api/moderation/reports');
    assert.equal(reports.status, 200);
    assert.ok(reports.data.items.some((r) => r.id === reportRes.data.id && r.status === 'open'));

    const resolveRes = await mod.req(`/api/moderation/reports/${reportRes.data.id}`, {
      method: 'PATCH',
      body: { status: 'resolved', hideTarget: true },
    });
    assert.equal(resolveRes.status, 200);

    const pointsAfterHide = (await member.req('/api/auth/me')).data.user.points;
    assert.ok(pointsAfterHide < pointsBeforeHide);

    const topicCheck = await mod.req(`/api/forum/topics/${topicId}`);
    assert.equal(topicCheck.data.item.best_reply_id, null);

    // Moderator pins & locks topic
    const pinRes = await mod.req(`/api/moderation/topics/${topicId}`, {
      method: 'PATCH',
      body: { is_pinned: true, is_locked: true },
    });
    assert.equal(pinRes.status, 200);
    assert.equal(pinRes.data.item.is_pinned, true);
    assert.equal(pinRes.data.item.is_locked, true);

    // Moderator cannot ban admin
    const banAdmin = await mod.req(`/api/moderation/users/${adminMe.data.user.id}/ban`, {
      method: 'PATCH',
      body: { is_banned: true, ban_reason: 'test' },
    });
    assert.equal(banAdmin.status, 403);

    // Moderator bans member -> existing cookie immediately gets 403 on write
    const banMem = await mod.req(`/api/moderation/users/${memberMe.data.user.id}/ban`, {
      method: 'PATCH',
      body: { is_banned: true, ban_reason: 'تكرار المخالفة' },
    });
    assert.equal(banMem.status, 200);

    const writeWhileBanned = await member.req('/api/forum/topics', {
      method: 'POST',
      body: { category_id: cats.data.items[0].id, title: 'محاولة بعد الحظر', body: 'يجب منع هذه المحاولة فوراً.' },
    });
    assert.ok([401, 403].includes(writeWhileBanned.status));

    const loginWhileBanned = await member.req('/api/auth/login', {
      method: 'POST',
      body: { email: memberMe.data.user.email, password: 'Member@2026' },
    });
    assert.equal(loginWhileBanned.status, 403);

    // Unban restores login
    await mod.req(`/api/moderation/users/${memberMe.data.user.id}/ban`, {
      method: 'PATCH',
      body: { is_banned: false },
    });
    const relogin = await member.req('/api/auth/login', {
      method: 'POST',
      body: { email: memberMe.data.user.email, password: 'Member@2026' },
    });
    assert.equal(relogin.status, 200);
  } finally {
    await srv.close();
  }
});

test('admin CMS CRUD works for hadiths, stories, sermons, categories, and role promotion with strict validation', async () => {
  const srv = await startTestServer();
  try {
    const admin = new ClientJar(srv.baseUrl);
    await admin.req('/api/auth/demo-login', { method: 'POST', body: { role: 'admin' } });

    // Malformed validation returns 400
    const badHadith = await admin.req('/api/admin/hadiths', {
      method: 'POST',
      body: { title: '', benefits: 'not-an-array' },
    });
    assert.equal(badHadith.status, 400);

    // Create hadith -> visible publicly -> unpublish -> hidden publicly -> delete
    const createdH = await admin.req('/api/admin/hadiths', {
      method: 'POST',
      body: {
        title: 'حديث الصدق والبر',
        text_diacritics: 'عَلَيْكُمْ بِالصِّدْقِ، فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ',
        narrator: 'عبد الله بن مسعود رضي الله عنه',
        source: 'صحيح البخاري وصحيح مسلم',
        grade: 'متفق عليه',
        category: 'الأخلاق والمعاملات',
        mood_tags: ['resolve'],
        explanation: 'الصدق يهدي إلى البر والبر يهدي إلى الجنة.',
        benefits: ['الالتزام بالصدق في القول والعمل'],
        is_published: true,
      },
    });
    assert.equal(createdH.status, 201);
    const hid = createdH.data.item.id;

    let pubList = await admin.req('/api/hadiths?q=' + encodeURIComponent('الصدق يهدي الي البر'));
    assert.ok(pubList.data.items.some((x) => x.id === hid));

    await admin.req(`/api/admin/hadiths/${hid}`, {
      method: 'PATCH',
      body: { is_published: false, title: 'حديث الصدق المعدل' },
    });
    pubList = await admin.req('/api/hadiths?q=' + encodeURIComponent('الصدق'));
    assert.equal(pubList.data.items.some((x) => x.id === hid), false);

    const adminList = await admin.req('/api/admin/hadiths');
    assert.ok(adminList.data.items.some((x) => x.id === hid && x.title === 'حديث الصدق المعدل'));
    assert.equal((await admin.req(`/api/admin/hadiths/${hid}`, { method: 'DELETE' })).status, 200);

    // Create & delete story
    const createdS = await admin.req('/api/admin/stories', {
      method: 'POST',
      body: {
        title: 'قصة أصحاب الجنة وعبرة شكر النعمة',
        category: 'lessons',
        summary: 'قصة قرآنية في شكر النعمة ومراعاة حق الفقير.',
        paragraphs: ['فقرة أولى في القصة', 'فقرة ثانية في القصة'],
        lessons: ['شكر النعمة بإيتاء حق المساكين'],
        reading_minutes: 3,
        mood_tags: ['repentance'],
      },
    });
    assert.equal(createdS.status, 201);
    assert.equal((await admin.req(`/api/admin/stories/${createdS.data.item.id}`, { method: 'DELETE' })).status, 200);

    // Create & delete sermon
    const createdM = await admin.req('/api/admin/sermons', {
      method: 'POST',
      body: {
        title: 'موعظة في بركة الاستغفار',
        category: 'التوبة والرجاء',
        excerpt: 'الاستغفار يفتح المغاليق ويغسل القلوب.',
        body_paragraphs: ['فقرة وعظية أولى مباركة'],
        reflection_question: 'كم مرة تستغفر الله بقلب حاضر اليوم؟',
        mood_tags: ['repentance'],
        reading_minutes: 2,
      },
    });
    assert.equal(createdM.status, 201);
    assert.equal((await admin.req(`/api/admin/sermons/${createdM.data.item.id}`, { method: 'DELETE' })).status, 200);

    // Create category & promote member -> moderator
    const createdCat = await admin.req('/api/admin/categories', {
      method: 'POST',
      body: {
        slug: 'seerah-study',
        name: 'مجالس السيرة النبوية',
        description: 'مناقشة دروس السيرة النبوية',
        icon: 'BookOpen',
        sort_order: 6,
      },
    });
    assert.equal(createdCat.status, 201);

    const users = await admin.req('/api/moderation/users');
    const targetMember = users.data.items.find((u) => u.role === 'member');
    const promo = await admin.req(`/api/admin/users/${targetMember.id}/role`, {
      method: 'PATCH',
      body: { role: 'moderator' },
    });
    assert.equal(promo.status, 200);
    assert.equal(promo.data.item.role, 'moderator');
    assert.equal(promo.data.item.badge, 'مشرف');
  } finally {
    await srv.close();
  }
});

test('admin CMS rejects empty paragraph arrays, non-string array items, non-string PATCH values, bad sort_order, and malformed JSON with 400 JSON', async () => {
  const srv = await startTestServer();
  try {
    const admin = new ClientJar(srv.baseUrl);
    await admin.req('/api/auth/demo-login', { method: 'POST', body: { role: 'admin' } });

    // Empty paragraphs/body_paragraphs on POST
    const emptyStory = await admin.req('/api/admin/stories', {
      method: 'POST',
      body: { title: 'قصة صالحة', category: 'lessons', summary: 'ملخص صالح للقصة', paragraphs: [] },
    });
    assert.equal(emptyStory.status, 400);

    const emptySermon = await admin.req('/api/admin/sermons', {
      method: 'POST',
      body: { title: 'موعظة صالحة', category: 'السكينة', excerpt: 'مقتطف صالح', body_paragraphs: [] },
    });
    assert.equal(emptySermon.status, 400);

    // Non-string array elements on POST & PATCH
    const badMood = await admin.req('/api/admin/hadiths', {
      method: 'POST',
      body: {
        title: 'حديث صالح',
        text_diacritics: 'نص حديث صالح بالتشكيل الكامل',
        narrator: 'أبو هريرة',
        source: 'صحيح مسلم',
        grade: 'صحيح',
        category: 'الذكر',
        explanation: 'شرح الحديث هنا',
        benefits: ['فائدة'],
        mood_tags: [123],
      },
    });
    assert.equal(badMood.status, 400);

    const hadiths = await admin.req('/api/admin/hadiths');
    const hid = hadiths.data.items[0].id;
    const badPatchBenefits = await admin.req(`/api/admin/hadiths/${hid}`, {
      method: 'PATCH',
      body: { benefits: [{ bad: 1 }] },
    });
    assert.equal(badPatchBenefits.status, 400);

    const nullTitlePatch = await admin.req(`/api/admin/hadiths/${hid}`, {
      method: 'PATCH',
      body: { title: null },
    });
    assert.equal(nullTitlePatch.status, 400);

    const stories = await admin.req('/api/admin/stories');
    const sid = stories.data.items[0].id;
    assert.equal(
      (await admin.req(`/api/admin/stories/${sid}`, { method: 'PATCH', body: { paragraphs: [] } })).status,
      400
    );
    assert.equal(
      (await admin.req(`/api/admin/stories/${sid}`, { method: 'PATCH', body: { lessons: [{}] } })).status,
      400
    );
    assert.equal(
      (await admin.req(`/api/admin/stories/${sid}`, { method: 'PATCH', body: { title: null } })).status,
      400
    );

    const sermons = await admin.req('/api/admin/sermons');
    const mid = sermons.data.items[0].id;
    assert.equal(
      (await admin.req(`/api/admin/sermons/${mid}`, { method: 'PATCH', body: { body_paragraphs: [] } })).status,
      400
    );
    assert.equal(
      (await admin.req(`/api/admin/sermons/${mid}`, { method: 'PATCH', body: { title: {} } })).status,
      400
    );

    // Invalid sort_order on category PATCH -> 400 JSON (not 500 HTML)
    const cats = await admin.req('/api/forum/categories');
    const cid = cats.data.items[0].id;
    const badSort = await admin.req(`/api/admin/categories/${cid}`, {
      method: 'PATCH',
      body: { sort_order: 'abc' },
    });
    assert.equal(badSort.status, 400);
    assert.ok(typeof badSort.data?.error === 'string');

    // Malformed raw JSON -> 400 JSON (not HTML stack trace)
    const rawRes = await fetch(`${srv.baseUrl}/api/admin/hadiths`, {
      method: 'POST',
      headers: {
        Cookie: admin.cookie,
        'Content-Type': 'application/json',
      },
      body: '{invalid-json',
    });
    assert.equal(rawRes.status, 400);
    const rawJson = await rawRes.json();
    assert.ok(typeof rawJson.error === 'string');
  } finally {
    await srv.close();
  }
});
