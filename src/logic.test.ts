import test from 'node:test';
import assert from 'node:assert/strict';
import { countChars, clampText, escapeHtml, localDay, hasSafetyRisk, matchNotes, newState, parseState, sendNote, replyTo, addMessage, Store, STORAGE_KEY } from './logic';
import { NOTES, REFERENCE, REFERENCE_MAP } from './data';

const date = new Date(2026, 8, 13, 23, 59, 0);
function withSession() { const state = newState(); state.session = { text: '考研二战，重新开始。', skipped: [] }; return state; }
class MemoryStorage implements Storage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('Unicode counting counts supplementary characters once and never breaks surrogate pairs', () => {
  assert.equal(countChars('中文😀'), 3);
  assert.equal(clampText('😀'.repeat(101)), '😀'.repeat(100));
  assert.equal(countChars(clampText('中'.repeat(98) + '😀甲乙')), 100);
});
test('Unicode policy is code points, not grapheme clusters', () => { assert.equal(countChars('e\u0301'), 2); });
test('HTML escapes untrusted drafts and attribute quotes', () => { assert.equal(escapeHtml('<img src="x" onerror=\'x\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;'); });
test('local day follows the supplied local wall-clock date, not UTC truncation', () => {
  assert.equal(localDay(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
  assert.equal(localDay(date), '2026-09-13');
});
test('matches are keyword-grounded and stable', () => {
  const matches = matchNotes('考研二战，也很累');
  assert.equal(matches[0].note.id, 'exam'); assert.deepEqual(matches[0].hits, ['考研', '二战']);
  assert.equal(matches[0].score, 2); assert.ok(matches[0].reason.includes('「考研」「二战」'));
  assert.equal(matches[1].note.id, 'rest');
});
test('unmatched input gives honest fallback, not claimed similarity', () => {
  const matches = matchNotes('今天吃了草莓布丁');
  assert.ok(matches.every(m => m.score === 0 && m.reason.includes('没有直接交集')));
  assert.deepEqual(matches.map(m => m.note.id), NOTES.map(n => n.id));
});
test('eighteen unique explicitly synthetic notes and scoped public reference', () => {
  assert.equal(NOTES.length, 18); assert.equal(new Set(NOTES.map(n => n.id)).size, 18);
  assert.ok(NOTES.every(n => n.reply && !n.reply.includes('演示')));
  assert.equal(REFERENCE.author, '百里推冰'); assert.equal(REFERENCE.cachedOn, '2026-09-13');
  assert.equal(new URL(REFERENCE.url).hostname, 'www.zhihu.com');
});
test('cached citations point at real notes and valid zhihu links', () => {
  // 今天知乎搜索额度 10/10 已全部用于预取：10 个新主题 + 旧 exam 引用；
  // 其余纸条暂无引用块，quoteMarkup 会优雅省略（额度恢复后可补齐）。
  for (const [id, ref] of Object.entries(REFERENCE_MAP)) {
    assert.ok(NOTES.some(n => n.id === id), `引用卡指向不存在的纸条：${id}`);
    assert.ok(ref.excerpt.length >= 10 && ref.author && ref.title);
    assert.ok(['www.zhihu.com', 'zhuanlan.zhihu.com'].includes(new URL(ref.url).hostname));
    assert.ok(['2026-09-13', '2026-09-15'].includes(ref.cachedOn));
  }
  assert.equal(Object.keys(REFERENCE_MAP).length, 11);
});
test('risk keywords pause flow, with whitespace and Latin normalization', () => {
  for (const value of ['我不想活了', '伤害自己', '结 束 生 命', 'KILL MYSELF', '我想自残']) assert.ok(hasSafetyRisk(value));
  assert.equal(hasSafetyRisk('今天有点累，想休息'), false);
});
test('versioned state roundtrips', () => { const value = newState(); assert.deepEqual(parseState(JSON.stringify(value)), value); });
test('bad JSON, wrong versions, invalid shapes are ignored safely', () => {
  for (const raw of ['{', 'null', '[]', '1', '{}', JSON.stringify({ ...newState(), version: 99 }), JSON.stringify({ ...newState(), draft: 3 })]) assert.equal(parseState(raw), null);
});
test('validator rejects hostile portrait sources and oversized drafts', () => {
  for (const portrait of ['javascript:alert(1)', '<svg onload="x">', 'https://example.com/image.png', 'preset:99']) assert.equal(parseState(JSON.stringify({ ...newState(), portrait })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), draft: 'x'.repeat(201) })), null);
  assert.ok(parseState(JSON.stringify({ ...newState(), draft: 'x'.repeat(200) })));
});
test('validator accepts restricted preset portraits and PNG data URLs only', () => {
  assert.ok(parseState(JSON.stringify({ ...newState(), portrait: 'preset:1' })));
  assert.ok(parseState(JSON.stringify({ ...newState(), portrait: 'data:image/png;base64,YWJj' })));
});
test('invalid session and unknown note IDs rejected', () => {
  assert.equal(parseState(JSON.stringify({ ...newState(), session: { text: '', skipped: [] } })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), session: { text: 'abc', skipped: ['missing'] } })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), session: { text: 'abc', skipped: ['exam', 'exam'] } })), null);
});
test('same local day allows multiple sends, each archived separately', () => {
  const state = withSession(); const first = sendNote(state, 'exam', date);
  assert.ok(first); const second = sendNote(state, 'city', date);
  assert.ok(second); assert.equal(state.entries.length, 2);
  assert.equal(state.entries[0].day, localDay(date)); assert.equal(state.entries[1].day, localDay(date));
});
test('send snapshots original draft independently of future writing', () => {
  const state = withSession(); const original = state.session!.text;
  const entry = sendNote(state, 'exam', date)!;
  state.draft = '后来写的句子'; state.session!.text = '另一句话';
  assert.equal(entry.text, original);
});
test('later days allow further sends while retaining archive', () => {
  const state = withSession(); sendNote(state, 'exam', date);
  const tomorrow = new Date(2026, 8, 14, 0, 0, 1);
  assert.ok(sendNote(state, 'city', tomorrow)); assert.equal(state.entries.length, 2);
});
test('send rejects unknown note, missing session and risk input', () => {
  assert.equal(sendNote(newState(), 'exam', date), null);
  const state = withSession(); assert.equal(sendNote(state, 'missing', date), null);
  state.session!.text = '不想活了'; assert.equal(sendNote(state, 'exam', date), null);
});
test('reply only once, trims content, clears draft, snapshots date', () => {
  const state = withSession(); const entry = sendNote(state, 'exam', date)!; entry.replyDraft = '  谢谢你  ';
  assert.ok(replyTo(state, entry.id, entry.replyDraft, date)); assert.equal(entry.reply, '谢谢你');
  assert.equal(entry.replyDraft, ''); assert.equal(entry.repliedAt, date.toISOString()); assert.equal(replyTo(state, entry.id, '第二次', date), false);
});
test('blank, oversized, unknown-entry and high-risk replies rejected', () => {
  const state = withSession(); const entry = sendNote(state, 'exam', date)!;
  for (const value of ['   ', '😀'.repeat(201), '我想自杀']) assert.equal(replyTo(state, entry.id, value, date), false);
  assert.equal(replyTo(state, 'missing', '你好', date), false); assert.equal(entry.reply, null);
});
test('archive validator rejects duplicate IDs, impossible dates and reply inconsistency; same-day entries allowed', () => {
  const state = withSession(); const entry = sendNote(state, 'exam', date)!;
  assert.ok(parseState(JSON.stringify(state)));
  const clone = () => JSON.parse(JSON.stringify(state));
  let value = clone(); value.entries.push({ ...entry }); assert.equal(parseState(JSON.stringify(value)), null);
  value = clone(); value.entries.push({ ...entry, id: 'entry-second', text: '另一句' }); assert.ok(parseState(JSON.stringify(value)));
  value = clone(); value.entries[0].day = '2026-02-31'; assert.equal(parseState(JSON.stringify(value)), null);
  value = clone(); value.entries[0].reply = 'hello'; assert.equal(parseState(JSON.stringify(value)), null);
  value = clone(); value.entries[0].noteId = 'missing'; assert.equal(parseState(JSON.stringify(value)), null);
});
test('Store persists and reloads drafts', () => {
  const memory = new MemoryStorage(); const store = new Store(memory); store.state.draft = '留一行'; store.save();
  assert.equal(new Store(memory).state.draft, '留一行');
});
test('Store invalid JSON fallback is explicit', () => {
  const memory = new MemoryStorage(); memory.setItem(STORAGE_KEY, '{bad'); const store = new Store(memory);
  assert.equal(store.state.draft, ''); assert.ok(store.warning.includes('损坏')); store.save(); assert.ok(parseState(memory.getItem(STORAGE_KEY)!));
});
test('unavailable storage and quota failures preserve memory with warning', () => {
  const store = new Store(null); store.state.draft = '暂存在本页'; store.save(); assert.equal(store.state.draft, '暂存在本页'); assert.ok(store.warning);
  const memory = new MemoryStorage(); memory.setItem = () => { throw new Error('QuotaExceededError'); };
  const quota = new Store(memory); quota.state.draft = '不会白屏'; quota.save(); assert.equal(quota.state.draft, '不会白屏'); assert.ok(quota.warning.includes('内存模式'));
});
test('reset touches only this app storage key', () => {
  const memory = new MemoryStorage(); memory.setItem('other-app', 'keep'); const store = new Store(memory); store.save(); store.reset();
  assert.equal(memory.getItem('other-app'), 'keep'); assert.equal(memory.getItem(STORAGE_KEY), null); assert.equal(store.state.entries.length, 0);
});
test('stale draft saves preserve another tab’s sent archive and completed reply', () => {
  const memory = new MemoryStorage(); const first = new Store(memory); first.state = withSession(); first.save();
  const stale = new Store(memory); const entry = sendNote(first.state, 'exam', date)!; first.save();
  stale.state.draft = '另外一页'; stale.save(); assert.equal(stale.state.entries.length, 1);
  replyTo(first.state, entry.id, '收到了', date); first.save();
  stale.state.draft = '仍在写'; stale.save(); assert.equal(stale.state.entries[0].reply, '收到了');
});
test('external sync rejects corruption and accepts reset', () => {
  const store = new Store(new MemoryStorage()); store.state.draft = 'original';
  assert.equal(store.accept('{'), false); assert.equal(store.state.draft, 'original');
  assert.equal(store.accept(null), true); assert.equal(store.state.draft, '');
});
test('portrait presets and message drawings accept 0..5 and reject 6', () => {
  for (const n of [0, 1, 5]) assert.ok(parseState(JSON.stringify({ ...newState(), portrait: `preset:${n}` })));
  assert.equal(parseState(JSON.stringify({ ...newState(), portrait: 'preset:6' })), null);
  const withDrawing = (drawing: number) => {
    const state = newState();
    state.conversations = [{ id: 'conversation-1', entryId: 'entry-1', readerName: '读者 · 42', portrait: 'preset:0', createdAt: date.toISOString(), messages: [{ id: 'message-1', conversationId: 'conversation-1', sender: 'me', kind: 'drawing', text: '', drawing, createdAt: date.toISOString(), read: true }] }];
    return state;
  };
  assert.ok(parseState(JSON.stringify(withDrawing(5))));
  assert.equal(parseState(JSON.stringify(withDrawing(6))), null);
  const conversation = { id: 'conversation-2', entryId: 'entry-2', readerName: '读者 · 42', portrait: 'preset:0', createdAt: date.toISOString(), messages: [] };
  assert.ok(addMessage(conversation, '', undefined, 5, date));
  assert.equal(addMessage(conversation, '', undefined, 6, date), null);
  const withPortrait = (portrait: string) => {
    const state = newState();
    state.conversations = [{ id: 'conversation-3', entryId: 'entry-3', readerName: '读者 · 42', portrait, createdAt: date.toISOString(), messages: [] }];
    return state;
  };
  assert.ok(parseState(JSON.stringify(withPortrait('preset:5'))));
  assert.equal(parseState(JSON.stringify(withPortrait('preset:6'))), null);
});
test('portraitTemplates accepts up to 3 PNG data URLs and normalizes the missing field', () => {
  const png = 'data:image/png;base64,YWJj';
  assert.ok(parseState(JSON.stringify({ ...newState(), portraitTemplates: [] })));
  assert.ok(parseState(JSON.stringify({ ...newState(), portraitTemplates: [png] })));
  assert.ok(parseState(JSON.stringify({ ...newState(), portraitTemplates: [png, png, png] })));
  assert.equal(parseState(JSON.stringify({ ...newState(), portraitTemplates: [png, png, png, png] })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), portraitTemplates: ['data:image/jpeg;base64,YWJj'] })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), portraitTemplates: [png, 'https://example.com/face.png'] })), null);
  assert.equal(parseState(JSON.stringify({ ...newState(), portraitTemplates: [`data:image/png;base64,${'A'.repeat(1500000)}`] })), null);
  const legacy = { ...newState() } as Record<string, unknown>;
  delete legacy.portraitTemplates;
  const parsed = parseState(JSON.stringify(legacy));
  assert.ok(parsed); assert.deepEqual(parsed.portraitTemplates, []);
});
test('undoKey defaults to ctrl+z, normalizes invalid values and keeps custom combos', () => {
  const legacy = { ...newState() } as Record<string, unknown>;
  delete legacy.undoKey;
  const missing = parseState(JSON.stringify(legacy));
  assert.ok(missing); assert.equal(missing.undoKey, 'ctrl+z');
  const upper = parseState(JSON.stringify({ ...newState(), undoKey: 'U' }));
  assert.ok(upper); assert.equal(upper.undoKey, 'ctrl+z');
  const weird = parseState(JSON.stringify({ ...newState(), undoKey: 'Control' }));
  assert.ok(weird); assert.equal(weird.undoKey, 'ctrl+z');
  const digit = parseState(JSON.stringify({ ...newState(), undoKey: '7' }));
  assert.ok(digit); assert.equal(digit.undoKey, '7');
  const combo = parseState(JSON.stringify({ ...newState(), undoKey: 'ctrl+u' }));
  assert.ok(combo); assert.equal(combo.undoKey, 'ctrl+u');
  const fkey = parseState(JSON.stringify({ ...newState(), undoKey: 'alt+shift+f5' }));
  assert.ok(fkey); assert.equal(fkey.undoKey, 'alt+shift+f5');
  const arrow = parseState(JSON.stringify({ ...newState(), undoKey: 'arrowleft' }));
  assert.ok(arrow); assert.equal(arrow.undoKey, 'arrowleft');
  const tooManyMods = parseState(JSON.stringify({ ...newState(), undoKey: 'ctrl+alt+shift+z' }));
  assert.ok(tooManyMods); assert.equal(tooManyMods.undoKey, 'ctrl+z');
});
test('volume defaults to -6dB (0.5) and normalizes invalid values without rejecting the state', () => {
  const legacy = { ...newState() } as Record<string, unknown>;
  delete legacy.volume;
  const missing = parseState(JSON.stringify(legacy));
  assert.ok(missing); assert.equal(missing.volume, 0.5);
  const tooLoud = parseState(JSON.stringify({ ...newState(), volume: 1.5 }));
  assert.ok(tooLoud); assert.equal(tooLoud.volume, 0.5);
  const negative = parseState(JSON.stringify({ ...newState(), volume: -0.2 }));
  assert.ok(negative); assert.equal(negative.volume, 0.5);
  const nan = parseState(JSON.stringify({ ...newState(), volume: 'loud' }));
  assert.ok(nan); assert.equal(nan.volume, 0.5);
  const quiet = parseState(JSON.stringify({ ...newState(), volume: 0.25 }));
  assert.ok(quiet); assert.equal(quiet.volume, 0.25);
});
test('old v2 state without portraitTemplates is accepted and normalized to []', () => {
  const state = withSession();
  const entry = sendNote(state, 'exam', date)!;
  replyTo(state, entry.id, '收到了', date);
  state.portrait = 'preset:2';
  const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  delete legacy.portraitTemplates;
  const parsed = parseState(JSON.stringify(legacy));
  assert.ok(parsed);
  assert.deepEqual(parsed.portraitTemplates, []);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0].reply, '收到了');
});
