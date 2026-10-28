/* BEGIN AI-GENERATED CODE: AI was used to help draft and debug the JavaScript logic for the frontend application, including state management, event handling, and API interactions. */
/* ── Course Explorer — app.js ─────────────────────────────────── */


const API = '';  // Same origin — served by Express

// ── State ──────────────────────────────────────────────────────
const state = {
  results:      [],
  total:        0,
  allDepartments: [],
  page:         0,
  pageSize:     50,
  sortField:    'dept',
  sortDir:      'ASC',
};

// ── Element refs ───────────────────────────────────────────────
const deptSelect       = document.getElementById('dept-select');
const yearFromInput    = document.getElementById('year-from');
const yearToInput      = document.getElementById('year-to');
const instructorInput  = document.getElementById('instructor-input');
const searchBtn        = document.getElementById('search-btn');
const clearBtn         = document.getElementById('clear-btn');

const resultCount      = document.getElementById('result-count');
const sortInfo         = document.getElementById('sort-info');
const sortFieldLabel   = document.getElementById('sort-field-label');
const sortDirIndicator = document.getElementById('sort-dir-indicator');

const emptyState       = document.getElementById('empty-state');
const loadingState     = document.getElementById('loading-state');
const tableWrap        = document.getElementById('table-wrap');
const tableBody        = document.getElementById('table-body');
const pagination       = document.getElementById('pagination');
const prevBtn          = document.getElementById('prev-btn');
const nextBtn          = document.getElementById('next-btn');
const pageInfo         = document.getElementById('page-info');
const headers          = document.querySelectorAll('th.sortable');

// ── Filters & Pagination ────────────────────────────────────────

searchBtn.addEventListener('click', () => { state.page = 0; runSearch(); });

clearBtn.addEventListener('click', () => {
  Array.from(deptSelect.options).forEach(option => {
    option.selected = false;
  });
  yearFromInput.value    = '';
  yearToInput.value      = '';
  instructorInput.value  = '';
  state.page = 0;
  runSearch();
});

[yearFromInput, yearToInput, instructorInput].forEach(el =>
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.page = 0; runSearch(); } })
);

deptSelect.addEventListener('change', () => {
  state.page = 0;
  runSearch();
});

prevBtn.addEventListener('click', () => {
  if (state.page > 0) { state.page--; renderPage(); }
});
nextBtn.addEventListener('click', () => {
  if (state.page < Math.ceil(state.total / state.pageSize) - 1) { state.page++; renderPage(); }
});

// ── Sorting ─────────────────────────────────────────────────────
// Sorting is server-side using ORDER as a plain string field name.

headers.forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.field;
    state.sortField = field;
    state.sortDir = 'ASC';
    state.page = 0;
    runSearch();
  });
});

function updateHeaderArrows() {
  headers.forEach(th => {
    th.classList.remove('active-sort');
    th.querySelector('.sort-arrow').textContent = '';
  });
  const active = document.querySelector(`th[data-field="${state.sortField}"]`);
  if (active) {
    active.classList.add('active-sort');
    active.querySelector('.sort-arrow').textContent = '↑';
  }
  sortInfo.style.display     = 'block';
  sortFieldLabel.textContent = state.sortField;
  sortDirIndicator.textContent = '↑';
}

// ── Query Builder ────────────────────────────────────────────────
//
// The search endpoint body shape (from searchRoutes.ts):
//   { kind: "course_offerings", query: { WHERE: {...}, OPTIONS: { COLUMNS: [...], ORDER?: string } } }
//
// ORDER must be a plain field-name string (ascending only).
// Year range:  year >= from  →  NOT { LT: { year: from } }
//              year <= to    →  NOT { GT: { year: to   } }

function buildSearchBody() {
  const depts    = Array.from(deptSelect.selectedOptions).map(option => option.value);
  const yfrom    = parseInt(yearFromInput.value) || null;
  const yto      = parseInt(yearToInput.value)   || null;
  const instruct = instructorInput.value.trim();

  const conditions = [];

  if (depts.length === 1) {
    conditions.push({ IS: { dept: depts[0] } });
  } else if (depts.length > 1) {
    conditions.push({ OR: depts.map(d => ({ IS: { dept: d } })) });
  }

  if (yfrom !== null && !isNaN(yfrom)) {
    conditions.push({ NOT: { LT: { year: yfrom } } });
  }
  if (yto !== null && !isNaN(yto)) {
    conditions.push({ NOT: { GT: { year: yto } } });
  }

  if (instruct) {
    conditions.push({ IS: { instructor: `*${instruct}*` } });
  }

  let where;
  if (conditions.length === 0)      where = {};
  else if (conditions.length === 1) where = conditions[0];
  else                              where = { AND: conditions };

  return {
    kind: 'course_offerings',
    query: {
      WHERE: where,
      OPTIONS: {
        COLUMNS: ['dept', 'code', 'title', 'year', 'instructor', 'avg'],
        ORDER: state.sortField,
      },
    },
  };
}

// ── Main Search ──────────────────────────────────────────────────

async function runSearch() {
  showLoading();

  const body = buildSearchBody();

  try {
    const res = await fetch(`${API}/api/v1/search`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      const detail = data.message || data.error || JSON.stringify(data);
      showEmpty(`Search error: ${detail}`);
      return;
    }

    // The endpoint returns the results array directly (not wrapped in { result: [] })
    const allResults = Array.isArray(data) ? data : (Array.isArray(data.result) ? data.result : []);
    state.results = allResults;
    state.total   = allResults.length;
    updateDepartmentOptions(allResults);

    renderPage();

  } catch (err) {
    showEmpty(`Network error: ${err.message}`);
  }
}

function updateDepartmentOptions(records) {
  const currentSelection = new Set(Array.from(deptSelect.selectedOptions).map(option => option.value));
  const departments = new Set(state.allDepartments);

  for (const row of records) {
    if (typeof row.dept === 'string' && row.dept.trim() !== '') {
      departments.add(row.dept.toLowerCase());
    }
  }

  state.allDepartments = Array.from(departments).sort((a, b) => a.localeCompare(b));

  deptSelect.innerHTML = '';
  for (const dept of state.allDepartments) {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    option.selected = currentSelection.has(dept);
    deptSelect.appendChild(option);
  }
}

// ── Render ───────────────────────────────────────────────────────

function renderPage() {
  if (state.total === 0) {
    showEmpty('No results matched your filters');
    return;
  }

  emptyState.style.display   = 'none';
  loadingState.style.display = 'none';
  tableWrap.style.display    = 'block';
  pagination.style.display   = 'flex';

  const offset     = state.page * state.pageSize;
  const slice      = state.results.slice(offset, offset + state.pageSize);
  const totalPages = Math.ceil(state.total / state.pageSize);

  resultCount.textContent  = `${state.total.toLocaleString()} result${state.total !== 1 ? 's' : ''}`;
  prevBtn.disabled         = state.page === 0;
  nextBtn.disabled         = state.page >= totalPages - 1;
  pageInfo.textContent     = `Page ${state.page + 1} of ${totalPages}`;

  tableBody.innerHTML = '';
  slice.forEach(row => {
    const tr         = document.createElement('tr');
    const year       = row.year === 1900 ? 'Overall' : (row.year ?? '—');
    const avg        = row.avg != null ? Number(row.avg).toFixed(1) : '—';
    const avgClass   = row.avg >= 80 ? 'avg-hi' : row.avg >= 65 ? 'avg-mid' : 'avg-lo';
    const instructor = row.instructor
      ? esc(row.instructor)
      : '<span class="no-value">—</span>';

    tr.innerHTML = `
      <td><span class="tag">${esc(row.dept  || '')}</span></td>
      <td><span class="tag">${esc(row.code  || '')}</span></td>
      <td>${esc(row.title || '')}</td>
      <td>${year}</td>
      <td>${instructor}</td>
      <td class="avg-cell ${avgClass}">${avg}</td>
    `;
    tableBody.appendChild(tr);
  });

  updateHeaderArrows();
}

function showLoading() {
  emptyState.style.display   = 'none';
  loadingState.style.display = 'flex';
  tableWrap.style.display    = 'none';
  pagination.style.display   = 'none';
}

function showEmpty(msg) {
  emptyState.style.display   = 'flex';
  loadingState.style.display = 'none';
  tableWrap.style.display    = 'none';
  pagination.style.display   = 'none';
  resultCount.textContent    = msg || 'No data loaded';

  const emptyTitle = emptyState.querySelector('.empty-title');
  const emptySub   = emptyState.querySelector('.empty-sub');
  if (msg) {
    emptyTitle.textContent = 'No results';
    emptySub.textContent   = msg;
  } else {
    emptyTitle.textContent = 'No courses loaded';
    emptySub.textContent   = 'Upload a dataset to begin exploring course offerings';
  }
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ─────────────────────────────────────────────────────────
updateHeaderArrows();
runSearch();

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////