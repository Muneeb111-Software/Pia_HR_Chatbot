// ===================== PIA HR Assistant frontend =====================

const searchInput = document.getElementById('search-input');
const clearBtn = document.getElementById('clear-btn');
const suggestionsBox = document.getElementById('suggestions');
const answerZone = document.getElementById('answer-zone');
const emptyZone = document.getElementById('empty-zone');
const answerTopic = document.getElementById('answer-topic');
const answerConf = document.getElementById('answer-conf');
const answerQuestion = document.getElementById('answer-question');
const answerText = document.getElementById('answer-text');
const answerReference = document.getElementById('answer-reference');
const relatedWrap = document.getElementById('related-wrap');
const relatedList = document.getElementById('related-list');
const faqGrid = document.getElementById('faq-grid');
const faqEyebrow = document.getElementById('faq-eyebrow');
const resetFilterBtn = document.getElementById('reset-filter');
const boardRows = document.querySelectorAll('.board-row');
const sideLinks = document.querySelectorAll('.side-link');
const askAiBtn = document.getElementById('ask-ai-btn');
const quickChips = document.querySelectorAll('.quick-chip');
const ctaInput = document.getElementById('cta-input');
const ctaSend = document.getElementById('cta-send');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sideNav = document.getElementById('side-nav');

let activeTopic = null;
let debounceTimer = null;

// ---------------- Icon set for Quick Access cards (matched by topic name) ----------------
const TOPIC_ICONS = {
  medical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 8.6a4.6 4.6 0 0 0-7.8-3.3L12 6l-1-.7A4.6 4.6 0 0 0 3.2 8.6c0 2 1.2 3.6 2.6 5L12 20l6.2-6.4c1.4-1.4 2.6-3 2.6-5Z"/><path d="M12 9v5M9.5 11.5h5"/></svg>',
  leave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  allowance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="15" cy="14.5" r="1.4" fill="currentColor" stroke="none"/></svg>',
  recruitment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="18" cy="9" r="2.4"/><path d="M15.5 20c.3-2.6 2-4.4 4.5-4.7"/></svg>',
  pension: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1a2 2 0 0 1-2 2h-1v2h-2v-2H9v2H7v-2H6a2 2 0 0 1-2-2Z"/><circle cx="15" cy="11" r="1" fill="currentColor" stroke="none"/><path d="M4 12 2 11M9 8V6"/></svg>',
  passage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 1 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 1 0 0-4Z"/><path d="M14 7v10" stroke-dasharray="2 3"/></svg>',
  discipline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M7 7h10M4 7l-2 5a3 3 0 0 0 6 0Zm16 0-2 5a3 3 0 0 0 6 0Z"/><path d="M8 21h8"/></svg>'
};

function iconFor(topicName) {
  const key = (topicName || '').toLowerCase();
  for (const k in TOPIC_ICONS) {
    if (key.includes(k)) return TOPIC_ICONS[k];
  }
  return null;
}

// Apply icons to Quick Access cards rendered from the backend
boardRows.forEach(row => {
  const wrap = row.querySelector('.board-icon');
  if (!wrap) return;
  const svg = iconFor(row.dataset.topic);
  if (svg) {
    wrap.innerHTML = svg;
  } else {
    wrap.textContent = wrap.dataset.fallback || '\u2708';
  }
});

// ---------------- Sidebar celebration counter (split-flap style) ----------------
function animateSplitFlap(el) {
  const target = parseInt(el.dataset.count, 10) || 0;
  const duration = 900;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.floor(eased * target)).padStart(2, '0');
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = String(target).padStart(2, '0');
  }
  requestAnimationFrame(tick);
}
document.querySelectorAll('.flap-digits').forEach((el, i) => {
  setTimeout(() => animateSplitFlap(el), 300 + i * 150);
});

// ---------------- Mobile sidebar toggle ----------------
if (sidebarToggle && sideNav) {
  sidebarToggle.addEventListener('click', () => {
    sideNav.classList.toggle('open');
  });
}

// ---------------- Live search suggestions ----------------
searchInput.addEventListener('input', () => {
  clearBtn.hidden = searchInput.value.length === 0;
  clearTimeout(debounceTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    suggestionsBox.hidden = true;
    return;
  }
  debounceTimer = setTimeout(() => fetchSuggestions(q), 220);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q) askQuestion(q);
    suggestionsBox.hidden = true;
  }
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.hidden = true;
  suggestionsBox.hidden = true;
  answerZone.hidden = true;
  emptyZone.hidden = true;
  searchInput.focus();
});

// ---------------- Ask AI button (hero search) ----------------
if (askAiBtn) {
  askAiBtn.addEventListener('click', () => {
    const q = searchInput.value.trim();
    if (!q) {
      searchInput.focus();
      return;
    }
    askAiBtn.classList.remove('launching'); void askAiBtn.offsetWidth;
    askAiBtn.classList.add('launching');
    setTimeout(() => askAiBtn.classList.remove('launching'), 600);
    suggestionsBox.hidden = true;
    askQuestion(q);
  });
}

// ---------------- Bottom chat CTA bar ----------------
function submitCta() {
  const q = ctaInput.value.trim();
  if (!q) {
    ctaInput.focus();
    return;
  }
  searchInput.value = q;
  ctaInput.value = '';
  document.getElementById('boarding-pass').scrollIntoView({ behavior: 'smooth', block: 'center' });
  askQuestion(q);
}
if (ctaSend) ctaSend.addEventListener('click', submitCta);
if (ctaInput) {
  ctaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitCta();
    }
  });
}

// ---------------- Quick question chips ----------------
quickChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const query = chip.dataset.query || chip.textContent.trim();
    searchInput.value = query;
    clearBtn.hidden = false;
    document.getElementById('boarding-pass').scrollIntoView({ behavior: 'smooth', block: 'center' });
    askQuestion(query);
  });
});

async function fetchSuggestions(query) {
  try {
    const url = `/api/search?q=${encodeURIComponent(query)}&top_k=5${activeTopic ? '&topic=' + encodeURIComponent(activeTopic) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    renderSuggestions(data.results);
  } catch (err) {
    console.error('Search error', err);
  }
}

function renderSuggestions(results) {
  if (!results || results.length === 0) {
    suggestionsBox.hidden = true;
    return;
  }
  suggestionsBox.innerHTML = '';
  results.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'suggestion-item';
    btn.innerHTML = `<span>${escapeHtml(r.question)}</span><span class="suggestion-topic">${r.main_topic.toUpperCase()}</span>`;
    btn.addEventListener('click', () => {
      searchInput.value = r.question;
      suggestionsBox.hidden = true;
      askQuestion(r.question);
    });
    suggestionsBox.appendChild(btn);
  });
  suggestionsBox.hidden = false;
}

// ---------------- Ask / answer rendering ----------------
async function askQuestion(message) {
  suggestionsBox.hidden = true;
  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, topic: activeTopic }),
    });
    const data = await res.json();

    if (!data.matched_question) {
      answerZone.hidden = true;
      emptyZone.hidden = false;
      return;
    }
    emptyZone.hidden = true;
    answerZone.hidden = false;
    answerZone.classList.remove('answer-zone'); void answerZone.offsetWidth; answerZone.classList.add('answer-zone'); // restart animation

    answerTopic.textContent = data.main_topic ? data.main_topic.toUpperCase() : 'PIA HR';
    answerConf.textContent = `match ${Math.round((data.confidence || 0) * 100)}%`;
    answerQuestion.textContent = data.matched_question;
    answerText.textContent = data.answer;
    answerReference.textContent = data.reference ? `Ref: ${data.reference}` : '';

    if (data.related && data.related.length > 0) {
      relatedList.innerHTML = '';
      data.related.forEach(r => {
        const b = document.createElement('button');
        b.className = 'related-item';
        b.textContent = r.question;
        b.addEventListener('click', () => {
          searchInput.value = r.question;
          askQuestion(r.question);
        });
        relatedList.appendChild(b);
      });
      relatedWrap.hidden = false;
    } else {
      relatedWrap.hidden = true;
    }
  } catch (err) {
    console.error('Ask error', err);
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.boarding-pass')) {
    suggestionsBox.hidden = true;
  }
});

// ---------------- Topic filtering (sidebar + Quick Access cards share state) ----------------
function setActiveTopic(topic, label) {
  const topicLower = (topic || '').toLowerCase();
  if (activeTopic === topic) {
    activeTopic = null;
    boardRows.forEach(r => r.classList.remove('active'));
    sideLinks.forEach(l => l.classList.toggle('active', l.dataset.topic === ''));
    faqEyebrow.textContent = 'MOST ASKED \u00B7 ALL DESKS';
    resetFilterBtn.hidden = true;
  } else {
    activeTopic = topic;
    boardRows.forEach(r => r.classList.toggle('active', r.dataset.topic === topic));
    sideLinks.forEach(l => {
      const key = (l.dataset.topic || '').toLowerCase();
      l.classList.toggle('active', key !== '' && topicLower.includes(key));
    });
    faqEyebrow.textContent = `MOST ASKED \u00B7 ${(label || topic).toUpperCase()} DESK`;
    resetFilterBtn.hidden = false;
  }
  loadFaqs();
}

boardRows.forEach(row => {
  row.addEventListener('click', () => {
    setActiveTopic(row.dataset.topic, row.querySelector('.board-name')?.textContent);
    document.querySelector('.faq-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

sideLinks.forEach(link => {
  link.addEventListener('click', () => {
    const key = (link.dataset.topic || '').toLowerCase();
    if (sideNav) sideNav.classList.remove('open');
    if (key === '') {
      activeTopic = null;
      boardRows.forEach(r => r.classList.remove('active'));
      sideLinks.forEach(l => l.classList.toggle('active', l.dataset.topic === ''));
      faqEyebrow.textContent = 'MOST ASKED \u00B7 ALL DESKS';
      resetFilterBtn.hidden = true;
      loadFaqs();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Resolve against the matching Quick Access card so we always filter
      // using the exact topic name the backend actually knows about,
      // instead of a hand-typed guess that may not match (e.g. "Allowance"
      // vs the real topic string, which silently returned zero FAQs).
      const matchedRow = Array.from(boardRows).find(r => (r.dataset.topic || '').toLowerCase().includes(key));
      const realTopic = matchedRow ? matchedRow.dataset.topic : link.dataset.topic;
      const label = matchedRow ? matchedRow.querySelector('.board-name')?.textContent : link.querySelector('span:last-child')?.textContent;
      setActiveTopic(realTopic, label);
      document.querySelector('.faq-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

resetFilterBtn.addEventListener('click', () => {
  activeTopic = null;
  boardRows.forEach(r => r.classList.remove('active'));
  sideLinks.forEach(l => l.classList.toggle('active', l.dataset.topic === ''));
  faqEyebrow.textContent = 'MOST ASKED \u00B7 ALL DESKS';
  resetFilterBtn.hidden = true;
  loadFaqs();
});

// ---------------- FAQ grid ----------------
async function loadFaqs() {
  faqGrid.innerHTML = '<p class="faq-empty">Loading\u2026</p>';
  try {
    const url = `/api/faqs?limit=12${activeTopic ? '&topic=' + encodeURIComponent(activeTopic) : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    renderFaqs(data);
  } catch (err) {
    faqGrid.innerHTML = '<p class="faq-empty">Could not load FAQs right now.</p>';
  }
}

function renderFaqs(items) {
  if (!items || items.length === 0) {
    faqGrid.innerHTML = '<p class="faq-empty">No FAQs for this desk yet.</p>';
    return;
  }
  faqGrid.innerHTML = '';
  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'faq-card';
    card.style.animationDelay = `${i * 40}ms`;
    card.innerHTML = `
      <span class="faq-cat">${escapeHtml(item.category)}</span>
      <p class="faq-q">${escapeHtml(item.question)}</p>
      <p class="faq-a">${escapeHtml(item.answer)}</p>
    `;
    card.addEventListener('click', () => card.classList.toggle('open'));
    faqGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// initial load
loadFaqs();