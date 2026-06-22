/* ================================================================
   EcoLearn – script.js
   Sistem Step-by-Step dengan Kuis Evaluasi per Halaman
   Menggunakan Cookie sebagai Session untuk melacak progress
   ================================================================ */

/* ===================== STORAGE HELPERS ===================== */
// Menggunakan sessionStorage untuk menghindari masalah cookie race condition
// sessionStorage bertahan selama tab browser terbuka

const COOKIE_NAME = 'ecolearn_progress';
const PAGE_ORDER = ['beranda', 'pengenalan', 'jenis', 'dampak', 'pengelolaan', 'kuis'];
const QUIZ_PAGES = ['pengenalan', 'jenis', 'dampak', 'pengelolaan'];

// Cache progress di memory agar tidak perlu baca storage berkali-kali
let _progressCache = null;

function getProgress() {
  if (_progressCache) return _progressCache;
  try {
    const saved = sessionStorage.getItem(COOKIE_NAME);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.unlocked) {
        _progressCache = parsed;
        return _progressCache;
      }
    }
  } catch(e) {}
  _progressCache = { unlocked: ['beranda', 'pengenalan'], quizPassed: [] };
  return _progressCache;
}

function saveProgress(progress) {
  _progressCache = progress; // update cache langsung
  try {
    sessionStorage.setItem(COOKIE_NAME, JSON.stringify(progress));
  } catch(e) {}
}

function isUnlocked(pageId) {
  return getProgress().unlocked.includes(pageId);
}

function isQuizPassed(pageId) {
  return getProgress().quizPassed.includes(pageId);
}

function markQuizPassed(pageId) {
  // Baca dari cache (bukan dari storage lagi), update, simpan SEKALI
  const p = getProgress();

  if (!p.quizPassed.includes(pageId)) {
    p.quizPassed.push(pageId);
  }

  const idx = PAGE_ORDER.indexOf(pageId);
  if (idx >= 0 && idx < PAGE_ORDER.length - 1) {
    const next = PAGE_ORDER[idx + 1];
    if (!p.unlocked.includes(next)) {
      p.unlocked.push(next);
    }
  }

  saveProgress(p);
  updateNavLocks();
}

function resetAllProgress() {
  if (confirm('Reset semua progress belajar? Semua halaman akan terkunci kembali.')) {
    _progressCache = null;
    try { sessionStorage.removeItem(COOKIE_NAME); } catch(e) {}
    location.reload();
  }
}

/* ===================== SPLASH ===================== */
function enterSite() {
  const splash = document.getElementById('splash');
  splash.classList.add('fade-out');
  setTimeout(() => {
    splash.style.display = 'none';
    const site = document.getElementById('site');
    site.classList.add('visible');
    updateNavLocks();
    initKuis();
    initAllEvalQuizzes();
  }, 800);
}

/* ===================== NAVIGATION ===================== */
function showPage(id) {
  // Cek apakah halaman terkunci
  if (!isUnlocked(id)) {
    showLockedModal(id);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('nav-' + id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const navLinks = document.getElementById('navLinks');
  navLinks.classList.remove('open');

  // Khusus halaman kuis: tampilkan peringatan jika semua kuis eval belum selesai
  if (id === 'kuis') {
    const allPassed = QUIZ_PAGES.every(p => isQuizPassed(p));
    const warning = document.getElementById('kuisLockWarning');
    const wrapper = document.querySelector('.kuis-wrapper');
    if (warning && wrapper) {
      warning.style.display = allPassed ? 'none' : 'block';
      wrapper.style.display = allPassed ? 'block' : 'none';
    }
  }
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

/* ===================== NAV LOCK UI ===================== */
function updateNavLocks() {
  PAGE_ORDER.forEach(pageId => {
    const navEl = document.getElementById('nav-' + pageId);
    if (!navEl) return;
    const locked = !isUnlocked(pageId);
    if (locked) {
      navEl.classList.add('nav-locked');
      // Tambah ikon gembok kalau belum ada
      if (!navEl.querySelector('.lock-icon')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'lock-icon';
        lockIcon.textContent = ' 🔒';
        navEl.appendChild(lockIcon);
      }
    } else {
      navEl.classList.remove('nav-locked');
      const li = navEl.querySelector('.lock-icon');
      if (li) li.remove();
    }
  });
}

/* ===================== MODAL TERKUNCI ===================== */
function showLockedModal(id) {
  // Temukan halaman sebelumnya yang perlu diselesaikan
  const idx = PAGE_ORDER.indexOf(id);
  const prevPage = idx > 0 ? PAGE_ORDER[idx - 1] : null;
  const prevQuizPassed = prevPage ? isQuizPassed(prevPage) : true;

  let msg = '';
  const pageNames = {
    beranda: 'Beranda', pengenalan: 'Pengenalan', jenis: 'Jenis Sampah',
    dampak: 'Dampak Sampah', pengelolaan: 'Pengelolaan', kuis: 'Kuis Umum'
  };

  if (prevPage && !prevQuizPassed && QUIZ_PAGES.includes(prevPage)) {
    msg = `Kamu harus menyelesaikan <strong>Kuis Evaluasi</strong> di halaman <strong>${pageNames[prevPage]}</strong> terlebih dahulu sebelum lanjut ke sini!`;
  } else {
    msg = `Halaman <strong>${pageNames[id]}</strong> masih terkunci. Selesaikan materi sebelumnya terlebih dahulu.`;
  }

  // Buat atau update modal
  let modal = document.getElementById('lockModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'lockModal';
    modal.className = 'lock-modal-overlay';
    modal.innerHTML = `
      <div class="lock-modal-box">
        <div class="lock-modal-icon">🔒</div>
        <h3>Halaman Terkunci</h3>
        <p id="lockModalMsg"></p>
        <div class="lock-modal-btns">
          <button class="btn-primary" onclick="closeLockModal()">Mengerti</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById('lockModalMsg').innerHTML = msg;
  modal.style.display = 'flex';
}

function closeLockModal() {
  const modal = document.getElementById('lockModal');
  if (modal) modal.style.display = 'none';
}

/* ================================================================
   KUIS EVALUASI PER HALAMAN (3 soal, harus lulus untuk lanjut)
   ================================================================ */

const EVAL_QUESTIONS = {
  pengenalan: [
    {
      q: "Menurut UU No. 18 Tahun 2008, sampah adalah...",
      opts: [
        "Benda cair yang berasal dari pabrik",
        "Sisa kegiatan manusia dan/atau proses alam yang berbentuk padat",
        "Gas berbahaya dari asap kendaraan",
        "Limbah kimia dari rumah sakit"
      ],
      ans: 1,
      explain: "UU No. 18 Tahun 2008 mendefinisikan sampah sebagai sisa kegiatan sehari-hari manusia dan/atau proses alam yang berbentuk padat. ✅"
    },
    {
      q: "Dari mana sumber sampah terbesar di pemukiman?",
      opts: [
        "Pabrik dan industri besar",
        "Perkantoran dan sekolah",
        "Rumah tangga — 57% berupa sampah organik",
        "Jalan raya dan trotoar"
      ],
      ans: 2,
      explain: "Pemukiman/rumah tangga adalah sumber sampah terbesar, dengan sekitar 57% berupa sampah organik dari dapur dan halaman. ✅"
    },
    {
      q: "Salah satu tujuan peraturan pengelolaan sampah di Indonesia adalah...",
      opts: [
        "Meningkatkan impor sampah dari luar negeri",
        "Membiarkan masyarakat membuang sampah sembarangan",
        "Menciptakan ketertiban pengelolaan sampah di seluruh daerah",
        "Menghilangkan tanggung jawab pemerintah terhadap sampah"
      ],
      ans: 2,
      explain: "Peraturan pengelolaan sampah bertujuan menciptakan ketertiban dalam pengelolaan sampah di seluruh daerah dan memberi kejelasan tugas pemerintah. ✅"
    }
  ],
  jenis: [
    {
      q: "Manakah yang termasuk contoh sampah ORGANIK dari rumah tangga?",
      opts: [
        "Botol plastik dan kaleng minuman",
        "Baterai bekas dan obat kadaluarsa",
        "Sisa nasi, kulit buah, dan daun kering",
        "Koran lama dan kardus"
      ],
      ans: 2,
      explain: "Sampah organik berasal dari makhluk hidup, mudah terurai. Contohnya: sisa nasi, kulit buah, daun kering, ampas kopi. ✅"
    },
    {
      q: "Apa yang dimaksud dengan sampah B3?",
      opts: [
        "Sampah yang bisa langsung dibuang ke sungai",
        "Sampah Bersih, Baik, dan Bermanfaat",
        "Sampah Bahan Berbahaya dan Beracun yang perlu penanganan khusus",
        "Sampah biasa dari dapur rumah tangga"
      ],
      ans: 2,
      explain: "B3 = Bahan Berbahaya dan Beracun. Contohnya baterai bekas, obat kadaluarsa, tinta printer. Harus dibuang secara khusus! ✅"
    },
    {
      q: "Sampah anorganik seperti botol plastik membutuhkan waktu berapa lama untuk terurai?",
      opts: [
        "1–2 minggu saja",
        "Kurang dari sebulan",
        "1–5 tahun",
        "Hingga ratusan tahun"
      ],
      ans: 3,
      explain: "Sampah anorganik seperti plastik sangat sulit terurai — bisa membutuhkan hingga ratusan tahun untuk hancur secara alami. ✅"
    }
  ],
  dampak: [
    {
      q: "Gas apa yang dihasilkan dari pembusukan sampah organik yang berbahaya bagi iklim?",
      opts: [
        "Gas oksigen (O₂)",
        "Gas nitrogen (N₂)",
        "Gas metana (CH₄)",
        "Gas argon (Ar)"
      ],
      ans: 2,
      explain: "Sampah organik yang membusuk menghasilkan gas metana (CH₄) — gas rumah kaca yang 25x lebih kuat dari CO₂ dalam menyebabkan pemanasan global. ✅"
    },
    {
      q: "Apa dampak utama mikroplastik terhadap lingkungan laut?",
      opts: [
        "Menyuburkan terumbu karang",
        "Merusak rantai makanan laut dan mengancam biota perairan",
        "Membuat air laut lebih jernih",
        "Membantu ikan berkembang biak lebih cepat"
      ],
      ans: 1,
      explain: "Mikroplastik dari sampah plastik masuk ke rantai makanan laut, merusak ekosistem, dan mengancam kehidupan biota perairan seperti ikan dan penyu. ✅"
    },
    {
      q: "Penyakit apa yang bisa disebabkan oleh sampah yang menjadi sarang nyamuk?",
      opts: [
        "Flu dan pilek biasa",
        "Demam Berdarah Dengue (DBD) dan malaria",
        "Patah tulang dan memar",
        "Rabun jauh dan katarak"
      ],
      ans: 1,
      explain: "Tumpukan sampah menjadi tempat berkembang biak nyamuk yang menyebarkan penyakit berbahaya seperti Demam Berdarah (DBD) dan malaria. ✅"
    }
  ],
  pengelolaan: [
    {
      q: "Apa kepanjangan dari prinsip 3R dalam pengelolaan sampah?",
      opts: [
        "Rapid, Reclaim, Restore",
        "Reduce, Reuse, Recycle",
        "Repair, Remove, Renew",
        "Rethink, Reform, Renew"
      ],
      ans: 1,
      explain: "3R = Reduce (Mengurangi), Reuse (Menggunakan Kembali), Recycle (Mendaur Ulang). Inilah pilar utama pengelolaan sampah yang bertanggung jawab! ✅"
    },
    {
      q: "Berapa lama waktu yang dibutuhkan untuk membuat kompos dari sampah organik rumah tangga?",
      opts: [
        "1–2 hari saja",
        "1 minggu",
        "4–6 minggu",
        "1–2 tahun"
      ],
      ans: 2,
      explain: "Proses pengomposan sampah organik rumah tangga membutuhkan sekitar 4–6 minggu hingga kompos siap digunakan untuk menyuburkan tanaman. ✅"
    },
    {
      q: "Ke mana seharusnya sampah B3 seperti baterai bekas dan obat kadaluarsa dibuang?",
      opts: [
        "Dicampur dengan sampah dapur biasa",
        "Dibuang ke sungai agar larut",
        "Dibakar di pekarangan rumah",
        "Dikumpulkan terpisah dan diserahkan ke fasilitas daur ulang khusus B3"
      ],
      ans: 3,
      explain: "Sampah B3 HARUS dikumpulkan terpisah dan diserahkan ke pusat pengumpulan B3 atau fasilitas khusus — jangan pernah dibuang sembarangan! ✅"
    }
  ]
};

// State kuis evaluasi per halaman
const evalState = {};

function initAllEvalQuizzes() {
  QUIZ_PAGES.forEach(pageId => {
    evalState[pageId] = {
      current: 0,
      score: 0,
      answered: false,
      userAnswers: new Array(3).fill(null),
      passed: isQuizPassed(pageId)
    };
    renderEvalSection(pageId);
  });
  updateNavLocks();
}

function renderEvalSection(pageId) {
  const containerId = 'evalQuiz-' + pageId;
  let container = document.getElementById(containerId);
  if (!container) return;

  const state = evalState[pageId];

  // Jika sudah lulus sebelumnya
  if (state.passed) {
    container.innerHTML = `
      <div class="eval-passed-banner">
        <span class="eval-passed-icon">🏆</span>
        <div>
          <strong>Kuis Evaluasi Selesai!</strong>
          <p>Kamu telah lulus kuis ini. Halaman berikutnya sudah terbuka. ✅</p>
        </div>
      </div>`;
    return;
  }

  const questions = EVAL_QUESTIONS[pageId];
  const q = questions[state.current];
  const ua = state.userAnswers[state.current];
  const progress = ((state.current) / questions.length) * 100;

  container.innerHTML = `
    <div class="eval-quiz-box">
      <div class="eval-header">
        <div class="eval-title-row">
          <span class="eval-badge">📝 Kuis Evaluasi</span>
          <span class="eval-counter">Soal ${state.current + 1} dari ${questions.length}</span>
        </div>
        <p class="eval-desc">Jawab semua soal dengan benar untuk membuka halaman berikutnya!</p>
        <div class="eval-progress-bar"><div class="eval-progress-fill" style="width:${progress}%"></div></div>
      </div>

      <div class="eval-card" id="evalCard-${pageId}">
        <div class="eval-q-num">Pertanyaan ${state.current + 1}</div>
        <div class="eval-question">${q.q}</div>
        <div class="eval-options" id="evalOpts-${pageId}">
          ${q.opts.map((opt, i) => {
            let cls = 'eval-option';
            if (ua !== null) {
              cls += ' disabled';
              if (i === q.ans) cls += ' correct';
              if (i === ua.chosen && !ua.correct) cls += ' wrong';
            }
            return `<button class="${cls}" ${ua !== null ? 'disabled' : `onclick="selectEvalAnswer('${pageId}', ${i})"`}>${opt}</button>`;
          }).join('')}
        </div>
        <div class="eval-feedback ${ua !== null ? (ua.correct ? 'correct show' : 'wrong show') : ''}" id="evalFb-${pageId}">
          ${ua !== null ? (ua.correct ? '✅ ' : '❌ Jawaban kurang tepat. ') + q.explain : ''}
        </div>
      </div>

      <div class="eval-nav">
        ${state.current > 0 && state.userAnswers[state.current - 1] !== null
          ? `<button class="btn-secondary eval-nav-btn" onclick="prevEvalQ('${pageId}')">← Soal Sebelumnya</button>` : '<span></span>'}
        ${ua !== null
          ? `<button class="btn-primary eval-nav-btn" onclick="nextEvalQ('${pageId}')">
              ${state.current < questions.length - 1 ? 'Soal Berikutnya →' : 'Lihat Hasil 🎯'}
             </button>`
          : ''}
      </div>
    </div>`;
}

function selectEvalAnswer(pageId, idx) {
  const state = evalState[pageId];
  if (state.answered) return;
  state.answered = true;

  const q = EVAL_QUESTIONS[pageId][state.current];
  const isCorrect = idx === q.ans;
  state.userAnswers[state.current] = { chosen: idx, correct: isCorrect };
  if (isCorrect) state.score++;

  renderEvalSection(pageId);

  // Animasi
  const card = document.getElementById('evalCard-' + pageId);
  if (card) {
    card.classList.add(isCorrect ? 'bounce-anim' : 'shake-anim');
    setTimeout(() => card.classList.remove('bounce-anim', 'shake-anim'), 700);
  }
}

function nextEvalQ(pageId) {
  const state = evalState[pageId];
  const questions = EVAL_QUESTIONS[pageId];

  if (state.current < questions.length - 1) {
    state.current++;
    state.answered = state.userAnswers[state.current] !== null;
    renderEvalSection(pageId);
  } else {
    showEvalResult(pageId);
  }
}

function prevEvalQ(pageId) {
  const state = evalState[pageId];
  if (state.current > 0 && state.userAnswers[state.current - 1] !== null) {
    state.current--;
    state.answered = true;
    renderEvalSection(pageId);
  }
}

function showEvalResult(pageId) {
  const state = evalState[pageId];
  const total = EVAL_QUESTIONS[pageId].length;
  // Cukup selesai dikerjakan — tidak memandang benar/salah
  const pct = Math.round((state.score / total) * 100);

  const containerId = 'evalQuiz-' + pageId;
  const container = document.getElementById(containerId);
  if (!container) return;

  const nextPageNames = {
    pengenalan: 'Jenis Sampah', jenis: 'Dampak Sampah',
    dampak: 'Pengelolaan', pengelolaan: 'Kuis Umum'
  };
  const nextPageId = {
    pengenalan: 'jenis', jenis: 'dampak',
    dampak: 'pengelolaan', pengelolaan: 'kuis'
  };

  // Tentukan pesan feedback berdasarkan skor (informatif saja)
  let feedbackEmoji, feedbackMsg;
  if (pct === 100) {
    feedbackEmoji = '🏆';
    feedbackMsg = 'Luar biasa! Semua jawaban benar. Pemahaman kamu sangat baik!';
  } else if (pct >= 67) {
    feedbackEmoji = '👍';
    feedbackMsg = `Bagus! Kamu menjawab ${state.score} dari ${total} soal dengan benar. Terus semangat belajar!`;
  } else if (pct >= 34) {
    feedbackEmoji = '📚';
    feedbackMsg = `Kamu menjawab ${state.score} dari ${total} soal dengan benar. Yuk pelajari lagi materi di atas agar lebih paham!`;
  } else {
    feedbackEmoji = '💪';
    feedbackMsg = `Kamu menjawab ${state.score} dari ${total} soal dengan benar. Jangan menyerah — baca kembali materinya ya!`;
  }

  // Tandai selesai & buka halaman berikutnya
  markQuizPassed(pageId);
  state.passed = true;
  updateNavLocks();

  container.innerHTML = `
    <div class="eval-result passed">
      <div class="eval-result-icon">${feedbackEmoji}</div>
      <h3>Kuis Evaluasi Selesai!</h3>
      <div class="eval-result-score">${state.score}/${total}</div>
      <p class="eval-feedback-msg">${feedbackMsg}</p>
      <p class="eval-unlock-note">✅ Halaman <strong>${nextPageNames[pageId]}</strong> telah terbuka.</p>
      <div class="eval-result-actions">
        <button class="btn-retry-eval" onclick="resetEvalQuiz('${pageId}')">🔄 Ulangi Kuis</button>
        <button class="btn-primary eval-unlock-btn" onclick="showPage('${nextPageId[pageId]}')">
          Lanjut ke ${nextPageNames[pageId]} 🚀
        </button>
      </div>
    </div>`;

  // Confetti jika skor sempurna
  if (pct === 100) setTimeout(() => launchEvalConfetti(containerId), 200);
}

function resetEvalQuiz(pageId) {
  evalState[pageId] = {
    current: 0,
    score: 0,
    answered: false,
    userAnswers: new Array(3).fill(null),
    passed: false
  };
  renderEvalSection(pageId);
}

function launchEvalConfetti(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let canvas = container.querySelector('.eval-confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'eval-confetti-canvas';
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border-radius:16px;z-index:10;';
    container.style.position = 'relative';
    container.appendChild(canvas);
  }
  canvas.style.display = 'block';
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#f5c518','#2e9c4e','#3a9bd5','#e5383b','#ff8c00','#a855f7'];
  const pieces = Array.from({length: 60}, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 10 + 6, h: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3 + 2, vr: (Math.random() - 0.5) * 5
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    });
    frame++;
    if (frame < 100) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
  }
  draw();
}

/* ================================================================
   KUIS UMUM (10 soal — hanya bisa diakses jika semua halaman selesai)
   ================================================================ */
const QUESTIONS = [
  { q: "🍂 Daun termasuk sampah apa?", opts: ["Sampah Organik","Sampah Plastik","Sampah Logam","Sampah Kaca"], ans: 0, explain: "Hebat! Daun termasuk sampah ORGANIK karena berasal dari makhluk hidup dan bisa membusuk dengan sendirinya! 🌿", emoji: "🍂" },
  { q: "🗑️ Di mana kita harus membuang sampah?", opts: ["Di sungai","Di jalan","Di tempat sampah","Di halaman orang lain"], ans: 2, explain: "Betul sekali! Sampah harus dibuang di TEMPAT SAMPAH agar lingkungan tetap bersih dan sehat! 🗑️", emoji: "🗑️" },
  { q: "🧴 Botol plastik termasuk sampah apa?", opts: ["Sampah Organik","Sampah Anorganik","Sampah Makanan","Sampah Daun"], ans: 1, explain: "Benar! Botol plastik adalah sampah ANORGANIK karena tidak bisa membusuk sendiri dan butuh waktu lama untuk hancur! ♻️", emoji: "🧴" },
  { q: "🍌 Sisa kulit pisang termasuk sampah apa?", opts: ["Sampah Kaca","Sampah Logam","Sampah Organik","Sampah Plastik"], ans: 2, explain: "Pintar! Kulit pisang adalah sampah ORGANIK karena berasal dari buah-buahan dan bisa dijadikan pupuk kompos! 🍌", emoji: "🍌" },
  { q: "♻️ Apa arti simbol tanda panah melingkar pada kemasan?", opts: ["Bisa dimakan","Bisa didaur ulang","Berbahaya","Bisa diminum"], ans: 1, explain: "Luar biasa! Simbol tanda panah melingkar artinya bisa DIDAUR ULANG — barang itu bisa diolah kembali menjadi barang baru! ♻️", emoji: "♻️" },
  { q: "🌊 Apa yang terjadi jika kita membuang sampah ke sungai?", opts: ["Sungai jadi bersih","Sungai jadi kotor dan tercemar","Ikan menjadi senang","Air jadi lebih jernih"], ans: 1, explain: "Tepat! Membuang sampah ke sungai membuat sungai KOTOR dan TERCEMAR, ikan bisa mati, dan air tidak bisa dipakai! 🌊", emoji: "🌊" },
  { q: "📰 Kertas koran bekas termasuk jenis sampah apa?", opts: ["Sampah Organik","Sampah Anorganik","Sampah Makanan","Sampah Basah"], ans: 1, explain: "Betul! Kertas koran adalah sampah ANORGANIK yang bisa didaur ulang menjadi kertas baru! Jangan dibuang sembarangan ya! 📰", emoji: "📰" },
  { q: "🌱 Sampah organik seperti sisa makanan bisa diolah menjadi apa?", opts: ["Plastik baru","Pupuk kompos","Kaca","Logam"], ans: 1, explain: "Wow, kamu pintar! Sisa makanan bisa diolah menjadi PUPUK KOMPOS yang berguna untuk menyuburkan tanaman! 🌱", emoji: "🌱" },
  { q: "🏠 Sampah dari rumah tangga seperti sisa nasi dan sayur termasuk sampah...?", opts: ["Anorganik","Organik","Berbahaya","Elektronik"], ans: 1, explain: "Hebat! Sisa nasi dan sayur adalah sampah ORGANIK — berasal dari makhluk hidup dan bisa membusuk secara alami! 🏠", emoji: "🏠" },
  { q: "💡 Apa yang harus kita lakukan agar sampah berkurang?", opts: ["Buang sampah ke mana saja","Bakar semua sampah","Kurangi, gunakan ulang, dan daur ulang sampah","Kubur semua sampah di taman"], ans: 2, explain: "Sempurna! Kita harus KURANGI sampah, GUNAKAN ULANG barang yang masih bisa dipakai, dan DAUR ULANG — inilah prinsip 3R! 💡", emoji: "💡" }
];

let currentQ = 0, score = 0, answered = false;
let userAnswers = new Array(QUESTIONS.length).fill(null);
let reviewMode = false;

/* ===================== CONFETTI ===================== */
function launchConfetti(canvasId) {
  const canvas = document.getElementById(canvasId || 'confettiCanvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
  const colors = ['#f5c518','#2e9c4e','#3a9bd5','#e5383b','#ff8c00','#a855f7'];
  const pieces = Array.from({length: 80}, () => ({
    x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height,
    w: Math.random() * 12 + 6, h: Math.random() * 7 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vx: (Math.random() - 0.5) * 3, vy: Math.random() * 4 + 2, vr: (Math.random() - 0.5) * 6
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    });
    frame++;
    if (frame < 90) requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display='none'; }
  }
  draw();
}

function shakeCard() {
  const card = document.getElementById('kuisCard');
  card.classList.remove('shake-anim'); void card.offsetWidth; card.classList.add('shake-anim');
  setTimeout(() => card.classList.remove('shake-anim'), 600);
}
function bounceCard() {
  const card = document.getElementById('kuisCard');
  card.classList.remove('bounce-anim'); void card.offsetWidth; card.classList.add('bounce-anim');
  setTimeout(() => card.classList.remove('bounce-anim'), 700);
}

function initKuis() {
  currentQ = 0; score = 0; answered = false; reviewMode = false;
  userAnswers = new Array(QUESTIONS.length).fill(null);
  document.getElementById('kuisResult').classList.remove('show');
  document.getElementById('kuisArea').style.display = 'block';
  updateNavBtns(); renderQ();
}

function renderQ() {
  const q = QUESTIONS[currentQ]; const ua = userAnswers[currentQ];
  const filled = reviewMode ? ((currentQ+1)/QUESTIONS.length)*100 : (currentQ/QUESTIONS.length)*100;
  document.getElementById('kuisProgress').style.width = filled + '%';
  document.getElementById('kuisCounter').textContent = `Soal ${currentQ+1} dari ${QUESTIONS.length}`;
  document.getElementById('kuisScoreLive').textContent = `Skor: ${score}`;
  document.getElementById('kuisQNum').textContent = `Pertanyaan ${currentQ+1} ${q.emoji||''}`;
  document.getElementById('kuisQuestion').textContent = q.q;
  const opts = document.getElementById('kuisOptions');
  opts.innerHTML = '';
  q.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'kuis-option'; btn.textContent = opt;
    if (ua !== null) {
      btn.disabled = true;
      if (i === q.ans) btn.classList.add('correct');
      if (i === ua.chosen && !ua.correct) btn.classList.add('wrong');
    } else { btn.onclick = () => selectAnswer(i); }
    opts.appendChild(btn);
  });
  const fb = document.getElementById('kuisFeedback');
  if (ua !== null) {
    fb.className = 'kuis-feedback ' + (ua.correct ? 'correct' : 'wrong') + ' show';
    fb.innerHTML = (ua.correct ? '✅ ' : '❌ Jawaban kurang tepat. ') + q.explain;
  } else { fb.className = 'kuis-feedback'; fb.textContent = ''; }
  updateNavBtns(); answered = ua !== null;
}

function updateNavBtns() {
  const btnPrev = document.getElementById('btnPrev'), btnNext = document.getElementById('btnNext');
  if (currentQ > 0 && userAnswers[currentQ-1] !== null) btnPrev.classList.add('show');
  else btnPrev.classList.remove('show');
  if (answered || userAnswers[currentQ] !== null) {
    btnNext.classList.add('show');
    btnNext.textContent = currentQ === QUESTIONS.length-1 ? 'Lihat Hasil 🎯' : 'Soal Berikutnya →';
  } else btnNext.classList.remove('show');
}

function selectAnswer(idx) {
  if (answered) return;
  answered = true;
  const q = QUESTIONS[currentQ]; const isCorrect = idx === q.ans;
  userAnswers[currentQ] = { chosen: idx, correct: isCorrect };
  const optBtns = document.querySelectorAll('.kuis-option');
  optBtns.forEach(b => b.disabled = true);
  optBtns[q.ans].classList.add('correct');
  if (!isCorrect) optBtns[idx].classList.add('wrong');
  const fb = document.getElementById('kuisFeedback');
  if (isCorrect) {
    score++;
    fb.className = 'kuis-feedback correct show';
    fb.innerHTML = '✅ ' + q.explain;
    bounceCard(); setTimeout(() => launchConfetti('confettiCanvas'), 100); spawnStars(true);
  } else {
    fb.className = 'kuis-feedback wrong show';
    fb.innerHTML = '❌ Jawaban kurang tepat. ' + q.explain;
    shakeCard(); spawnStars(false);
  }
  document.getElementById('kuisScoreLive').textContent = `Skor: ${score}`;
  updateNavBtns();
}

function spawnStars(correct) {
  const card = document.getElementById('kuisCard');
  for (let i = 0; i < (correct ? 8 : 5); i++) {
    const el = document.createElement('div');
    el.className = 'burst-particle ' + (correct ? 'star-p' : 'x-p');
    el.textContent = correct ? '⭐' : '💨';
    el.style.cssText = `position:absolute;font-size:${20+Math.random()*14}px;left:${20+Math.random()*60}%;top:${10+Math.random()*40}%;pointer-events:none;z-index:50;animation:burstFly 0.9s ease forwards;animation-delay:${i*0.07}s;--tx:${(Math.random()-0.5)*120}px;--ty:${-(40+Math.random()*80)}px;`;
    card.style.position = 'relative'; card.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

function prevQuestion() {
  if (currentQ > 0 && userAnswers[currentQ-1] !== null) { reviewMode = true; currentQ--; answered = true; renderQ(); }
}
function nextQuestion() {
  if (currentQ < QUESTIONS.length-1) { currentQ++; answered = userAnswers[currentQ] !== null; renderQ(); }
  else showResult();
}

function showResult() {
  document.getElementById('kuisArea').style.display = 'none';
  document.getElementById('kuisProgress').style.width = '100%';
  const pct = Math.round((score/QUESTIONS.length)*100);
  const wrong = QUESTIONS.length - score;
  let emoji, title, msg;
  if (pct >= 90) { emoji='🏆'; title='Luar Biasa!'; msg=`Skor kamu ${pct}% — Kamu juara! Sangat pintar memahami materi sampah. Terus jaga kebersihan lingkungan ya! 🌍`; }
  else if (pct >= 70) { emoji='🎉'; title='Bagus Sekali!'; msg=`Skor kamu ${pct}% — Hebat! Pengetahuanmu sudah bagus. Coba sekali lagi untuk hasil sempurna! 💪`; }
  else if (pct >= 50) { emoji='📚'; title='Cukup Baik!'; msg=`Skor kamu ${pct}% — Lumayan! Ayo belajar lagi materinya dan kamu pasti bisa lebih baik! 📖`; }
  else { emoji='💪'; title='Ayo Coba Lagi!'; msg=`Skor kamu ${pct}%. Jangan menyerah ya! Baca lagi materinya pelan-pelan dan kamu pasti bisa! 🌟`; }
  document.getElementById('resultEmoji').textContent = emoji;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultScore').textContent = score + '/' + QUESTIONS.length;
  document.getElementById('resCorrect').textContent = score;
  document.getElementById('resWrong').textContent = wrong;
  document.getElementById('resultMsg').textContent = msg;
  document.getElementById('kuisResult').classList.add('show');
  if (pct >= 70) { setTimeout(() => launchConfetti('confettiCanvasResult'), 300); setTimeout(() => launchConfetti('confettiCanvasResult'), 900); }
}

function resetKuis() { initKuis(); }

/* ===================== RESET PROGRESS (untuk testing) ===================== */


document.addEventListener('DOMContentLoaded', () => {
  // kuis will init after splash
});
