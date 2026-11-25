import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';

test('seedDatabase populates verified library and demo community when demoMode is true', () => {
  const db = openDatabase(':memory:');
  seedDatabase(db, { demoMode: true });

  const counts = {
    hadiths: db.prepare('SELECT COUNT(*) AS c FROM hadiths').get().c,
    stories: db.prepare('SELECT COUNT(*) AS c FROM stories').get().c,
    sermons: db.prepare('SELECT COUNT(*) AS c FROM sermons').get().c,
    categories: db.prepare('SELECT COUNT(*) AS c FROM forum_categories').get().c,
    topics: db.prepare('SELECT COUNT(*) AS c FROM forum_topics').get().c,
    replies: db.prepare('SELECT COUNT(*) AS c FROM forum_replies').get().c,
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  };

  assert.ok(counts.hadiths >= 24, `expected >= 24 hadiths, got ${counts.hadiths}`);
  assert.ok(counts.stories >= 12, `expected >= 12 stories, got ${counts.stories}`);
  assert.ok(counts.sermons >= 15, `expected >= 15 sermons, got ${counts.sermons}`);
  assert.ok(counts.categories >= 5, `expected >= 5 categories, got ${counts.categories}`);
  assert.ok(counts.topics >= 8, `expected >= 8 topics, got ${counts.topics}`);
  assert.ok(counts.replies >= 16, `expected >= 16 replies, got ${counts.replies}`);
  assert.equal(counts.users, 4);

  const featured = db.prepare('SELECT COUNT(*) AS c FROM hadiths WHERE is_featured = 1').get().c;
  assert.ok(featured >= 1);

  const hadiths = db.prepare('SELECT * FROM hadiths').all();
  for (const h of hadiths) {
    assert.ok(h.text_diacritics.trim().length > 10);
    assert.ok(h.text_plain.trim().length > 10);
    assert.ok(h.narrator.trim().length > 2);
    assert.ok(h.source.trim().length > 2);
    assert.ok(h.grade.trim().length > 2);
    assert.ok(h.explanation.trim().length > 10);
    assert.ok(Array.isArray(JSON.parse(h.benefits_json)));
    assert.ok(Array.isArray(JSON.parse(h.mood_tags)));
  }
  db.close();
});

test('seedDatabase is idempotent across repeated invocations', () => {
  const db = openDatabase(':memory:');
  seedDatabase(db, { demoMode: true });
  const firstCounts = {
    hadiths: db.prepare('SELECT COUNT(*) AS c FROM hadiths').get().c,
    topics: db.prepare('SELECT COUNT(*) AS c FROM forum_topics').get().c,
    users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  };
  seedDatabase(db, { demoMode: true });
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM hadiths').get().c, firstCounts.hadiths);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM forum_topics').get().c, firstCounts.topics);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM users').get().c, firstCounts.users);
  db.close();
});

test('seedDatabase omits demo users in production mode and uses configured admin env only', () => {
  const db1 = openDatabase(':memory:');
  seedDatabase(db1, { demoMode: false });
  assert.equal(db1.prepare('SELECT COUNT(*) AS c FROM users').get().c, 0);
  assert.ok(db1.prepare('SELECT COUNT(*) AS c FROM hadiths').get().c >= 24);
  assert.ok(db1.prepare('SELECT COUNT(*) AS c FROM forum_categories').get().c >= 5);
  db1.close();

  const db2 = openDatabase(':memory:');
  seedDatabase(db2, {
    demoMode: false,
    adminEmail: 'root@mishkah.org',
    adminPassword: 'StrongPassword#99',
  });
  const users = db2.prepare('SELECT email, role FROM users').all();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'root@mishkah.org');
  assert.equal(users[0].role, 'admin');
  db2.close();
});
