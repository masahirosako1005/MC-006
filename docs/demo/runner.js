// Kopa 3 分デモ ページ内ランナー(classic script。evaluate_script の format="script" で注入する)
// 使い方: 1) 注入  2) await __demo.prefetch({mute})  3) await __demo.run(1|2|3)  (結果は __demo.log。部ごとに 1 回の呼び出し)
// 台詞(LINES)は docs/demo/narration.md の [Nx] と同期させること(台詞を直したらここも直す)。
(() => {
  if (window.__demo && window.__demo.cleanup) window.__demo.cleanup();
  const BASE = '/nttw-demo';
  const VV = 'http://127.0.0.1:50021';
  const SPEAKER = 3, SPEED = 1.3;
  const LINES = {
    N0: 'はじめまして。今日ご紹介するのは、こぱあ。観光だけじゃなく、地方の街と人、そして人と人を、つなぐことをテーマにしたサービスです。人物も地名も、すべて架空のデモデータですよ。',
    N1a: 'では早速、グループを作りましょう。',
    N1b: '名前と行き先、日程を入れて、地方を選ぶと、',
    N1c: 'ほら、日本地図の中部が光りました。',
    N2a: 'ここがポイント。氏名や連絡先の欄は、ありません。',
    N2b: 'これで、募集中のグループができました。',
    N3a: '別の旅行者が二人、参加を申請してくれました。',
    N3b: '最少人数でもいい、という同意つきです。',
    N3c: '幹事は、承認を押すだけ。',
    N4a: 'あっという間に、最少人数に達しました。',
    N4b: 'ここから先は自動で進みます。幹事の手間は、ぐっと減りますね。',
    N5a: '続いて、宿のオーナーの画面です。',
    N5b: '青い棒が過去の実績、斜線の棒が、これからのグループ旅行の予定です。',
    N6a: '週を選ぶと、年代別の円グラフに変わります。',
    N6b: '混みそうな週には、部屋や席を用意しましょう、という提案も出ます。',
    N7a: '最後は、自治体の画面です。',
    N7b: '作成数、申請数、実行確定率が、地方別にひと目でわかります。',
    N8a: '五件未満の値は、少数と表示して、個人が特定されないようにしています。',
    N8b: '担当の地方だけを集計して、流入元もわかります。',
    N9: 'こぱあは、旅行者に仲間を、事業者に来訪の見込みを、自治体に安心できる集計を。ありがとうございました。',
  };
  const sl = (ms) => new Promise((r) => setTimeout(r, ms));
  const J = { 'Content-Type': 'application/json' };
  const prev = window.__demo || {}; // 再注入しても、先読み済みの音声と AudioContext は引き継ぐ
  const D = (window.__demo = { audio: prev.audio || {}, log: [], mute: false, t0: 0, ctx: prev.ctx || null, credit: null });
  const now = () => (D.t0 ? Math.round(performance.now() - D.t0) : 0);
  const rec = (kind, id, ev, extra) => D.log.push({ t: now(), kind, id, ev, ...(extra || {}) });

  // ---- 音声 ----
  D.ensureCtx = async () => {
    if (!D.ctx) D.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (D.ctx.state !== 'running') { try { await D.ctx.resume(); } catch (e) {} }
    return D.ctx.state;
  };
  async function synth(text) {
    const q = await (await fetch(`${VV}/audio_query?speaker=${SPEAKER}&text=${encodeURIComponent(text)}`, { method: 'POST' })).json();
    q.speedScale = SPEED;
    const wav = await (await fetch(`${VV}/synthesis?speaker=${SPEAKER}`, { method: 'POST', headers: J, body: JSON.stringify(q) })).arrayBuffer();
    return await D.ctx.decodeAudioData(wav);
  }
  D.prefetch = async (opt) => {
    D.mute = !!(opt && opt.mute);
    const st = await D.ensureCtx();
    const info = { ctx: st, ok: 0, fail: [], total: 0 };
    if (!D.mute) {
      for (const [id, text] of Object.entries(LINES)) {
        if (D.audio[id]) { info.ok++; continue; }
        try { D.audio[id] = await synth(text); info.ok++; } catch (e) { info.fail.push(id + ':' + e.message); }
      }
      info.total = +Object.values(D.audio).reduce((a, b) => a + b.duration, 0).toFixed(1);
    }
    // クレジット(常時表示)
    if (!D.credit) {
      const c = document.createElement('div');
      c.textContent = '音声: VOICEVOX:ずんだもん';
      c.style.cssText = 'position:fixed;left:6px;top:4px;z-index:2147483647;font:10px sans-serif;color:#555;background:rgba(255,255,255,.7);padding:1px 4px;border-radius:3px;pointer-events:none';
      document.body.appendChild(c);
      D.credit = c;
    }
    return info;
  };
  // 台詞: 開始 → 再生 → ended まで待つ。ids は続けて読む
  async function say(...ids) {
    for (const id of ids) {
      rec('S', id, 'start');
      const buf = D.audio[id];
      let dur = 0;
      if (D.mute || !buf) {
        dur = LINES[id].length / 6; await sl(dur * 1000);
      } else {
        dur = buf.duration;
        await D.ensureCtx();
        await new Promise((res) => {
          const s = D.ctx.createBufferSource(); s.buffer = buf; s.connect(D.ctx.destination);
          let done = false; const fin = () => { if (!done) { done = true; res(); } };
          s.onended = fin; s.start();
          setTimeout(fin, dur * 1000 + 1500); // 保険
        });
      }
      rec('S', id, 'end', { dur: +dur.toFixed(2), ctx: D.ctx ? D.ctx.state : null });
      await sl(120);
    }
  }
  // 操作: 失敗しても止めない
  async function op(name, fn, chk) {
    rec('O', name, 'start');
    let res = null, err = null;
    try { res = await fn(); } catch (e) { err = String(e && e.message || e); }
    let ok = null; try { if (chk) ok = !!chk(); } catch (e) { ok = false; }
    rec('O', name, 'end', { ...(err ? { err } : (res === undefined ? {} : { res })), ...(ok === null ? {} : { ok }) });
    await sl(600); // 画面が安定する間
  }

  // ---- DOM ヘルパー ----
  const setVal = (el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus(); set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const field = (label) => {
    const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(label));
    return l && document.getElementById(l.htmlFor);
  };
  const fill = async (pairs) => { for (const [l, v] of pairs) { const el = field(l); if (!el) throw new Error('no field ' + l); setVal(el, v); await sl(120); } };
  const waitUntil = async (f, n = 80) => { for (let i = 0; i < n && !f(); i++) await sl(250); return !!f(); };
  const hasText = (t) => document.body.innerText.includes(t);
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
  const head = (t, exact) => [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].find((e) => exact ? e.textContent.trim() === t : e.textContent.includes(t));
  const leaf = (t, starts) => [...document.querySelectorAll('p,div,span')].find((e) => e.children.length === 0 && (starts ? e.textContent.trim().startsWith(t) : e.textContent.trim() === t));
  const nav = (p) => window.next.router.push(BASE + p);
  const setU = (u) => fetch('/api/demo/me', { method: 'POST', headers: J, body: JSON.stringify({ userId: u }) });
  const inView = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const gid = () => (location.pathname.match(/groups\/(g-\d+)/) || [])[1];

  // ---- 部 ----
  const part1 = async () => {
    await setU('u-001'); // 幹事は u-001(ユーザーの Cookie が他のユーザーのままでも動くように)
    await sl(600);
    await say('N0', 'N1a');
    await op('入力:名称・行き先・日程', () => fill([['名称', '鈴風高原 ゆっくり散策'], ['行き先', '雪雫の音楽堂'], ['開始日', '2026-12-10'], ['終了日', '2026-12-11']]), () => field('名称').value === '鈴風高原 ゆっくり散策' && field('開始日').value === '2026-12-10' && field('終了日').value === '2026-12-11');
    await say('N1b');
    await op('入力:最少人数・締切・地方', async () => {
      await fill([['最少人数', '3'], ['締切日', '2026-12-01']]);
      const c = [...document.querySelectorAll('input[role=combobox]')].find((e) => e.required);
      c.click(); c.focus(); await sl(400);
      [...document.querySelectorAll('[role=option]')].find((o) => o.textContent.includes('鈴風高原')).click();
      await sl(500); return c.value;
    }, () => field('最少人数').value === '3' && field('締切日').value === '2026-12-01' && [...document.querySelectorAll('input[role=combobox]')].find((e) => e.required).value === '鈴風高原');
    await say('N1c', 'N2a');
    await op('作成→募集中', async () => {
      const b = btn('グループを作る'); b.scrollIntoView({ block: 'center' }); await sl(400); b.click();
      await waitUntil(() => gid()); await waitUntil(() => hasText('募集中')); return location.pathname;
    }, () => hasText('募集中') && gid());
    await say('N2b');
    await op('申請の仕込み→承認画面', async () => {
      const g = gid();
      for (const u of ['u-002', 'u-003']) { await setU(u); await fetch('/api/groups/' + g + '/join-requests', { method: 'POST', headers: J, body: JSON.stringify({ note: 'よろしくお願いします', consentMinMembers: true, consentedMinMembers: 3 }) }); }
      await setU('u-001'); nav('/groups/' + g + '/requests');
      await waitUntil(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '承認する').length >= 2);
      return location.pathname;
    }, () => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '承認する').length >= 2);
    await say('N3a', 'N3b');
    await op('承認x2', async () => {
      let n = 0;
      for (let k = 0; k < 2; k++) { const b = btn('承認する'); if (!b) break; b.scrollIntoView({ block: 'center' }); await sl(350); b.click(); n++; await sl(900); }
      return n;
    }, () => !btn('承認する'));
    await say('N3c');
    await op('詳細→最少人数到達', async () => { const g = gid(); nav('/groups/' + g); await waitUntil(() => location.pathname === BASE + '/groups/' + g && hasText('最少人数到達')); await sl(300); return location.pathname; }, () => hasText('最少人数に達しました'));
    await say('N4a', 'N4b');
  };
  const part2 = async () => {
    await op('オーナー→棒グラフ', async () => {
      await setU('u-013'); nav('/business/insights');
      const q = '[aria-label^="週別の旅行者人数"]'; await waitUntil(() => document.querySelector(q));
      document.querySelector(q).scrollIntoView({ block: 'center' }); await sl(300); return location.pathname;
    }, () => inView(document.querySelector('[aria-label^="週別の旅行者人数"]')));
    await say('N5a', 'N5b');
    await op('週の切替→円グラフ', async () => {
      const rs = [...document.querySelectorAll('[aria-label^="週別の旅行者人数"] rect')];
      rs[21].dispatchEvent(new MouseEvent('click', { bubbles: true })); await sl(500);
      head('週別の年代別構成').scrollIntoView({ block: 'start' }); await sl(300); return hasText('12月28日');
    }, () => hasText('12月28日') && inView(head('週別の年代別構成')));
    await say('N6a');
    await op('提案へ', async () => { [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].find((e) => e.textContent.trim().startsWith('提案')).scrollIntoView({ block: 'start' }); }, () => inView([...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].find((e) => e.textContent.trim().startsWith('提案'))));
    await say('N6b');
  };
  const part3 = async () => {
    await op('自治体→主な指標', async () => {
      await setU('u-009'); nav('/admin/stats');
      await waitUntil(() => leaf('主な指標', true)); leaf('主な指標', true).scrollIntoView({ block: 'start' }); await sl(300); return location.pathname;
    }, () => inView(leaf('主な指標', true)));
    await say('N7a', 'N7b');
    await op('地方別へ', () => { leaf('地方別').scrollIntoView({ block: 'start' }); }, () => inView(leaf('地方別')));
    await say('N8a');
    await op('流入元へ', () => { leaf('流入元').scrollIntoView({ block: 'start' }); }, () => inView(leaf('流入元')));
    await say('N8b', 'N9');
  };

  D.run = async (n) => {
    if (n === 1 || !D.t0) { D.t0 = performance.now(); D.log.length = 0; } // 部 1 で時計を開始。部 2・3 は同じ時計で続ける(部の間の往復も総時間に入る)
    D.part = n;
    rec('P', 'part' + n, 'start', { at: new Date().toISOString() });
    await D.ensureCtx();
    try { await ({ 1: part1, 2: part2, 3: part3 })[n](); } catch (e) { rec('P', 'part' + n, 'error', { err: String(e) }); }
    rec('P', 'part' + n, 'end');
    return { part: n, totalMs: now(), log: D.log.slice() };
  };
  D.cleanup = () => { if (D.credit) D.credit.remove(); D.credit = null; };
  D.finish = () => { D.cleanup(); return true; };
})();
