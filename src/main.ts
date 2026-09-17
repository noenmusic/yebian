import './style.css';
import { NOTES, PRESETS, REFERENCE_MAP } from './data';
import { Store, STORAGE_KEY, MAX_NOTE_CHARS, MAX_MESSAGE_CHARS, escapeHtml as esc, countChars, clampText, matchNotes, sendNote, replyTo, addConversation, addMessage, hasSafetyRisk, isPortraitTemplate, type Entry } from './logic';
import { mountPortrait, portraitMarkup, portraitSvg, rasterizePreset, type PortraitEditor } from './portrait';
import { bindEffects, fxCleanup, confettiSend, confettiReply, showToastStar, stopToastStar } from './fx';
import { clickSound, flipSound, fireworkSound, setVolume, startAmbient, unlockAmbient } from './sound';
import { spotSticker, cardSticker } from './stickers';

const app = document.querySelector<HTMLDivElement>('#app')!;
const modal = document.querySelector<HTMLDialogElement>('#modal')!;
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { /* The Store explicitly reports memory-only mode. */ }
const store = new Store(storage);
store.save();
let editor: PortraitEditor | null = null;
let chatEditor: PortraitEditor | null = null;
let route = location.hash || '#write';
let toastTimer = 0;
let safetyBack = '#write';
let dragCleanup: (() => void) | null = null;
let pendingExternal: string | null | undefined;
const star = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 3 4 15 15 5-15 5-4 16-5-16L4 23l15-5Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m36 5 1 5 5 1-5 1-1 5-1-5-5-1 5-1Z" fill="currentColor"/></svg>';
const arrow = '<span aria-hidden="true">↗</span>';
const LINEART_TEMPLATE = '/templates/tpl-lineart-1.png';
// 纸条头像：从模板池里取（0–5 内置简笔画，6/7 走线条画模板）。按纸条自带的编号分配，
// 既保证八张卡各不相同，又不会在每次重渲染时跳变。
const NOTE_TEMPLATE_COUNT = 7;
function templateAvatarMarkup(index: number): string {
  return index >= 6 ? `<img src="${LINEART_TEMPLATE}" alt="" />` : portraitSvg(index);
}
function noteAvatarMarkup(note: { id: string; portrait: number }): string {
  // 0–5 用六款内置简笔画，6 及以上统一走线条画模板（data.ts 里是 6/7）
  return templateAvatarMarkup(Math.min(note.portrait, 6));
}
// 默认头像：用户还没画自画像时用线条画顶着
function avatarOrDefaultMarkup(value: string | null): string {
  return value ? portraitMarkup(value) : `<img src="${LINEART_TEMPLATE}" alt="默认头像" />`;
}
const s = () => store.state;
const formatDate = (value: string) => new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
// WAAPI 弹簧：贴纸「啪」入、主按钮按压反馈、toast 出现（零依赖增量；base 保留元素已有位移，如 toast 的居中 translate）
function pop(el: HTMLElement, base = '', from = 1.35) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.animate([
    { transform: `${base} scale(${from})` },
    { transform: `${base} scale(.92)` },
    { transform: `${base} scale(1)` },
  ], { duration: 340, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}
function toast(message: string, star = false) {
  const el = document.querySelector<HTMLElement>('#toast')!;
  const text = el.querySelector<HTMLElement>('#toast-message')!;
  text.textContent = message;
  el.classList.add('visible');
  if (star) showToastStar(); else stopToastStar();
  window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('visible'), 4500);
  pop(el, 'translate(-50%, 0)', 1.07);
}
function save() { store.save(); updateWarning(); }
function updateWarning() {
  const el = document.querySelector<HTMLElement>('#storage-warning');
  if (el) { el.textContent = store.warning; el.hidden = !store.warning; }
}
function navigate(next: string) { if (location.hash === next) render(); else location.hash = next; }
function dialog(title: string, body: string, confirm: string, action: () => void | Promise<void>, destructive = false) {
  if (modal.open) return;
  const opener = document.activeElement as HTMLElement | null;
  modal.innerHTML = `<form method="dialog"><div class="eyebrow">页边 · 小提醒</div><h2 id="dialog-title">${esc(title)}</h2><div class="dialog-body">${body}</div><div class="dialog-actions"><button class="button secondary" value="cancel" autofocus>再想一想</button><button type="button" id="dialog-confirm" class="button ${destructive ? 'danger' : 'primary'}">${esc(confirm)}</button></div></form>`;
  modal.showModal();
  modal.onclose = () => { if (opener?.isConnected) opener.focus(); };
  modal.querySelector('#dialog-confirm')!.addEventListener('click', async () => {
    const button = modal.querySelector<HTMLButtonElement>('#dialog-confirm')!; button.disabled = true;
    try { await action(); modal.close(); } catch { button.disabled = false; toast('这一步没有完成，请再试一次。你的草稿仍在。'); }
  });
}
function heading(kicker: string, title: string, copy: string) {
  return `<div class="section-intro">${kicker ? `<div class="eyebrow light">${kicker}</div>` : ''}<h1 id="page-title" tabindex="-1">${title}</h1>${copy ? `<p>${copy}</p>` : ''}</div>`;
}
function templateGridMarkup(): string {
  const lineart = `<button data-lineart="1" aria-label="使用线条画模板"><img src="${LINEART_TEMPLATE}" alt="线条画模板" /></button>`;
  const built = Array.from({ length: 6 }, (_, i) => `<button data-portrait="${i}" aria-label="使用第${i + 1}种简笔自画像">${portraitSvg(i)}</button>`);
  const custom = s().portraitTemplates.map((url, i) => `<button data-template="${i}" aria-label="${esc(`使用保存的模板${i + 1}`)}"><img src="${url}" alt="${esc(`保存的模板 ${i + 1}`)}" /></button>`);
  return lineart + built.concat(custom).join('');
}
function chatTemplatesMarkup(): string {
  const built = Array.from({ length: 6 }, (_, i) => `<button type="button" data-drawing="${i}" aria-label="选择第${i + 1}张简笔画">${portraitSvg(i)}</button>`);
  const custom = s().portraitTemplates.map((url, i) => `<button type="button" data-chat-template="${i}" aria-label="${esc(`使用保存的模板${i + 1}`)}"><img src="${url}" alt="${esc(`保存的模板 ${i + 1}`)}" /></button>`);
  return built.concat(custom).join('');
}
function updateReaderTools() {
  const undo = document.querySelector<HTMLButtonElement>('#undo-portrait-btn');
  const saveTemplate = document.querySelector<HTMLButtonElement>('#save-template-btn');
  if (undo) undo.disabled = editor ? !editor.hasStrokes() : true;
  if (saveTemplate) saveTemplate.disabled = editor ? (editor.empty() && !s().portrait) : !s().portrait;
}
function shell(body: string, section: string) {
  return `<header class="site-header"><a href="#write" class="brand" aria-label="页边首页"><span class="brand-words"><img class="brand-logo" src="/logo-yebian.png" alt="页边" /><img class="brand-sub" src="/logo-margin.png" alt="THE MARGIN" /></span></a><nav aria-label="主导航"><a href="#write" ${section === 'write' ? 'aria-current="page"' : ''}><img class="nav-img" src="/nav-write.png" alt="写一行" /></a><a href="#book" ${section === 'book' ? 'aria-current="page"' : ''}><img class="nav-img" src="/nav-book.png" alt="页边册" /></a></nav><div class="header-actions"><a href="#messages" class="bell${s().conversations.length ? '' : ' quiet'}" ${section === 'messages' ? 'aria-current="page"' : ''} aria-label="页边往来"><i></i></a><a href="#reader" class="portrait-entry" ${section === 'reader' ? 'aria-current="page"' : ''} aria-label="读者证">${avatarOrDefaultMarkup(s().portrait)}</a></div></header>
  <div class="system-notices"><p id="storage-warning" class="warning" role="status" ${store.warning ? '' : 'hidden'}>${esc(store.warning)}</p><p id="sync-warning" class="warning" hidden>另一标签页有更新。<button data-action="sync">载入更新</button>（将替换当前页面状态，请先保存自画像）</p></div>
  <main id="main-content" tabindex="-1">${body}</main><footer class="site-footer"><span>同路星光 <span class="footer-cross">×</span> 页边</span><p>生活是一本书。这里，留给你的那一行。</p><label class="volume-control" title="音效音量（默认 -6.0dB）"><span>音量</span><input type="range" id="volume-slider" min="0" max="1" step="0.05" value="${s().volume}" aria-label="音效音量"></label><button class="footer-link" data-action="settings">重置</button><a href="#help">需要一点帮助？ ${arrow}</a></footer>`;
}
function home() {
  return shell(`<div class="desk-layout home-layout"><aside class="left-column">${heading('', '<span class="hand-heading"><img src="/heading-line1.png" alt="生活很厚" /><img src="/heading-line2.png" alt="页边，留一点空白。" /></span>', '不必是一段完整的故事。<br>一句正在经历的事，就很好。')}</aside>
  <section class="paper writing-paper tilt-card" aria-labelledby="write-title"><div class="tilt-shadow"></div><div class="tilt-face"></div><div class="paper-mark" aria-hidden="true">${avatarOrDefaultMarkup(s().portrait)}</div><div class="paper-sticker sticker-left" aria-hidden="true"><img src="${spotSticker()}" alt="" /></div><div class="paper-body"><h2 id="write-title">此刻，你读到生活的哪一页？</h2><form id="write-form"><label class="sr-only" for="note-input">此刻的一句话，最多200个Unicode字符</label><div class="ruled-input"><textarea id="note-input" rows="4" placeholder="最近，我……" aria-describedby="input-count" spellcheck="false">${esc(s().draft)}</textarea><div class="input-meta"><span id="input-count" aria-live="polite">${countChars(s().draft)} / ${MAX_NOTE_CHARS}</span></div></div><div class="write-submit"><button type="submit" class="button primary" id="match-submit" ${!s().draft.trim() ? 'disabled' : ''}>寻找共鸣的纸条 <span aria-hidden="true">→</span></button></div></form></div></section></div>`, 'write');
}
function matchPage() {
  const session = s().session;
  if (!session) return home();
  const matches = matchNotes(session.text);
  const current = matches.find(m => !session.skipped.includes(m.note.id));
  const intro = heading('', '也许，<br>我们读到了<br>相近的地方。', '');
  if (!current) return shell(`<div class="desk-layout matching-layout"><aside class="left-column">${intro}<a class="desk-link" href="#write">← 回去改写一句话</a></aside><section class="paper empty-paper"><div class="empty-drawing">${star}</div><div class="eyebrow">本轮已翻完 · ${NOTES.length} / ${NOTES.length}</div><h2>先把书签夹在这里。</h2><p>纸条都读过了。<br>可以重新翻阅，也可以换一句话再来。</p><button class="button primary" data-action="refresh">重新翻阅这 ${NOTES.length} 张 <span aria-hidden="true">↻</span></button><p class="tiny muted">重新翻阅不会生成新纸条。</p></section></div>`, 'write');
  const { note, hits, reason } = current;
  return shell(`<div class="desk-layout matching-layout"><aside class="left-column">${intro}<div class="your-line"><p>“${esc(session.text)}”</p><a href="#write">重新写一行 ${arrow}</a></div></aside><section class="match-stage" aria-label="纸条"><div class="stage-top"><span aria-hidden="true"></span><span>${String(session.skipped.length + 1).padStart(2, '0')} <i>/ ${String(NOTES.length).padStart(2, '0')}</i></span></div><article class="paper match-card tilt-card" id="swipe-card" data-note="${note.id}" tabindex="0" role="button" aria-label="展开阅读：${note.title}。也可使用下方按钮翻过或递出。"><div class="tilt-shadow"></div><div class="tilt-face"></div><span class="drag-indicator left" aria-hidden="true">翻过这一页</span><span class="drag-indicator right" aria-hidden="true">递出纸条</span><div class="paper-top"><span class="tiny">读者 · ${note.number}</span><span class="mini-portrait">${noteAvatarMarkup(note)}</span></div><div class="note-card-body"><div class="eyebrow">${note.title}</div><p class="handwritten">${note.text}</p><div class="tags">${note.tags.map(tag => `<span>${tag}</span>`).join('')}</div></div><div class="card-bottom"><span>点击纸条，展开读一读</span><span aria-hidden="true">⤢</span></div><div class="paper-sticker sticker-right" aria-hidden="true"><img src="${cardSticker(note.id)}" alt="" /></div></article><details class="match-reason"><summary>为什么翻到这一页？</summary><p>${esc(reason)}</p></details><div class="swipe-actions"><button class="button secondary" data-action="skip"><span aria-hidden="true">←</span> 翻过这一页</button><button class="button primary" data-action="send">递出一张纸条 <span aria-hidden="true">→</span></button></div><p class="stage-hint">左滑翻过 · 右滑递出</p></section></div>`, 'write');
}
function quoteMarkup(noteId: string) {
  const ref = REFERENCE_MAP[noteId];
  if (!ref) return '';
  return `<aside class="reference"><div class="eyebrow">正文的一小段 / 知乎公开内容</div><blockquote>${esc(ref.excerpt)}</blockquote><a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} ${arrow}</a><p>${esc(ref.author)} · 缓存时 ${ref.votes} 赞同</p><small>${esc(ref.source)} · ${ref.cachedOn}<br>引用作者不是本页的读者。</small></aside>`;
}
function detailPage(entry: Entry) {
  const note = NOTES.find(n => n.id === entry.noteId)!;
  return shell(`<div class="desk-layout detail-layout"><aside class="left-column">${heading('02 / 一页往来', entry.reply === null ? '一张纸条，<br>有了回声。' : '这一页，<br>已好好收起。', '')}<div class="archive-stamp">${entry.reply !== null ? '已留批注' : '已经递出'}<small>${formatDate(entry.createdAt)}</small></div><a class="desk-link" href="#book">← 查看我的页边册</a></aside><section class="paper correspondence tilt-card"><div class="tilt-shadow"></div><div class="tilt-face"></div><div class="paper-top"><span class="eyebrow">归档 / ${entry.day}</span><span class="status-tag">${entry.reply !== null ? '已回批注' : '已递出 · 待批注'}</span></div><div class="paper-body"><div class="correspondence-row"><span class="row-label">我递出的</span><p>${esc(entry.text)}</p></div><div class="received-note"><div class="received-heading"><div class="mini-portrait">${noteAvatarMarkup(note)}</div><div><h2>${note.title}</h2><span class="tiny muted">读者 ${note.number}</span></div></div><p class="note-text">${note.text}</p><p class="demo-reply">${note.reply}</p></div>${quoteMarkup(note.id)}${entry.reply !== null ? `<div class="saved-reply"><div class="eyebrow">我留下的批注</div><p>${esc(entry.reply)}</p><span class="sticker">${star} 认真读过</span><small>贴纸 · ${formatDate(entry.repliedAt!)}</small></div>` : `<form id="reply-form" data-entry="${entry.id}" class="reply-form"><label for="reply-input">留一行批注，就把这一页收好。</label><p class="tiny muted">每张纸条只能回一次。</p><textarea id="reply-input" rows="3" placeholder="读到这里，我想说……" aria-describedby="reply-count">${esc(entry.replyDraft)}</textarea><div class="reply-footer"><span id="reply-count" aria-live="polite">${countChars(entry.replyDraft)} / ${MAX_NOTE_CHARS}</span><button class="button primary" id="reply-submit" ${!entry.replyDraft.trim() ? 'disabled' : ''}>留下批注 ${arrow}</button></div></form>`}</div><div class="paper-bottom"><span>不是即时聊天 · 一页只留一回批注</span><a href="#book">夹回册子 →</a></div></section></div>`, 'book');
}
function bookPage() {
  return shell(`<div class="desk-layout book-layout"><aside class="left-column">${heading('', '一些小事。<br>一些，<br>留下来的字。', '')}<div class="book-stats"><div><strong>${s().entries.length.toString().padStart(2, '0')}</strong><span>页递出</span></div></div></aside><section class="paper book-paper tilt-card"><div class="tilt-shadow"></div><div class="tilt-face"></div>${s().entries.length ? `<div class="archive-list">${s().entries.map((e, i) => `<a class="archive-item" href="#note/${e.id}"><span class="archive-index">${String(s().entries.length - i).padStart(2, '0')}</span><div><span class="tiny muted">${e.day}</span><h2>${esc(e.text)}</h2><p>${NOTES.find(n => n.id === e.noteId)!.title}</p><span class="status-tag">${e.reply === null ? '已递出 · 待批注' : '已回批注 · 认真读过'}</span></div><span aria-hidden="true">↗</span></a>`).join('')}</div>` : `<div class="book-empty"><h2>第一张纸条，还在路上。</h2><a href="#write" class="button primary">去写第一行 <span aria-hidden="true">→</span></a></div>`}</section></div>`, 'book');
}
function messagesPage() {
  const c = s().conversations[0];
  if (!c) return shell(`<div class="desk-layout messages-layout"><aside class="left-column">${heading('', '隔着一行字，<br>慢慢写下去。', '读到同一页的人，就在这里。可以写字，也可以画几笔。')}<a class="desk-link" href="#book">← 回到页边册</a></aside><section class="paper messages-paper tilt-card"><div class="tilt-shadow"></div><div class="tilt-face"></div><div class="thread-empty"><div class="empty-drawing">${star}</div><h2>还没有消息。</h2><p>递出一张纸条后，回信会出现在这里。</p><a href="#write" class="button primary">去写第一行 <span aria-hidden="true">→</span></a></div></section></div>`, 'messages');
  return shell(`<div class="desk-layout messages-layout"><aside class="left-column">${heading('', '隔着一行字，<br>慢慢写下去。', '读到同一页的人，就在这里。可以写字，也可以画几笔。')}<a class="desk-link" href="#book">← 回到页边册</a></aside><section class="paper messages-paper tilt-card"><div class="tilt-shadow"></div><div class="tilt-face"></div><div class="message-thread"><div class="thread-reader"><div class="mini-portrait">${portraitSvg(Number(c.portrait.replace('preset:', '')))}</div><div><strong>${esc(c.readerName.replace('合成读者', '读者'))}</strong><span class="tiny muted">已读</span></div></div>${c.messages.map(m => `<div class="message-bubble ${m.sender === 'me' ? 'mine' : ''}">${m.image ? `<img src="${m.image}" alt="图片">` : ''}${m.drawing !== undefined ? `<div class="message-drawing">${portraitSvg(m.drawing)}</div>` : ''}${m.text ? `<p>${esc(m.text)}</p>` : ''}<small>${m.read ? '已读' : '未读'}</small></div>`).join('')}<form id="message-form" data-conversation="${esc(c.id)}" class="message-form"><label class="sr-only" for="message-input">私信内容，最多200个Unicode字符</label><textarea id="message-input" rows="3" maxlength="200" placeholder="写一条私信……" aria-describedby="message-count"></textarea><div class="message-tools"><label class="button secondary image-picker">添加图片<input id="message-image" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="button secondary drawing-toggle" data-action="toggle-drawings">发一张简笔画</button><span id="message-count">0 / ${MAX_MESSAGE_CHARS}</span><button class="button primary" type="submit">发送</button></div><div id="drawing-panel" class="drawing-panel" hidden><div id="paint-tools" class="paint-tools" aria-label="简笔画工具"><div class="colors" role="group" aria-label="画笔颜色">${[['#343630', '铅笔黑'], ['#62768a', '蜡笔蓝'], ['#8c9b80', '鼠尾草绿'], ['#bd816f', '陶土红'], ['#d4b76b', '暖黄']].map(([color, label], i) => `<button class="color-swatch" type="button" style="--swatch:${color}" data-color="${color}" aria-label="${label}" aria-pressed="${i === 0}"></button>`).join('')}</div><div class="width-tools" role="group" aria-label="画笔粗细"><button type="button" data-width="3" aria-pressed="false" aria-label="细画笔">细</button><button type="button" data-width="5" aria-pressed="true" aria-label="粗画笔">粗</button></div><button type="button" data-eraser aria-pressed="false">橡皮</button><button type="button" data-action="undo-chat" aria-label="撤回一笔" disabled>撤回一笔</button><button type="button" data-action="clear-chat">清空</button></div><div class="canvas-frame chat-frame"><canvas id="chat-portrait-canvas" aria-label="简笔画画布；不能使用指针时请用下方模板">你可以使用下方键盘可操作的简笔画模板。</canvas><span aria-hidden="true">画歪也没关系</span></div><div class="portrait-presets chat-templates" aria-label="简笔画模板">${chatTemplatesMarkup()}</div><button type="button" class="button primary" data-action="send-chat-drawing" disabled>发送这张画 <span aria-hidden="true">→</span></button><p class="tiny muted">手绘会存成图片；选中模板会按编号递出。没有表情包或贴纸。</p></div><p class="tiny muted">Enter 发送，Shift+Enter 换行。不能发送表情包。</p></form></div></section></div>`, 'messages');
}
function readerPage() {
  return shell(`<div class="desk-layout reader-layout"><aside class="left-column">${heading('03 / 我的读者证', '不必像谁。<br>画成自己，<br>就很好。', '这里不用照片，也没有粉丝数。<br>几根歪歪的线，就足够介绍你。')}<div class="reader-ticket"><span class="eyebrow">页边 · 读者证</span><div class="ticket-portrait" id="saved-preview">${avatarOrDefaultMarkup(s().portrait)}</div><strong>NO. ${s().reader}</strong><p>入册于 ${formatDate(s().joinedAt)}</p></div><a href="#book" class="desk-link">我的页边册 ${arrow}</a></aside><section class="paper portrait-paper"><div class="paper-top"><span class="eyebrow">此刻的自画像</span><span class="tiny" id="portrait-status">${s().portrait ? '已保存' : '尚未保存'}</span></div><div class="paper-body"><div class="portrait-heading"><h2>给自己画个小模样。</h2><p class="muted tiny">鼠标、手指或触控笔都可以。画布之外仍可滚动。</p></div><div id="paint-tools" class="paint-tools" aria-label="画笔工具"><div class="colors" role="group" aria-label="画笔颜色">${[['#343630', '铅笔黑'], ['#62768a', '蜡笔蓝'], ['#8c9b80', '鼠尾草绿'], ['#bd816f', '陶土红'], ['#d4b76b', '暖黄']].map(([color, label], i) => `<button class="color-swatch" type="button" style="--swatch:${color}" data-color="${color}" aria-label="${label}" aria-pressed="${i === 0}"></button>`).join('')}</div><div class="width-tools" role="group" aria-label="画笔粗细"><button data-width="3" aria-pressed="false" aria-label="细画笔">细</button><button data-width="5" aria-pressed="true" aria-label="粗画笔">粗</button></div><button data-eraser aria-pressed="false">橡皮</button><button id="undo-portrait-btn" data-action="undo-portrait" aria-label="撤回一笔" disabled>撤回一笔</button><button type="button" data-action="rebind-undo" class="undo-key" aria-label="设置撤回快捷键">撤销键 <kbd>${esc(shortcutLabel(s().undoKey))}</kbd></button><button data-action="clear-portrait">清空</button><button id="save-template-btn" data-action="save-template" disabled>存为模板</button></div><div class="canvas-frame tilt-frame"><div class="tilt-shadow"></div><div class="tilt-face"></div><canvas id="portrait-canvas" aria-label="自画像画布；不能使用指针时请用下方预设按钮">你可以使用下方键盘可操作的简笔画预设。</canvas><span aria-hidden="true">画歪也没关系</span></div><div class="portrait-options"><div><span class="tiny muted">不方便手绘？用一张简笔画开始，或选一个存好的模板</span><div class="portrait-presets" id="portrait-template-grid">${templateGridMarkup()}</div></div><button class="button primary" data-action="save-portrait">保存自画像 ${arrow}</button></div><p class="tiny muted">只保留最后保存的一张。自存模板最多 3 个。</p></div><div class="paper-bottom"><span>不以相貌认识彼此</span><span>以留在页边的一行字。</span></div></section></div>`, 'reader');
}
function helpPage() {
  return shell(`<div class="desk-layout"><aside class="left-column">${heading('给此刻的一点支持', '先停一停。<br>你不必独自<br>扛着这一刻。', '如果正感到难以承受，<br>可以先联系一个信任的人。')}</aside><section class="paper help-paper"><div class="paper-top"><span class="eyebrow">现实中的帮助，比一张纸条更重要</span></div><div class="paper-body"><h2>让一个真实的人，陪你一会儿。</h2><p>如果你或身边的人正有伤害自己的想法，请尽量远离可能造成伤害的物品，去有他人在的安全地方，并联系信任的人或专业支持。</p><a href="tel:12356" class="hotline"><span>全国统一心理援助热线<strong>12356</strong></span>${arrow}</a><div class="emergency"><p>如果存在立即危险，或已经受伤</p><a href="tel:110">拨打 110</a><a href="tel:120">拨打 120</a><span>也可前往最近的急诊寻求帮助。</span></div><div class="help-disclosure"><h3>关于这份提示</h3><p>这里只用有限的关键词规则提示可能的风险，并暂停普通推荐或批注提交。它不是诊断，可能误判，也可能漏检；不能识别所有危险，更不能代替专业帮助。这里没有实时值守人员。</p></div><button class="button secondary" data-action="back-from-help">返回，保留我的草稿 <span aria-hidden="true">←</span></button></div></section></div>`, 'write');
}
function render(focus = true) {
  editor?.destroy(); editor = null;
  chatEditor?.destroy(); chatEditor = null;
  dragCleanup?.(); dragCleanup = null;
  fxCleanup(); // 重渲染前清理 rough-notation 圈注、贴纸描边与旧观察器，避免元素尺寸变化后残留错位标注
  const path = route;
  let content: string;
  if (path === '#book') content = bookPage();
  else if (path === '#reader') content = readerPage();
  else if (path === '#messages') content = messagesPage();
  else if (path === '#help') content = helpPage();
  else if (path === '#match' && s().session) {
    if (hasSafetyRisk(s().session!.text)) { safetyBack = '#write'; content = helpPage(); }
    else content = matchPage();
  } else if (path.startsWith('#note/')) {
    const entry = s().entries.find(e => e.id === path.slice(6));
    content = entry ? detailPage(entry) : shell(`<section class="paper not-found"><h1 id="page-title" tabindex="-1">这张纸条不在本机册子里。</h1><p>可能已被重置，或链接来自另一台设备。</p><a class="button primary" href="#book">返回页边册</a></section>`, 'book');
  } else content = home();
  app.innerHTML = content;
  bindInputs(); bindSwipe(); bindTilt();
  setVolume(s().volume);
  const volumeSlider = document.querySelector<HTMLInputElement>('#volume-slider');
  volumeSlider?.addEventListener('input', () => { s().volume = Number(volumeSlider.value); save(); setVolume(s().volume); });
  const mainEl = document.querySelector<HTMLElement>('main');
  if (mainEl) { mainEl.classList.remove('page-in'); void mainEl.offsetWidth; mainEl.classList.add('page-in'); }
  const canvas = document.querySelector<HTMLCanvasElement>('#portrait-canvas');
  if (canvas) {
    try {
      editor = mountPortrait(canvas, s().portrait, dirty => {
        document.querySelector('#portrait-status')!.textContent = dirty ? '有未保存的笔画' : s().portrait ? '已保存' : '尚未保存';
        updateReaderTools();
      }, updateReaderTools);
      updateReaderTools();
    }
    catch (error) { toast(String(error)); canvas.hidden = true; }
  }
  if (focus) { document.querySelector<HTMLElement>('#page-title')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  updateWarning();
  if (pendingExternal !== undefined) document.querySelector<HTMLElement>('#sync-warning')!.hidden = false;
  bindEffects(); // 圈注 / 贴纸描边 / 星光呼吸：对新渲染的内容按需触发
}
function bindCounter(id: string, counterId: string, buttonId: string, max: number, change: (value: string) => void) {
  const input = document.querySelector<HTMLTextAreaElement>(`#${id}`);
  if (!input) return;
  let composing = false;
  function update(commit = true) {
    if (commit) {
      const previous = input!.value; input!.value = clampText(previous, max);
      if (input!.value !== previous) toast(`最多保留${max}个字符，超出部分没有保存。`);
      change(input!.value);
    }
    document.querySelector(`#${counterId}`)!.textContent = `${countChars(input!.value)} / ${max}${composing ? ' · 输入中' : ''}`;
    document.querySelector<HTMLButtonElement>(`#${buttonId}`)!.disabled = composing || !input!.value.trim();
  }
  input.addEventListener('compositionstart', () => { composing = true; update(false); });
  input.addEventListener('compositionend', () => { composing = false; update(); });
  input.addEventListener('input', () => update(!composing));
}
function bindInputs() {
  bindCounter('note-input', 'input-count', 'match-submit', MAX_NOTE_CHARS, value => { s().draft = value; save(); });
  bindCounter('reply-input', 'reply-count', 'reply-submit', MAX_NOTE_CHARS, value => {
    const id = document.querySelector<HTMLFormElement>('#reply-form')?.dataset.entry;
    const entry = s().entries.find(e => e.id === id); if (entry) { entry.replyDraft = value; save(); }
  });
  document.querySelector('#write-form')?.addEventListener('submit', e => {
    e.preventDefault(); const value = s().draft.trim(); if (!value) return;
    if (hasSafetyRisk(value)) { safetyBack = '#write'; navigate('#help'); return; }
    s().session = { text: value, skipped: [] }; save(); navigate('#match');
  });
  const messageForm = document.querySelector<HTMLFormElement>('#message-form');
  if (messageForm) {
    const form = messageForm;
    const input = messageForm.querySelector<HTMLTextAreaElement>('#message-input')!;
    const file = messageForm.querySelector<HTMLInputElement>('#message-image')!;
    const count = messageForm.querySelector<HTMLElement>('#message-count')!;
    input.addEventListener('input', () => { input.value = clampText(input.value, MAX_MESSAGE_CHARS); count.textContent = `${countChars(input.value)} / ${MAX_MESSAGE_CHARS}`; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); messageForm.requestSubmit(); } });
    const drawingPanel = messageForm.querySelector<HTMLElement>('#drawing-panel')!;
    let chatInk = false; let chatTemplate: number | null = null; let chatCustom: string | null = null;
    function updateChatTools() {
      const undo = form.querySelector<HTMLButtonElement>('[data-action="undo-chat"]');
      const send = form.querySelector<HTMLButtonElement>('[data-action="send-chat-drawing"]');
      if (undo) undo.disabled = chatEditor ? !chatEditor.hasStrokes() : true;
      if (send) send.disabled = !chatInk && chatTemplate === null && !chatCustom;
    }
    const onChatInk = () => { chatInk = true; chatTemplate = null; chatCustom = null; updateChatTools(); };
    function sendChatDrawing() {
      const c = s().conversations.find(x => x.id === form.dataset.conversation);
      if (!c) return;
      if (chatInk) {
        if (!chatEditor) { toast('当前浏览器无法保存手绘，请改用模板。'); return; }
        const data = chatEditor.exportPng();
        if (data.length >= 1000000) { toast('这张画太大，请清空后重新画。'); return; }
        if (!addMessage(c, '', data)) { toast('这张画未能递出，请再试一次。'); return; }
      } else if (chatTemplate !== null) {
        if (!addMessage(c, '', undefined, chatTemplate)) { toast('这张简笔画未能递出，请再试一次。'); return; }
      } else if (chatCustom) {
        if (!addMessage(c, '', chatCustom)) { toast('这张画未能递出，请再试一次。'); return; }
      } else { toast('先画几笔，或选一张简笔画。'); return; }
      save(); render(false); toast('这张画已递出。');
    }
    messageForm.addEventListener('click', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action="toggle-drawings"], [data-action="undo-chat"], [data-action="clear-chat"], [data-action="send-chat-drawing"], [data-drawing], [data-chat-template]');
      if (!target) return;
      if (target.dataset.action === 'toggle-drawings') { drawingPanel.hidden = !drawingPanel.hidden; return; }
      if (target.dataset.action === 'undo-chat') { chatEditor?.undo(); chatInk = chatEditor ? chatEditor.hasStrokes() : false; updateChatTools(); return; }
      if (target.dataset.action === 'clear-chat') { chatEditor?.clear(); chatInk = false; chatTemplate = null; chatCustom = null; updateChatTools(); return; }
      if (target.dataset.action === 'send-chat-drawing') { sendChatDrawing(); return; }
      if ('drawing' in target.dataset) {
        const index = Number(target.dataset.drawing);
        if (!Number.isInteger(index) || index < 0 || index > 5) return;
        chatEditor?.preset(index);
        chatInk = false; chatTemplate = index; chatCustom = null; updateChatTools();
        return;
      }
      if ('chatTemplate' in target.dataset) {
        const index = Number(target.dataset.chatTemplate);
        const url = s().portraitTemplates[index];
        if (!url) return;
        chatEditor?.applyImage(url);
        chatInk = false; chatTemplate = null; chatCustom = url; updateChatTools();
      }
    });
    const compressImage = (selected: File, done: (data: string) => void) => { const reader = new FileReader(); reader.onload = () => { const source = String(reader.result); const imageEl = new Image(); imageEl.onload = () => { const scale = Math.min(1, 1400 / Math.max(imageEl.naturalWidth, imageEl.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(imageEl.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(imageEl.naturalHeight * scale)); const ctx = canvas.getContext('2d'); if (!ctx) { toast('无法处理图片，请选择其他文件。'); return; } ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height); let quality = 0.82; let data = canvas.toDataURL('image/jpeg', quality); while (data.length > 900000 && quality > 0.42) { quality -= 0.08; data = canvas.toDataURL('image/jpeg', quality); } if (data.length > 1000000) { toast('图片压缩后仍然过大，请选择更小的图片。'); return; } done(data); }; imageEl.onerror = () => toast('图片读取失败，请重试。'); imageEl.src = source; }; reader.onerror = () => toast('图片读取失败，请重试。'); reader.readAsDataURL(selected); };
    messageForm.addEventListener('submit', e => { e.preventDefault(); const c = s().conversations.find(x => x.id === messageForm.dataset.conversation); if (!c) return; const selected = file.files?.[0]; if (selected && !/^image\/(png|jpeg|webp)$/.test(selected.type)) { toast('只支持 PNG、JPG 或 WebP 图片。'); return; } if (selected && selected.size > 5 * 1024 * 1024) { toast('图片超过5MB，请选择更小的图片。'); return; } const finish = (data?: string) => { if (!addMessage(c, input.value, data)) { toast('私信不能为空或包含不安全内容。'); return; } save(); render(false); }; if (selected) compressImage(selected, finish); else finish(); });
    const chatCanvas = messageForm.querySelector<HTMLCanvasElement>('#chat-portrait-canvas');
    if (chatCanvas) {
      try { chatEditor = mountPortrait(chatCanvas, null, () => updateChatTools(), onChatInk); updateChatTools(); }
      catch (error) { toast(String(error)); chatCanvas.hidden = true; }
    }
  }
  document.querySelector<HTMLFormElement>('#reply-form')?.addEventListener('submit', e => {
    e.preventDefault(); const id = (e.currentTarget as HTMLFormElement).dataset.entry!;
    const input = document.querySelector<HTMLTextAreaElement>('#reply-input')!;
    const value = clampText(input.value).trim(); if (!value) return;
    if (hasSafetyRisk(value)) { safetyBack = route; navigate('#help'); return; }
    dialog('把这一行夹进册子？', '<p>保存后，这张纸条不能再回第二次。</p>', '确认留下批注', async () => {
      await withStateLock(() => {
        store.refresh();
        if (replyTo(s(), id, value)) { save(); render(); toast('这一行已收好。获得一枚「认真读过」贴纸。'); window.setTimeout(() => { const sticker = document.querySelector<HTMLElement>('.sticker'); if (sticker) pop(sticker); confettiReply(); }, 180); }
        else { render(); toast('这页已经回过批注，或记录已改变。没有重复保存。'); }
      });
    });
  });
}
let stateQueue: Promise<void> = Promise.resolve();
function withStateLock(action: () => void) {
  const next = stateQueue.then(() => action());
  stateQueue = next;
  return next;
}
function currentMatch() {
  return s().session ? matchNotes(s().session!.text).find(m => !s().session!.skipped.includes(m.note.id)) : undefined;
}
function skip() {
  const match = currentMatch(); if (!match || !s().session) return;
  s().session!.skipped.push(match.note.id); save(); flipSound(); render(false);
  document.querySelector<HTMLElement>('#swipe-card, #page-title')?.focus({ preventScroll: true });
  toast('翻过这一页，不代表不喜欢。');
}
function requestSend(fromSwipe = false) {
  const match = currentMatch(); if (!match || !s().session) return;
  const noteId = match.note.id, snapshot = s().session!.text;
  let sent = false;
  // 右滑把纸片飞出屏幕后如果反悔取消，就把同一张纸条请回来
  if (fromSwipe) modal.addEventListener('close', () => { if (!sent) render(false); }, { once: true });
  dialog('把这张纸条递出去？', `<p>会把你的这句话与这张纸条一起归档，并展示一条回信。</p><div class="dialog-quote">${esc(snapshot)}</div>`, '确认递出', async () => {
    await withStateLock(() => {
      store.refresh();
      if (!s().session || s().session!.text !== snapshot) { render(); toast('另一标签页改变了当前纸条，请重新确认后递出。'); return; }
      const entry = sendNote(s(), noteId);
      if (entry) { sent = true; addConversation(s(), entry); save(); flipSound(); navigate(`#note/${entry.id}`); toast('已递出并归档。这是一条回信。', true); window.setTimeout(() => { fireworkSound(); confettiSend(); }, 480); }
      else { render(); toast('今天已递出，或记录已改变。没有重复投递。'); }
    });
  });
}
function expandNote() {
  const match = currentMatch(); if (!match) return;
  dialog(match.note.title, `<p class="note-text">${esc(match.note.text)}</p><p class="tiny muted">读者 ${match.note.number}</p><div class="dialog-quote">${esc(match.reason)}</div>${quoteMarkup(match.note.id)}`, '读完了，继续翻页', () => {});
}
function bindTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // .tilt-card 自己倾斜；.tilt-frame（画布纸）只让纸张层倾斜，画布保持水平
  document.querySelectorAll<HTMLElement>('.tilt-card, .tilt-frame').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      card.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
      card.style.setProperty('--ry', `${(x - 0.5) * 12}deg`);
      card.style.setProperty('--mx', `${(x - 0.5) * 24}px`);
      card.style.setProperty('--my', `${(0.5 - y) * 18}px`);
      // 纸面右上角那张简笔画：朝相反方向小幅错位（景深感），跟着鼠标一起动
      card.style.setProperty('--pmx', `${(x - 0.5) * -12}px`);
      card.style.setProperty('--pmy', `${(0.5 - y) * -9}px`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--mx', '0px');
      card.style.setProperty('--my', '0px');
      card.style.setProperty('--pmx', '0px');
      card.style.setProperty('--pmy', '0px');
    });
  });
}
// 进入匹配页时的一次性滑动提示：纸条自己轻轻左右晃一次（方向演示），左右边距里浮出两枚淡箭头。
// 箭头在正文从不占用的两侧留白里，不压字；2.6 秒后自己淡出，用户一动手（按下/按键）立刻收掉。
// 减少动态偏好下完全不提示；已经翻过牌说明会用，也不再打扰。
let coachTimer = 0;
function coachSwipe(card: HTMLElement, reduce: boolean) {
  if (reduce) return;
  if (s().session?.skipped.length) return;
  window.clearTimeout(coachTimer);
  const cue = document.createElement('div');
  cue.className = 'swipe-cue';
  cue.setAttribute('aria-hidden', 'true');
  cue.innerHTML = '<span>←</span><span>→</span>';
  card.appendChild(cue);
  const onInteract = () => stop();
  const stop = (immediate = false) => {
    window.clearTimeout(coachTimer);
    document.removeEventListener('pointerdown', onInteract, true);
    document.removeEventListener('keydown', onInteract, true);
    card.classList.remove('coach');
    window.setTimeout(() => cue.remove(), immediate ? 0 : 500); // 等淡出跑完再摘掉
  };
  card.classList.add('coach');
  // 用独立的 translate 属性做晃动：不碰 transform，就不会和倾斜/拖拽的 transform 打架
  card.animate([
    { translate: '0 0' }, { translate: '-13px 0' }, { translate: '0 0' }, { translate: '13px 0' }, { translate: '0 0' },
  ], { duration: 1700, easing: 'ease-in-out' });
  coachTimer = window.setTimeout(() => stop(), 2600);
  document.addEventListener('pointerdown', onInteract, true);
  document.addEventListener('keydown', onInteract, true);
}
function bindSwipe() {
  const card = document.querySelector<HTMLElement>('#swipe-card'); if (!card) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  coachSwipe(card, reduce);
  let active: number | null = null, x = 0, y = 0, dx = 0, mode = '', moved = false;
  const clear = () => { active = null; card.style.transform = ''; card.classList.remove('dragging', 'toward-left', 'toward-right'); };
  // 松手回中：从当前拖拽位置弹回居中的倾斜位（果冻回弹，学 Tinder）
  const springBack = () => {
    const from = card.style.transform || 'translateX(0px) rotate(0deg)';
    card.classList.remove('toward-left', 'toward-right');
    if (reduce) { clear(); return; }
    const rx = card.style.getPropertyValue('--rx') || '0deg';
    const ry = card.style.getPropertyValue('--ry') || '0deg';
    const rest = `rotate(-.8deg) perspective(1200px) rotateX(${rx}) rotateY(${ry})`;
    const anim = card.animate([{ transform: from }, { transform: rest }], { duration: 540, easing: 'cubic-bezier(.3, 1.42, .4, 1)' });
    anim.onfinish = () => { card.classList.remove('dragging'); card.style.transform = ''; };
  };
  // 达到阈值：朝滑出方向飞离屏幕，再执行翻过/递出
  const flyOut = (sign: number, after: () => void) => {
    const from = card.style.transform || 'translateX(0px) rotate(0deg)';
    card.classList.remove('toward-left', 'toward-right');
    if (reduce) { clear(); after(); return; }
    const exit = Math.max(window.innerWidth, 900) * 1.15 * sign;
    const anim = card.animate([
      { transform: from },
      { transform: `translateX(${exit}px) rotate(${sign * 15}deg)` },
    ], { duration: 320, easing: 'cubic-bezier(.25, .6, .35, 1)' });
    anim.onfinish = () => { card.style.transform = `translateX(${exit}px) rotate(${sign * 15}deg)`; after(); };
  };
  card.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    active = e.pointerId; x = e.clientX; y = e.clientY; dx = 0; mode = ''; moved = false;
  });
  const move = (e: PointerEvent) => {
    if (active !== e.pointerId) return;
    dx = e.clientX - x; const dy = e.clientY - y;
    if (!mode && Math.hypot(dx, dy) > 9) { mode = Math.abs(dx) > Math.abs(dy) * 1.25 ? 'drag' : 'scroll'; moved = true; }
    if (mode !== 'drag') return;
    card.setPointerCapture(e.pointerId); card.classList.add('dragging');
    // 阻尼钳制：先 1:1 跟手到 220px，再往外只跟 35%，不会突然「撞墙」
    const limit = Math.min(220, card.clientWidth * .42);
    const sign = dx < 0 ? -1 : 1;
    const mag = Math.abs(dx);
    const tx = sign * (mag <= limit ? mag : limit + (mag - limit) * .35);
    card.style.transform = `translateX(${tx}px) rotate(${tx / 30}deg)`;
    card.classList.toggle('toward-left', dx < -45); card.classList.toggle('toward-right', dx > 45);
  };
  const up = (e: PointerEvent) => {
    if (active !== e.pointerId) return;
    const valid = mode === 'drag' && Math.abs(dx) > Math.min(95, card.clientWidth * .25);
    const direction = dx;
    active = null;
    if (valid) flyOut(direction < 0 ? -1 : 1, direction < 0 ? skip : () => requestSend(true));
    else springBack();
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', clear);
  card.addEventListener('click', e => { if (!moved && !modal.open) expandNote(); else e.preventDefault(); moved = false; });
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expandNote(); } });
  dragCleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
}
function savePortrait() {
  if (!editor) { toast('请选择一个简笔画预设。'); return; }
  try {
    s().portrait = editor.save(); save();
    document.querySelector('#saved-preview')!.innerHTML = portraitMarkup(s().portrait);
    document.querySelector('#portrait-status')!.textContent = store.warning ? '保存在本页 · 请查看存储提示' : '已保存于本机';
    toast(store.warning ? '自画像已留在本页，请留意顶部存储提示。' : '自画像收好了。下次打开，还会是这张。');
  } catch { toast('自画像未能保存，请尝试使用简笔画预设。'); }
}
function saveTemplate() {
  if (s().portraitTemplates.length >= 3) { toast('模板已存满，最多保存3个。'); return; }
  const finish = (data: string) => {
    if (!isPortraitTemplate(data)) { toast('这张画太大或格式不支持，未能存为模板。'); return; }
    dialog('把这张画存为模板？', '<p>会把当前画布存成一张模板，出现在模板栏里，以后可以直接选用。最多保存 3 个。</p>', '确认存为模板', () => {
      s().portraitTemplates.push(data); save();
      const grid = document.querySelector<HTMLElement>('#portrait-template-grid');
      if (grid) grid.innerHTML = templateGridMarkup();
      updateReaderTools();
      toast('模板已存好，出现在模板栏里。');
    });
  };
  const portrait = s().portrait;
  if (editor && !editor.empty()) finish(editor.exportPng());
  else if (portrait?.startsWith('data:image/png;base64,')) finish(portrait);
  else if (portrait?.startsWith('preset:')) rasterizePreset(Number(portrait.slice(7))).then(finish).catch(() => toast('模板未能生成，请再试一次。'));
  else toast('画布还是空的。先画几笔，或先保存一张自画像。');
}
app.addEventListener('click', e => {
  // 按钮类交互统一给一个点击音；画布、输入框等非按钮点击不响
  if ((e.target as Element).closest?.('button, a[href], summary')) clickSound();
  const button = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-preset], [data-portrait], [data-template], [data-lineart]'); if (!button) return;
  if ('preset' in button.dataset) {
    s().draft = PRESETS[Number(button.dataset.preset)]; save();
    const input = document.querySelector<HTMLTextAreaElement>('#note-input')!; input.value = s().draft; input.dispatchEvent(new Event('input')); input.focus(); return;
  }
  if ('portrait' in button.dataset) {
    const apply = () => {
      if (editor) editor.preset(Number(button.dataset.portrait));
      else { s().portrait = `preset:${button.dataset.portrait}`; save(); document.querySelector('#saved-preview')!.innerHTML = portraitMarkup(s().portrait); toast('已保存预设自画像。'); }
    };
    if (editor?.dirty || s().portrait) dialog('换成这张简笔画？', '<p>会替换当前画布。尚未保存的笔画将被清除，已保存的自画像要再次保存才会替换。</p>', '替换画布', apply, true); else apply();
    return;
  }
  if ('lineart' in button.dataset) {
    const apply = () => { if (editor) { editor.applyImage(LINEART_TEMPLATE); updateReaderTools(); } else toast('画布不可用，换用其他模板试试。'); };
    if (editor?.dirty || s().portrait) dialog('换成这张线条画？', '<p>会替换当前画布。尚未保存的笔画将被清除，已保存的自画像要再次保存才会替换。</p>', '替换画布', apply, true); else apply();
    return;
  }
  if ('template' in button.dataset) {
    const index = Number(button.dataset.template);
    const url = s().portraitTemplates[index];
    if (!url) return;
    const apply = () => {
      if (editor) editor.applyImage(url);
      else { s().portrait = url; save(); document.querySelector('#saved-preview')!.innerHTML = portraitMarkup(s().portrait); toast('已把这个模板保存为自画像。'); }
    };
    if (editor?.dirty || s().portrait) dialog('换成这个模板？', '<p>会替换当前画布。尚未保存的笔画将被清除，已保存的自画像要再次保存才会替换。</p>', '替换画布', apply, true); else apply();
    return;
  }
  switch (button.dataset.action) {
    case 'skip': skip(); break;
    case 'send': requestSend(); break;
    case 'refresh': if (s().session) { s().session!.skipped = []; save(); render(); toast('重新翻阅同一组纸条。'); } break;
    case 'back-from-help': navigate(safetyBack); break;
    case 'save-portrait': savePortrait(); break;
    case 'undo-portrait': editor?.undo(); updateReaderTools(); break;
    case 'rebind-undo': bindUndoKey(); break;
    case 'save-template': saveTemplate(); break;
    case 'clear-portrait': dialog('清空这张画布？', '<p>当前画布上的笔画将被清除。之前保存的自画像不变，除非你再次点击保存。</p>', '确认清空画布', () => editor?.clear(), true); break;
    case 'sync': {
      const apply = () => { if (pendingExternal !== undefined) store.accept(pendingExternal); pendingExternal = undefined; if (editor) editor.dirty = false; render(); toast('已载入另一标签页的记录。'); };
      if (editor?.dirty) dialog('载入其他标签页的记录？', '<p>当前未保存的画布笔画会丢失。</p>', '放弃笔画并载入', apply, true); else apply(); break;
    }
    case 'settings': dialog('关于页边', `<p>《页边》由同路星光制作。</p><p>重置只移除本应用的 <code>${STORAGE_KEY}</code> 存储项，会清除草稿、归档、自画像和编号，不影响其他网站数据。</p>${editor?.dirty ? '<p><strong>当前尚未保存的画布笔画也会丢失。</strong></p>' : ''}`, '确认重置全部数据', () => {
      if (editor) editor.dirty = false; store.reset(); pendingExternal = undefined; navigate('#write'); toast('本应用数据已重置。');
    }, true); break;
  }
});
document.querySelector('.skip-link')!.addEventListener('click', e => {
  e.preventDefault(); document.querySelector<HTMLElement>('#main-content')?.focus();
});
let pageTimer = 0;
window.addEventListener('hashchange', () => {
  const next = location.hash || '#write';
  if (editor?.dirty) {
    history.replaceState(null, '', route);
    dialog('自画像还有未保存的笔画', '<p>离开会放弃这些笔画。想保留它们，请先取消，然后点击“保存自画像”。</p>', '放弃笔画并离开', () => { if (editor) editor.dirty = false; navigate(next); }, true);
    return;
  }
  const mainEl = document.querySelector<HTMLElement>('main');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const apply = () => { route = next; if (modal.open) modal.close(); render(); };
  window.clearTimeout(pageTimer);
  if (mainEl && !reduce) {
    mainEl.classList.add('page-leaving');
    pageTimer = window.setTimeout(apply, 150);
  } else apply();
});
window.addEventListener('beforeunload', e => { if (editor?.dirty) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('storage', e => {
  if (e.key !== STORAGE_KEY) return;
  // Never re-render an active canvas or textarea from an unrelated external update.
  pendingExternal = e.newValue;
  const warning = document.querySelector<HTMLElement>('#sync-warning'); if (warning) warning.hidden = false;
});
function bindPaperCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  // 写在纸面上＝铅笔，离开纸面回到小手。留一圈回差防边界抖动，但不要留太宽：
  // 原来进 44px / 出 80px，纸条周围一大圈都算"纸面"，手指光标几乎看不到；
  // 现在收到 18px / 44px——铅笔只贴着纸条边缘出现，手指重新成为常态。
  const ENTER = 18;
  const EXIT = 44;
  for (const src of ['/hand-cursor.png', '/pencil-cursor.png']) { const img = new Image(); img.src = src; }
  let near = false;
  document.addEventListener('pointermove', e => {
    let inside = false;
    for (const el of document.querySelectorAll<HTMLElement>('.tilt-card, .tilt-frame, .match-card')) {
      const r = el.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      if (Math.hypot(dx, dy) <= (near ? EXIT : ENTER)) { inside = true; break; }
    }
    if (inside !== near) { near = inside; document.body.classList.toggle('paper-near', near); }
  });
}
// 撤回一笔的键盘快捷键，跨平台通用：
// · 存储格式 `ctrl+z`、`alt+u`、`f5`、`arrowleft`……其中 ctrl 代表平台主修饰键
//   （Mac 上是 ⌘、Windows/Linux 上是 Ctrl），匹配时 ctrlKey 与 metaKey 等价；
// · Ctrl/⌘+Z 始终兜底有效，用户改过的组合键永远优先尊重；
// · 只作用于读者证画布，输入法合成、弹窗打开、焦点在输入框时都不触发。
function normalizeShortcut(e: KeyboardEvent): string | null {
  if (e.isComposing || e.key === 'Process') return null;
  const key = e.key.toLowerCase();
  if (key === 'escape' || key === 'control' || key === 'meta' || key === 'shift' || key === 'alt' || key === 'tab') return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(key);
  return parts.join('+');
}
function shortcutMatches(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const key = parts.pop()!;
  if (e.key.toLowerCase() !== key) return false;
  const want = new Set(parts);
  if (want.has('ctrl') !== (e.ctrlKey || e.metaKey)) return false;
  if (want.has('shift') !== e.shiftKey) return false;
  if (want.has('alt') !== e.altKey) return false;
  return true;
}
function shortcutLabel(combo: string): string {
  const mac = /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
  const names: Record<string, string> = { ctrl: mac ? '⌘' : 'Ctrl', shift: mac ? '⇧' : 'Shift', alt: mac ? '⌥' : 'Alt', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', space: '空格', enter: '回车', backspace: '退格', delete: 'Del' };
  return combo.split('+').map(p => names[p] ?? p.toUpperCase()).join(mac ? '' : '+');
}
let bindingUndoKey = false;
function bindUndoShortcut() {
  document.addEventListener('keydown', e => {
    if (bindingUndoKey || route !== '#reader' || modal.open || !editor || e.isComposing) return;
    const target = e.target as Element | null;
    if (target && typeof target.closest === 'function' && target.closest('input, textarea, select, [contenteditable]')) return;
    if (!shortcutMatches(e, 'ctrl+z') && !shortcutMatches(e, s().undoKey)) return;
    e.preventDefault();
    if (editor.undo()) updateReaderTools();
  });
}
function bindUndoKey() {
  const btn = document.querySelector<HTMLButtonElement>('[data-action="rebind-undo"]');
  if (!btn) return;
  bindingUndoKey = true;
  const original = btn.innerHTML;
  const cancel = () => { bindingUndoKey = false; document.removeEventListener('keydown', onKey, true); btn.innerHTML = original; };
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { cancel(); return; }
    const combo = normalizeShortcut(e);
    if (!combo) { toast('单独按修饰键不行；用组合键（如 Ctrl+U）或单个字母、数字、F 键都可以。'); return; }
    s().undoKey = combo; save(); cancel();
    btn.innerHTML = `撤销键 <kbd>${esc(shortcutLabel(combo))}</kbd>`;
    toast(`撤回快捷键已改为 ${esc(shortcutLabel(combo))}。画一笔后按它试试。`);
  };
  document.addEventListener('keydown', onKey, true);
  btn.textContent = '按一个键…';
  toast('按下要设为「撤回」的组合键，Esc 取消。');
}
// 主按钮按压反馈：按下时小幅「啵」一下（WAAPI 弹簧，与 hover 的 CSS 过渡并存，不替换）
const primaryPop = (e: Event) => {
  const button = (e.target as HTMLElement).closest<HTMLElement>('.button.primary');
  if (button && !button.hasAttribute('disabled')) pop(button, '', 1.06);
};
app.addEventListener('pointerdown', primaryPop);
modal.addEventListener('pointerdown', primaryPop);
// 弹窗在 #app 之外，单独给它补上按钮点击音
modal.addEventListener('click', e => {
  if ((e.target as Element).closest?.('button')) clickSound();
});
render(false);
bindPaperCursor();
bindUndoShortcut();
// 环境声（草地上的雨）：进入页面即开始循环（静音待命），首次手势后出声——浏览器不允许零交互发声，这是能做到的极限
startAmbient();
const unlockAmbientOnce = () => {
  unlockAmbient();
  window.removeEventListener('pointerdown', unlockAmbientOnce);
  window.removeEventListener('keydown', unlockAmbientOnce);
};
window.addEventListener('pointerdown', unlockAmbientOnce);
window.addEventListener('keydown', unlockAmbientOnce);
