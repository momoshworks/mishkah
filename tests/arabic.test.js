import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArabic, matchesArabicQuery } from '../server/arabic.js';

test('normalizeArabic strips diacritics, tatweel, and punctuation cleanly', () => {
  const input = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ — صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ';
  assert.equal(normalizeArabic(input), 'انما الاعمال بالنيات صلي الله عليه وسلم');
});

test('normalizeArabic unifies hamza, taa marbuta, and alef maqsura variants', () => {
  assert.equal(
    normalizeArabic('الصلاة على النبي'),
    normalizeArabic('الصلاه علي النبي')
  );
  assert.equal(
    normalizeArabic('أُحِبُّ الهدى والآخرة'),
    normalizeArabic('احب الهدي والاخره')
  );
});

test('matchesArabicQuery matches multi-word unvoweled queries and empty query', () => {
  const hadith = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى';
  assert.equal(matchesArabicQuery(hadith, 'اعمال نيات'), true);
  assert.equal(matchesArabicQuery(hadith, 'انما لكل امرئ'), true);
  assert.equal(matchesArabicQuery(hadith, 'الصلاه'), false);
  assert.equal(matchesArabicQuery(hadith, '   '), true);
});
