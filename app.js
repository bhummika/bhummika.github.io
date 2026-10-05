/* Brick portfolio. Reads content.json (or content.js on a double clicked file) and renders every brick. */
(function () {
  'use strict';

  var DIRS = ['left', 'right', 'top', 'bottom'];
  /* animation kinds: duration in ms, gap between bricks of one section in ms */
  var KINDS = {
    drop:  { dur: 1000, gap: 420 },
    stack: { dur: 800,  gap: 260 },
    snap:  { dur: 800,  gap: 110 },
    piece: { dur: 620,  gap: 700 }
  };
  var FADE_MS = 150;
  var MAX_STAGGER = 600;   /* ms from the first brick of a batch to the last */
  var COUNT_MS = 900;      /* how long a number brick counts up to its value */

  var root = document.documentElement;
  var $main = document.getElementById('sections');
  var state = {
    content: null, secs: [], bricks: [], scrubs: [], locked: 0, contactLocked: false,
    skip: false, sound: false, skillEls: {}, skillNames: {}, lastPointer: 'mouse',
    focus: null, targetingDefault: ''
  };

  /* ---------- helpers ---------- */
  function el(tag, attrs) {
    var n = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'style') Object.keys(v).forEach(function (p) { n.style.setProperty(p, v[p]); });
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid === null || kid === undefined) continue;
      n.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return n;
  }

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { /* storage can be blocked */ }
    return null;
  }

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  function mode() {
    if (state.skip) return 'skip';
    return reduceQuery.matches ? 'fade' : 'full';
  }
  function applyMode() {
    root.classList.remove('mode-full', 'mode-fade', 'mode-skip');
    root.classList.add('mode-' + mode());
  }
  function isPhone() { return window.innerWidth < 768; }

  function linkAttrs(l, cls) {
    return {
      class: cls, href: l.href,
      download: l.download ? '' : null,
      target: l.external ? '_blank' : null,
      rel: l.external ? 'noopener noreferrer' : null
    };
  }

  /* ---------- click sound (synthesized, off by default) ---------- */
  var audio = null;
  var lastClick = 0;
  function ensureAudio() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (e) { audio = null; }
    return audio;
  }
  function clickSound() {
    if (!state.sound || !audio) return;
    var now = performance.now();
    if (now - lastClick < 70) return;
    lastClick = now;
    try {
      var t = audio.currentTime;
      var o = audio.createOscillator();
      var g = audio.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(1100, t);
      o.frequency.exponentialRampToValueAtTime(260, t + 0.05);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(audio.destination);
      o.start(t); o.stop(t + 0.08);
      var o2 = audio.createOscillator();
      var g2 = audio.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(160, t);
      o2.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      g2.gain.setValueAtTime(0.09, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o2.connect(g2); g2.connect(audio.destination);
      o2.start(t); o2.stop(t + 0.11);
    } catch (e) { /* sound is optional */ }
  }

  /* ---------- brick factory ---------- */
  function checkLimits(type, size) {
    var lim = state.content.limits && state.content.limits[type];
    if (!lim) return;
    if (size[0] < lim.min[0] || size[1] < lim.min[1] || size[0] > lim.max[0] || size[1] > lim.max[1]) {
      console.warn('Brick "' + type + '" is ' + size.join(' by ') + ' studs, outside ' + lim.min.join(' by ') + ' to ' + lim.max.join(' by ') + '.');
    }
  }

  function studRow(n) {
    var row = el('div', { class: 'studrow', 'aria-hidden': 'true', style: { '--n': n } });
    for (var i = 0; i < n; i++) row.appendChild(el('i', { class: 'stud', style: { '--i': i } }));
    return row;
  }

  /* Creates a slot with a brick in it, registers the brick for the assemble motion, returns the face. */
  function brick(sec, parent, type, size, opts) {
    opts = opts || {};
    checkLimits(type, size);
    var face = el('div', { class: 'face' });
    var b = el('div', { class: 'brick ' + type + (opts.solid ? ' solid' : '') }, studRow(size[0]), face);
    var slot = el('div', { class: 'slot', style: { '--c': size[0], '--r': size[1] } }, b);
    parent.appendChild(slot);
    var rec = {
      slot: slot, brick: b, sec: sec, idx: sec.count++, state: 'idle',
      isContact: !!opts.contact, scrub: opts.scrub === undefined ? false : true, scrubIdx: opts.scrub || 0, built: false
    };
    slot._rec = rec;
    state.bricks.push(rec);
    if (rec.scrub) {
      b.classList.add('scrub');
      state.scrubs.push(rec);
    }
    return face;
  }

  function emptySlot(grid, size, cls) {
    var slot = el('div', { class: 'slot empty ' + (cls || ''), style: { '--c': size[0], '--r': size[1] } });
    grid.appendChild(slot);
    return slot;
  }

  function plainSlot(grid, size) {
    var slot = el('div', { class: 'slot plain', style: { '--c': size[0], '--r': size[1] } });
    grid.appendChild(slot);
    return slot;
  }

  /* hover (mouse) or tap (touch): outline the skill bricks a role or project lists, and show chips on it */
  function linkSkills(face, host, ids, below) {
    if (!ids || !ids.length) return null;
    var chips = el('div', { class: 'chips' + (below ? ' below' : ''), 'aria-hidden': 'true' });
    ids.forEach(function (id) { chips.appendChild(el('span', { class: 'chip-skill', 'data-skill': id })); });
    face.parentNode.appendChild(chips);
    var on = false;
    function set(v) {
      on = v;
      chips.classList.toggle('show', v);
      host.classList.toggle('linking', v);
      ids.forEach(function (id) {
        var b = state.skillEls[id];
        if (b) b.classList.toggle('hl', v);
      });
      Array.prototype.forEach.call(chips.children, function (c) {
        c.textContent = state.skillNames[c.getAttribute('data-skill')] || '';
      });
    }
    host.addEventListener('pointerdown', function (e) { state.lastPointer = e.pointerType; });
    host.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') set(true); });
    host.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') set(false); });
    host.addEventListener('focusin', function () { set(true); });
    host.addEventListener('focusout', function () { set(false); });
    return { toggle: function () { set(!on); }, isOn: function () { return on; }, set: set };
  }

  /* ---------- section renderers ---------- */
  function art(name, cls) { return window.ART ? window.ART.make(name, cls) : null; }

  /* WebP with a JPEG fallback. width and height are always set, so nothing jumps while loading. */
  function photo(p, opts) {
    opts = opts || {};
    var img = el('img', {
      src: p.fallback || p.src, alt: p.alt, width: p.width, height: p.height,
      loading: opts.lazy ? 'lazy' : null, decoding: opts.lazy ? 'async' : null,
      fetchpriority: opts.priority ? 'high' : null
    });
    if (!p.srcset && !p.webp) return img;
    return el('picture', null,
      el('source', { type: 'image/webp', srcset: p.srcset || p.webp, sizes: p.sizes || null }),
      img);
  }

  function renderIntro(sec, grid, c) {
    var d = c.intro;
    var face = brick(sec, grid, 'idcard', [12, 8], { solid: true });
    face.parentNode.parentNode.classList.add('idslot');
    face.appendChild(el('div', { class: 'id-lanyard', 'aria-hidden': 'true' }, el('span')));

    var dl = el('dl');
    d.details.forEach(function (row) {
      var isTarget = /^targeting$/i.test(row.label);
      if (isTarget) state.targetingDefault = row.value;
      dl.appendChild(el('div', null, el('dt', { text: row.label }),
        el('dd', { text: row.value, 'data-detail': isTarget ? 'targeting' : null })));
    });

    var story = el('div', { class: 'id-rect id-story', role: 'group', 'aria-label': d.story.label },
      el('p', { class: 'story-lead', text: d.story.lead }));
    var list = el('ul', { class: 'story-list' });
    d.story.items.forEach(function (it) {
      list.appendChild(el('li', null, el('b', { text: it.label }), el('span', { text: it.text })));
    });
    story.appendChild(list);

    face.appendChild(el('div', { class: 'id-body' },
      el('div', { class: 'id-head' },
        el('h1', { text: d.heading }),
        el('p', { class: 'id-aka', text: d.aka })),
      el('div', { class: 'id-photo' }, photo(d.photo, { priority: true })),
      story,
      el('div', { class: 'id-rect id-details' }, el('h2', { text: d.detailsTitle }), dl)));
  }

  function renderAbout(sec, grid, c) {
    var a = c.about;
    a.problems.forEach(function (p) {
      var f = brick(sec, grid, 'solve', p.size);
      if (p.id) f.parentNode.parentNode.setAttribute('data-problem-id', p.id);
      f.appendChild(art(p.art, 'solve-art'));
      f.appendChild(el('h3', { text: p.title }));
      f.appendChild(el('p', { text: p.text }));
    });
    a.numbers.forEach(function (n) {
      var f = brick(sec, grid, 'number', [3, 2]);
      /* the final value is in the markup from the start, so a reader, a screen reader or a
         printer never sees a half counted number; the count only replaces it while animating */
      var value = el('p', { class: 'number-value' },
        el('span', { class: 'sr-only', text: n.value }),                  /* always the real value */
        el('span', { class: 'number-digits', 'aria-hidden': 'true', text: n.value }));
      f.appendChild(value);
      f.appendChild(el('p', { class: 'number-caption', text: n.caption }));
      if (n.count) countUpOnLand(f, value.lastChild, n);
      if (n.id) f.parentNode.parentNode.setAttribute('data-number-id', n.id);
    });
  }

  /* Counts a number brick up to its value as it lands. In fade or skip mode nothing moves and the
     value simply stands there. Only the decorative copy animates, so assistive tech reads one number. */
  function countUpOnLand(face, digits, n) {
    var c = n.count;
    function fmt(v) {
      return (c.prefix || '') + (c.group ? v.toLocaleString('en-US') : String(v)) + (c.suffix || '');
    }
    /* while the brick flies in it shows the starting figure, so the count does not jump back */
    face._prime = function () { if (mode() === 'full') digits.textContent = fmt(0); };
    face._count = function () {
      if (mode() !== 'full') { digits.textContent = n.value; return; }
      var t0 = 0;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / COUNT_MS);
        digits.textContent = p < 1 ? fmt(Math.round(c.to * (1 - Math.pow(1 - p, 3)))) : n.value;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    };
    face._count.final = function () { digits.textContent = n.value; };
  }

  function statusClass(s) {
    return /^Live/.test(s || '') ? 't-live' : s === 'Mockup' ? 't-mockup' : 't-build';
  }

  function hasDetail(item) {
    return !!(item.case || item.problem || (item.process && item.process.length) || item.result || item.inputs || (item.link && item.link.href));
  }

  /* Projects, featured layout: the best project across the full width, the rest as cards with the
     same anatomy (problem, what I did, result, one number, buttons), unfinished work as one strip. */
  function projectCard(sec, grid, c, item, wide) {
    var P = c.projects, L = P.labels;
    var face = brick(sec, grid, 'project pcard2' + (wide ? ' feature' : ''), wide ? [12, 4] : [4, 5]);
    face.parentNode.parentNode.classList.add(wide ? 'feature-slot' : 'card-slot');
    var slot = face.parentNode.parentNode;
    slot.setAttribute('data-project-id', item.id);

    var chips = el('div', { class: 'pc-chips' },
      wide ? el('span', { class: 'pc-chip feat', text: L.featured }) : null,
      item.type ? el('span', { class: 'pc-chip', text: P.types[item.type] }) : null,
      item.status ? el('span', { class: 'tag ' + statusClass(item.status), text: item.status }) : null,
      item.role ? el('span', { class: 'pc-chip role', text: item.role }) : null);

    var lines = el('dl', { class: 'pc-lines' });
    [[L.problemShort, item.oneProblem], [L.didShort, item.did], [L.resultShort, item.result]].forEach(function (r) {
      if (r[1]) lines.appendChild(el('div', null, el('dt', { text: r[0] }), el('dd', { text: r[1] })));
    });

    var read = el('button', { class: 'btn light', type: 'button', 'aria-haspopup': 'dialog', text: L.readCase });
    read.addEventListener('click', function () { if (item.case) openCase(item, read); else openPanel(item, read); });
    var actions = el('div', { class: 'pc-actions' },
      item.cta ? el('a', { class: 'btn', href: item.cta.href, target: '_blank', rel: 'noopener noreferrer', text: item.cta.label }) : null,
      hasDetail(item) ? read : null);

    face.appendChild(el('div', { class: 'pc-body' },
      el('div', { class: 'pc-head' },
        el('div', { class: 'pc-headtext' }, chips,
          el('h3', { class: 'pc-title', text: item.title }),
          item.subtitle ? el('p', { class: 'pc-sub', text: item.subtitle }) : null),
        art(item.art, 'pc-art')),
      el('div', { class: 'pc-main' }, lines,
        item.headline ? el('div', { class: 'pstat pc-num' }, el('b', { text: item.headline.value }), el('span', { text: item.headline.label })) : null),
      actions));
    linkSkills(face, slot, item.skills, false);
  }

  function renderProjectsFeatured(sec, grid, c) {
    var P = c.projects;
    var items = P.items.filter(function (i) { return !i.workbench; });
    var feat = items.filter(function (i) { return i.featured; });
    feat.forEach(function (i) { projectCard(sec, grid, c, i, true); });
    items.filter(function (i) { return !i.featured; }).forEach(function (i) { projectCard(sec, grid, c, i, false); });

    var bench = P.items.filter(function (i) { return i.workbench; });
    if (!bench.length) return;
    var strip = el('div', { class: 'bench' }, el('span', { class: 'bench-label', text: P.labels.workbench }));
    bench.forEach(function (i) {
      strip.appendChild(el('span', { class: 'bench-item', 'data-project-id': i.id },
        art(i.art, 'bench-art'),
        el('b', { text: i.title }),
        el('span', { class: 'tag t-build', text: i.workbenchNote || P.labels.inBuild })));
    });
    plainSlot(grid, [12, 1]).appendChild(strip);
  }

  function renderProjects(sec, grid, c) {
    var p = c.projects;
    if (p.layout === 'featured') return renderProjectsFeatured(sec, grid, c);
    p.items.forEach(function (item) {
      if (item.empty) {
        var slot = emptySlot(grid, item.size, 'proj-empty');
        if (item.id) slot.setAttribute('data-project-id', item.id);
        slot.setAttribute('role', 'group');
        slot.setAttribute('aria-label', item.title + ', ' + p.labels.inBuild);
        slot.appendChild(art(item.art, 'empty-art'));
        slot.appendChild(el('span', { class: 'empty-title', text: item.title }));
        slot.appendChild(el('span', { class: 'tag t-build', text: p.labels.inBuild }));
        return;
      }
      var face = brick(sec, grid, 'project', item.size);
      if (item.id) face.parentNode.parentNode.setAttribute('data-project-id', item.id);
      var big = item.size[0] >= 6;
      var summary = item.summary || item.problem;
      var inner = [
        el('div', { class: 'proj-head' },
          el('div', { class: 'proj-headtext' },
            el('h3', { class: 'proj-title clamp', style: { '-webkit-line-clamp': 3 }, text: item.title }),
            item.subtitle ? el('p', { class: 'proj-sub clamp', style: { '-webkit-line-clamp': 2 }, text: item.subtitle }) : null),
          art(item.art, 'proj-art')),
        summary ? el('p', { class: 'proj-problem clamp', style: { '-webkit-line-clamp': 3 }, text: summary }) : null
      ];
      if (item.tags && item.tags.length) {
        var tags = el('div', { class: 'proj-tags' });
        item.tags.forEach(function (t) { tags.appendChild(el('span', { class: 'ptag', text: t })); });
        inner.push(tags);
      }
      if (item.parts && item.parts.length) {
        var parts = el('div', { class: 'parts' });
        item.parts.forEach(function (t) { parts.appendChild(el('span', { class: 'part', text: t })); });
        inner.push(parts);
      }
      if (item.stats && item.stats.length) {
        var stats = el('div', { class: 'proj-stats' });
        item.stats.forEach(function (s) {
          stats.appendChild(el('div', { class: 'pstat' }, el('b', { text: s.value }), el('span', { text: s.label })));
        });
        inner.push(stats);
      }
      inner.push(el('div', { class: 'proj-foot' },
        item.status ? el('span', { class: 'tag ' + statusClass(item.status), text: item.status }) : null,
        hasDetail(item) ? el('span', { class: 'proj-open', text: p.labels.open }) : null));

      var holder = hasDetail(item)
        ? el('button', { class: 'proj-btn' + (big ? ' big' : ''), type: 'button', 'aria-haspopup': 'dialog' })
        : el('div', { class: 'proj-btn static' + (big ? ' big' : '') });
      inner.forEach(function (n) { if (n) holder.appendChild(n); });
      face.appendChild(holder);
      var link = linkSkills(face, face.parentNode, item.skills, false);
      if (hasDetail(item)) {
        holder.addEventListener('click', function () {
          if (link && state.lastPointer === 'touch' && !link.isOn()) { link.set(true); return; }
          if (item.case) openCase(item, holder); else openPanel(item, holder);
        });
      }
    });
  }

  /* Experience as a shipment tracker: one brick per stop along a route from her degree to
     "delivered". The roles keep their own detail panels; the other stops are plain stops. */
  function renderTracker(sec, grid, c) {
    var x = c.experience;
    var t = x.tracker;
    var byRole = {};
    x.roles.forEach(function (r) { byRole[r.id] = r; });

    var head = brick(sec, grid, 'trackhead', [12, 1], { solid: true });
    head.appendChild(el('div', { class: 'track-head' },
      el('p', null, el('b', { text: t.label + ' ' }), el('span', { class: 'track-code', text: t.code })),
      el('p', null, el('b', { text: t.shipmentLabel + ' ' }), el('span', { text: t.shipment })),
      el('p', { class: 'track-status' }, el('b', { text: t.statusLabel + ' ' }), el('span', { text: t.status }))));

    var line = el('div', { class: 'track' });
    plainSlot(grid, [12, 2]).appendChild(line);
    line.appendChild(el('span', { class: 'track-rail', 'aria-hidden': 'true' }));

    t.stops.forEach(function (s, i) {
      var r = s.role ? byRole[s.role] : null;
      var stop = el('div', { class: 'stop' + (s.current ? ' current' : '') + (s.pending ? ' pending' : ''),
        style: { '--i': i } });
      var inner = [
        el('span', { class: 'stop-dot', 'aria-hidden': 'true' }),
        el('p', { class: 'stop-stage', text: s.stage }),
        el('h3', { class: 'stop-title', text: r ? r.title : s.title }),
        el('p', { class: 'stop-where', text: r ? r.org + ', Hyderabad, India' : s.where }),
        el('p', { class: 'stop-when', text: r ? r.dates : s.when }),
        r ? el('p', { class: 'stop-note', text: r.headline }) : null,
        r ? el('span', { class: 'proj-open', text: t.openLabel }) : null
      ];
      var holder;
      if (r) {
        holder = el('button', { class: 'stop-btn', type: 'button', 'aria-haspopup': 'dialog' });
      } else if (s.href) {
        holder = el('a', { class: 'stop-btn', href: s.href });
      } else {
        holder = el('div', { class: 'stop-btn static' });
      }
      inner.forEach(function (node) { if (node) holder.appendChild(node); });
      stop.appendChild(holder);
      line.appendChild(stop);
      if (r) {
        stop.setAttribute('data-role-id', r.id);
        var link = linkSkills(holder, stop, r.skills, true);
        holder.addEventListener('click', function () {
          if (link && state.lastPointer === 'touch' && !link.isOn()) { link.set(true); return; }
          openRole(r, holder);
        });
      }
    });
  }

  function renderExperience(sec, grid, c) {
    var x = c.experience;
    if (x.tracker) return renderTracker(sec, grid, c);
    x.roles.forEach(function (r) {
      var face = brick(sec, grid, 'role', [4, 4]);
      if (r.id) face.parentNode.parentNode.setAttribute('data-role-id', r.id);
      var btn = el('button', { class: 'role-btn', type: 'button', 'aria-haspopup': 'dialog' },
        art(r.art, 'role-art'),
        el('p', { class: 'role-org', text: r.org }),
        el('h3', { class: 'role-title', text: r.title }),
        el('p', { class: 'role-dates', text: r.dates }),
        el('p', { class: 'role-headline', text: r.headline }),
        el('span', { class: 'proj-open', text: x.labels.open }));
      face.appendChild(btn);
      var link = linkSkills(face, face.parentNode, r.skills, false);
      btn.addEventListener('click', function () {
        if (link && state.lastPointer === 'touch' && !link.isOn()) { link.set(true); return; }
        openRole(r, btn);
      });
    });
  }

  function renderEducation(sec, grid, c) {
    c.education.items.forEach(function (e) {
      var f = brick(sec, grid, 'edu', [6, 3]);
      f.appendChild(el('h3', { text: e.school }));
      f.appendChild(el('p', { class: 'edu-degree', text: e.degree }));
      f.appendChild(el('p', { class: 'edu-dates', text: e.dates }));
      f.appendChild(el('p', { class: 'edu-line', text: e.line }));
      f.appendChild(art(e.art, 'edu-art'));
    });
  }

  function renderSkills(sec, grid, c) {
    var s = c.skills;
    plainSlot(grid, [12, 1]).appendChild(el('p', { class: 'label-line', text: s.label }));
    s.problems.forEach(function (p) {
      var col = el('div', { class: 'pcol' });
      grid.appendChild(col);
      var pf = brick(sec, col, 'problem', [4, 2], { solid: true });
      pf.parentNode.parentNode.classList.add('wide');
      pf.appendChild(el('p', { class: 'problem-text', text: p.text }));
      pf.appendChild(art(p.art, 'problem-art'));
      p.skills.forEach(function (id) {
        var name = s.names[id];
        var f = brick(sec, col, 'skill', [2, 2]);
        f.appendChild(el('p', { class: 'skill-name', text: name }));
        f.parentNode.parentNode.setAttribute('data-skill-id', id);
        state.skillEls[id] = f.parentNode;
        state.skillNames[id] = name;
      });
    });
  }

  function renderArticles(sec, grid, c) {
    c.articles.items.forEach(function (a) {
      var f = brick(sec, grid, 'article', [6, 2]);
      f.appendChild(el('h3', { class: 'clamp', style: { '-webkit-line-clamp': 3 }, text: a.title }));
      f.appendChild(a.link
        ? el('a', { class: 'article-link', href: a.link, target: '_blank', rel: 'noopener noreferrer', text: 'Read the article' })
        : el('span', { class: 'article-soon', text: c.articles.soon }));
      f.appendChild(art(a.art, 'article-art'));
    });
  }

  function renderOutside(sec, grid, c) {
    c.outside.items.forEach(function (o, i) {
      var f = brick(sec, grid, 'outside', [3, 3], { scrub: i + 1 });
      f.appendChild(photo(o, { lazy: true }));
      f.appendChild(el('p', { class: 'outside-cap', text: o.caption }));
    });
    var lf = brick(sec, grid, 'outsideline', [12, 2], { solid: true, scrub: c.outside.items.length + 1 });
    lf.appendChild(el('p', { class: 'outside-line', text: c.outside.line }));
  }

  function renderContact(sec, grid, c) {
    var k = c.contact;
    var face = brick(sec, grid, 'contact', [12, 3], { solid: true, contact: true });
    /* real links (mailto and the PDF) so crawlers and no script readers can follow them;
       a plain click opens the friendlier dialog, ctrl or middle click keeps the normal link behaviour */
    function dialogLink(attrs, open) {
      var a = el('a', attrs);
      a.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(a);
      });
      return a;
    }
    var emailBtn = dialogLink({ class: 'contact-link', href: 'mailto:' + k.email, 'aria-haspopup': 'dialog' }, openEmail);
    emailBtn.appendChild(el('b', { text: k.emailLabel }));
    emailBtn.appendChild(el('span', { text: k.email }));
    var li = k.linkedin;
    var liLink = el('a', { class: 'contact-link', href: li.href, target: '_blank', rel: 'noopener noreferrer' },
      el('b', { text: li.label }), el('span', { text: li.value }));
    var resBtn = dialogLink({ class: 'contact-link', href: k.resume.href, 'aria-haspopup': 'dialog' }, openResume);
    resBtn.appendChild(el('b', { text: k.resume.label }));
    resBtn.appendChild(el('span', { text: k.resume.value }));
    face.appendChild(el('p', { class: 'contact-text', text: k.text }));
    face.appendChild(el('div', { class: 'contact-links' }, emailBtn, liLink, resBtn));
  }

  var RENDERERS = {
    intro: renderIntro, about: renderAbout, projects: renderProjects, experience: renderExperience,
    education: renderEducation, skills: renderSkills, articles: renderArticles, outside: renderOutside,
    contact: renderContact
  };

  /* ---------- page assembly ---------- */
  function render(c) {
    state.content = c;
    Object.keys((c.skills && c.skills.names) || {}).forEach(function (id) { state.skillNames[id] = c.skills.names[id]; });
    document.title = c.site.title;

    document.getElementById('brand').textContent = c.site.name;
    var nav = document.getElementById('topnav');
    document.getElementById('skipAnim').textContent = c.site.skipLabel;
    document.getElementById('soundBtn').textContent = c.site.soundLabel;
    document.getElementById('meterLabel').textContent = c.site.meter.assembling;

    c.sections.forEach(function (def, i) {
      var isIntro = def.kind === 'intro';
      var h = el(isIntro ? 'span' : 'h2', { class: 'plate-title', id: 'h-' + def.id, text: def.title });
      var plate = el('div', { class: 'plate' + (def.noPlate ? ' plain' : '') },
        studRow(12),
        h,
        el('span', { class: 'plate-fill', 'aria-hidden': 'true' }, studRow(12)),
        el('span', { class: 'plate-title-on', 'aria-hidden': 'true', text: def.title }));
      var grid = el('div', { class: 'grid' });
      var node = el('section', {
        class: 'sec anim-' + (def.anim || 'snap'), id: def.id, 'data-color': def.color, 'data-dir': DIRS[i % 4],
        'aria-labelledby': 'h-' + def.id, tabindex: '-1'
      }, plate, grid);
      var sec = { def: def, index: i, el: node, count: 0 };
      state.secs.push(sec);
      RENDERERS[def.kind](sec, grid, c, def);
      $main.appendChild(node);
      nav.appendChild(el('a', { href: '#' + def.id, text: def.nav || def.title }));
    });
  }

  /* ---------- assemble motion ---------- */
  var meter = document.getElementById('meter');
  var meterLabel = document.getElementById('meterLabel');

  function updateMeter() {
    var total = state.bricks.length || 1;
    var pct = state.locked / total;
    meter.style.setProperty('--p', pct);
    meter.setAttribute('aria-valuenow', Math.round(pct * 100));
    if (state.contactLocked) {
      meter.classList.add('done');
      meterLabel.textContent = state.content.site.meter.done;
    }
  }

  /* neighbours of a brick that just landed wiggle, as if the studs knocked them */
  function wiggleNeighbours(rec) {
    var a = rec.slot.getBoundingClientRect();
    state.bricks.forEach(function (o) {
      if (o === rec || o.state !== 'locked' || o.sec !== rec.sec) return;
      var b = o.slot.getBoundingClientRect();
      var dx = Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) - (a.width + b.width) / 2;
      var dy = Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) - (a.height + b.height) / 2;
      if (dx < 26 && dy < 26) {
        var f = o.brick.querySelector('.face');
        f.classList.remove('wig');
        void f.offsetWidth;
        f.classList.add('wig');
        setTimeout(function () { f.classList.remove('wig'); }, 360);
      }
    });
  }

  function lock(rec, animate) {
    if (rec.state === 'locked') return;
    rec.state = 'locked';
    rec.slot.classList.add('locked');
    rec.sec.el.classList.add('lit');
    var face = rec.brick.querySelector('.face');
    if (face && face._count) { if (animate) face._count(); else face._count.final && face._count.final(); face._count = null; }
    if (animate && mode() === 'full') {
      wiggleNeighbours(rec);
      clickSound();
    }
    state.locked++;
    if (rec.isContact) {
      state.contactLocked = true;
      if (animate && mode() !== 'skip') {
        rec.slot.classList.add('flash');
        setTimeout(function () { rec.slot.classList.remove('flash'); }, 800);
      }
    }
    updateMeter();
    if (rec.isContact) completeAll();
  }

  function assemble(rec, delay, instant) {
    if (rec.state !== 'idle' || rec.scrub) return;
    io.unobserve(rec.slot);
    var m = mode();
    rec.state = 'flying';
    if (instant || m === 'skip') {
      rec.brick.classList.add('go', 'instant');
      lock(rec, false);
      return;
    }
    var kind = rec.sec.def.anim || 'snap';
    var info = KINDS[kind] || KINDS.snap;
    var face = rec.brick.querySelector('.face');
    if (face && face._prime && m === 'full') face._prime();
    rec.brick.style.setProperty('--delay', delay + 'ms');
    rec.brick.classList.add(m === 'fade' ? 'k-fade' : 'k-' + kind);
    var done = false;
    var finish = function () {
      if (done) return;
      done = true;
      lock(rec, true);
    };
    rec.brick.addEventListener('animationend', function (e) {
      if (e.target === rec.brick && /^(drop|stack|snap|piece|fade-in)$/.test(e.animationName)) finish();
    });
    rec.brick.classList.add('go');
    setTimeout(finish, delay + (m === 'fade' ? FADE_MS : info.dur) + 150);
  }

  var io = new IntersectionObserver(function (entries) {
    var bySec = new Map();
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var rec = e.target._rec;
      if (!bySec.has(rec.sec)) bySec.set(rec.sec, []);
      bySec.get(rec.sec).push(rec);
    });
    bySec.forEach(function (list, sec) {
      var gap = (KINDS[sec.def.anim] || KINDS.snap).gap;
      /* no reader should wait for a brick: however many arrive at once, the last one starts
         within MAX_STAGGER (the old fixed gap made the sixth project card 3.5s late) */
      if (list.length > 1) gap = Math.min(gap, MAX_STAGGER / (list.length - 1));
      list.sort(function (a, b) { return a.idx - b.idx; });
      list.forEach(function (rec, k) { assemble(rec, k * gap, false); });
    });
  }, { threshold: 0.25 });

  function completeBefore(index) {
    state.bricks.forEach(function (rec) {
      if (rec.sec.index < index) { assemble(rec, 0, true); markScrubDone(rec); }
    });
  }
  function completeAll() {
    state.bricks.forEach(function (rec) { assemble(rec, 0, true); markScrubDone(rec); });
  }
  function markScrubDone(rec) {
    if (rec.scrub && rec.state === 'idle') { rec.state = 'flying'; lock(rec, false); }
  }

  /* ---------- scroll scrubbed build (Outside work) ---------- */
  var SCRUB_FROM = [[-150, 120, -7], [0, 230, 5], [150, 120, 7], [0, 230, -5], [-150, 200, 4]];
  function updateScrub() {
    var vh = window.innerHeight;
    var k = isPhone() ? 0.35 : 1;
    var still = mode() !== 'full';
    state.scrubs.forEach(function (rec) {
      var f = SCRUB_FROM[(rec.scrubIdx - 1) % SCRUB_FROM.length];
      var r = rec.slot.getBoundingClientRect();
      var start = vh * 0.98;
      var end = vh * 0.5;
      var p = (start - r.top) / (start - end);
      p = Math.max(0, Math.min(1, p));
      if (still) p = mode() === 'skip' ? 1 : Math.min(1, p * 2);
      var s = rec.brick.style;
      s.setProperty('--p', p.toFixed(3));
      s.setProperty('--fx', (f[0] * k) + 'px');
      s.setProperty('--fy', (f[1] * k) + 'px');
      s.setProperty('--fr', f[2] + 'deg');
      var built = p >= 0.985;
      if (built !== rec.built) {
        rec.built = built;
        rec.brick.classList.toggle('built', built);
        if (built) {
          var face = rec.brick.querySelector('.face');
          face.classList.remove('wig'); void face.offsetWidth; face.classList.add('wig');
          if (mode() === 'full') clickSound();
          if (rec.state === 'idle') { rec.state = 'flying'; lock(rec, false); }
        }
      }
    });
  }

  /* ---------- tailored links (?for=risk-compliance) ----------
     She can send a recruiter a link aimed at one kind of role. The matching projects, roles,
     problems and numbers stay bright and come first in their section; everything else dims but
     stays readable. One click clears it, and the plain URL is the whole site as usual. */
  function focusGroups() {
    return (state.content.focus && state.content.focus.groups) || [];
  }
  function readFocus() {
    var m = /[?&]for=([^&#]+)/.exec(window.location.search) || /#for=([^&]+)/.exec(window.location.hash);
    if (!m) return null;
    var want = decodeURIComponent(m[1]).toLowerCase();
    return focusGroups().filter(function (g) { return g.id === want; })[0] || null;
  }

  var banner = null;
  function applyFocus(group) {
    state.focus = group || null;
    root.classList.toggle('focused', !!group);
    var pick = group
      ? { project: group.projects || [], role: group.roles || [], problem: group.problems || [], number: group.numbers || [] }
      : null;
    [['data-project-id', 'project'], ['data-role-id', 'role'], ['data-problem-id', 'problem'], ['data-number-id', 'number']]
      .forEach(function (pair) {
        Array.prototype.forEach.call(document.querySelectorAll('[' + pair[0] + ']'), function (node) {
          var inFocus = !!pick && pick[pair[1]].indexOf(node.getAttribute(pair[0])) !== -1;
          node.classList.toggle('in-focus', !!pick && inFocus);
          node.classList.toggle('out-focus', !!pick && !inFocus);
          /* order:-1 lifts a match to the front of its grid without moving it in the DOM,
             so reading order and tab order stay as written */
          node.style.order = pick && inFocus ? '-1' : '';
        });
      });

    if (banner) { banner.remove(); banner = null; }
    var targetEl = document.querySelector('[data-detail="targeting"]');
    if (targetEl) targetEl.textContent = group && group.targeting ? group.targeting : state.targetingDefault;
    if (!group) return;

    var f = state.content.focus;
    var clear = el('button', { class: 'focus-clear', type: 'button', text: f.clear });
    clear.addEventListener('click', function () {
      var url = window.location.pathname + window.location.hash.replace(/#?for=[^&]*/, '');
      try { history.replaceState(null, '', url || '/'); } catch (e) { /* ignore */ }
      applyFocus(null);
    });
    banner = el('div', { class: 'focus-bar', role: 'status' },
      el('p', null, el('span', { text: f.paramLabel + ' ' }), el('b', { text: group.label })), clear);
    document.getElementById('topbar').insertAdjacentElement('afterend', banner);
  }

  /* ---------- navigation ---------- */
  function sectionFromHash(hash) {
    var id = (hash || '').replace('#', '');
    for (var i = 0; i < state.secs.length; i++) if (state.secs[i].def.id === id) return state.secs[i];
    return null;
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var sec = sectionFromHash(a.getAttribute('href'));
    if (!sec) return;
    e.preventDefault();
    completeBefore(sec.index);
    sec.el.scrollIntoView({ behavior: 'auto', block: 'start' });
    sec.el.focus({ preventScroll: true });
    try { history.replaceState(null, '', '#' + sec.def.id); } catch (err) { /* ignore */ }
    updateActive();
    updateScrub();
  });

  var activeId = null;
  var ticking = false;
  function updateActive() {
    var line = document.getElementById('topbar').offsetHeight + window.innerHeight * 0.25;
    var current = state.secs[0];
    state.secs.forEach(function (s) {
      if (s.el.getBoundingClientRect().top <= line) current = s;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      current = state.secs[state.secs.length - 1];
    }
    if (current.def.id === activeId) return;
    activeId = current.def.id;
    var nav = document.getElementById('topnav');
    Array.prototype.forEach.call(nav.children, function (a) {
      if (a.getAttribute('href') === '#' + activeId) {
        a.setAttribute('aria-current', 'true');
        if (nav.scrollWidth > nav.clientWidth) {
          nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
        }
      } else a.removeAttribute('aria-current');
    });
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; updateActive(); updateScrub(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- toggles ---------- */
  var skipBtn = document.getElementById('skipAnim');
  var soundBtn = document.getElementById('soundBtn');
  function setSkip(on, persist) {
    state.skip = on;
    skipBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    applyMode();
    if (persist) store('brickSkip', on ? '1' : '0');
    if (on) completeAll();
    updateScrub();
  }
  function setSound(on, persist) {
    state.sound = on;
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (persist) store('brickSound', on ? '1' : '0');
    if (on) { ensureAudio(); if (audio && audio.state === 'suspended') audio.resume(); clickSound(); }
  }
  skipBtn.addEventListener('click', function () { setSkip(!state.skip, true); });
  soundBtn.addEventListener('click', function () { setSound(!state.sound, true); });
  if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', function () { applyMode(); updateScrub(); });
  /* a saved "sound on" choice needs one tap before the browser lets audio start */
  document.addEventListener('pointerdown', function () {
    if (state.sound && !audio) ensureAudio();
    if (audio && audio.state === 'suspended') audio.resume();
  }, { passive: true });

  /* ---------- project detail panel ---------- */
  var wrap = document.getElementById('panelWrap');
  var panel = document.getElementById('panel');
  var lastTrigger = null;

  function openPanel(item, trigger) {
    var L = state.content.projects.labels;
    lastTrigger = trigger;
    panel.textContent = '';

    var close = el('button', { class: 'btn light panel-close', type: 'button', text: L.close });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'panel-head' },
      el('div', null,
        item.status ? el('span', { class: 'tag ' + statusClass(item.status), text: item.status }) : null,
        el('h2', { id: 'panelTitle', text: item.title })),
      close));

    var dl = el('dl');
    function row(label, node) { dl.appendChild(el('div', null, el('dt', { text: label }), el('dd', null, node))); }
    if (item.problem) row(L.problem, item.problem);
    if (item.inputs) row(L.inputs, item.inputs);
    if (item.process && item.process.length) {
      var steps = el('div', { class: 'mini-row' });
      item.process.forEach(function (s, i) {
        steps.appendChild(el('div', { class: 'mini' }, el('b', { text: String(i + 1) }), el('span', { text: s })));
      });
      row(L.process, steps);
    }
    if (item.result) row(L.result, item.result);
    if (item.link && item.link.href) {
      row(L.link, el('a', { class: 'btn', href: item.link.href, target: '_blank', rel: 'noopener noreferrer', text: item.link.label }));
    }
    panel.appendChild(dl);

    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    close.focus();
  }

  /* full case write up, rendered from item.case */
  function openCase(item, trigger) {
    var L = state.content.projects.labels;
    var cs = item.case;
    lastTrigger = trigger;
    panel.textContent = '';
    var close = el('button', { class: 'btn light panel-close', type: 'button', text: L.close });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'panel-head' },
      el('div', null,
        item.status ? el('span', { class: 'tag ' + statusClass(item.status), text: item.status }) : null,
        el('h2', { id: 'panelTitle', text: item.title }),
        item.subtitle ? el('p', { class: 'case-sub', text: item.subtitle }) : null,
        cs.context ? el('p', { class: 'case-ctx', text: cs.context }) : null),
      close));

    if (item.tags && item.tags.length) {
      var tags = el('div', { class: 'proj-tags case-tags' });
      item.tags.forEach(function (t) { tags.appendChild(el('span', { class: 'ptag', text: t })); });
      panel.appendChild(tags);
    }

    function statGrid(list) {
      var g = el('div', { class: 'case-stats' });
      list.forEach(function (s) { g.appendChild(el('div', { class: 'cstat' }, el('b', { text: s.value }), el('span', { text: s.label }))); });
      return g;
    }
    if (cs.stats && cs.stats.length) panel.appendChild(statGrid(cs.stats));
    (cs.intro || []).forEach(function (t) { panel.appendChild(el('p', { class: 'case-p', text: t })); });

    (cs.blocks || []).forEach(function (b) {
      if (b.type === 'text') {
        panel.appendChild(el('h3', { class: 'case-h', text: b.heading }));
        b.paragraphs.forEach(function (t) { panel.appendChild(el('p', { class: 'case-p', text: t })); });
      } else if (b.type === 'steps') {
        panel.appendChild(el('h3', { class: 'case-h', text: b.heading }));
        var row = el('div', { class: 'mini-row' });
        b.items.forEach(function (s, i) {
          row.appendChild(el('div', { class: 'mini' },
            el('b', { text: String(i + 1) }),
            el('div', { class: 'mini-body' }, el('p', { class: 'mini-title', text: s.title }), el('p', { text: s.text }))));
        });
        panel.appendChild(row);
      } else if (b.type === 'matrix') {
        panel.appendChild(el('h3', { class: 'case-h', text: b.heading }));
        var m = el('div', { class: 'matrix' });
        m.appendChild(el('span', { class: 'mx head' }));
        b.cols.forEach(function (t) { m.appendChild(el('span', { class: 'mx head', text: t })); });
        b.rows.forEach(function (r) {
          m.appendChild(el('span', { class: 'mx head', text: r.label }));
          r.cells.forEach(function (t) { m.appendChild(el('span', { class: 'mx', text: t })); });
        });
        panel.appendChild(m);
      } else if (b.type === 'list') {
        panel.appendChild(el('h3', { class: 'case-h', text: b.heading }));
        if (b.intro) panel.appendChild(el('p', { class: 'case-p', text: b.intro }));
        var ol = el('ol', { class: 'bullets numbered' });
        b.items.forEach(function (t) { ol.appendChild(el('li', { text: t })); });
        panel.appendChild(ol);
      } else if (b.type === 'stats') {
        panel.appendChild(el('h3', { class: 'case-h', text: b.heading }));
        panel.appendChild(statGrid(b.items));
      } else if (b.type === 'quote') {
        panel.appendChild(el('blockquote', { class: 'case-quote', text: b.text }));
      }
    });

    if (cs.links && cs.links.length) {
      var links = el('div', { class: 'chooser' });
      cs.links.forEach(function (l) {
        links.appendChild(el('a', { class: 'btn', href: l.href, target: '_blank', rel: 'noopener noreferrer', text: l.label }));
      });
      panel.appendChild(links);
    }

    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    close.focus();
  }

  function openRole(r, trigger) {
    var L = state.content.experience.labels;
    lastTrigger = trigger;
    panel.textContent = '';
    var close = el('button', { class: 'btn light panel-close', type: 'button', text: state.content.projects.labels.close });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'panel-head' },
      el('div', null,
        el('p', { class: 'panel-org', text: r.org + ', ' + r.dates }),
        el('h2', { id: 'panelTitle', text: r.title })),
      close));
    var ul = el('ul', { class: 'bullets' });
    r.bullets.forEach(function (b) { ul.appendChild(el('li', { text: b })); });
    var dl = el('dl');
    dl.appendChild(el('div', null, el('dt', { text: L.responsibilities }), el('dd', null, ul)));
    if (r.skills && r.skills.length) {
      var chips = el('div', { class: 'panel-chips' });
      r.skills.forEach(function (id) { chips.appendChild(el('span', { class: 'chip-skill', text: state.skillNames[id] || id })); });
      dl.appendChild(el('div', null, el('dt', { text: L.skills }), el('dd', null, chips)));
    }
    panel.appendChild(dl);
    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    close.focus();
  }

  function openEmail(trigger) {
    var k = state.content.contact;
    var ch = k.chooser;
    lastTrigger = trigger;
    panel.textContent = '';
    var close = el('button', { class: 'btn light panel-close', type: 'button', text: state.content.projects.labels.close });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'panel-head' },
      el('div', null, el('h2', { id: 'panelTitle', text: ch.title })),
      close));
    panel.appendChild(el('p', { class: 'chooser-hint', text: ch.hint }));
    panel.appendChild(el('p', { class: 'chooser-addr', text: k.email }));
    var list = el('div', { class: 'chooser' });
    ch.providers.forEach(function (p) {
      var href = p.href.replace('{email}', encodeURIComponent(k.email).replace('%40', '@'));
      var isMail = href.indexOf('mailto:') === 0;
      list.appendChild(el('a', { class: 'btn', href: href, target: isMail ? null : '_blank', rel: isMail ? null : 'noopener noreferrer', text: p.label }));
    });
    var copy = el('button', { class: 'btn light', type: 'button', text: ch.copy });
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = ch.copied; setTimeout(function () { copy.textContent = ch.copy; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k.email).then(done, done);
      else done();
    });
    list.appendChild(copy);
    panel.appendChild(list);
    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    close.focus();
  }

  function openResume(trigger) {
    var R = state.content.contact.resume;
    var url = new URL(R.href, window.location.href).href;
    lastTrigger = trigger;
    panel.textContent = '';
    var close = el('button', { class: 'btn light panel-close', type: 'button', text: state.content.projects.labels.close });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'panel-head' },
      el('div', null, el('h2', { id: 'panelTitle', text: R.title })),
      close));
    panel.appendChild(el('p', { class: 'chooser-hint', text: R.hint }));

    var actions = el('div', { class: 'chooser' },
      el('a', { class: 'btn', href: R.href, target: '_blank', rel: 'noopener noreferrer', text: R.open }),
      el('a', { class: 'btn', href: R.href, download: '', text: R.download }));
    var share = el('button', { class: 'btn', type: 'button', text: R.share });
    actions.appendChild(share);
    panel.appendChild(actions);

    var more = el('div', { class: 'chooser more', hidden: true });
    var copy = el('button', { class: 'btn light', type: 'button', text: R.copy });
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = R.copied; setTimeout(function () { copy.textContent = R.copy; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, done);
      else done();
    });
    var mail = el('a', { class: 'btn light', href: 'mailto:?subject=' + encodeURIComponent(R.shareTitle) + '&body=' + encodeURIComponent(R.shareText + ': ' + url), text: R.mail });
    more.appendChild(copy);
    more.appendChild(mail);
    panel.appendChild(more);

    share.addEventListener('click', function () {
      if (navigator.share && window.location.protocol !== 'file:') {
        navigator.share({ title: R.shareTitle, text: R.shareText, url: url }).catch(function () { more.hidden = false; });
      } else {
        more.hidden = false;
      }
    });

    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    panel.scrollTop = 0;
    close.focus();
  }

  function closePanel() {
    wrap.hidden = true;
    document.body.style.overflow = '';
    if (lastTrigger) lastTrigger.focus();
  }

  document.getElementById('panelBackdrop').addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) {
    if (wrap.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    var f = panel.querySelectorAll('a[href], button:not([disabled])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  /* ---------- start ---------- */
  /* the plain text copy of the page is for readers without JavaScript; hide it from screen and screen readers once we run */
  var staticCopy = document.getElementById('static-content');
  if (staticCopy) { staticCopy.setAttribute('inert', ''); staticCopy.setAttribute('aria-hidden', 'true'); }
  state.skip = store('brickSkip') === '1';
  state.sound = store('brickSound') === '1';
  applyMode();
  skipBtn.setAttribute('aria-pressed', state.skip ? 'true' : 'false');
  soundBtn.setAttribute('aria-pressed', state.sound ? 'true' : 'false');

  /* content.js is loaded before this file, so the page can draw itself straight away:
     no second request, nothing to wait for. sync_content.py keeps it equal to content.json. */
  try {
    if (!window.CONTENT) throw new Error('content.js did not load');
    render(window.CONTENT);
    applyFocus(readFocus());
    state.bricks.forEach(function (rec) { if (!rec.scrub) io.observe(rec.slot); });
    var target = sectionFromHash(location.hash);
    if (target) {
      completeBefore(target.index);
      target.el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    if (state.skip) completeAll();
    updateActive();
    updateScrub();
  } catch (err) {
    /* bricks could not build: show the plain text copy instead */
    root.classList.remove('js');
    if (staticCopy) { staticCopy.removeAttribute('inert'); staticCopy.removeAttribute('aria-hidden'); }
    console.error(err);
  }
})();
