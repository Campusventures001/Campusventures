// =====================================================================
// Campus Venture — Supabase-powered directory, auth, add/delete listings
// =====================================================================

const SUPABASE_URL = 'https://bzmbewbiyymoubosihdx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OiHECuIA9j4ysGnFYcIOGQ_r0igEJHm';

// Client-side convenience list only — controls which UI buttons are shown.
// Real permission is enforced server-side by the `admin_users` table + RLS
// policies (see supabase-setup.sql). Adding an email here does NOT make
// someone an admin; they must also have a row in `admin_users`.
const ADMIN_EMAILS = ['admin@campusventures.in'];

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const FALLBACK_LISTINGS = [
  {
    id: 'fallback-1',
    institution_name: 'Delhi Public School',
    location: 'Gurgaon, Haryana',
    plot: '4.2 Acres',
    constructed: '2010',
    class_up_to: 'Nursery to XII',
    students: '1200+',
    fee: '₹1.2 L/yr',
    board: 'CBSE',
    state: 'Haryana',
    established: '2010',
    demand: '₹8.5 Cr',
    extra: 'Fully developed campus with hostel, sports facilities, and strong admissions pipeline.',
    status: 'published',
    created_by: null
  },
  {
    id: 'fallback-2',
    institution_name: 'Bright Future College',
    location: 'Noida, Uttar Pradesh',
    plot: '3.8 Acres',
    constructed: '2008',
    class_up_to: 'XI to XII',
    students: '900+',
    fee: '₹95K/yr',
    board: 'State Board',
    state: 'Uttar Pradesh',
    established: '2008',
    demand: '₹6.2 Cr',
    extra: 'Ideal for a growth-focused operator looking for a stable college campus in the NCR belt.',
    status: 'published',
    created_by: null
  },
  {
    id: 'fallback-3',
    institution_name: 'Green Valley Academy',
    location: 'Jaipur, Rajasthan',
    plot: '5.1 Acres',
    constructed: '2012',
    class_up_to: 'Nursery to X',
    students: '800+',
    fee: '₹85K/yr',
    board: 'ICSE',
    state: 'Rajasthan',
    established: '2012',
    demand: '₹7.1 Cr',
    extra: 'Modern campus with strong transport links and a well-established student base.',
    status: 'published',
    created_by: null
  }
];

let allListings = [];
let currentUser = null;
let isAdmin = false;
let visibleCount = 9;
let authMode = 'signin'; // 'signin' | 'signup'

const grid = document.getElementById('listingGrid');
const qInput = document.getElementById('q');
const dirCount = document.getElementById('dirCount');
const noticeCount = document.getElementById('noticeCount');
const statTotal = document.getElementById('statTotal');
const loadMoreBtn = document.getElementById('loadMoreBtn');

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) {
    await setUser(data.session.user);
  } else {
    await fetchListings();
  }
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) {
      setUser(session.user);
    } else {
      currentUser = null;
      isAdmin = false;
      updateNavForUser();
    }
  });
}

async function setUser(u) {
  currentUser = u;
  isAdmin = !!(u.email && ADMIN_EMAILS.includes(u.email.toLowerCase()));
  updateNavForUser();
  await fetchListings();
}

function updateNavForUser() {
  const cta = document.getElementById('navcta');
  if (!cta) return;
  if (currentUser) {
    const initial = (currentUser.email || '?')[0].toUpperCase();
    cta.innerHTML = ''
      + '<span style="font-size:13px;color:rgba(255,255,255,0.8);display:flex;align-items:center;gap:8px;padding:4px 12px 4px 0;border-right:1px solid rgba(255,255,255,0.15);margin-right:4px;">'
      + '<span style="width:24px;height:24px;border-radius:50%;background:var(--neon-gold);color:#0f172a;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;">' + initial + '</span>'
      + escapeHtml(currentUser.email)
      + (isAdmin ? '<span style="font-size:10px;font-family:\'IBM Plex Mono\',monospace;color:var(--neon-gold);background:rgba(13,148,136,0.15);padding:3px 8px;border-radius:20px;margin-left:2px;">ADMIN</span>' : '')
      + '</span>'
      + '<a href="#" class="btn btn-ghost btn-sm" id="listPropertyBtn">List property</a>'
      + '<a href="#" class="btn btn-primary btn-sm" id="logoutBtn">Logout</a>';
    document.getElementById('logoutBtn').addEventListener('click', function (e) { e.preventDefault(); logout(); });
    document.getElementById('listPropertyBtn').addEventListener('click', function (e) { e.preventDefault(); window.openModal('sellModal'); });
  } else {
    cta.innerHTML = '<a href="#" class="btn btn-ghost btn-sm" id="loginBtn">Login</a>';
    document.getElementById('loginBtn').addEventListener('click', function (e) { e.preventDefault(); window.openModal('loginModal'); });
  }
}

async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  updateNavForUser();
  await fetchListings();
}

// ---------------------------------------------------------------------
// Listings — fetch / render / filter
// ---------------------------------------------------------------------
function updateDirectorySummary(listings) {
  const publishedCount = listings.filter((s) => s.status === 'published').length;
  if (noticeCount) noticeCount.textContent = publishedCount + ' verified listings live';
  if (statTotal) statTotal.textContent = String(publishedCount);
}

function useFallbackListings() {
  allListings = FALLBACK_LISTINGS;
  updateDirectorySummary(allListings);
  applyFilterAndRender();
}

async function fetchListings() {
  if (!dirCount) return;
  dirCount.textContent = 'Loading…';

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      console.warn('Using fallback listings because Supabase returned no data.', error);
      useFallbackListings();
      return;
    }

    allListings = data || [];
    updateDirectorySummary(allListings);
    applyFilterAndRender();
  } catch (err) {
    console.error('fetchListings error', err);
    useFallbackListings();
  }
}

function applyFilterAndRender() {
  const q = qInput.value.trim().toLowerCase();
  const filtered = !q ? allListings : allListings.filter((s) => {
    const fields = [s.institution_name, s.location, s.plot, s.constructed, s.class_up_to, s.board, s.state, s.extra, String(s.students || ''), s.demand, s.fee];
    return fields.some((f) => (f || '').toLowerCase().includes(q));
  });
  renderSchools(filtered);
}

function cardHtml(s) {
  const pending = s.status === 'pending';
  const ownListing = currentUser && s.created_by === currentUser.id;
  const canDelete = isAdmin || (ownListing && pending);
  const canPublish = isAdmin && pending;

  const details = [
    ['Plot', s.plot],
    ['Built', s.constructed],
    ['Class', s.class_up_to],
    ['Students', s.students],
    ['Fee', s.fee],
    ['Board', s.board],
    s.established ? ['Est.', s.established] : null,
    s.bank_loan ? ['Loan', s.bank_loan] : null
  ].filter(Boolean);

  return `
    <div class="school-card" data-id="${s.id}" data-loc="${escapeHtml(s.location || '')}" data-demand="${escapeHtml(s.demand || '')}">
      <div class="school-card-header">
        <h3>${escapeHtml(s.location || 'Unnamed location')}</h3>
        <span class="price">${escapeHtml(s.demand || 'On request')}</span>
      </div>
      <div class="school-card-body">
        <div class="school-details">
          ${details.map(([k, v]) => `<div class="detail"><strong>${k}:</strong> ${escapeHtml(v || '—')}</div>`).join('')}
        </div>
        ${s.extra ? `<div style="font-size:12px;color:var(--text-soft);margin-top:8px;line-height:1.6;">${escapeHtml(s.extra)}</div>` : ''}
        <div class="school-tags">
          ${pending ? '<span class="tag pending">Pending review</span>' : ''}
          ${s.board ? `<span class="tag gold">${escapeHtml(s.board)}</span>` : ''}
          ${s.class_up_to ? `<span class="tag">${escapeHtml(s.class_up_to)}</span>` : ''}
          ${s.state ? `<span class="tag">${escapeHtml(s.state)}</span>` : ''}
          ${s.established ? `<span class="tag">Est. ${escapeHtml(s.established)}</span>` : ''}
        </div>
      </div>
      <div class="school-card-footer">
        <a href="#" class="more-btn" data-action="enquire" data-id="${s.id}">Enquire Now →</a>
        ${canPublish ? `<button type="button" class="admin-btn publish" data-action="publish" data-id="${s.id}">Publish</button>` : ''}
        ${canDelete ? `<button type="button" class="admin-btn danger" data-action="delete" data-id="${s.id}">Delete</button>` : ''}
        <a href="https://wa.me/918618952683?text=Hi%20CampusVentures%2C%20I'm%20interested%20in%20${encodeURIComponent(s.location || '')}" target="_blank" class="whatsapp-small">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
          WhatsApp
        </a>
      </div>
    </div>`;
}

function renderSchools(data) {
  if (data.length === 0) {
    grid.innerHTML = '<div class="dir-empty">No schools match that search. Try a different location or clear the filter.</div>';
    dirCount.textContent = '0 listings';
    loadMoreBtn.style.display = 'none';
    return;
  }
  dirCount.textContent = data.length + (data.length === 1 ? ' listing' : ' listings');
  const shown = data.slice(0, visibleCount);
  grid.innerHTML = shown.map(cardHtml).join('');
  loadMoreBtn.style.display = data.length > visibleCount ? 'inline-flex' : 'none';
}

qInput.addEventListener('input', function () {
  visibleCount = 9;
  applyFilterAndRender();
});
loadMoreBtn.addEventListener('click', function () {
  visibleCount += 9;
  applyFilterAndRender();
});

// Delegated clicks on the grid: enquire / publish / delete / open detail
grid.addEventListener('click', function (e) {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.preventDefault();
    const id = actionBtn.dataset.id;
    const action = actionBtn.dataset.action;
    if (action === 'enquire') {
      const card = actionBtn.closest('.school-card');
      document.getElementById('inqListing').textContent = card.dataset.loc || 'this listing';
      document.getElementById('inqLoc').textContent = card.dataset.demand || '';
      document.getElementById('inqListingId').value = id;
      window.openModal('inquiryModal');
    } else if (action === 'publish') {
      publishListing(id);
    } else if (action === 'delete') {
      deleteListing(id);
    }
    return;
  }
  const card = e.target.closest('.school-card');
  if (card && !e.target.closest('.whatsapp-small')) {
    document.getElementById('inqListing').textContent = card.dataset.loc || 'this listing';
    document.getElementById('inqLoc').textContent = card.dataset.demand || '';
    document.getElementById('inqListingId').value = card.dataset.id;
    window.openModal('inquiryModal');
  }
});

async function deleteListing(id) {
  if (!confirm('Delete this listing permanently? This cannot be undone.')) return;
  const { error } = await supabase.from('listings').delete().eq('id', id);
  if (error) {
    alert('Could not delete listing: ' + error.message);
    return;
  }
  await fetchListings();
}

async function publishListing(id) {
  const { error } = await supabase.from('listings').update({ status: 'published' }).eq('id', id);
  if (error) {
    alert('Could not publish listing: ' + error.message);
    return;
  }
  await fetchListings();
}

// ---------------------------------------------------------------------
// Modals open/close
// ---------------------------------------------------------------------
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
};
window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
};
document.addEventListener('click', function (e) {
  if (e.target.closest('.modal-close')) {
    e.target.closest('.modal-overlay').classList.remove('active');
  }
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// "List your institution" triggers throughout the page
document.querySelectorAll('.sell-trigger').forEach((a) => {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    if (currentUser) window.openModal('sellModal');
    else window.openModal('loginModal');
  });
});

// ---------------------------------------------------------------------
// Login / Sign up form
// ---------------------------------------------------------------------
const authTitle = document.getElementById('authTitle');
const authSub = document.getElementById('authSub');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggle = document.getElementById('authToggle');
const loginError = document.getElementById('loginError');

authToggle.addEventListener('click', function (e) {
  e.preventDefault();
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  loginError.style.display = 'none';
  if (authMode === 'signup') {
    authTitle.textContent = 'Create your account';
    authSub.textContent = 'Sign up to browse verified listings and list your own';
    authSubmitBtn.textContent = 'Create account';
    authToggle.textContent = 'Sign in instead';
  } else {
    authTitle.textContent = 'Welcome back';
    authSub.textContent = 'Sign in to your Campus Venture account';
    authSubmitBtn.textContent = 'Sign in';
    authToggle.textContent = 'Create an account';
  }
});

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  loginError.style.display = 'none';
  loginError.style.color = '#c0392b';

  if (authMode === 'signup') {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      loginError.textContent = error.message;
      loginError.style.display = 'block';
      return;
    }
    if (data.session) {
      window.closeModal('loginModal');
      document.getElementById('successLoginTitle').textContent = 'Account created';
      document.getElementById('successLoginBody').textContent = "You're signed in. You can now browse listings and submit your own.";
      window.openModal('successLoginModal');
    } else {
      loginError.style.color = 'var(--neon-green)';
      loginError.textContent = 'Account created — check your email to confirm it, then sign in.';
      loginError.style.display = 'block';
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      loginError.textContent = error.message;
      loginError.style.display = 'block';
      return;
    }
    window.closeModal('loginModal');
    document.getElementById('successLoginTitle').textContent = 'Signed in';
    document.getElementById('successLoginBody').textContent = "You're now signed in as a verified Campus Venture user.";
    window.openModal('successLoginModal');
  }
});

// ---------------------------------------------------------------------
// KYC (cosmetic — stored locally; wire to a `profiles` table if needed)
// ---------------------------------------------------------------------
const kycForm = document.getElementById('kycForm');
if (kycForm) {
  kycForm.addEventListener('submit', function (e) {
    e.preventDefault();
    window.closeModal('kycModal');
    window.openModal('successKycModal');
  });
}

// ---------------------------------------------------------------------
// Sell / list-your-institution form -> inserts a pending listing
// ---------------------------------------------------------------------
document.getElementById('sellForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const errEl = document.getElementById('sellError');
  errEl.style.display = 'none';

  if (!currentUser) {
    window.closeModal('sellModal');
    window.openModal('loginModal');
    return;
  }

  const payload = {
    institution_name: document.getElementById('sellName').value.trim(),
    location: document.getElementById('sellLoc').value.trim(),
    plot: document.getElementById('sellArea').value.trim(),
    demand: document.getElementById('sellPrice').value.trim(),
    board: document.getElementById('sellAff').value,
    status: 'pending',
    created_by: currentUser.id
  };

  const { error } = await supabase.from('listings').insert(payload);
  if (error) {
    errEl.textContent = 'Could not submit listing: ' + error.message;
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('sellForm').reset();
  window.closeModal('sellModal');
  window.openModal('successSellModal');
  await fetchListings();
});

// ---------------------------------------------------------------------
// Buy inquiry -> stored in `inquiries` table (anyone can submit)
// ---------------------------------------------------------------------
document.getElementById('inquiryForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const errEl = document.getElementById('inqError');
  errEl.style.display = 'none';

  const payload = {
    listing_id: document.getElementById('inqListingId').value || null,
    name: document.getElementById('inqName').value.trim(),
    email: document.getElementById('inqEmail').value.trim(),
    phone: document.getElementById('inqPhone').value.trim(),
    message: document.getElementById('inqMessage').value.trim()
  };

  const { error } = await supabase.from('inquiries').insert(payload);
  if (error) {
    errEl.textContent = 'Could not submit inquiry: ' + error.message;
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('inquiryForm').reset();
  window.closeModal('inquiryModal');
  window.openModal('successInqModal');
});

// ---------------------------------------------------------------------
// General contact form -> also stored in `inquiries` (listing_id null)
// ---------------------------------------------------------------------
document.getElementById('contactForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const payload = {
    listing_id: null,
    name: document.getElementById('ctName').value.trim(),
    email: document.getElementById('ctEmail').value.trim(),
    phone: document.getElementById('ctPhone').value.trim(),
    message: document.getElementById('ctMessage').value.trim()
  };
  const { error } = await supabase.from('inquiries').insert(payload);
  if (error) {
    alert('Could not send message: ' + error.message);
    return;
  }
  alert('Thank you! We have received your message and will get back to you within 24 hours.');
  document.getElementById('contactForm').reset();
});

// ---------------------------------------------------------------------
// Scroll-triggered entrance animations
// ---------------------------------------------------------------------
const animObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: 0.15 });
document.querySelectorAll('.anim-fade-up').forEach((el) => animObs.observe(el));

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
initAuth();