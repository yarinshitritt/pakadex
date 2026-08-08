/* ================================
   הגדרות טבלאות (לחישובים כלליים)
================================ */
const tableConfigs = {
  keshertable: { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, availableCol: 33, excessCol: 34 },
  optictable:  { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, availableCol: 33, excessCol: 34 }
};

/* ================================
   מצב גלובלי (שבועות)
================================ */
let currentWeek = 1;
let currentYear = new Date().getFullYear();
const TOTAL_WEEKS = 52;
const tableWeeks = {};

/* ================================
   יצירת תפריטי ניווט גלובליים
================================ */

/**
 * מנהלת פתיחה/כיווץ של סרגל הצד (Sidebar) ושומרת את מצבו ב-LocalStorage.
 */
function toggleSidebar() {
  const container2 = document.querySelector('.container2');
  if (!container2) return;
  
  const isCollapsed = container2.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', isCollapsed ? 'true' : 'false');

  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = isCollapsed 
      ? `<span>►</span>` 
      : `<span>◄</span> <span class="sidebar-text">כווץ תפריט</span>`;
  }
}

const UNIT_TITLE_MAP = {
  'esuk.html': 'בא"ח איסו"ק',
  'hirg.html': 'בא"ח חיר"ג',
  'pikud.html': 'גדוד הפיקוד',
  'tazam.html': 'ענף תצ"מ',
  'bahalag.html': 'בהל"ג',
  'kesher.html': 'טבלאות מנהל',
  'optic.html': 'טבלאות מנהל',
  'modiein.html': 'טבלאות מנהל',
  'hipokim.html': 'טבלאות מנהל',
  'hadrag.html': 'טבלאות מנהל',
  'shekem.html': 'טבלאות מנהל',
  'main.html': 'עמוד ראשי'
};

const CATEGORY_NAME_MAP = {
  'kesher': 'קשר',
  'optic': 'אופטיקה',
  'modiein': 'מודיעין',
  'hipok': 'חיפוקים',
  'chadrag': 'חדר"ג',
  'shekem': 'שעות שקם'
};

const PAGE_CATEGORY_MAP = {
  'kesher.html': 'קשר',
  'optic.html': 'אופטיקה',
  'modiein.html': 'מודיעין',
  'hipokim.html': 'חיפוקים',
  'hadrag.html': 'חדר"ג',
  'shekem.html': 'שעות שקם'
};

/**
 * מעדכנת את נתיב הניווט (Breadcrumbs) בסרגל העליון בהתאם לעמוד הנוכחי והתצוגה (דרישות/הקצאות).
 */
function updateBreadcrumbPath() {
  const container = document.getElementById('breadcrumb-path');
  if (!container) return;

  const currentPage = window.location.pathname.split('/').pop() || 'main.html';
  const isUnitPage = ['esuk.html', 'hirg.html', 'pikud.html', 'tazam.html', 'bahalag.html'].includes(currentPage);
  const urlParams = new URLSearchParams(window.location.search);
  const isHaktzaotView = urlParams.get('view') === 'haktzaot';

  const unitName = UNIT_TITLE_MAP[currentPage] || 'PAKADEX';

  if (isUnitPage) {
    const viewName = isHaktzaotView ? 'הקצאות' : 'דרישות';
    const catKey = (typeof currentCategory !== 'undefined') ? currentCategory : 'kesher';
    const catName = CATEGORY_NAME_MAP[catKey] || 'קשר';

    container.innerHTML = `
      <span>${unitName}</span>
      <span style="color:#64748b; font-size:11px;">➔</span>
      <span>${viewName}</span>
      <span style="color:#64748b; font-size:11px;">➔</span>
      <span style="color:#ffffff;">${catName}</span>
    `;
  } else if (PAGE_CATEGORY_MAP[currentPage]) {
    container.innerHTML = `
      <span>טבלאות מנהל</span>
      <span style="color:#64748b; font-size:11px;">➔</span>
      <span style="color:#ffffff;">${PAGE_CATEGORY_MAP[currentPage]}</span>
    `;
  } else {
    container.innerHTML = `<span style="color:#ffffff;">${unitName}</span>`;
  }
}

/**
 * מייצרת ומזריקה את סרגלי הניווט העליון והצדדי באופן דינמי לכל עמודי המערכת.
 */
function renderNavbars() {
  const topNav = document.getElementById('top-nav-placeholder');
  const sideNav = document.getElementById('side-nav-placeholder');

  const currentPage = window.location.pathname.split('/').pop() || 'main.html';
  const isUnitPage = ['esuk.html', 'hirg.html', 'pikud.html', 'tazam.html', 'bahalag.html'].includes(currentPage);

  const urlParams = new URLSearchParams(window.location.search);
  const currentView = urlParams.get('view') || 'bakashot';
  const isHaktzaotView = currentView === 'haktzaot';
  
  const isCollapsedStored = localStorage.getItem('sidebar_collapsed') === 'true';

  // 1. הזרקת תפריט עליון (Top Nav) - יישור לימין בסדר מימין לשמאל: קשר, אופטיקה, מודיעין, חיפוקים, חדר"ג, שעות שקם
  if (topNav) {
    const isKesher = currentPage === 'kesher.html';
    const isOptic = currentPage === 'optic.html';
    const isHipok = currentPage === 'hipokim.html';
    const isModiein = currentPage === 'modiein.html';
    const isHadrag = currentPage === 'hadrag.html';
    const isShekem = currentPage === 'shekem.html';

    const logoBlock = !isUnitPage ? `
      <div style="display:flex; align-items:center; gap:8px; margin-right:auto; cursor:pointer;" onclick="window.location.href='main.html'">
        <h1 style="font-size:20px; color:white; margin:0;">PAKADEX</h1>
        <img src="images/לוגו בהלג בלי רקע.png" alt="לוגו" class="sidebar-image" width="36" style="height:auto;">
      </div>
    ` : '';

    const breadcrumbsBlock = !isUnitPage ? `
      <div id="breadcrumb-path" style="display:flex; align-items:center; gap:6px; background:#1e293b; padding:4px 10px; border-radius:6px; border:1px solid #334155; font-size:13px; font-weight:700; color:#38bdf8; white-space:nowrap;"></div>
    ` : '';

    topNav.innerHTML = `
      <div class="container1">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="top-nav-buttons" style="display:flex; align-items:center; gap:8px;">
            <button class="topnav-btn ${isKesher ? 'active' : ''}" id="btn-kesher" onclick="${isUnitPage ? "showTopSection('kesher')" : "window.location.href='kesher.html'"}">קשר</button>
            <button class="topnav-btn ${isOptic ? 'active' : ''}" id="btn-optic" onclick="${isUnitPage ? "showTopSection('optic')" : "window.location.href='optic.html'"}">אופטיקה</button>
            <button class="topnav-btn ${isModiein ? 'active' : ''}" id="btn-modiein" onclick="${isUnitPage ? "showTopSection('modiein')" : "window.location.href='modiein.html'"}">מודיעין</button>
            <button class="topnav-btn ${isHipok ? 'active' : ''}" id="btn-hipok" onclick="${isUnitPage ? "showTopSection('hipok')" : "window.location.href='hipokim.html'"}" style="${isHaktzaotView ? 'display:none;' : ''}">חיפוקים</button>
            <button class="topnav-btn ${isHadrag ? 'active' : ''}" id="btn-chadrag" onclick="${isUnitPage ? "showTopSection('chadrag')" : "window.location.href='hadrag.html'"}" style="${isHaktzaotView ? 'display:none;' : ''}">חדר"ג</button>
            <button class="topnav-btn ${isShekem ? 'active' : ''}" id="btn-shekem" onclick="${isUnitPage ? "showTopSection('shekem')" : "window.location.href='shekem.html'"}" style="${isHaktzaotView ? 'display:none;' : ''}">שעות שקם</button>
          </div>
          ${breadcrumbsBlock}
        </div>
        ${logoBlock}
      </div>
    `;

    updateBreadcrumbPath();
  }

  // 2. הזרקת תפריט צדדי (Side Nav)
  if (sideNav) {
    const isMain = currentPage === 'main.html';
    const isTabels = ['tabels.html', 'kesher.html', 'optic.html', 'modiein.html', 'hipokim.html', 'hadrag.html', 'shekem.html'].includes(currentPage);

    const isEsuk = currentPage === 'esuk.html';
    const isHirg = currentPage === 'hirg.html';
    const isPikud = currentPage === 'pikud.html';
    const isTazam = currentPage === 'tazam.html';
    const isBahalag = currentPage === 'bahalag.html';

    sideNav.innerHTML = `
      <div class="container2 ${isCollapsedStored ? 'collapsed' : ''}" style="margin-top: 0;">
        <button id="sidebar-toggle" class="sidebar-toggle-btn" onclick="toggleSidebar()">
          <span>${isCollapsedStored ? '►' : '◄'}</span>
          <span class="sidebar-text">כווץ תפריט</span>
        </button>

        <button class="sidebar-btn ${isMain ? 'active' : ''}" onclick="window.location.href='main.html'">
          <span>🏠</span> <span class="sidebar-text">ראשי</span>
        </button>
        <button class="sidebar-btn ${isTabels ? 'active' : ''}" onclick="window.location.href='kesher.html'">
          <span>📊</span> <span class="sidebar-text">טבלאות</span>
        </button>
        
        <button class="sidebar-btn ${isEsuk ? 'active' : ''}" onclick="toggleMenu('subMenu_esuk')">
          <span>🟡</span> <span class="sidebar-text">בא"ח איסו"ק</span>
        </button>
        <div id="subMenu_esuk" class="submenu ${isEsuk ? 'show' : ''}">
          <button class="sidebar-btn ${isEsuk && !isHaktzaotView ? 'active' : ''}" onclick="window.location.href='esuk.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isEsuk && isHaktzaotView ? 'active' : ''}" onclick="window.location.href='esuk.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>

        <button class="sidebar-btn ${isHirg ? 'active' : ''}" onclick="toggleMenu('subMenu_hirg')">
          <span>🟢</span> <span class="sidebar-text">בא"ח חיר"ג</span>
        </button>
        <div id="subMenu_hirg" class="submenu ${isHirg ? 'show' : ''}">
          <button class="sidebar-btn ${isHirg && !isHaktzaotView ? 'active' : ''}" onclick="window.location.href='hirg.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isHirg && isHaktzaotView ? 'active' : ''}" onclick="window.location.href='hirg.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>

        <button class="sidebar-btn ${isPikud ? 'active' : ''}" onclick="toggleMenu('subMenu_pikud')">
          <span>🔵</span> <span class="sidebar-text">גדוד הפיקוד</span>
        </button>
        <div id="subMenu_pikud" class="submenu ${isPikud ? 'show' : ''}">
          <button class="sidebar-btn ${isPikud && !isHaktzaotView ? 'active' : ''}" onclick="window.location.href='pikud.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isPikud && isHaktzaotView ? 'active' : ''}" onclick="window.location.href='pikud.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>

        <button class="sidebar-btn ${isTazam ? 'active' : ''}" onclick="toggleMenu('subMenu_tazam')">
          <span>🟣</span> <span class="sidebar-text">ענף תצ"מ</span>
        </button>
        <div id="subMenu_tazam" class="submenu ${isTazam ? 'show' : ''}">
          <button class="sidebar-btn ${isTazam && !isHaktzaotView ? 'active' : ''}" onclick="window.location.href='tazam.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isTazam && isHaktzaotView ? 'active' : ''}" onclick="window.location.href='tazam.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>

        <button class="sidebar-btn ${isBahalag ? 'active' : ''}" onclick="toggleMenu('subMenu_bahalag')">
          <span>🟠</span> <span class="sidebar-text">בהל"ג</span>
        </button>
        <div id="subMenu_bahalag" class="submenu ${isBahalag ? 'show' : ''}">
          <button class="sidebar-btn ${isBahalag && !isHaktzaotView ? 'active' : ''}" onclick="window.location.href='bahalag.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isBahalag && isHaktzaotView ? 'active' : ''}" onclick="window.location.href='bahalag.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>
      </div>
    `;
  }
}

/**
 * מציגה או מסתירה תת-תפריט בסרגל הצדדי, וסוגרת את שאר תתי-התפריטים הפתוחים.
 * @param {string} menuId - מזהה האלמנט של תת-התפריט
 */
function toggleMenu(menuId) {
  const targetId = typeof menuId === 'string' ? menuId : 'subMenu_esuk';
  const targetMenu = document.getElementById(targetId);

  document.querySelectorAll('.submenu').forEach(menu => {
    if (menu !== targetMenu) {
      menu.style.display = 'none';
      menu.classList.remove('show');
    }
  });

  if (targetMenu) {
    const isVisible = targetMenu.style.display === 'flex' || targetMenu.classList.contains('show');
    targetMenu.style.display = isVisible ? 'none' : 'flex';
    targetMenu.classList.toggle('show', !isVisible);
  }
}

/* ================================
   פונקציות עזר - תאריכים
================================ */

/**
 * מחשבת את מספר השבוע והשנה הנוכחיים לפי תקן ISO-8601 הבינלאומי.
 * @returns {{week: number, year: number}} אובייקט המכיל את השבוע והשנה
 */
function getCurrentWeekAndYear() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: Math.min(Math.max(weekNo, 1), 52), year: d.getUTCFullYear() };
}

/**
 * מפיקה מפתח שמירה אחיד ב-LocalStorage עבור טבלה, שבוע ושנה נתונים.
 * @param {string} tableId - מזהה הטבלה
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה מורכב
 */
function getStorageKey(tableId, week, year) {
  return `${tableId}_week${week}_year${year}`;
}

/* ================================
   קריאה ושמירה של טבלאות כלליות
================================ */

/**
 * קוראת ואוספת את נתוני שדות הקלט (cell-input) מטבלה נתונה במבנה אובייקט.
 * @param {string} tableId - מזהה הטבלה
 * @returns {Object} אובייקט המכיל את ערכי התאים לפי אינדקס
 */
function readTableData(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return {};
  const data = {};
  table.querySelectorAll('.cell-input').forEach((input, index) => data[index] = input.value);
  return data;
}

/**
 * מחזירה את רשימת מזהי כל הטבלאות הפעילות הנשמרות במערכת.
 * @returns {Array<string>} מערך מזהי טבלאות
 */
function getActiveTables() {
  return [
    'keshertable','esukkeshertable','kkeshertable','pkeshertable','tkeshertable','bkeshertable',
    'optictable','esukoptictable','koptictable','poptictable','toptictable','boptictable',
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
}

/**
 * שומרת את כל נתוני הטבלאות, החיפוקים, החדר"ג והשק"ם עבור השבוע והשנה הנוכחיים ב-LocalStorage.
 */
function saveCurrentWeek() {
  const tables = getActiveTables();
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (table) {
      const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };
      localStorage.setItem(getStorageKey(tableId, tw.week, tw.year), JSON.stringify(readTableData(tableId)));
    }
  });
  
  if (typeof saveHipokData === 'function') saveHipokData();
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
}

/**
 * טוענת את נתוני הטבלה המאוחסנים עבור שבוע ושנה ספציפיים, ומעדכנת את שדות הקלט ב-DOM.
 * @param {string} tableId - מזהה הטבלה
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function loadTableData(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const dynamicTables = [
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
  const isDynamic = dynamicTables.includes(tableId);

  if (isDynamic) {
    const tbody = table.tBodies[0];
    while (tbody.rows.length > 2) {
      tbody.deleteRow(-1);
    }
  }

  table.querySelectorAll('.cell-input').forEach(input => {
    input.value = '';
    if (input.classList.contains('topic-textarea')) {
      autoResizeTopicTextarea(input);
    }
  });

  const saved = localStorage.getItem(getStorageKey(tableId, week, year));
  if (saved) {
    const data = JSON.parse(saved);

    if (isDynamic) {
      const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
      if (keysWithData.length > 0) {
        const maxIndex = Math.max(...keysWithData.map(Number));
        let inputsPerRow = 7;
        if (table.tBodies[0].rows[1]) {
          inputsPerRow = table.tBodies[0].rows[1].querySelectorAll('.cell-input').length;
        }

        if (inputsPerRow > 0 && maxIndex >= 0) {
          const requiredRows = Math.floor(maxIndex / inputsPerRow) + 1;
          while (table.tBodies[0].rows.length < requiredRows) {
            addNewRow(tableId, false);
          }
        }
      }
    }

    const inputs = table.querySelectorAll('.cell-input');
    Object.keys(data).forEach(indexStr => {
      const idx = parseInt(indexStr);
      if (inputs[idx]) inputs[idx].value = data[indexStr];
    });

    inputs.forEach(input => {
      if (input.classList.contains('topic-textarea')) {
        autoResizeTopicTextarea(input);
      }
    });

    if (isDynamic) {
      const tbody = table.tBodies[0];
      const lastRow = tbody.lastElementChild;
      if (lastRow) {
        const isLastRowEmpty = Array.from(lastRow.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
        if (!isLastRowEmpty) addNewRow(tableId, false);
      }
    }
  }
}

/* ================================
   ניווט שבועות
================================ */

/**
 * שומרת את השבוע הנוכחי ומעבירה את תצוגת המערכת לשבוע ושנה חדשים.
 * @param {number} year - השנה
 * @param {number} week - מספר השבוע
 */
function loadWeek(year, week) {
  saveCurrentWeek();
  currentWeek = week;
  currentYear = year;
  updateUIForWeek();
}

/**
 * מעבירה את התצוגה לשבוע הקודם (כולל מעבר שנה במידת הצורך).
 */
function prevWeek() { 
  let week = currentWeek - 1, year = currentYear;
  if (week < 1) { week = TOTAL_WEEKS; year--; }
  loadWeek(year, week);
}

/**
 * מעבירה את התצוגה לשבוע הבא (כולל מעבר שנה במידת הצורך).
 */
function nextWeek() { 
  let week = currentWeek + 1, year = currentYear;
  if (week > TOTAL_WEEKS) { week = 1; year++; }
  loadWeek(year, week);
}

/**
 * מעדכנת את כל רכיבי ממשק המשתמש (שדות שבוע, טבלאות, רשימות חיפוקים, חדר"ג ושק"ם) בעת החלפת שבוע.
 */
function updateUIForWeek() {
  const weekInput = document.getElementById('weekInput');
  const weekInputOptic = document.getElementById('weekInputOptic');
  if (weekInput) weekInput.value = currentWeek;
  if (weekInputOptic) weekInputOptic.value = currentWeek;

  const tables = getActiveTables();
  tables.forEach(tableId => {
    tableWeeks[tableId] = { week: currentWeek, year: currentYear };
    loadTableData(tableId, currentWeek, currentYear);
  });

  if (typeof loadHipokData === 'function') loadHipokData(currentWeek, currentYear);

  recalcAll('keshertable');
  recalcAll('optictable', tableConfigs.optictable);

  renderPageNumbers();

  const haktzaot = document.getElementById('haktzaot');
  if (haktzaot && haktzaot.style.display !== 'none') {
    if (typeof renderHaktzaot === 'function') renderHaktzaot();
    if (typeof renderHaktzaotOptic === 'function') renderHaktzaotOptic();
    if (typeof renderHaktzaotEsuk === 'function') renderHaktzaotEsuk();
    if (typeof renderHaktzaotHirg === 'function') renderHaktzaotHirg();
    if (typeof renderHaktzaotPikud === 'function') renderHaktzaotPikud();
    if (typeof renderHaktzaotTazam === 'function') renderHaktzaotTazam();
    if (typeof renderHaktzaotBahalag === 'function') renderHaktzaotBahalag();
  }

  if (typeof renderHipokEntriesList === 'function') renderHipokEntriesList();
  
  // פונקציות החדר"ג והשק"ם:
  if (typeof renderHadragRequestsList === 'function') renderHadragRequestsList();
  if (typeof loadHadragTables === 'function') loadHadragTables(currentWeek, currentYear);
  if (typeof renderHadragPendingRequests === 'function') renderHadragPendingRequests();
  if (typeof renderShekemRequestsList === 'function') renderShekemRequestsList();
  if (typeof loadShekemTables === 'function') loadShekemTables(currentWeek, currentYear);
  if (typeof renderShekemPendingRequests === 'function') renderShekemPendingRequests();
}

/**
 * מייצרת ומציגה כפתורי ניווט מהיר לשבועות הסמוכים (טווח של +-2 שבועות).
 */
function renderPageNumbers() {
  const containers = ['pageNumbers', 'pageNumbers-optic', 'pageNumbers2'];
  containers.forEach(id => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = '';
      for (let offset = -2; offset <= 2; offset++) {
        let week = currentWeek + offset, year = currentYear;
        if (week < 1) { week += TOTAL_WEEKS; year--; }
        if (week > TOTAL_WEEKS) { week -= TOTAL_WEEKS; year++; }
        const btn = document.createElement('button');
        btn.textContent = `${week} (${year})`;
        btn.onclick = () => loadWeek(year, week);
        if (week === currentWeek && year === currentYear) btn.classList.add('active-week');
        container.appendChild(btn);
      }
    }
  });
}

/**
 * מאתחלת מאזיני אירועים לשדות הקלט הידניים של מזהה השבוע בסרגל העליון.
 */
function initWeekInput() {
  ['weekInput', 'weekInputOptic'].forEach(inputId => {
    const weekInput = document.getElementById(inputId);
    if (weekInput) weekInput.addEventListener('change', () => {
      let val = parseInt(weekInput.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 52) val = 52;
      weekInput.value = val;
      loadWeek(currentYear, val);
    });
  });
}

/* ================================
   מערכת החיפוקים (+ צבעים)
================================ */

/**
 * קוראת את נתוני טבלת החיפוקים (משימות, שעות וצבעים) מתוך ה-DOM.
 * @returns {Object} אובייקט נתוני החיפוקים
 */
function readHipokData() {
  const data = {};
  document.querySelectorAll('#hipoktable .task-input').forEach((el, i) => { data['task_' + i] = el.value; });
  document.querySelectorAll('#hipoktable .time-input').forEach((el, i) => { data['time_' + i] = el.value; });
  
  if (typeof ALL_HIPOK_COLORS !== 'undefined') {
    document.querySelectorAll('#hipoktable .cell-wrapper').forEach((el, i) => {
       const colorClass = ALL_HIPOK_COLORS.find(c => el.classList.contains(c)) || '';
       data['color_' + i] = colorClass;
    });
  }
  return data;
}

/**
 * שומרת את נתוני טבלת החיפוקים עבור השבוע והשנה הנוכחיים.
 */
function saveHipokData() {
  const table = document.getElementById('hipoktable');
  if (!table) return;
  const data = readHipokData();
  localStorage.setItem(getStorageKey('hipoktable', currentWeek, currentYear), JSON.stringify(data));
}

/**
 * טוענת את נתוני טבלת החיפוקים עבור שבוע ושנה נתונים ומעדכנת את שדות הטבלה והצבעים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function loadHipokData(week, year) {
  const table = document.getElementById('hipoktable');
  if (!table) return;

  document.querySelectorAll('#hipoktable .task-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .time-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .cell-wrapper').forEach(wrapper => { wrapper.className = 'cell-wrapper'; });

  const saved = localStorage.getItem(getStorageKey('hipoktable', week, year));
  if (!saved) return;

  const data = JSON.parse(saved);
  document.querySelectorAll('#hipoktable .task-input').forEach((el, i) => {
    if (data['task_' + i] !== undefined) {
      el.value = data['task_' + i];
      if (data['task_' + i].trim() !== '') {
        const wrapper = el.closest('.cell-wrapper');
        if (wrapper) wrapper.classList.add('imported');
      }
    }
  });
  document.querySelectorAll('#hipoktable .time-input').forEach((el, i) => {
    if (data['time_' + i] !== undefined) {
      el.value = data['time_' + i];
      if (data['time_' + i].trim() !== '') {
        const wrapper = el.closest('.cell-wrapper');
        if (wrapper) wrapper.classList.add('imported');
      }
    }
  });

  if (typeof ALL_HIPOK_COLORS !== 'undefined') {
    document.querySelectorAll('#hipoktable .cell-wrapper').forEach((wrapper, i) => {
       if (data['color_' + i]) {
           wrapper.classList.add(data['color_' + i]);
       }
    });
  }
}

const HIPOK_DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const HIPOK_MAX_SLOTS_PER_GROUP = 6;

/**
 * מפיקה מפתח שמירה עבור רשימת בקשות החיפוקים של היחידות.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה
 */
function getHipokEntriesKey(week, year) { return `hipokEntries_week${week}_year${year}`; }

/**
 * טוענת את רשימת בקשות החיפוקים המאוחסנות לשבוע ושנה מסוימים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {Array<Object>} מערך אובייקטי בקשות חיפוק
 */
function loadHipokEntries(week, year) { const raw = localStorage.getItem(getHipokEntriesKey(week, year)); return raw ? JSON.parse(raw) : []; }

/**
 * שומרת את רשימת בקשות החיפוקים ב-LocalStorage.
 * @param {Array<Object>} entries - מערך בקשות החיפוק
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function saveHipokEntriesList(entries, week, year) { localStorage.setItem(getHipokEntriesKey(week, year), JSON.stringify(entries)); }

/**
 * מוסיפה בקשת חיפוק חדשה לרשימה ומעדכנת את השמירה.
 * @param {string} type - סוג החיפוק ('dry' / 'wet')
 * @param {number} day - אינדקס יום (0-6)
 * @param {string} time - מחרוזת שעות
 * @param {string} [text] - פירוט המשימה
 * @param {string} [color] - מחלקת צבע היחידה
 * @returns {Array<Object>} הרשימה המעודכנת
 */
function addHipokEntry(type, day, time, text = '', color = '') {
  const entries = loadHipokEntries(currentWeek, currentYear);
  entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, day, time, text, color });
  saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ספציפית לפי מזהה ייחודי.
 * @param {string} id - מזהה הבקשה
 * @returns {Array<Object>} הרשימה המעודכנת לאחר המחיקה
 */
function deleteHipokEntry(id) {
  const entries = loadHipokEntries(currentWeek, currentYear).filter(e => e.id !== id);
  saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ומעדכנת את התצוגה בעמוד היחידה.
 * @param {string} id - מזהה הבקשה
 */
function removeHipokEntry(id) {
  deleteHipokEntry(id);
  if (typeof renderHipokEntriesList === 'function') renderHipokEntriesList();
}

const PAGE_UNIT_MAP = {
  'esuk.html': 'bg-esuk',
  'hirg.html': 'bg-hirg',
  'pikud.html': 'bg-pikud',
  'tazam.html': 'bg-tazam',
  'bahalag.html': 'bg-maphat'
};

/**
 * מרנדרת את רשימת בקשות החיפוקים המוגשות בעמוד היחידה הרלוונטית.
 */
function renderHipokEntriesList() {
  const container = document.getElementById('hipokEntriesList');
  if (!container) return;

  const entries = loadHipokEntries(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredEntries = entries;
  if (targetColor) {
    filteredEntries = entries.filter(e => e.color === targetColor);
  }

  if (filteredEntries.length === 0) {
    container.innerHTML = '<p style="color:#666; text-align:center; padding: 15px; font-weight:bold;">אין חיפוקים שהוזנו לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredEntries.map(entry => {
    const typeText = entry.type === 'dry' ? 'חיפוק יבש' : 'חיפוק רטוב';
    const dayText = HIPOK_DAY_LABELS[entry.day] !== undefined ? 'יום ' + HIPOK_DAY_LABELS[entry.day] : '';
    const styleObj = UNIT_BG_MAP[entry.color] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 100px; color: ${styleObj.text}; text-align: right;">${typeText}</span>
        <span style="font-weight: bold; width: 80px; color: #333;">${dayText}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${entry.text || '-'}</span>
        <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 15px;">${entry.time}</span>
        <button class="hipok-delete-btn" onclick="removeHipokEntry('${entry.id}')">✕</button>
      </div>
    `;
  }).join('');
}

/**
 * מוצאת ומחזירה תא ספציפי בטבלת החיפוקים לפי סוג החיפוק, היום ואינדקס המשבצת.
 * @param {string} type - סוג ('dry' / 'wet')
 * @param {number} day - יום בשבוע
 * @param {number} slotIndex - אינדקס סלוט בתוך היום
 * @returns {HTMLTableCellElement|null} התא שנמצא או null
 */
function getHipokTableCell(type, day, slotIndex) {
  const table = document.getElementById('hipoktable');
  if (!table || !table.tBodies[0]) return null;
  const tbody = table.tBodies[0];
  let rowIndex, cellIndex;
  if (type === 'dry') {
    if (slotIndex === 0) { rowIndex = 0; cellIndex = day + 2; }
    else { rowIndex = slotIndex; cellIndex = day; }
  } else {
    if (slotIndex === 0) { rowIndex = 6; cellIndex = day + 1; }
    else { rowIndex = 6 + slotIndex; cellIndex = day; }
  }
  const row = tbody.rows[rowIndex];
  if (!row) return null;
  return row.cells[cellIndex] || null;
}

/**
 * מייבאת את בקשות החיפוקים של היחידות לתוך טבלת החיפוקים של המנהל מול מגבלת המשבצות.
 */
function importHipukim() {
  const table = document.getElementById('hipoktable');
  if (!table) { alert('טבלת החיפוקים לא נמצאה'); return; }

  const entries = loadHipokEntries(currentWeek, currentYear);
  if (entries.length === 0) {
    alert('אין חיפוקים שהוזנו לשבוע זה.');
    return;
  }

  const slotCounters = {};
  const overflow = [];

  entries.forEach(entry => {
    const key = `${entry.type}_${entry.day}`;
    const slot = slotCounters[key] || 0;
    slotCounters[key] = slot + 1;

    if (slot >= HIPOK_MAX_SLOTS_PER_GROUP) { overflow.push(entry); return; }

    const cell = getHipokTableCell(entry.type, entry.day, slot);
    if (!cell) { overflow.push(entry); return; }

    const wrapper = cell.querySelector('.cell-wrapper');
    const timeInput = cell.querySelector('.time-input');
    const taskInput = cell.querySelector('.task-input');

    if (timeInput && entry.time) timeInput.value = entry.time;
    if (taskInput && entry.text) taskInput.value = entry.text;
    
    if (wrapper) {
      wrapper.classList.add('imported');
      if (entry.color) wrapper.classList.add(entry.color); 
    }
  });

  saveHipokData();
  if (overflow.length > 0) {
    alert(`יובאו ${entries.length - overflow.length} חיפוקים.\n${overflow.length} לא נכנסו (חריגה מ-6 משבצות).`);
  } else {
    alert(`יובאו ${entries.length} חיפוקים בהצלחה`);
  }
}

/* ================================
   טבלאות דינמיות וייבוא כללי
================================ */

/**
 * בודקת אם כל תאי הקלט בשורה נתונה בטבלה ריקים מטקסט.
 * @param {HTMLTableRowElement} row - שורת טבלה
 * @returns {boolean} true אם השורה ריקה לחלוטין
 */
function isRowEmpty(row) {
  return Array.from(row.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
}

/**
 * מוסיפה שורה חדשה לטבלה דינמית ומשכפלת את מבנה תאי הקלט.
 * @param {string} tableId - מזהה הטבלה
 * @param {boolean} [autoSave=true] - האם לבצע שמירה אוטומטית לאחר ההוספה
 */
function addNewRow(tableId, autoSave = true) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const tbody = table.tBodies[0];
  if (!tbody.rows.length) return;
  let referenceRow = tbody.rows[1] || tbody.rows[0];
  const inputsCount = referenceRow.querySelectorAll('.cell-input').length;
  const newRow = document.createElement('tr');
  let tds = '';
  for (let i = 0; i < inputsCount; i++) { tds += `<td><input type="text" class="cell-input"></td>`; }
  newRow.innerHTML = tds;
  tbody.appendChild(newRow);
  if (autoSave) saveCurrentWeek();
}

/**
 * מאתחלת מאזיני הקלדה לטבלאות דינמיות להוספת שורות אוטומטית בסיפה ומחיקת שורות ריקות.
 */
function initDynamicRows() {
  const tables = [
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (!table) return;
    table.addEventListener('input', (e) => {
      const input = e.target;
      if (!input.classList.contains('cell-input')) return;
      const row = input.closest('tr');
      const tbody = row.parentElement;
      const isLastRow = row === tbody.lastElementChild;
      if (isLastRow && input.value.trim() !== '') { addNewRow(tableId, true); }
      if (row.cells[0] && row.cells[0].textContent.trim() !== "נושא שבוע" && isRowEmpty(row)) {
        if (tbody.rows.length > 2) { row.remove(); saveCurrentWeek(); }
      }
    });
  });
}

/**
 * מייבאת נתונים מצירי טבלאות יחידתיות אל טבלת מנהל ראשית (קשר/אופטיקה).
 * @param {string} sourceTableId - מזהה טבלת המקור
 * @param {string} targetTableId - מזהה טבלת היעד
 * @param {number} targetStartCol - עמודת התחלה ביעד
 * @param {number} [sourceCols] - מספר עמודות במקור
 */
function importFromSubTable(sourceTableId, targetTableId, targetStartCol, sourceCols) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  const key = getStorageKey(sourceTableId, currentWeek, currentYear);
  const saved = localStorage.getItem(key);
  if (!saved) { alert(`אין נתונים לשבוע ${currentWeek}`); return; }
  const data = JSON.parse(saved);
  if (!sourceCols) {
    const sourceTable = document.getElementById(sourceTableId);
    sourceCols = sourceTable ? sourceTable.tBodies[0].rows[0].cells.length - 1 : 7;
  }
  const targetRows = target.tBodies[0].rows;
  Object.entries(data).forEach(([indexStr, value]) => {
    if (value === undefined || value === null || value.trim() === '') return;
    const index = parseInt(indexStr);
    const row = Math.floor(index / sourceCols);
    const col = index % sourceCols;
    if (!targetRows[row]) return;
    const targetCell = targetRows[row].cells[targetStartCol + col];
    if (targetCell) {
      const input = targetCell.querySelector('.cell-input');
      if (input) input.value = value;
    }
  });
  saveCurrentWeek();
  if (targetTableId === 'keshertable') recalcAll(targetTableId);
  else recalcAll(targetTableId, tableConfigs[targetTableId]);
  alert(`יובאו נתונים בהצלחה`);
}

/**
 * מייבאת נתונים באופן ישיר לטבלאות דינמיות (כגון טבלאות מודיעין).
 * @param {string} sourceTableId - מזהה טבלת המקור
 * @param {string} targetTableId - מזהה טבלת היעד
 */
function importDirectToTable(sourceTableId, targetTableId) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  const key = getStorageKey(sourceTableId, currentWeek, currentYear);
  const saved = localStorage.getItem(key);
  if (!saved) { alert(`אין נתונים לשבוע ${currentWeek}`); return; }
  const data = JSON.parse(saved);
  
  const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
  if (keysWithData.length > 0) {
    const maxIndex = Math.max(...keysWithData.map(Number));
    const inputsPerRow = target.tBodies[0].rows[1].querySelectorAll('.cell-input').length;
    if (inputsPerRow > 0 && maxIndex >= 0) {
      const requiredRows = Math.floor(maxIndex / inputsPerRow) + 1;
      while (target.tBodies[0].rows.length < requiredRows) { addNewRow(targetTableId, false); }
    }
  }

  const targetInputs = target.querySelectorAll('.cell-input');
  targetInputs.forEach((input, idx) => {
    if (data[idx] !== undefined && data[idx].trim() !== '') {
      input.value = data[idx];
    }
  });

  const tbody = target.tBodies[0];
  const lastRow = tbody.lastElementChild;
  if (lastRow) {
    const isLastRowEmpty = Array.from(lastRow.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
    if (!isLastRowEmpty) { addNewRow(targetTableId, false); }
  }
  saveCurrentWeek();
  if (tableConfigs[targetTableId]) recalcAll(targetTableId, tableConfigs[targetTableId]);
  alert(`יובאו נתונים בהצלחה`);
}

/* ================================
   הקצאות (תצוגה בלבד לכל היחידות)
================================ */
const KESHER_ROW_NAMES = [
  "נושא שבוע","715/709","POC","710","שקדון","CF-33","700","דיסקית","סל\"צ","נתונים",
  "מגבר","מח-120","מח-121","מח-122","מדונה","אול\"רים","מר2791",
  "מזוודת הטענה בומבה","מזוודת הטענה ליתיום","משיכה\\זיכוי"
];

const OPTIC_ROW_NAMES = [
  "נושא שבוע","מת\"ן","עמית","עמית איכון","חצובת עמית","חצובת תבל","יובל","תבל ידני",
  "מיני תבל ידני","תבל נשלט","מיני תבל נשלט","רחפן מטריס 300","רחפן איבו",
  "רחפן אווטא (ערכה זוגית)","15X80","מצפן מעלות","שטיינר","צגון","מצלמת NIKON",
  "איבו אלפא","התקני הטלה/ כדור ברזל"
];

/**
 * בונה שורות הקצאה לתצוגה בלבד על בסיס נתונים שנשמרו בטבלאות המנהל.
 * @param {Object} data - נתוני הטבלה
 * @param {Array<string>} names - שמות השורות
 * @param {number} totalCols - סך העמודות
 * @param {number} startCol - עמודת התחלה
 * @param {number} endCol - עמודת סיום
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {Array<number>} [specialRowIndices=[0, 19]] - אינדקסים של שורות מיוחדות להדגשה
 */
function buildHaktzaotRows(data, names, totalCols, startCol, endCol, tbodyId, specialRowIndices = [0, 19]) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  let hasAny = false;

  names.forEach((name, rowIndex) => {
    let hasValue = false;
    const values = [];

    for (let col = startCol; col <= endCol; col++) {
      const globalIndex = rowIndex * (totalCols - 1) + (col - 1);
      const val = data[globalIndex] || '';
      values.push(val);
      if (val !== '') hasValue = true;
    }

    if (!hasValue) return;
    hasAny = true;

    const isSpecialRow = specialRowIndices.includes(rowIndex);
    let tds = `<td class="test">${name}</td>`;
    values.forEach(val => {
      tds += `<td style="text-align:center; font-weight:bold;">${val}</td>`;
    });
    tbody.innerHTML += `<tr class="${isSpecialRow ? 'special-row' : ''}">${tds}</tr>`;
  });

  if (!hasAny) {
    const colSpan = (endCol - startCol + 2);
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">אין נתונים לשבוע זה</td></tr>`;
  }
}

/**
 * מרנדרת את תצוגת הקצאות המודיעין עבור יחידה ספציפית לפי מספר הפלוגות.
 * @param {string} sourceTableId - מזהה טבלת המקור של המודיעין
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {number} [companyCount=6] - מספר הפלוגות ביחידה
 */
function renderHaktzaotModieinUnit(sourceTableId, tbodyId, companyCount = 6) {
  const key = getStorageKey(sourceTableId, currentWeek, currentYear);
  const saved = localStorage.getItem(key);
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!saved) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
    return;
  }

  const data = JSON.parse(saved);
  tbody.innerHTML = '';
  const keysWithData = Object.keys(data).filter(k => data[k] && data[k].trim() !== '');
  if (keysWithData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
    return;
  }

  const maxIndex = Math.max(...keysWithData.map(Number));
  const requiredRows = maxIndex < companyCount ? 1 : 2 + Math.floor((maxIndex - companyCount) / (companyCount + 1));
  let hasAny = false;

  for (let r = 0; r < requiredRows; r++) {
    let tr = document.createElement('tr');
    if (r === 0) {
      tr.innerHTML += `<td class="test">נושא שבוע</td>`;
      let rowHasData = false;
      for (let c = 0; c < companyCount; c++) {
        const val = data[c] || '';
        if (val) rowHasData = true;
        tr.innerHTML += `<td style="text-align:center; font-weight:bold;">${val}</td>`;
      }
      if (rowHasData) {
        tr.classList.add('special-row'); 
        tbody.appendChild(tr);
        hasAny = true;
      }
    } else {
      let isEmpty = true;
      let rowHtml = '';
      for (let c = 0; c < companyCount + 1; c++) {
        const idx = companyCount + (r - 1) * (companyCount + 1) + c;
        const val = data[idx] || '';
        if (val !== '') isEmpty = false;
        rowHtml += `<td style="text-align:center; font-weight:bold;">${val}</td>`;
      }
      if (!isEmpty) {
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr);
        hasAny = true;
      }
    }
  }
  if (!hasAny) {
    tbody.innerHTML = `<tr><td colspan="${companyCount + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
  }
}

/** מרנדרת הקצאות מודיעין עבור בא"ח איסו"ק */
function renderHaktzaotEsuk() {
  renderHaktzaotModieinUnit('esukTable', 'haktzaot-esuk-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור בא"ח חיר"ג */
function renderHaktzaotHirg() {
  renderHaktzaotModieinUnit('hirgTable', 'haktzaot-hirg-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור גדוד הפיקוד */
function renderHaktzaotPikud() {
  renderHaktzaotModieinUnit('pikudTable', 'haktzaot-pikud-body', 7);
}

/** מרנדרת הקצאות מודיעין עבור ענף תצ"מ */
function renderHaktzaotTazam() {
  renderHaktzaotModieinUnit('tazamTable', 'haktzaot-tazam-body', 8);
}

/** מרנדרת הקצאות מודיעין עבור בהל"ג */
function renderHaktzaotBahalag() {
  renderHaktzaotModieinUnit('bahalagTable', 'haktzaot-bahalag-body', 1);
}

/* ================================
   חישובים (נוסחאות) לטבלת קשר ולשאר
================================ */

/**
 * מריצה נוסחאות וחישובי סיכום, דרישה, ויסות ועודפים עבור שורה בטבלת קשר.
 * @param {HTMLTableRowElement} row - שורת הטבלה
 */
function recalcKesherRow(row) {
  const groups = [
    { companyCols: [1, 2, 3, 4, 5, 6, 7], demandCol: 8, regCol: 9, surplusCol: 10 },
    { companyCols: [11, 12, 13, 14, 15, 16], demandCol: 17, regCol: 18, surplusCol: 19 },
    { companyCols: [20, 21, 22, 23, 24, 25, 26], demandCol: 27, regCol: 28, surplusCol: 29 },
    { companyCols: [30, 31, 32, 33, 34, 35, 36, 37], demandCol: 38, regCol: 39, surplusCol: 40 },
    { companyCols: [41], demandCol: 42, regCol: 43, surplusCol: 44 }
  ];

  let totalRegulatedAll = 0;
  let hasAnyCompanyInputOverall = false;

  groups.forEach(group => {
    let groupDemand = 0;
    let hasGroupCompanyInput = false;

    group.companyCols.forEach(colIdx => {
      const input = row.cells[colIdx]?.querySelector('.cell-input');
      if (input && input.value.trim() !== '') {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          groupDemand += val;
          hasGroupCompanyInput = true;
          hasAnyCompanyInputOverall = true;
        }
      }
    });

    totalRegulatedAll += groupDemand;

    const demandInput = row.cells[group.demandCol]?.querySelector('.cell-input');
    if (demandInput) {
      demandInput.value = hasGroupCompanyInput ? groupDemand : '';
    }

    const regInput = row.cells[group.regCol]?.querySelector('.cell-input');
    const surplusInput = row.cells[group.surplusCol]?.querySelector('.cell-input');
    
    if (surplusInput && regInput) {
      const regValRaw = regInput.value ? regInput.value.trim() : '';
      if (regValRaw !== '' && !isNaN(parseFloat(regValRaw))) {
        const regVal = parseFloat(regValRaw);
        surplusInput.value = regVal - groupDemand;
      } else if (hasGroupCompanyInput) {
        surplusInput.value = -groupDemand;
      } else {
        surplusInput.value = '';
      }
    }
  });

  const totalUnitCol = 45;
  const failCol = 46;
  const totalRegulatedCol = 47;
  const availableCol = 48;
  const excessCol = 49;

  const totalUnitInput = row.cells[totalUnitCol]?.querySelector('.cell-input');
  const failInput = row.cells[failCol]?.querySelector('.cell-input');

  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';

  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyCompanyInputOverall;

  const totalRegInput = row.cells[totalRegulatedCol]?.querySelector('.cell-input');
  if (totalRegInput) {
    totalRegInput.value = hasAnyCompanyInputOverall ? totalRegulatedAll : '';
  }

  const availableInput = row.cells[availableCol]?.querySelector('.cell-input');
  if (availableInput) {
    if (totalUnitRaw !== '' || failRaw !== '') {
      availableInput.value = totalUnit - fail;
    } else {
      availableInput.value = '';
    }
  }

  const excessInput = row.cells[excessCol]?.querySelector('.cell-input');
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - totalRegulatedAll;
    } else {
      excessInput.value = '';
    }
  }
}

/**
 * מריצה נוסחאות חישוב עבור שורה בטבלת אופטיקה בהתאם לקונפיגורציית העמודות.
 * @param {HTMLTableRowElement} row - שורת הטבלה
 * @param {Object} config - קונפיגורציית עמודות
 */
function recalcRow(row, config) {
  const { startCol, endCol, totalUnitCol, failCol, totalRegulatedCol, availableCol, excessCol } = config;
  let sum = 0, hasAnyValue = false;

  for (let i = startCol; i <= endCol; i++) {
    const input = row.cells[i]?.querySelector('.cell-input');
    if (input && input.value.trim() !== '') {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        sum += val;
        hasAnyValue = true;
      }
    }
  }

  const totalUnitInput = row.cells[totalUnitCol]?.querySelector('.cell-input');
  const failInput = row.cells[failCol]?.querySelector('.cell-input');
  
  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';
  
  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyValue;

  const totalRegInput = row.cells[totalRegulatedCol]?.querySelector('.cell-input');
  if (totalRegInput) totalRegInput.value = hasAnyValue ? sum : '';

  const availableInput = row.cells[availableCol]?.querySelector('.cell-input');
  if (availableInput) {
    if (totalUnitRaw !== '' || failRaw !== '') {
      availableInput.value = totalUnit - fail;
    } else {
      availableInput.value = '';
    }
  }

  const excessInput = row.cells[excessCol]?.querySelector('.cell-input');
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - sum;
    } else {
      excessInput.value = '';
    }
  }
}

/**
 * מריצה חישוב מחדש של הנוסחאות על כל השורות בטבלה נתונה.
 * @param {string} tableId - מזהה הטבלה
 * @param {Object} [config] - קונפיגורציית חישוב אופציונלית
 */
function recalcAll(tableId, config) {
  const table = document.getElementById(tableId);
  if (!table || !table.tBodies[0]) return;
  
  for (let row of table.tBodies[0].rows) {
    if (row.sectionRowIndex === 0 || row.rowIndex === 20) continue;
    
    if (tableId === 'keshertable' && row.cells.length >= 50) {
      recalcKesherRow(row);
    } else if (config) {
      recalcRow(row, config);
    }
  }
}

/**
 * מאתחלת מאזיני אירועי הקלדה בטבלאות לשמירה וחישוב אוטומטי בזמן אמת.
 */
function initTableListeners() {
  const tables = getActiveTables();
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (table) {
      table.addEventListener('input', () => {
        saveCurrentWeek();
        if (tableId === 'keshertable') recalcAll('keshertable');
        else if (tableConfigs[tableId]) recalcAll(tableId, tableConfigs[tableId]);
      });
    }
  });
  
  const hipok = document.getElementById('hipoktable');
  if (hipok) hipok.addEventListener('input', () => {
    if (typeof saveHipokData === 'function') saveHipokData();
  });
}

/* ================================
   התרחבות אוטומטית ל"נושא שבוע"
================================ */

/**
 * מתאימה באופן אוטומטי את גובה תיבת הטקסט בשורת "נושא שבוע" לפי גובה התוכן (scrollHeight).
 * @param {HTMLTextAreaElement} el - רכיב ה-textarea
 */
function autoResizeTopicTextarea(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 42) + 'px';
}

/**
 * מאתחלת מאזינים להתרחבות אוטומטית של תיבות הטקסט בשורות נושא השבוע.
 */
function initTopicExpansion() {
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('topic-textarea')) {
      autoResizeTopicTextarea(e.target);
    }
  });

  document.querySelectorAll('.topic-textarea').forEach(autoResizeTopicTextarea);
}

/* =========================================================
   מערכת חדר"ג / כיתות - (ניהול בקשות ואישורים למנהל)
========================================================= */

const HADRAG_FACILITY_NAMES = {
  'chadrag': 'חדר"ג',
  'anafit8': 'ענפית 8',
  'anafit-bah': 'ענפית בא"ח',
  'tavor': 'תבור'
};
const HADRAG_DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const ALL_COLOR_CLASSES = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'imported', 'conflict-overlap'];

/**
 * מפיקה מפתח שמירה עבור בקשות חדר"ג.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה
 */
function getHadragRequestsKey(week, year) { return `hadragRequests_week${week}_year${year}`; }

/**
 * טוענת את בקשות החדר"ג לשבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {Array<Object>} מערך בקשות חדר"ג
 */
function loadHadragRequests(week, year) { const raw = localStorage.getItem(getHadragRequestsKey(week, year)); return raw ? JSON.parse(raw) : []; }

/**
 * שומרת את בקשות החדר"ג ב-LocalStorage.
 * @param {Array<Object>} requests - מערך בקשות חדר"ג
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function saveHadragRequests(requests, week, year) { localStorage.setItem(getHadragRequestsKey(week, year), JSON.stringify(requests)); }

/**
 * בונה דינמית את שורות ועמודות השעות (06:00 עד 23:30) בטבלאות חדר"ג ושק"ם.
 * @param {string} tbodyId - מזהה גוף הטבלה (tbody)
 */
function generateTimeSlots(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (tbody.rows.length > 0) return;

  let html = '';
  for (let r = 0; r < 36; r++) {
    const hour = Math.floor(6 + r / 2).toString().padStart(2, '0');
    const minutes = r % 2 === 0 ? '00' : '30';
    const timeString = `${hour}:${minutes}`;
    
    let rowHtml = `<tr><td class="time-col">${timeString}</td>`;
    for (let c = 0; c < 7; c++) {
      rowHtml += `<td class="platoon-cell" data-row="${r}" data-col="${c}">
                    <textarea placeholder=""></textarea>
                  </td>`;
    }
    rowHtml += `</tr>`;
    html += rowHtml;
  }
  tbody.innerHTML = html;

  tbody.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
    });
  });
}

const PAGE_UNIT_NAMES = {
  'esuk.html': 'בא"ח איסו"ק',
  'hirg.html': 'בא"ח חיר"ג',
  'pikud.html': 'גדוד הפיקוד',
  'tazam.html': 'ענף תצ"מ',
  'bahalag.html': 'בהל"ג'
};

/**
 * מגישה בקשת שיבוץ חדר"ג חדשה מטעם יחידה ושומרת אותה כממתינה לאישור.
 * @param {string} [unitClass] - מחלקת צבע היחידה
 * @param {string} [unitName] - שם היחידה
 */
function submitHadragRequest(unitClass, unitName) {
  const facility = document.getElementById('hadragFacilityInput').value;
  const text = document.getElementById('hadragTextInput').value.trim();
  const day = parseInt(document.getElementById('hadragDayInput').value);
  const startTime = document.getElementById('hadragStartTime').value;
  const endTime = document.getElementById('hadragEndTime').value;

  if (!text || !startTime || !endTime) { alert('יש למלא את כל השדות.'); return; }
  if (startTime >= endTime) { alert('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.'); return; }

  const currentPage = window.location.pathname.split('/').pop();
  if (!unitClass) unitClass = PAGE_UNIT_MAP[currentPage] || 'bg-esuk';
  if (!unitName) unitName = PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק';

  const requests = loadHadragRequests(currentWeek, currentYear);
  requests.push({ id: Date.now().toString(36), facility, text, day, startTime, endTime, unit: unitClass, unitName: unitName, status: 'pending' });
  saveHadragRequests(requests, currentWeek, currentYear);

  document.getElementById('hadragTextInput').value = '';
  document.getElementById('hadragStartTime').value = '';
  document.getElementById('hadragEndTime').value = '';
  
  if(typeof renderHadragRequestsList === 'function') renderHadragRequestsList();
}

/**
 * מוחקת בקשת חדר"ג ומעדכנת את הרשימות בתצוגה.
 * @param {string} id - מזהה הבקשה
 */
function deleteHadragRequest(id) {
  const requests = loadHadragRequests(currentWeek, currentYear).filter(req => req.id !== id);
  saveHadragRequests(requests, currentWeek, currentYear);
  if(typeof renderHadragRequestsList === 'function') renderHadragRequestsList();
  if(typeof renderHadragPendingRequests === 'function') renderHadragPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות החדר"ג שהוגשו עבור עמוד היחידה הנוכחי.
 */
function renderHadragRequestsList() {
  const container = document.getElementById('hadragRequestsList');
  if (!container) return;

  const requests = loadHadragRequests(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map(req => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 90px; color: ${styleObj.text}; text-align: right;">${HADRAG_FACILITY_NAMES[req.facility] || 'חדר"ג'}</span>
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${req.text}</span>
        <span style="direction: ltr; font-weight: bold; color: #333;">${req.startTime} - ${req.endTime}</span>
        <button class="hipok-delete-btn" onclick="deleteHadragRequest('${req.id}')">✕</button>
      </div>
    `;
  }).join('');
}

/**
 * המירה מחרוזת שעה (HH:MM) לאינדקס שורה בטבלאות חדר"ג/שק"ם (0 עד 35).
 * @param {string} timeStr - מחרוזת שעה
 * @returns {number} אינדקס שורה
 */
function timeToRowIndex(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours - 6) * 2 + (minutes >= 30 ? 1 : 0);
}

const UNIT_BG_MAP = {
  'bg-esuk':   { bg: '#fff9c4', border: '#ffe082', text: '#856404' },
  'bg-hirg':   { bg: '#c8e6c9', border: '#81c784', text: '#1b5e20' },
  'bg-pikud':  { bg: '#bbdefb', border: '#64b5f6', text: '#0d47a1' },
  'bg-tazam':  { bg: '#e1bee7', border: '#ba68c8', text: '#4a148c' },
  'bg-maphat': { bg: '#ffe0b2', border: '#ffb74d', text: '#e65100' }
};

/**
 * מרנדרת את כרטיסי הבקשות הממתינות לאישור חדר"ג עבור עמוד ניהול החדר"ג.
 */
function renderHadragPendingRequests() {
  const container = document.getElementById('hadragPendingList');
  if (!container) return; 

  const allRequests = loadHadragRequests(currentWeek, currentYear);
  const pendingRequests = allRequests.filter(req => req.status !== 'approved');

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:13px; font-weight:700; margin:6px 0;">אין בקשות ממתינות לאישור.</p>';
    return;
  }

  container.innerHTML = pendingRequests.map(req => {
    const unitKey = req.unit || 'bg-esuk';
    const info = UNIT_BG_MAP[unitKey] || UNIT_BG_MAP['bg-esuk'];
    const unitName = req.unitName || 'בא"ח איסו"ק';
    const facilityName = HADRAG_FACILITY_NAMES[req.facility] || 'חדר"ג';
    const dayName = HADRAG_DAY_LABELS[req.day] !== undefined ? 'יום ' + HADRAG_DAY_LABELS[req.day] : '';

    return `
      <div class="request-card" style="background:#ffffff; border:1px solid #cbd5e1; border-right:4px solid ${info.border}; padding:6px 12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span style="background:${info.bg}; border:1px solid ${info.border}; color:${info.text}; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11.5px;">${unitName}</span>
          <span style="background:#0f172a; color:#ffffff; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11.5px;">${facilityName} • ${dayName}</span>
        </div>

        <span style="color:#000000; font-weight:800; flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px;">${req.text}</span>

        <div style="direction:ltr; display:flex; align-items:center; gap:4px; flex-shrink:0; background:#f8fafc; padding:3px 6px; border-radius:6px; border:1px solid #e2e8f0;">
          <input type="time" id="editStart_${req.id}" value="${req.startTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
          <span style="font-weight:700; color:#64748b; font-size:12px;">-</span>
          <input type="time" id="editEnd_${req.id}" value="${req.endTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
        </div>

        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-approve" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:4px 12px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(22,163,74,0.2);" onclick="approveHadragRequest('${req.id}')">✓ שבץ</button>
          <button class="btn-reject" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:4px 10px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center;" onclick="rejectHadragRequest('${req.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * מאשרת בקשת חדר"ג, מחשבת את מיזוג השורות הנדרש, ומשבצת אותה בטבלה.
 * @param {string} reqId - מזהה הבקשה
 */
function approveHadragRequest(reqId) {
  const requests = loadHadragRequests(currentWeek, currentYear);
  const reqIndex = requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return;
  
  const req = requests[reqIndex];
  const tbodyId = 'body-' + req.facility;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) { alert('הטבלה הרלוונטית לא נמצאה'); return; }

  const newStartInput = document.getElementById(`editStart_${reqId}`);
  const newEndInput = document.getElementById(`editEnd_${reqId}`);
  
  if (newStartInput && newEndInput) {
    if (newStartInput.value >= newEndInput.value) {
      alert('שגיאה: שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }
    req.startTime = newStartInput.value;
    req.endTime = newEndInput.value;
  }

  const startRow = timeToRowIndex(req.startTime);
  const endRow = Math.max(startRow, timeToRowIndex(req.endTime) - 1);
  const col = req.day;

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || cell.classList.contains('imported')) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות שבחרת תפוסות.');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = '100%';
    textarea.value = req.text;
    const unitClass = req.unit || 'bg-esuk';
    firstCell.classList.add(unitClass, 'imported');
  }

  req.status = 'approved';
  saveHadragRequests(requests, currentWeek, currentYear);
  if (typeof saveHadragTables === 'function') saveHadragTables(); 
  renderHadragPendingRequests(); 
}

/**
 * דוחה ומודקת בקשת חדר"ג לאחר אישור המשתמש.
 * @param {string} reqId - מזהה הבקשה
 */
function rejectHadragRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    deleteHadragRequest(reqId);
  }
}

/**
 * שומרת את מצב תאי הטבלאות ומיזוגי השורות בכל מתקני החדר"ג לשבוע הנוכחי.
 */
function saveHadragTables() {
  const TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
  TABLE_IDS.forEach(tableId => {
    const tbody = document.getElementById(tableId);
    if (!tbody) return; 
    
    const tableData = {};
    for(let r = 0; r < 36; r++) {
      for(let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if(!cell) continue;
        const textarea = cell.querySelector('textarea');
        tableData[`${r}_${c}`] = {
          val: textarea ? textarea.value : '',
          span: cell.rowSpan,
          disp: cell.style.display,
          classes: Array.from(cell.classList).filter(cls => ['merged', ...ALL_COLOR_CLASSES].includes(cls))
        };
      }
    }
    localStorage.setItem(`hadragData_${tableId}_week${currentWeek}_year${currentYear}`, JSON.stringify(tableData));
  });
}

/**
 * מאפסת את מבנה התאים והמיזוגים בטבלת חדר"ג או שק"ם למצב ברירת מחדל.
 * @param {HTMLTableSectionElement} tbody - גוף הטבלה
 */
function resetHadragOrShekemTable(tbody) {
  if (!tbody) return;
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      cell.rowSpan = 1;
      cell.style.display = '';
      cell.className = 'platoon-cell';
      const textarea = cell.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        textarea.style.height = '100%';
      }
    }
  }
}

/**
 * טוענת את מצב המשבצות והאירועים המשובצים בטבלאות החדר"ג עבור שבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function loadHadragTables(week, year) {
  const TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
  if (typeof generateTimeSlots !== 'function') return;

  TABLE_IDS.forEach(tableId => {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    
    generateTimeSlots(tableId); 
    resetHadragOrShekemTable(tbody);

    const saved = localStorage.getItem(`hadragData_${tableId}_week${week}_year${year}`);
    if (!saved) return; 
    
    const tableData = JSON.parse(saved);
    for (let r = 0; r < 36; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;
        
        const data = tableData[`${r}_${c}`];
        if (data) {
          const textarea = cell.querySelector('textarea');
          if (textarea) {
            textarea.value = data.val || '';
            textarea.style.height = '100%';
          }
          cell.rowSpan = data.span || 1;
          cell.style.display = data.disp || '';
          if (data.classes) data.classes.forEach(cls => cell.classList.add(cls));
        }
      }
    }
  });
}

/* =========================================================
   מערכת שק"ם
========================================================= */

/** מפיקה מפתח שמירה לבקשות שק"ם */
function getShekemRequestsKey(week, year) { return `shekemRequests_week${week}_year${year}`; }

/** טוענת את בקשות השק"ם לשבוע ושנה נתונים */
function loadShekemRequests(week, year) { const raw = localStorage.getItem(getShekemRequestsKey(week, year)); return raw ? JSON.parse(raw) : []; }

/** שומרת את בקשות השק"ם ב-LocalStorage */
function saveShekemRequests(requests, week, year) { localStorage.setItem(getShekemRequestsKey(week, year), JSON.stringify(requests)); }

/**
 * מגישה בקשת שעות שק"ם חדשה מטעם יחידה.
 * @param {string} [unitClass] - מחלקת צבע היחידה
 * @param {string} [unitName] - שם היחידה
 */
function submitShekemRequest(unitClass, unitName) {
  const text = document.getElementById('shekemTextInput').value.trim();
  const day = parseInt(document.getElementById('shekemDayInput').value);
  const startTime = document.getElementById('shekemStartTime').value;
  const endTime = document.getElementById('shekemEndTime').value;

  if (!text || !startTime || !endTime) { alert('יש למלא את כל השדות.'); return; }
  if (startTime >= endTime) { alert('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.'); return; }

  const currentPage = window.location.pathname.split('/').pop();
  if (!unitClass) unitClass = PAGE_UNIT_MAP[currentPage] || 'bg-esuk';
  if (!unitName) unitName = PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק';

  const requests = loadShekemRequests(currentWeek, currentYear);
  requests.push({ id: Date.now().toString(36), text, day, startTime, endTime, unit: unitClass, unitName: unitName, status: 'pending' });
  saveShekemRequests(requests, currentWeek, currentYear);

  document.getElementById('shekemTextInput').value = '';
  document.getElementById('shekemStartTime').value = '';
  document.getElementById('shekemEndTime').value = '';
  
  if(typeof renderShekemRequestsList === 'function') renderShekemRequestsList();
}

/**
 * מוחקת בקשת שק"ם ומעדכנת את התצוגות.
 * @param {string} id - מזהה הבקשה
 */
function deleteShekemRequest(id) {
  const requests = loadShekemRequests(currentWeek, currentYear).filter(req => req.id !== id);
  saveShekemRequests(requests, currentWeek, currentYear);
  if(typeof renderShekemRequestsList === 'function') renderShekemRequestsList();
  if(typeof renderShekemPendingRequests === 'function') renderShekemPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות השק"ם בעמוד היחידה.
 */
function renderShekemRequestsList() {
  const container = document.getElementById('shekemRequestsList');
  if (!container) return;

  const requests = loadShekemRequests(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map(req => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${req.text}</span>
        <span style="direction: ltr; font-weight: bold; color: #333;">${req.startTime} - ${req.endTime}</span>
        <button class="hipok-delete-btn" onclick="deleteShekemRequest('${req.id}')">✕</button>
      </div>
    `;
  }).join('');
}

/**
 * מרנדרת את כרטיסי הבקשות הממתינות לאישור שק"ם עבור עמוד ניהול השק"ם.
 */
function renderShekemPendingRequests() {
  const container = document.getElementById('shekemPendingList');
  if (!container) return; 

  const allRequests = loadShekemRequests(currentWeek, currentYear);
  const pendingRequests = allRequests.filter(req => req.status !== 'approved');

  if (pendingRequests.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:13px; font-weight:700; margin:6px 0;">אין בקשות לשעות שק"ם הממתינות לאישור.</p>';
    return;
  }

  container.innerHTML = pendingRequests.map(req => {
    const unitKey = req.unit || 'bg-esuk';
    const info = UNIT_BG_MAP[unitKey] || UNIT_BG_MAP['bg-esuk'];
    const unitName = req.unitName || 'בא"ח איסו"ק';
    const dayName = HADRAG_DAY_LABELS[req.day] !== undefined ? 'יום ' + HADRAG_DAY_LABELS[req.day] : '';

    return `
      <div class="request-card" style="background:#ffffff; border:1px solid #cbd5e1; border-right:4px solid ${info.border}; padding:6px 12px; border-radius:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:13px; box-shadow:0 1px 3px rgba(0,0,0,0.05); margin-bottom:4px;">
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span style="background:${info.bg}; border:1px solid ${info.border}; color:${info.text}; padding:2px 8px; border-radius:6px; font-weight:800; font-size:11.5px;">${unitName}</span>
          <span style="background:#0f172a; color:#ffffff; padding:2px 8px; border-radius:6px; font-weight:700; font-size:11.5px;">שק"ם • ${dayName}</span>
        </div>

        <span style="color:#000000; font-weight:800; flex:1; text-align:right; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 4px;">${req.text}</span>

        <div style="direction:ltr; display:flex; align-items:center; gap:4px; flex-shrink:0; background:#f8fafc; padding:3px 6px; border-radius:6px; border:1px solid #e2e8f0;">
          <input type="time" id="editShekemStart_${req.id}" value="${req.startTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
          <span style="font-weight:700; color:#64748b; font-size:12px;">-</span>
          <input type="time" id="editShekemEnd_${req.id}" value="${req.endTime}" step="1800" style="padding:2px 4px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; font-weight:700; width:68px; text-align:center; color:#000000; background:#ffffff; outline:none;">
        </div>

        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-approve" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:4px 12px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 2px rgba(22,163,74,0.2);" onclick="approveShekemRequest('${req.id}')">✓ שבץ</button>
          <button class="btn-reject" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:4px 10px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; height:28px; display:flex; align-items:center; justify-content:center;" onclick="rejectShekemRequest('${req.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * מאשרת ומשבצת בקשת שק"ם בטבלת השק"ם.
 * @param {string} reqId - מזהה הבקשה
 */
function approveShekemRequest(reqId) {
  const requests = loadShekemRequests(currentWeek, currentYear);
  const reqIndex = requests.findIndex(r => r.id === reqId);
  if (reqIndex === -1) return;
  
  const req = requests[reqIndex];
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return;

  const newStartInput = document.getElementById(`editShekemStart_${reqId}`);
  const newEndInput = document.getElementById(`editShekemEnd_${reqId}`);
  
  if (newStartInput && newEndInput) {
    if (newStartInput.value >= newEndInput.value) {
      alert('שגיאה: שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.');
      return;
    }
    req.startTime = newStartInput.value;
    req.endTime = newEndInput.value;
  }

  const startRow = timeToRowIndex(req.startTime);
  const endRow = Math.max(startRow, timeToRowIndex(req.endTime) - 1);
  const col = req.day;

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || cell.classList.contains('imported')) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות שבחרת כבר תפוסות בטבלה.');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = (firstCell.rowSpan * 17.5) + 'px';
    textarea.value = req.text;
    const unitClass = req.unit || 'bg-esuk';
    firstCell.classList.add(unitClass, 'imported');
  }

  req.status = 'approved';
  saveShekemRequests(requests, currentWeek, currentYear);
  if (typeof saveShekemTables === 'function') saveShekemTables(); 
  renderShekemPendingRequests(); 
}

/**
 * דוחה בקשת שק"ם ומוחקת אותה.
 * @param {string} reqId - מזהה הבקשה
 */
function rejectShekemRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    deleteShekemRequest(reqId);
  }
}

/**
 * שומרת את מצב טבלת השק"ם ב-LocalStorage.
 */
function saveShekemTables() {
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return; 
  
  const tableData = {};
  for(let r = 0; r < 36; r++) {
    for(let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if(!cell) continue;
      const textarea = cell.querySelector('textarea');
      tableData[`${r}_${c}`] = {
        val: textarea ? textarea.value : '',
        span: cell.rowSpan,
        disp: cell.style.display,
        classes: Array.from(cell.classList).filter(cls => ['merged', ...ALL_COLOR_CLASSES].includes(cls))
      };
    }
  }
  localStorage.setItem(`shekemData_body-shekem_week${currentWeek}_year${currentYear}`, JSON.stringify(tableData));
}

/**
 * טוענת את מצב טבלת השק"ם לשבוע ושנה נתונים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
function loadShekemTables(week, year) {
  if (typeof generateTimeSlots !== 'function') return;
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return;
  
  generateTimeSlots('body-shekem'); 
  resetHadragOrShekemTable(tbody);

  const saved = localStorage.getItem(`shekemData_body-shekem_week${week}_year${year}`);
  if (!saved) return; 
  
  const tableData = JSON.parse(saved);
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      
      const data = tableData[`${r}_${c}`];
      if (data) {
        const textarea = cell.querySelector('textarea');
        if (textarea) {
          textarea.value = data.val || '';
          textarea.style.height = (data.span > 1) ? (data.span * 17.5) + 'px' : '100%';
        }
        cell.rowSpan = data.span || 1;
        cell.style.display = data.disp || '';
        if (data.classes) data.classes.forEach(cls => cell.classList.add(cls));
      }
    }
  }
}

/* =========================================================
   שיבוץ ישיר למנהל (חדר"ג + שק"ם)
========================================================= */

/**
 * מיועדת לשיבוץ ישיר של מנהל בטבלאות חדר"ג או שק"ם ללא הגשת בקשה מוקדמת.
 * @param {string} type - סוג הטבלה ('hadrag' / 'shekem')
 */
function addDirectEntry(type) {
  const unitClass = document.getElementById('directUnit').value;
  const text = document.getElementById('directText').value.trim();
  const day = parseInt(document.getElementById('directDay').value);
  const startTime = document.getElementById('directStart').value;
  const endTime = document.getElementById('directEnd').value;
  
  let tbodyId = '';
  if (type === 'hadrag') {
    const facility = document.getElementById('directFacility').value;
    tbodyId = 'body-' + facility;
  } else {
    tbodyId = 'body-shekem';
  }

  if (!text || !startTime || !endTime) { alert('יש למלא את כל השדות לשיבוץ הישיר.'); return; }
  if (startTime >= endTime) { alert('שעת הסיום צריכה להיות מאוחרת משעת ההתחלה.'); return; }

  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const startRow = timeToRowIndex(startTime);
  const endRow = Math.max(startRow, timeToRowIndex(endTime) - 1);

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${day}"]`);
    if (!cell) continue;
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls))) {
      hasConflict = true;
    }
    const input = cell.querySelector('textarea');
    if (input && input.value.trim() !== '') hasConflict = true;
  }

  if (hasConflict) {
    alert('⚠️ אי אפשר לשבץ: השעות המבוקשות כבר תפוסות בטבלה. פנה אותן תחילה (קליק ימני).');
    return;
  }

  const firstCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${day}"]`);
  if (!firstCell) return;

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${day}"]`);
    if (cell) {
      cell.style.display = (r === startRow) ? '' : 'none';
      cell.rowSpan = 1;
      cell.classList.remove('merged', ...ALL_COLOR_CLASSES);
    }
  }

  firstCell.rowSpan = (endRow - startRow + 1);
  const textarea = firstCell.querySelector('textarea');
  if (textarea) {
    textarea.style.height = '100%';
    textarea.value = text;
    firstCell.classList.add(unitClass); 
  }

  if (type === 'hadrag' && typeof saveHadragTables === 'function') saveHadragTables();
  if (type === 'shekem' && typeof saveShekemTables === 'function') saveShekemTables();
}

/* =========================================================
   מנגנון גרירה ומיזוג משבצות (Drag to Merge) - חדר"ג ושק"ם
========================================================= */
let isDragging = false;
let dragStartCell = null;
let dragStartRow = -1;
let dragCol = -1;

/**
 * מסימת את מצב הגרירה והמיזוג (Drag-to-Merge) ושומרת את שינויי הטבלאות.
 */
function stopDragging() {
  if (isDragging) {
    isDragging = false;
    dragStartCell = null;
    dragStartRow = -1;
    dragCol = -1;
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();
  }
}

// 1. תחילת גרירה (לחיצה שמאלית)
document.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  
  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;
  
  const ta = cell.querySelector('textarea');
  const hasContent = ta && ta.value.trim() !== '';
  const hasColor = ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls));

  if (!hasContent && !hasColor && cell.style.display !== 'none') {
    isDragging = true;
    dragStartCell = cell;
    dragStartRow = parseInt(cell.dataset.row);
    dragCol = parseInt(cell.dataset.col);
  }
});

// 2. מהלך הגרירה (מעבר מעל משבצות אחרות)
document.addEventListener('mouseover', function(e) {
  if (!isDragging || !dragStartCell) return;
  
  const cell = e.target.closest('td.platoon-cell');
  if (cell && cell !== dragStartCell) {
    const currentRow = parseInt(cell.dataset.row);
    const currentCol = parseInt(cell.dataset.col);
    
    if (currentCol === dragCol && currentRow > dragStartRow) {
      const ta = cell.querySelector('textarea');
      const hasContent = ta && ta.value.trim() !== '';
      const hasColor = ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls));

      if (cell.style.display !== 'none' && !hasContent && !hasColor && cell.rowSpan === 1) {
        cell.style.display = 'none';
        const newSpan = currentRow - dragStartRow + 1;
        
        dragStartCell.rowSpan = newSpan;
        dragStartCell.classList.add('merged');
        
        const startTa = dragStartCell.querySelector('textarea');
        if (startTa) {
          startTa.style.height = '100%'; 
        }
      } else {
        stopDragging();
      }
    }
  }
});

// 3. סיום גרירה (עזיבת העכבר/פוקוס)
document.addEventListener('mouseup', stopDragging);
window.addEventListener('blur', stopDragging);

// *הערה: פונקציית הקליק הימני לביטול (contextmenu) כבר מובנית בקבצי ה-HTML של החדר"ג והשק"ם.
/* ================================
   אתחול (בעת עליית העמוד)
================================ */
window.onload = function () {
  const { week, year } = getCurrentWeekAndYear();
  currentWeek = week;
  currentYear = year;
  
  renderNavbars();
  initTableListeners();
  initTopicExpansion();
  initDynamicRows();
  initWeekInput();
  
  updateUIForWeek();
};