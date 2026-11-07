/* PS Poker — Hungry Horse study app.
   Static PWA. Content lives in data/*.json; progress lives in localStorage on this device. */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");
  const STORE_KEY = "psp-v1";
  const SUITS = { s: "♠", h: "♥", d: "♦", c: "♣" };

  /* ── Progress ───────────────────────────────────────────── */
  function load() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { p = {}; }
    p.episodes = p.episodes || {};
    p.lessons = p.lessons || {};
    p.last = p.last || null;
    return p;
  }
  const P = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(P)); } catch {} }
  function epState(id) {
    const k = String(id);
    if (!P.episodes[k]) P.episodes[k] = { intro: false, cur: 0, hands: {}, done: false };
    return P.episodes[k];
  }
  function handState(ep, handId) {
    const s = epState(ep);
    if (!s.hands[handId]) s.hands[handId] = { street: 0, answers: {}, done: false };
    return s.hands[handId];
  }
  function lessonState(id) {
    if (!P.lessons[id]) P.lessons[id] = { stage: "concept", q: 0, answers: {}, done: false };
    return P.lessons[id];
  }
  function setLast(last) { P.last = last; save(); }

  /* ── Data ───────────────────────────────────────────────── */
  const cache = {};
  async function getJSON(path) {
    if (cache[path]) return cache[path];
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(path);
    const data = await res.json();
    cache[path] = data;
    return data;
  }
  const getIndex = () => getJSON("data/episodes/index.json");
  const getEpisode = async (id) => {
    const idx = await getIndex();
    const meta = idx.episodes.find((e) => e.id === id);
    if (!meta || !meta.available) return null;
    return getJSON("data/episodes/" + meta.file);
  };
  const getCurriculum = () => getJSON("data/curriculum.json");
  function allLessons(cur) {
    const out = [];
    cur.phases.forEach((p) => p.modules.forEach((m) => (m.lessons || []).forEach((l) => out.push({ lesson: l, module: m, phase: p }))));
    return out;
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const order = {}; // option order per decision, kept for the session so a re-render doesn't reshuffle
  function shuffled(id, arr) {
    if (!order[id] || order[id].length !== arr.length) {
      const idxs = arr.map((_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
      order[id] = idxs;
    }
    return order[id].map((i) => arr[i]);
  }
  function card(c, small) {
    if (!c) return "";
    if (c === "?" ) return `<span class="pcard unknown${small ? " sm" : ""}"><span class="r">?</span></span>`;
    const rank = c[0] === "T" ? "10" : c[0];
    const suit = c[1];
    if (!suit || suit === "x" || suit === "?") return `<span class="pcard x${small ? " sm" : ""}"><span class="r">${rank}</span></span>`;
    return `<span class="pcard ${suit}${small ? " sm" : ""}"><span class="r">${rank}</span><span class="s">${SUITS[suit] || ""}</span></span>`;
  }
  const cards = (arr, small) => `<span class="cards">${(arr || []).map((c) => card(c, small)).join("")}</span>`;
  function setTab(name) {
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === name));
  }
  function render(html) { view.innerHTML = html; }
  function pct(n, d) { return d ? Math.round((100 * n) / d) : 0; }

  /* ── Router ──────────────────────────────────────────────── */
  async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    window.scrollTo(0, 0);
    try {
      if (!parts.length) { setTab("home"); return home(); }
      if (parts[0] === "episodes") { setTab("episodes"); return episodes(); }
      if (parts[0] === "ep") { setTab("episodes"); return episode(+parts[1], parts[2] === "h" ? +parts[3] : null); }
      if (parts[0] === "curriculum") { setTab("curriculum"); return curriculum(); }
      if (parts[0] === "module") { setTab("curriculum"); return module(parts[1]); }
      if (parts[0] === "lesson") { setTab("curriculum"); return lesson(parts[1]); }
      setTab("home"); return home();
    } catch (err) {
      render(`<p class="empty">Couldn't load that. ${esc(err.message || "")}</p>`);
    }
  }
  window.addEventListener("hashchange", route);

  /* ── Home ────────────────────────────────────────────────── */
  async function home() {
    const [idx, cur] = await Promise.all([getIndex(), getCurriculum()]);
    const available = idx.episodes.filter((e) => e.available);
    const epsDone = available.filter((e) => epState(e.id).done).length;
    const lessons = allLessons(cur);
    const lessonsDone = lessons.filter((x) => lessonState(x.lesson.id).done).length;

    // stats
    let decisions = 0, matched = 0, drillQ = 0, drillOk = 0;
    Object.values(P.episodes).forEach((e) => Object.values(e.hands).forEach((h) => Object.values(h.answers).forEach((a) => { decisions++; if (a.ok) matched++; })));
    Object.values(P.lessons).forEach((l) => Object.values(l.answers).forEach((a) => { drillQ++; if (a.ok) drillOk++; }));

    let resume = "";
    if (P.last) {
      resume = `<a class="resume tile" href="${esc(P.last.href)}">
        <p class="eyebrow">Pick up where you left off</p>
        <h2>${esc(P.last.title)}</h2>
        <p>${esc(P.last.sub || "")}</p>
        <span class="btn">Continue</span>
      </a>`;
    } else {
      resume = `<a class="resume tile" href="#/ep/1">
        <p class="eyebrow">Start here</p>
        <h2>Episode 1</h2>
        <p>Marc's first session of the $100/hr challenge. 12 hands, street by street.</p>
        <span class="btn">Play Episode 1</span>
      </a>`;
    }

    render(`
      <h1>Hungry Horse study</h1>
      <p class="sub">Decide first. Then see what Marc did, and why.</p>
      ${resume}
      <div class="stats">
        <div class="stat"><div class="v">${decisions}</div><div class="l">decisions</div></div>
        <div class="stat"><div class="v">${decisions ? pct(matched, decisions) + "%" : "–"}</div><div class="l">matched Marc</div></div>
        <div class="stat"><div class="v">${drillQ ? pct(drillOk, drillQ) + "%" : "–"}</div><div class="l">drill accuracy</div></div>
      </div>
      <div class="stack">
        <a class="tile" href="#/episodes">
          <p class="eyebrow">Series</p>
          <h2>Episodes</h2>
          <p class="sub" style="margin:0">${epsDone} of ${idx.episodes.length} episodes played · ${available.length} available</p>
          <div class="bar"><span style="width:${pct(epsDone, idx.episodes.length)}%"></span></div>
          <span class="arrow">›</span>
        </a>
        <a class="tile" href="#/curriculum">
          <p class="eyebrow">Course</p>
          <h2>Curriculum</h2>
          <p class="sub" style="margin:0">${lessonsDone} of ${lessons.length} lessons done · modules 1.1 and 1.2 open</p>
          <div class="bar gold"><span style="width:${pct(lessonsDone, lessons.length)}%"></span></div>
          <span class="arrow">›</span>
        </a>
      </div>
      <p class="foot">Built from Marc's videos. Progress is saved on this phone.</p>
    `);
  }

  /* ── Episodes list ───────────────────────────────────────── */
  async function episodes() {
    const idx = await getIndex();
    const items = idx.episodes.map((e) => {
      const s = epState(e.id);
      const handsDone = Object.values(s.hands).filter((h) => h.done).length;
      const cls = !e.available ? "locked" : s.done ? "done" : handsDone || s.intro ? "current" : "";
      const state = !e.available ? "Coming" : s.done ? "Done" : handsDone ? `${handsDone} hands` : "";
      const inner = `<span class="num">${e.id}</span>
        <span class="body"><span class="title">${esc(e.title)}</span><span class="meta">${esc(e.subtitle || "")}</span></span>
        <span class="state">${state}</span>`;
      return e.available ? `<li><a class="item ${cls}" href="#/ep/${e.id}">${inner}</a></li>` : `<li><div class="item ${cls}">${inner}</div></li>`;
    });
    render(`
      <p class="eyebrow">${esc(idx.series)}</p>
      <h1>Episodes</h1>
      <p class="sub">${esc(idx.description)}</p>
      <ul class="list">${items.join("")}</ul>
    `);
  }

  /* ── Episode page / hand player ──────────────────────────── */
  async function episode(id, handIdx) {
    const ep = await getEpisode(id);
    if (!ep) { render(`<p class="empty">That episode isn't in the app yet.</p>`); return; }
    const s = epState(id);
    if (handIdx === null) return episodeOverview(ep, s);
    return playHand(ep, s, Math.max(0, Math.min(handIdx, ep.hands.length - 1)));
  }

  function episodeOverview(ep, s) {
    const handsDone = ep.hands.filter((h) => s.hands[h.id] && s.hands[h.id].done).length;
    const nextIdx = ep.hands.findIndex((h) => !(s.hands[h.id] && s.hands[h.id].done));
    const items = ep.hands.map((h, i) => {
      const hs = s.hands[h.id];
      const cls = hs && hs.done ? "done" : i === nextIdx ? "current" : "";
      const nDec = h.streets.filter((st) => st.decision).length;
      let state = "";
      if (hs && hs.done) {
        const ok = Object.values(hs.answers).filter((a) => a.ok).length;
        state = `${ok}/${nDec}`;
      } else if (hs && hs.street > 0) state = "In progress";
      return `<li><a class="item ${cls}" href="#/ep/${ep.id}/h/${i}">
        <span class="num">${i + 1}</span>
        <span class="body"><span class="title">${esc(h.title)}</span><span class="meta">${esc(h.setup.hero.label)} · ${esc(h.setup.hero.pos)} · ${nDec} decision${nDec === 1 ? "" : "s"}</span></span>
        <span class="state">${state}</span></a></li>`;
    });
    const intro = s.intro ? "" : `<div class="panel"><p class="eyebrow">Before you start</p><p>${esc(ep.intro)}</p><p class="small muted" style="margin:0">${esc(ep.stakes)}</p></div>`;
    const cta = s.done
      ? `<div class="outcome"><p class="eyebrow">Session result</p>${esc(ep.result)}</div>`
      : `<a class="btn" href="#/ep/${ep.id}/h/${nextIdx < 0 ? 0 : nextIdx}" style="margin-top:12px">${handsDone ? "Continue" : "Start"} · Hand ${(nextIdx < 0 ? 0 : nextIdx) + 1}</a>`;
    render(`
      <p class="eyebrow">Episode ${ep.id}</p>
      <h1>${esc(ep.title)}</h1>
      <p class="sub">${esc(ep.subtitle)}</p>
      ${intro}
      <div class="bar" style="margin:12px 0 4px"><span style="width:${pct(handsDone, ep.hands.length)}%"></span></div>
      <p class="small muted">${handsDone} of ${ep.hands.length} hands played</p>
      ${cta}
      <h2>Hands</h2>
      <ul class="list">${items.join("")}</ul>
    `);
    if (!s.intro) { s.intro = true; save(); }
  }

  function playHand(ep, s, hi) {
    const hand = ep.hands[hi];
    const hs = handState(ep.id, hand.id);
    s.cur = hi;
    setLast({ href: `#/ep/${ep.id}/h/${hi}`, title: `Episode ${ep.id} · Hand ${hi + 1}`, sub: hand.title });

    const cur = Math.min(hs.street, hand.streets.length - 1);
    const street = hand.streets[cur];
    const dec = street.decision;
    const answered = dec ? hs.answers[dec.id] : null;
    const board = [...(street.board || [])];

    // Felt: hero + current board
    const felt = `<div class="felt">
      <div class="spread">
        <div class="hero">${cards(hand.setup.hero.cards)}<span class="pos">${esc(hand.setup.hero.pos)}</span></div>
        <div class="small" style="color:#cfdfd5">${esc(hand.setup.hero.label)}</div>
      </div>
      <div class="label" style="margin-top:14px">Board${street.name && !/preflop/i.test(street.name) ? " · " + esc(street.name.replace(/\s*\(.*\)/, "")) : ""}</div>
      <div class="board">${board.length ? board.map((c) => card(c)).join("") : '<span class="small" style="color:#cfdfd5">No cards yet</span>'}</div>
      ${street.boardNote ? `<div class="board-note">${esc(street.boardNote)}</div>` : ""}
      ${street.pot ? `<div class="pot"><span class="small" style="color:#cfdfd5">Pot</span><b>${esc(street.pot)}</b></div>` : ""}
    </div>`;

    const setup = `<div class="panel setup">
      <p style="margin:0 0 6px"><b>Villain:</b> ${esc(hand.setup.villain)}</p>
      ${hand.setup.note ? `<p class="muted" style="margin:0">${esc(hand.setup.note)}</p>` : ""}
    </div>`;

    // Past streets (compact)
    const past = hand.streets.slice(0, cur).map((st) => {
      const d = st.decision; const a = d ? hs.answers[d.id] : null;
      let line = "";
      if (d && a) {
        const pickText = d.options.find((o) => o.key === a.pick)?.text || a.pick;
        const marcText = d.options.find((o) => o.key === d.marcDid)?.text || d.marcDid;
        line = `<div class="small ${a.ok ? "" : "muted"}" style="margin-top:4px">You: <b>${esc(pickText)}</b> · Marc: <b>${esc(marcText)}</b>${a.ok ? " ✓" : ""}</div>`;
      }
      return `<div class="street past"><div class="street-name">${esc(st.name)}</div><p class="action">${esc(st.action)}</p>${line}</div>`;
    }).join("");

    // Current street
    let current = `<div class="street"><div class="street-name">${esc(street.name)}</div><p class="action">${esc(street.action)}</p>`;
    const isLast = cur === hand.streets.length - 1;
    if (dec && !answered) {
      const opts = shuffled(dec.id, dec.options);
      current += `<p class="question">${esc(dec.question)}</p><ul class="options">${opts.map((o, i) => `<li><button class="opt" data-pick="${esc(o.key)}"><span class="k">${"ABCD"[i]}</span><span class="t">${esc(o.text)}</span></button></li>`).join("")}</ul>`;
    } else if (dec && answered) {
      const opts = shuffled(dec.id, dec.options);
      current += `<p class="question">${esc(dec.question)}</p><ul class="options">${opts.map((o, i) => {
        const cls = o.key === dec.correct ? "right" : o.key === answered.pick ? "wrong" : "";
        const marcTag = o.key === dec.marcDid && dec.marcDid !== dec.correct ? `<span class="opt-note">Marc's actual play</span>` : "";
        return `<li><button class="opt ${cls}${o.key === dec.marcDid && dec.marcDid !== dec.correct ? " marc" : ""}" disabled><span class="k">${"ABCD"[i]}</span><span class="t">${esc(o.text)}</span>${marcTag}</button></li>`;
      }).join("")}</ul>`;
      const verdict = answered.ok
        ? (dec.marcDid === dec.correct ? "Same as Marc." : "That's the play Marc says he should have made.")
        : (answered.pick === dec.marcDid && dec.marcDid !== dec.correct ? "That's what Marc actually did, and he calls it a mistake." : "Different from Marc.");
      current += `<div class="reveal ${answered.ok ? "ok" : "miss"}"><div class="verdict">${verdict}</div><p>${esc(dec.reveal)}</p></div>`;
    }
    const canAdvance = !dec || answered;
    if (canAdvance) {
      if (!isLast) current += `<button class="btn" id="next" style="margin-top:14px">Next: ${esc(hand.streets[cur + 1].name)}</button>`;
      else {
        current += `<div class="outcome"><p class="eyebrow">Outcome</p>${esc(hand.outcome)}</div>`;
        const nextHand = hi + 1 < ep.hands.length;
        current += `<div class="btn-row">${nextHand ? `<button class="btn" id="nexthand">Next hand</button>` : `<a class="btn" href="#/ep/${ep.id}">Finish episode</a>`}<a class="btn ghost" href="#/ep/${ep.id}">All hands</a></div>`;
      }
    }
    current += `</div>`;

    render(`
      <p class="eyebrow"><a href="#/ep/${ep.id}">Episode ${ep.id}</a> · Hand ${hi + 1} of ${ep.hands.length}</p>
      <h1 style="font-size:23px">${esc(hand.title)}</h1>
      ${felt}
      ${setup}
      <div class="panel" style="margin-top:10px">${past}${current}</div>
    `);

    // Wire up
    view.querySelectorAll(".opt[data-pick]").forEach((b) => b.addEventListener("click", () => {
      const pick = b.dataset.pick;
      hs.answers[dec.id] = { pick, ok: pick === dec.correct };
      save();
      playHand(ep, s, hi);
      const r = $(".reveal"); if (r) r.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    const next = $("#next");
    if (next) next.addEventListener("click", () => { hs.street = cur + 1; save(); playHand(ep, s, hi); const st = view.querySelectorAll(".street"); const last = st[st.length - 1]; if (last) last.scrollIntoView({ behavior: "smooth", block: "start" }); });
    const nh = $("#nexthand");
    if (nh) nh.addEventListener("click", () => { finishHand(ep, s, hand, hs); location.hash = `#/ep/${ep.id}/h/${hi + 1}`; });
    if (isLast && canAdvance && !hs.done) finishHand(ep, s, hand, hs);
  }

  function finishHand(ep, s, hand, hs) {
    hs.done = true;
    if (ep.hands.every((h) => s.hands[h.id] && s.hands[h.id].done)) { s.done = true; setLast({ href: "#/episodes", title: `Episode ${ep.id} complete`, sub: ep.result }); }
    save();
  }

  /* ── Curriculum ──────────────────────────────────────────── */
  async function curriculum() {
    const cur = await getCurriculum();
    const phases = cur.phases.map((p) => {
      const mods = p.modules.map((m) => {
        const lessons = m.lessons || [];
        const done = lessons.filter((l) => lessonState(l.id).done).length;
        const locked = m.locked || !lessons.length;
        const cls = locked ? "locked" : done === lessons.length ? "done" : done ? "current" : "";
        const state = locked ? "Soon" : done === lessons.length ? "Done" : `${done}/${lessons.length}`;
        const inner = `<span class="num">${esc(m.id)}</span>
          <span class="body"><span class="title">${esc(m.title)}</span><span class="meta">${esc(m.summary)}</span></span>
          <span class="state">${state}</span>`;
        return locked ? `<li><div class="item ${cls}">${inner}</div></li>` : `<li><a class="item ${cls}" href="#/module/${esc(m.id)}">${inner}</a></li>`;
      });
      return `<section class="phase"><div class="phase-head"><span class="n">PHASE ${p.number}</span><h2>${esc(p.title)}</h2><span class="tag">${esc(p.tagline)}</span></div><ul class="list">${mods.join("")}</ul></section>`;
    });
    render(`
      <h1>${esc(cur.title)}</h1>
      <p class="sub">${esc(cur.intro)}</p>
      ${phases.join("")}
    `);
  }

  async function module(id) {
    const cur = await getCurriculum();
    let mod = null, phase = null;
    cur.phases.forEach((p) => p.modules.forEach((m) => { if (m.id === id) { mod = m; phase = p; } }));
    if (!mod || !(mod.lessons || []).length) { render(`<p class="empty">That module isn't built yet.</p>`); return; }
    const items = mod.lessons.map((l, i) => {
      const ls = lessonState(l.id);
      const n = l.drill.questions.length;
      const ok = Object.values(ls.answers).filter((a) => a.ok).length;
      const cls = ls.done ? "done" : ls.stage !== "concept" || Object.keys(ls.answers).length ? "current" : "";
      const state = ls.done ? `${ok}/${n}` : ls.stage === "drill" ? "In drill" : "";
      return `<li><a class="item ${cls}" href="#/lesson/${esc(l.id)}">
        <span class="num">${i + 1}</span>
        <span class="body"><span class="title">${esc(l.title)}</span><span class="meta">${l.minutes} min read · ${n} questions</span></span>
        <span class="state">${state}</span></a></li>`;
    });
    const next = mod.lessons.find((l) => !lessonState(l.id).done);
    render(`
      <p class="eyebrow"><a href="#/curriculum">Phase ${phase.number} · ${esc(phase.title)}</a></p>
      <h1>${esc(mod.id)} ${esc(mod.title)}</h1>
      <p class="sub">${esc(mod.summary)}</p>
      ${next ? `<a class="btn" href="#/lesson/${esc(next.id)}">${Object.keys(lessonState(next.id).answers).length || lessonState(next.id).stage !== "concept" ? "Continue" : "Start"}: ${esc(next.title)}</a>` : `<div class="outcome"><p class="eyebrow">Module complete</p>All lessons done. The drills can be replayed any time.</div>`}
      <h2>Lessons</h2>
      <ul class="list">${items.join("")}</ul>
      ${mod.homework ? `<div class="homework"><p class="eyebrow">Homework</p>${esc(mod.homework)}</div>` : ""}
      <div class="sources"><b>Source videos:</b> ${(mod.sources || []).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join(" · ")}</div>
    `);
  }

  function conceptHTML(blocks) {
    let html = "", inList = false;
    blocks.forEach((b) => {
      if (b.startsWith("- ")) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(b.slice(2))}</li>`; return; }
      if (inList) { html += "</ul>"; inList = false; }
      if (b.startsWith("## ")) html += `<h2>${inline(b.slice(3))}</h2>`;
      else if (b.startsWith("> ")) html += `<blockquote>${inline(b.slice(2))}</blockquote>`;
      else html += `<p>${inline(b)}</p>`;
    });
    if (inList) html += "</ul>";
    return html;
  }

  async function lesson(id) {
    const cur = await getCurriculum();
    const all = allLessons(cur);
    const pos = all.findIndex((x) => x.lesson.id === id);
    if (pos < 0) { render(`<p class="empty">That lesson isn't built yet.</p>`); return; }
    const { lesson: L, module: M } = all[pos];
    const ls = lessonState(id);
    setLast({ href: `#/lesson/${id}`, title: `Lesson ${id} · ${L.title}`, sub: `Module ${M.id} · ${M.title}` });

    const head = `<p class="eyebrow"><a href="#/module/${esc(M.id)}">Module ${esc(M.id)} · ${esc(M.title)}</a></p><h1 style="font-size:24px">${esc(L.title)}</h1>`;

    if (ls.stage === "concept") {
      render(`${head}<p class="sub">${L.minutes} min read, then ${L.drill.questions.length} questions.</p>
        <div class="panel concept">${conceptHTML(L.concept)}</div>
        <button class="btn" id="start" style="margin-top:14px">Start the drill</button>`);
      $("#start").addEventListener("click", () => { ls.stage = "drill"; ls.q = 0; ls.answers = {}; save(); lesson(id); });
      return;
    }

    const qs = L.drill.questions;
    if (ls.stage === "drill") {
      const qi = Math.min(ls.q, qs.length - 1);
      const q = qs[qi];
      const a = ls.answers[q.id];
      const opts = shuffled(q.id, q.options);
      const dots = qs.map((qq, i) => { const an = ls.answers[qq.id]; return `<i class="${an ? (an.ok ? "ok" : "miss") : i === qi ? "now" : ""}"></i>`; }).join("");
      let body = `<div class="drill-head"><span class="eyebrow" style="margin:0">Drill</span><span class="count">${qi + 1} of ${qs.length}</span></div><div class="dots">${dots}</div>`;
      if (qi === 0 && !a) body += `<p class="sub">${esc(L.drill.intro)}</p>`;
      body += `<p class="question">${esc(q.prompt)}</p><ul class="options">${opts.map((o, i) => {
        const cls = !a ? "" : o.key === q.correct ? "right" : o.key === a.pick ? "wrong" : "";
        return `<li><button class="opt ${cls}" data-pick="${esc(o.key)}" ${a ? "disabled" : ""}><span class="k">${"ABCD"[i]}</span><span class="t">${esc(o.text)}</span></button></li>`;
      }).join("")}</ul>`;
      if (a) {
        body += `<div class="reveal ${a.ok ? "ok" : "miss"}"><div class="verdict">${a.ok ? "Right." : "Not this one."}</div><p>${esc(q.explain)}</p></div>
          <button class="btn" id="next" style="margin-top:14px">${qi + 1 < qs.length ? "Next question" : "See results"}</button>`;
      }
      render(`${head}<div class="panel">${body}</div>`);
      view.querySelectorAll(".opt[data-pick]").forEach((b) => b.addEventListener("click", () => {
        ls.answers[q.id] = { pick: b.dataset.pick, ok: b.dataset.pick === q.correct }; save(); lesson(id);
        const r = $(".reveal"); if (r) r.scrollIntoView({ behavior: "smooth", block: "center" });
      }));
      const next = $("#next");
      if (next) next.addEventListener("click", () => {
        if (qi + 1 < qs.length) { ls.q = qi + 1; } else { ls.stage = "done"; ls.done = true; }
        save(); lesson(id);
      });
      return;
    }

    // done
    const ok = qs.filter((q) => ls.answers[q.id] && ls.answers[q.id].ok).length;
    const misses = qs.filter((q) => ls.answers[q.id] && !ls.answers[q.id].ok);
    const nextLesson = all[pos + 1];
    const lastInModule = M.lessons[M.lessons.length - 1].id === id;
    render(`${head}
      <div class="panel">
        <div class="score"><div class="big">${ok}/${qs.length}</div><div class="lbl">${ok === qs.length ? "Clean." : ok >= qs.length * 0.7 ? "Solid. Review the misses below." : "Worth a re-read before moving on."}</div></div>
        ${misses.length ? `<h3>Missed</h3>${misses.map((q) => `<p class="small"><b>${esc(q.prompt.length > 90 ? q.prompt.slice(0, 90) + "…" : q.prompt)}</b><br>${esc(q.explain)}</p>`).join("")}` : ""}
      </div>
      ${lastInModule && M.homework ? `<div class="homework"><p class="eyebrow">Homework for module ${esc(M.id)}</p>${esc(M.homework)}</div>` : ""}
      <div class="btn-row">
        ${nextLesson && !nextLesson.module.locked ? `<a class="btn" href="#/lesson/${esc(nextLesson.lesson.id)}">Next: ${esc(nextLesson.lesson.title)}</a>` : `<a class="btn" href="#/curriculum">Back to curriculum</a>`}
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="redo">Redo the drill</button>
        <button class="btn ghost" id="reread">Re-read the lesson</button>
      </div>`);
    $("#redo").addEventListener("click", () => { ls.stage = "drill"; ls.q = 0; ls.answers = {}; qs.forEach((q) => delete order[q.id]); save(); lesson(id); });
    $("#reread").addEventListener("click", () => { ls.stage = "concept"; save(); lesson(id); });
  }

  /* ── Theme ───────────────────────────────────────────────── */
  const THEME_KEY = "psp-theme";
  function applyTheme() {
    let t = null; try { t = localStorage.getItem(THEME_KEY); } catch {}
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }
  applyTheme();
  $("#theme").addEventListener("click", () => {
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const curT = document.documentElement.dataset.theme || (dark ? "dark" : "light");
    const next = curT === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    applyTheme();
  });

  /* ── Service worker + install bar (same pattern as PS Sports / PS Tube) ── */
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const DISMISS_KEY = "psp-install-dismissed";
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const dismissed = () => { try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } };
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  let deferred = null;
  function installBar(label, onGo) {
    if (standalone() || dismissed() || document.querySelector(".install-bar")) return;
    const bar = document.createElement("div");
    bar.className = "install-bar";
    bar.innerHTML = `<img src="icons/icon-192.png" alt="" width="40" height="40">
      <span class="install-text"><b>Get the PS Poker app</b><span>Episodes and lessons on your home screen</span></span>
      <button type="button" class="install-go">${label}</button>
      <button type="button" class="install-x" aria-label="Not now">×</button>`;
    bar.querySelector(".install-go").addEventListener("click", onGo);
    bar.querySelector(".install-x").addEventListener("click", () => { try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {} bar.remove(); document.body.classList.remove("has-install"); });
    document.body.appendChild(bar);
    document.body.classList.add("has-install");
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferred = e;
    installBar("Install", async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; document.querySelector(".install-bar")?.remove(); });
  });
  window.addEventListener("appinstalled", () => { document.querySelector(".install-bar")?.remove(); document.body.classList.remove("has-install"); });
  if (isIOS && !standalone()) {
    setTimeout(() => installBar("How", () => {
      const sheet = document.createElement("div");
      sheet.className = "install-sheet";
      const ua = navigator.userAgent;
      const chrome = /CriOS/.test(ua);
      const safariVer = +((ua.match(/Version\/(\d+)/) || [])[1] || 0);
      const MORE = `<span class="install-chip" aria-label="three dots">•••</span>`;
      const SHARE = `<span class="install-chip"><svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true"><path d="M6.5 1v8.5M3.5 4l3-3 3 3M2.5 6.5H1.5v7.5h10V6.5h-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
      const steps = chrome
        ? [`Tap the <b>Share</b> button ${SHARE} in the address bar at the top`, `Tap <b>Add to Home Screen</b> (you may need to tap <b>More</b> first)`, `Tap <b>Add</b>. PS Poker shows up with your other apps`]
        : safariVer >= 26
        ? [`Tap the ${MORE} button next to the address bar`, `Tap <b>Share</b> ${SHARE}, then scroll down and tap <b>Add to Home Screen</b>`, `Keep <b>Open as Web App</b> switched on and tap <b>Add</b>`]
        : [`Tap the <b>Share</b> button ${SHARE} at the bottom of Safari`, `Scroll down and tap <b>Add to Home Screen</b>`, `Tap <b>Add</b>. PS Poker shows up with your other apps`];
      sheet.innerHTML = `<div class="install-card" role="dialog" aria-label="Add PS Poker to your Home Screen">
        <h2>Add PS Poker to your Home Screen</h2>
        <ol>${steps.map((x) => `<li>${x}</li>`).join("")}</ol>
        <p class="install-note">It takes about 10 seconds, and then PS Poker opens full screen like any other app.</p>
        <button type="button" class="install-done">Got it</button>
      </div>`;
      sheet.addEventListener("click", (ev) => { if (ev.target === sheet || ev.target.closest(".install-done")) sheet.remove(); });
      document.body.appendChild(sheet);
    }), 1500);
  }

  route();
})();
