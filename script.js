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
  'bahalag.html': 'מפח"ט',
  'kesher.html': 'טבלאות מנהל',
  'optic.html': 'טבלאות מנהל',
  'modiein.html': 'טבלאות מנהל',
  'hipokim.html': 'טבלאות מנהל',
  'hadrag.html': 'טבלאות מנהל',
  'shekem.html': 'טבלאות מנהל',
  'index.html': 'עמוד ראשי'
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

  const rawPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const currentPage = rawPage.split('?')[0].split('#')[0];
  const isUnitPage = ['esuk', 'hirg', 'pikud', 'tazam', 'bahalag'].some(u => currentPage.includes(u));
  const urlParams = new URLSearchParams(window.location.search);
  const isHaktzaotView = urlParams.get('view') === 'haktzaot';

  const matchedUnitKey = Object.keys(UNIT_TITLE_MAP).find(k => currentPage.includes(k.split('.')[0]));
  const unitName = matchedUnitKey ? UNIT_TITLE_MAP[matchedUnitKey] : 'PAKADEX';

  const matchedCatKey = Object.keys(PAGE_CATEGORY_MAP).find(k => currentPage.includes(k.split('.')[0]));

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
  } else if (matchedCatKey) {
    container.innerHTML = `
      <span>טבלאות מנהל</span>
      <span style="color:#64748b; font-size:11px;">➔</span>
      <span style="color:#ffffff;">${PAGE_CATEGORY_MAP[matchedCatKey]}</span>
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

  const rawPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const currentPage = rawPage.split('?')[0].split('#')[0];
  const isUnitPage = ['esuk', 'hirg', 'pikud', 'tazam', 'bahalag'].some(u => currentPage.includes(u));

  const urlParams = new URLSearchParams(window.location.search);
  const currentView = urlParams.get('view') || 'bakashot';
  const isHaktzaotView = currentView === 'haktzaot';
  
  const isCollapsedStored = localStorage.getItem('sidebar_collapsed') === 'true';

  const isMain = currentPage.includes('main') || currentPage === '' || currentPage.includes('index');

  // 1. הזרקת תפריט עליון (Top Nav)
  if (topNav) {
    const isKesher = currentPage.includes('kesher');
    const isOptic = currentPage.includes('optic');
    const isHipok = currentPage.includes('hipok');
    const isModiein = currentPage.includes('modiein');
    const isHadrag = currentPage.includes('hadrag');
    const isShekem = currentPage.includes('shekem');

    const logoBlock = !isUnitPage ? `
      <div style="display:flex; align-items:center; gap:8px; margin-right:auto; cursor:pointer;" onclick="window.location.href='index.html'">
        <h1 style="font-size:20px; color:white; margin:0;">PAKADEX</h1>
        <img src="images/לוגו בהלג בלי רקע.png" alt="לוגו" class="sidebar-image" width="36" style="height:auto;">
      </div>
    ` : '';

    const breadcrumbsBlock = !isUnitPage ? `
      <div id="breadcrumb-path" style="display:flex; align-items:center; gap:6px; background:#1e293b; padding:4px 10px; border-radius:6px; border:1px solid #334155; font-size:13px; font-weight:700; color:#38bdf8; white-space:nowrap;"></div>
    ` : '';

    // מזהה הסטטוס לפי העמוד (למנהל בלבד): קשר/אופטיקה/מודיעין/חיפוקים/חדר"ג/שק"ם
    const statusId = isKesher ? 'kesher' : isOptic ? 'optic' : isModiein ? 'modiein'
      : isHipok ? 'hipok' : isHadrag ? 'hadrag' : isShekem ? 'shekem' : '';
    const statusBtnBlock = (!isUnitPage && statusId)
      ? `<button id="status-btn-${statusId}" class="status-btn not-updated" onclick="toggleTableStatus('${statusId}')">✗ לא מעודכן</button>`
      : '';

    // כפתור הדפסה (אפיון 1.6) - זמין בכל עמודי הטבלאות
    const printBtnBlock = '<button class="print-btn" onclick="window.print()" title="הדפס טבלה">🖨️ הדפס</button>';

    // כפתורי בטל/בצע-שוב (אפיון 1.4)
    const undoRedoBlock = `
      <button class="undo-btn" onclick="doUndo()" title="בטל (Ctrl+Z)">↶</button>
      <button class="undo-btn" onclick="doRedo()" title="בצע שוב (Ctrl+Y)">↷</button>`;

    // מרכז התראות - פעמון (אפיון 1.8)
    const bellBlock = `
      <div class="notif-wrap">
        <button class="notif-bell" id="notif-bell" onclick="toggleNotifPanel(event)" title="התראות">🔔<span id="notif-badge" class="notif-badge" style="display:none;">0</span></button>
        <div id="notif-panel" class="notif-panel" style="display:none;"></div>
      </div>`;

    const topNavButtonsBlock = !isMain ? `
      <div class="top-nav-buttons" style="display:flex; align-items:center; gap:8px;">
        <button class="topnav-btn ${isKesher ? 'active' : ''}" id="btn-kesher" onclick="${isUnitPage ? "showTopSection('kesher')" : "window.location.href='kesher.html'"}">קשר</button>
        <button class="topnav-btn ${isOptic ? 'active' : ''}" id="btn-optic" onclick="${isUnitPage ? "showTopSection('optic')" : "window.location.href='optic.html'"}">אופטיקה</button>
        <button class="topnav-btn ${isModiein ? 'active' : ''}" id="btn-modiein" onclick="${isUnitPage ? "showTopSection('modiein')" : "window.location.href='modiein.html'"}">מודיעין</button>
        <button class="topnav-btn ${isHipok ? 'active' : ''}" id="btn-hipok" onclick="${isUnitPage ? "showTopSection('hipok')" : "window.location.href='hipokim.html'"}">חיפוקים</button>
        <button class="topnav-btn ${isHadrag ? 'active' : ''}" id="btn-chadrag" onclick="${isUnitPage ? "showTopSection('chadrag')" : "window.location.href='hadrag.html'"}">חדר"ג</button>
        <button class="topnav-btn ${isShekem ? 'active' : ''}" id="btn-shekem" onclick="${isUnitPage ? "showTopSection('shekem')" : "window.location.href='shekem.html'"}">שעות שקם</button>
        ${bellBlock}
        ${undoRedoBlock}
        ${printBtnBlock}
        ${statusBtnBlock}
        ${!isUnitPage
          ? '<button id="global-export-btn" class="global-export-btn" onclick="globalExportManager()">הפץ שינויים 🚀</button>'
          : '<button id="global-export-btn" class="global-export-btn unit-ready" onclick="globalExportUnit()">שמור ומוכן לייבוא ✅</button>'}
      </div>
    ` : '';

    topNav.innerHTML = `
      <div class="container1">
        <div style="display:flex; align-items:center; gap:12px;">
          ${topNavButtonsBlock}
          ${breadcrumbsBlock}
        </div>
        ${logoBlock}
      </div>
    `;

    updateBreadcrumbPath();
    if (typeof updateNotifBadge === 'function') updateNotifBadge();
  }

  // 2. הזרקת תפריט צדדי (Side Nav)
  if (sideNav) {
    const isTabels = ['tabels', 'kesher', 'optic', 'modiein', 'hipok', 'hadrag', 'shekem'].some(p => currentPage.includes(p));

    const isEsuk = currentPage.includes('esuk');
    const isHirg = currentPage.includes('hirg');
    const isPikud = currentPage.includes('pikud');
    const isTazam = currentPage.includes('tazam');
    const isBahalag = currentPage.includes('bahalag');

    sideNav.innerHTML = `
      <div class="container2 ${isCollapsedStored ? 'collapsed' : ''}" style="margin-top: 0;">
        <button id="sidebar-toggle" class="sidebar-toggle-btn" onclick="toggleSidebar()">
          <span>${isCollapsedStored ? '►' : '◄'}</span>
          <span class="sidebar-text">כווץ תפריט</span>
        </button>

        <button class="sidebar-btn ${isMain ? 'active' : ''}" onclick="window.location.href='index.html'">
          <span>🏠</span> <span class="sidebar-text">ראשי</span>
        </button>
        <button class="sidebar-btn ${isTabels ? 'active' : ''}" onclick="window.location.href='kesher.html'">
          <span>📊</span> <span class="sidebar-text">טבלאות</span>
        </button>
        <button class="sidebar-btn ${currentPage.includes('general') ? 'active' : ''}" onclick="window.location.href='general.html'">
          <span>📗</span> <span class="sidebar-text">אקסל (3 שבועות)</span>
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
          <span>🟠</span> <span class="sidebar-text">ענף תצ"מ</span>
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
          <span>🟣</span> <span class="sidebar-text">מפח"ט</span>
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
 * שומרת את כל נתוני הטבלאות, החיפוקים, החדר"ג והשק"ם עבור השבוע והשנה הנוכחיים ב-DataService (SharePoint / Local).
 */
async function saveCurrentWeek() {
  const tables = getActiveTables();
  for (const tableId of tables) {
    const table = document.getElementById(tableId);
    if (table) {
      const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };
      const key = getStorageKey(tableId, tw.week, tw.year);
      const data = readTableData(tableId);
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(key, data);
      } else {
        localStorage.setItem(key, JSON.stringify(data));
      }
    }
  }
  
  if (typeof saveHipokData === 'function') await saveHipokData();
  if (typeof saveHadragTables === 'function') await saveHadragTables();
  if (typeof saveShekemTables === 'function') await saveShekemTables();
}

/**
 * שולפת אובייקט נתונים לטבלה, תוך שימוש ב-DataService במידה וקיים (גיבוי ב-localStorage).
 * @param {string} key - מפתח הנתונים
 * @returns {Promise<Object|null>}
 */
async function fetchTableData(key) {
  if (typeof DataService !== 'undefined') {
    return await DataService.getItem(key);
  }
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

/**
 * טוענת את נתוני הטבלה המאוחסנים עבור שבוע ושנה ספציפיים מ-DataService, ומעדכנת את שדות הקלט ב-DOM.
 * @param {string} tableId - מזהה הטבלה
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadTableData(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  if (KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId)) {
    renderDynamicTableStructure(tableId, week, year);
  }

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

  const key = getStorageKey(tableId, week, year);
  const data = await fetchTableData(key);

  if (data) {
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
    
    // Check for manager published data to highlight changes in orange
    let managerPublishedData = {};
    if (tableId === 'keshertable' || tableId === 'optictable') {
      const managerPublishedKey = getStorageKey(tableId, week, year) + '_published';
      if (typeof fetchTableData === 'function') {
        managerPublishedData = await fetchTableData(managerPublishedKey) || {};
      } else {
        managerPublishedData = JSON.parse(localStorage.getItem(managerPublishedKey) || '{}');
      }
    }

    Object.keys(data).forEach(indexStr => {
      const idx = parseInt(indexStr);
      if (inputs[idx]) {
        inputs[idx].value = data[indexStr];
        
        // Add conflict-overlap if this is a manager table and value differs from published
        if (tableId === 'keshertable' || tableId === 'optictable') {
          const publishedVal = managerPublishedData[indexStr] || '';
          if (data[indexStr] !== publishedVal) {
            const td = inputs[idx].closest('td');
            if (td) td.classList.add('conflict-overlap');
          }
        }
      }
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

  if (isUnitReqTable(tableId)) recalcUnitReqTotals(table);
}

/* ================================
   ניווט שבועות
================================ */

/**
 * שומרת את השבוע הנוכחי ומעבירה את תצוגת המערכת לשבוע ושנה חדשים.
 * @param {number} year - השנה
 * @param {number} week - מספר השבוע
 */
async function loadWeek(year, week) {
  await saveCurrentWeek();
  currentWeek = week;
  currentYear = year;
  await updateUIForWeek();
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
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
async function updateUIForWeek() {
  const weekInput = document.getElementById('weekInput');
  const weekInputOptic = document.getElementById('weekInputOptic');
  if (weekInput) weekInput.value = currentWeek;
  if (weekInputOptic) weekInputOptic.value = currentWeek;

  const tables = getActiveTables();
  for (const tableId of tables) {
    tableWeeks[tableId] = { week: currentWeek, year: currentYear };
    await loadTableData(tableId, currentWeek, currentYear);
  }

  if (typeof loadHipokData === 'function') await loadHipokData(currentWeek, currentYear);

  recalcAll('keshertable');
  recalcAll('optictable', tableConfigs.optictable);
  checkRequirementChanges('keshertable');
  checkRequirementChanges('optictable');

  renderPageNumbers();

  const haktzaot = document.getElementById('haktzaot');
  if (haktzaot && haktzaot.style.display !== 'none') {
    if (typeof renderHaktzaot === 'function') await renderHaktzaot();
    if (typeof renderHaktzaotOptic === 'function') await renderHaktzaotOptic();
    if (typeof renderHaktzaotEsuk === 'function') await renderHaktzaotEsuk();
    if (typeof renderHaktzaotHirg === 'function') await renderHaktzaotHirg();
    if (typeof renderHaktzaotPikud === 'function') await renderHaktzaotPikud();
    if (typeof renderHaktzaotTazam === 'function') await renderHaktzaotTazam();
    if (typeof renderHaktzaotBahalag === 'function') await renderHaktzaotBahalag();
    if (typeof renderHaktzaotHadrag === 'function') await renderHaktzaotHadrag();
    if (typeof renderHaktzaotShekem === 'function') await renderHaktzaotShekem();
    if (typeof renderHaktzaotHipok === 'function') await renderHaktzaotHipok();
  }

  if (typeof renderHipokEntriesList === 'function') await renderHipokEntriesList();
  
  // פונקציות החדר"ג והשק"ם:
  if (typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if (typeof loadHadragTables === 'function') loadHadragTables(currentWeek, currentYear);
  if (typeof renderHadragPendingRequests === 'function') await renderHadragPendingRequests();
  if (typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  if (typeof loadShekemTables === 'function') loadShekemTables(currentWeek, currentYear);
  if (typeof renderShekemPendingRequests === 'function') await renderShekemPendingRequests();

  await loadTableStatuses();
}

/* ================================
   סטטוס טבלה (מעודכן / לא מעודכן)
   נשמר לפי שבוע ושנה, עקבי עם שאר המערכת.
================================ */
function getTableStatusKey(tableId, week, year) {
  return `status_${tableId}_week${week}_year${year}`;
}

function applyStatusToButton(btn, isUpdated) {
  if (!btn) return;
  btn.classList.toggle('updated', isUpdated);
  btn.classList.toggle('not-updated', !isUpdated);
  btn.textContent = isUpdated ? '✓ מעודכן' : '✗ לא מעודכן';
}

/**
 * טוענת ומחילה את סטטוס הטבלאות (מעודכן/לא) עבור השבוע הנוכחי.
 * סורקת את כל כפתורי הסטטוס בעמוד (id שמתחיל ב-status-btn-).
 */
async function loadTableStatuses() {
  const buttons = document.querySelectorAll('[id^="status-btn-"]');
  for (const btn of buttons) {
    const tableId = btn.id.replace('status-btn-', '');
    let status = null;
    const key = getTableStatusKey(tableId, currentWeek, currentYear);
    if (typeof DataService !== 'undefined') {
      status = await DataService.getItem(key);
    } else {
      const val = localStorage.getItem(key);
      status = val ? JSON.parse(val) : null;
    }
    applyStatusToButton(btn, status === true || status === 'updated');
  }
}

/**
 * מחליפה את סטטוס הטבלה (מעודכן/לא מעודכן) ושומרת לשבוע הנוכחי.
 */
async function toggleTableStatus(tableId) {
  const btn = document.getElementById(`status-btn-${tableId}`);
  const isUpdated = btn ? !btn.classList.contains('updated') : true;
  applyStatusToButton(btn, isUpdated);
  const key = getTableStatusKey(tableId, currentWeek, currentYear);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, isUpdated);
  } else {
    localStorage.setItem(key, JSON.stringify(isUpdated));
  }
}

/**
 * פונקציית ייצוא מנהל: שומרת את הנתונים הנוכחיים למצב 'published'.
 * מנקה צבעים כתומים שסימנו שינויים.
 */
async function globalExportManager() {
  if (!confirm('האם אתה בטוח שברצונך להפיץ את כלל השינויים לשבוע זה? (פעולה זו תאשר את המצב הנוכחי ותנקה סימונים כתומים)')) return;

  const currentPrefix = `week${currentWeek}_year${currentYear}`;
  
  // 1. Copy all draft keys to published
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes(currentPrefix) && !key.includes('_published') && !key.startsWith('status_')) {
      const data = localStorage.getItem(key);
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(`${key}_published`, JSON.parse(data));
      } else {
        localStorage.setItem(`${key}_published`, data);
      }
    }
  }

  // 2. Remove orange highlights
  document.querySelectorAll('.conflict-overlap').forEach(el => {
    el.classList.remove('conflict-overlap');
  });

  // 3. Trigger save again so the orange class removal is saved
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
  if (typeof saveKesherTables === 'function') saveKesherTables();
  if (typeof saveOpticTables === 'function') saveOpticTables();
  if (typeof saveModieinTables === 'function') saveModieinTables();
  if (typeof saveHipokTables === 'function') saveHipokTables();

  if (typeof addNotification === 'function') {
    addNotification(`📢 המנהל הפיץ שינויים לשבוע ${currentWeek} (${currentYear})`, 'distribute');
  }

  alert('השינויים הופצו בהצלחה!');
}

/**
 * בודקת שדה חובה "נושא שבוע" בטבלאות דרישת הקשר של היחידה (אפיון 1.7).
 * אם הוזנה דרישת קשר כלשהי אך שורת "נושא שבוע" נותרה ריקה - מחזירה שגיאה.
 * @returns {{ok: boolean, tableId?: string}}
 */
function validateWeekTopic() {
  const unitKesherIds = KESHER_TABLE_LIST.filter(t => t.id !== 'keshertable').map(t => t.id);
  for (const id of unitKesherIds) {
    const table = document.getElementById(id);
    if (!table) continue;
    const topicRow = table.querySelector('tr.topic-row');
    if (!topicRow) continue;

    const topicInputs = Array.from(topicRow.querySelectorAll('.topic-textarea'));
    const topicFilled = topicInputs.some(t => t.value.trim() !== '');

    // האם הוזנו נתוני דרישה כלשהם (מחוץ לשורת הנושא)?
    let hasRequirementData = false;
    table.querySelectorAll('.cell-input').forEach(inp => {
      if (inp.classList.contains('topic-textarea')) return;
      if (inp.value.trim() !== '') hasRequirementData = true;
    });

    if (hasRequirementData && topicInputs.length && !topicFilled) {
      return { ok: false, tableId: id };
    }
  }
  return { ok: true };
}

/**
 * פונקציית ייצוא פלוגה: שומרת את הטיוטה למצב שמאפשר למנהל לייבא.
 */
async function globalExportUnit() {
  const topicCheck = validateWeekTopic();
  if (!topicCheck.ok) {
    alert('לא ניתן לשמור: שדה "נושא שבוע" בטבלת הקשר הוא שדה חובה. יש למלא אותו לפני שמירה לייבוא.');
    return;
  }

  if (!confirm('האם סיימת את השיבוץ וברצונך לשמור את הנתונים כך שיהיו מוכנים לייבוא על ידי המנהל?')) return;

  const currentPrefix = `week${currentWeek}_year${currentYear}`;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.includes(currentPrefix) && !key.includes('_published') && !key.startsWith('status_')) {
      const data = localStorage.getItem(key);
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(`${key}_published`, JSON.parse(data));
      } else {
        localStorage.setItem(`${key}_published`, data);
      }
    }
  }
  
  if (typeof addNotification === 'function') {
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    const unitName = (typeof UNIT_TITLE_MAP !== 'undefined' && UNIT_TITLE_MAP[page]) || 'יחידה';
    addNotification(`✅ ${unitName} שמרה נתונים מוכנים לייבוא לשבוע ${currentWeek} (${currentYear})`, 'unit-ready');
  }

  alert('הנתונים נשמרו ומוכנים לייבוא!');
}

/* ================================
   העתקת שבוע / הדבקה לכל השנה (אפיון 1.3) - מנהל בלבד
================================ */

// מעתיקה גם את מבנה השורות (rowList) כדי לשמור התאמה בין הנתונים לשמות האמצעים.
function copyRowListToWeek(category, targetWeek, targetYear) {
  const rows = getRowsForWeek(category, currentWeek, currentYear);
  localStorage.setItem(getRowsStorageKey(category, targetWeek, targetYear), JSON.stringify(rows));
}

/**
 * מעתיקה את תוכן טבלת המנהל (קשר/אופטיקה) משבוע הנוכחי לשבוע יעד שנבחר.
 */
async function copyWeekToTarget(tableId) {
  const catName = tableId === 'keshertable' ? 'קשר' : 'אופטיקה';
  const category = tableId === 'keshertable' ? 'kesher' : 'optic';
  const targetStr = prompt(`העתקת נתוני ${catName} משבוע ${currentWeek} (${currentYear}) לשבוע יעד.\nהזן מספר שבוע יעד (1-${TOTAL_WEEKS}):`);
  if (targetStr === null) return;
  const target = parseInt(targetStr);
  if (isNaN(target) || target < 1 || target > TOTAL_WEEKS) { alert('מספר שבוע לא תקין.'); return; }
  if (target === currentWeek) { alert('שבוע היעד זהה לשבוע הנוכחי.'); return; }

  await saveCurrentWeek();
  const data = await fetchTableData(getStorageKey(tableId, currentWeek, currentYear));
  if (!data) { alert('אין נתונים להעתקה בשבוע הנוכחי.'); return; }

  await DataService.setItem(getStorageKey(tableId, target, currentYear), data);
  copyRowListToWeek(category, target, currentYear);
  alert(`הנתונים הועתקו לשבוע ${target} (${currentYear}).`);
}

/**
 * מדביקה את תוכן השבוע הנוכחי לכל השבועות הבאים באותה שנה (דורס נתונים קיימים).
 */
async function applyWeekToRestOfYear(tableId) {
  const catName = tableId === 'keshertable' ? 'קשר' : 'אופטיקה';
  const category = tableId === 'keshertable' ? 'kesher' : 'optic';
  if (currentWeek >= TOTAL_WEEKS) { alert('זהו השבוע האחרון בשנה - אין שבועות הבאים להדבקה.'); return; }
  if (!confirm(`פעולה זו תעתיק את תוכן טבלת ${catName} משבוע ${currentWeek} לכל השבועות ${currentWeek + 1}-${TOTAL_WEEKS} בשנת ${currentYear}, ותדרוס את הנתונים הקיימים בהם.\n\nלהמשיך?`)) return;

  await saveCurrentWeek();
  const data = await fetchTableData(getStorageKey(tableId, currentWeek, currentYear));
  if (!data) { alert('אין נתונים להעתקה בשבוע הנוכחי.'); return; }

  let count = 0;
  for (let w = currentWeek + 1; w <= TOTAL_WEEKS; w++) {
    await DataService.setItem(getStorageKey(tableId, w, currentYear), data);
    copyRowListToWeek(category, w, currentYear);
    count++;
  }
  alert(`הנתונים הועתקו ל-${count} שבועות (${currentWeek + 1}-${TOTAL_WEEKS}).`);
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
async function saveHipokData() {
  const table = document.getElementById('hipoktable');
  if (!table) return;
  const data = readHipokData();
  const key = getStorageKey('hipoktable', currentWeek, currentYear);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, data);
  } else {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

/**
 * טוענת את נתוני טבלת החיפוקים עבור שבוע ושנה נתונים ומעדכנת את שדות הטבלה והצבעים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function loadHipokData(week, year) {
  const table = document.getElementById('hipoktable');
  if (!table) return;

  document.querySelectorAll('#hipoktable .task-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .time-input').forEach(el => el.value = '');
  document.querySelectorAll('#hipoktable .cell-wrapper').forEach(wrapper => { wrapper.className = 'cell-wrapper'; });

  const key = getStorageKey('hipoktable', week, year);
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }
  if (!data) return;

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
 * @returns {Promise<Array<Object>>} מערך אובייקטי בקשות חיפוק
 */
async function loadHipokEntries(week, year) {
  const key = getHipokEntriesKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/**
 * שומרת את רשימת בקשות החיפוקים ב-DataService.
 * @param {Array<Object>} entries - מערך בקשות החיפוק
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function saveHipokEntriesList(entries, week, year) {
  const key = getHipokEntriesKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, entries);
  } else {
    localStorage.setItem(key, JSON.stringify(entries));
  }
}

/**
 * מוסיפה בקשת חיפוק חדשה לרשימה ומעדכנת את השמירה.
 * @param {string} type - סוג החיפוק ('dry' / 'wet')
 * @param {number} day - אינדקס יום (0-6)
 * @param {string} time - מחרוזת שעות
 * @param {string} [text] - פירוט המשימה
 * @param {string} [color] - מחלקת צבע היחידה
 * @returns {Array<Object>} הרשימה המעודכנת
 */
async function addHipokEntry(type, day, time, text = '', color = '') {
  const entries = await loadHipokEntries(currentWeek, currentYear);
  entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type, day, time, text, color });
  await saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ספציפית לפי מזהה ייחודי.
 * @param {string} id - מזהה הבקשה
 * @returns {Array<Object>} הרשימה המעודכנת לאחר המחיקה
 */
async function deleteHipokEntry(id) {
  const entries = (await loadHipokEntries(currentWeek, currentYear)).filter(e => e.id !== id);
  await saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת חיפוק ומעדכנת את התצוגה בעמוד היחידה.
 * @param {string} id - מזהה הבקשה
 */
async function removeHipokEntry(id) {
  await deleteHipokEntry(id);
  if (typeof renderHipokEntriesList === 'function') await renderHipokEntriesList();
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
async function renderHipokEntriesList() {
  const container = document.getElementById('hipokEntriesList');
  if (!container) return;

  const entries = await loadHipokEntries(currentWeek, currentYear);
  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredEntries = entries;
  if (targetColor) {
    filteredEntries = entries.filter(e => e.color === targetColor);
  }

  if (filteredEntries.length === 0) {
    container.innerHTML = '<p style="color:#666; text-align:center; padding: 15px; font-weight:bold;">אין חיפוקים שהוזנו לשבוע זה.</p>';
  } else {
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

  // רענון טבלת ההקצאות אם היא גלויה
  const haktzaotSection = document.getElementById('haktzaot');
  if (haktzaotSection && haktzaotSection.style.display !== 'none') {
    if (typeof renderHaktzaotHipok === 'function') await renderHaktzaotHipok();
  }
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
async function importHipukim() {
  const table = document.getElementById('hipoktable');
  if (!table) { alert('טבלת החיפוקים לא נמצאה'); return; }

  const entries = await loadHipokEntries(currentWeek, currentYear);
  if (entries.length === 0) {
    alert('אין חיפוקים שהוזנו לשבוע זה.');
    return;
  }

  const slotCounters = {};
  const overflow = [];

  entries.forEach(entry => {
    const key = `${entry.type}_${entry.day}`;
    let slot = slotCounters[key] || 0;
    
    let targetCell = null;
    let targetTimeInput = null;
    let targetTaskInput = null;
    let targetWrapper = null;

    // Find the next empty slot that doesn't have manual data
    while (slot < HIPOK_MAX_SLOTS_PER_GROUP) {
      const cell = getHipokTableCell(entry.type, entry.day, slot);
      if (!cell) break;
      
      const timeInput = cell.querySelector('.time-input');
      const taskInput = cell.querySelector('.task-input');
      const wrapper = cell.querySelector('.cell-wrapper');
      
      let isOccupied = false;
      if (timeInput && timeInput.value.trim() !== '') isOccupied = true;
      if (taskInput && taskInput.value.trim() !== '') isOccupied = true;
      if (wrapper && typeof ALL_COLOR_CLASSES !== 'undefined') {
        if (ALL_COLOR_CLASSES.some(c => c !== 'imported' && c !== 'conflict-overlap' && wrapper.classList.contains(c))) {
          isOccupied = true;
        }
      }

      if (!isOccupied) {
        targetCell = cell;
        targetTimeInput = timeInput;
        targetTaskInput = taskInput;
        targetWrapper = wrapper;
        break;
      }
      slot++;
    }

    if (!targetCell) {
      overflow.push(entry);
      slotCounters[key] = slot; // update to where we stopped
      return;
    }

    slotCounters[key] = slot + 1; // start searching from next slot next time

    if (targetTimeInput && entry.time) targetTimeInput.value = entry.time;
    if (targetTaskInput && entry.text) targetTaskInput.value = entry.text;
    
    if (targetWrapper) {
      targetWrapper.classList.add('imported');
      if (typeof ALL_COLOR_CLASSES !== 'undefined') {
        const colorClassesOnly = ALL_COLOR_CLASSES.filter(c => c !== 'imported' && c !== 'conflict-overlap');
        targetWrapper.classList.remove(...colorClassesOnly);
      }
      if (entry.color) targetWrapper.classList.add(entry.color); 
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
  if (isUnitReqTable(tableId)) { tds += `<td class="row-total-cell">0</td>`; }
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
async function importFromSubTable(sourceTableId, targetTableId, targetStartCol, sourceCols) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  const key = getStorageKey(sourceTableId, currentWeek, currentYear) + '_published';
  const data = await fetchTableData(key);
  if (!data) { alert(`אין נתונים מאושרים (לא בוצע ייצוא) לשבוע ${currentWeek}`); return; }
  
  if (!sourceCols) {
    const sourceTable = document.getElementById(sourceTableId);
    sourceCols = sourceTable ? sourceTable.tBodies[0].rows[0].cells.length - 1 : 7;
  }
  
  // Get manager's published data to compare
  const managerPublishedKey = getStorageKey(targetTableId, currentWeek, currentYear) + '_published';
  const managerPublishedData = await fetchTableData(managerPublishedKey) || {};

  const targetRows = target.tBodies[0].rows;
  Object.entries(data).forEach(([indexStr, value]) => {
    if (value === undefined || value === null || value.trim() === '') return;
    const index = parseInt(indexStr);
    const row = Math.floor(index / sourceCols);
    const col = index % sourceCols;
    if (!targetRows[row]) return;
    const targetColIdx = targetStartCol + col;
    const targetCell = targetRows[row].cells[targetColIdx];
    if (targetCell) {
      const input = targetCell.querySelector('.cell-input');
      if (input) {
        input.value = value;
        // Compare with manager's published data
        const globalIndex = row * (targetRows[0].cells.length - 1) + (targetColIdx - 1);
        const publishedVal = managerPublishedData[globalIndex] || '';
        if (value !== publishedVal) {
          targetCell.classList.add('conflict-overlap');
        }
      }
    }
  });
  saveCurrentWeek();
  const ackKey = getAckStorageKey(targetTableId, currentWeek, currentYear);
  const ackSavedRaw = localStorage.getItem(ackKey);
  const ackData = ackSavedRaw ? JSON.parse(ackSavedRaw) : {};
  Object.entries(data).forEach(([indexStr, value]) => {
    const idx = parseInt(indexStr);
    const subVal = value !== undefined && value !== null ? String(value).trim() : '';
    ackData[`${sourceTableId}_${idx}`] = subVal;
  });
  localStorage.setItem(ackKey, JSON.stringify(ackData));

  if (targetTableId === 'keshertable') recalcAll(targetTableId);
  else recalcAll(targetTableId, tableConfigs[targetTableId]);
  checkRequirementChanges(targetTableId);
  alert(`יובאו נתונים בהצלחה`);
}

/**
 * מייבאת נתונים באופן ישיר לטבלאות דינמיות (כגון טבלאות מודיעין).
 * @param {string} sourceTableId - מזהה טבלת המקור
 * @param {string} targetTableId - מזהה טבלת היעד
 */
async function importDirectToTable(sourceTableId, targetTableId) {
  const target = document.getElementById(targetTableId);
  if (!target) return;
  const key = getStorageKey(sourceTableId, currentWeek, currentYear);
  const data = await fetchTableData(key);
  if (!data) { alert(`אין נתונים לשבוע ${currentWeek}`); return; }
  
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

const DEFAULT_KESHER_ROWS = [
  "נושא שבוע", "715/709", "POC", "710", "שקדון", "CF-33", "700", "דיסקית", "סל\"צ", "נתונים",
  "מגבר", "מח-120", "מח-121", "מח-122", "מדונה", "אול\"רים", "מר2791",
  "מזוודת הטענה בומבה", "מזוודת הטענה ליתיום", "משיכה\\זיכוי"
];

const DEFAULT_OPTIC_ROWS = [
  "נושא שבוע", "מת\"ן", "עמית", "עמית איכון", "חצובת עמית", "חצובת תבל", "יובל", "תבל ידני",
  "מיני תבל ידני", "תבל נשלט", "מיני תבל נשלט", "רחפן מטריס 300", "רחפן איבו",
  "רחפן אווטא (ערכה זוגית)", "15X80", "מצפן מעלות", "שטיינר", "צגון", "מצלמת NIKON",
  "איבו אלפא", "התקני הטלה/ כדור ברזל"
];

const KESHER_TABLE_LIST = [
  { id: 'keshertable', dataCols: 49 },
  { id: 'esukkeshertable', dataCols: 7 },
  { id: 'kkeshertable', dataCols: 6 },
  { id: 'pkeshertable', dataCols: 7 },
  { id: 'tkeshertable', dataCols: 8 },
  { id: 'bkeshertable', dataCols: 1 }
];

const OPTIC_TABLE_LIST = [
  { id: 'optictable', dataCols: 34 },
  { id: 'esukoptictable', dataCols: 7 },
  { id: 'koptictable', dataCols: 6 },
  { id: 'poptictable', dataCols: 7 },
  { id: 'toptictable', dataCols: 8 },
  { id: 'boptictable', dataCols: 1 }
];

function getRowsStorageKey(category, week, year) {
  return `rowList_${category}_week${week}_year${year}`;
}

function getRowsForWeek(category, week, year) {
  const key = getRowsStorageKey(category, week, year);
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved);

  if (week > 1) {
    return getRowsForWeek(category, week - 1, year);
  } else if (year > new Date().getFullYear() - 2) {
    const prevYearKey = getRowsStorageKey(category, TOTAL_WEEKS, year - 1);
    const prevYearSaved = localStorage.getItem(prevYearKey);
    if (prevYearSaved) return JSON.parse(prevYearSaved);
  }

  return category === 'kesher' ? [...DEFAULT_KESHER_ROWS] : [...DEFAULT_OPTIC_ROWS];
}

/* ================================
   עמודת "סה"כ" בטבלאות הדרישה היחידתיות (אפיון 1.7)
   מסכמת את כמות האמצעים המבוקשת בכל שורה. לא חלה על טבלאות המנהל.
================================ */
function isUnitReqTable(tableId) {
  const inList = KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId);
  return inList && tableId !== 'keshertable' && tableId !== 'optictable';
}

// מזריקה כותרת "סה"כ" לטבלה (פעם אחת), ומרחיבה את שורת הכותרת העליונה בהתאם.
function ensureUnitTotalHeader(table) {
  const thead = table.tHead;
  if (!thead || thead.rows.length === 0) return;
  if (thead.querySelector('.unit-total-th')) return;

  const labelRow = thead.rows[thead.rows.length - 1];
  const th = document.createElement('th');
  th.className = 'unit-total-th';
  th.textContent = 'סה"כ';
  labelRow.appendChild(th);

  if (thead.rows.length > 1) {
    const topRow = thead.rows[0];
    const lastTh = topRow.cells[topRow.cells.length - 1];
    if (lastTh && lastTh.hasAttribute('colspan')) {
      lastTh.colSpan = lastTh.colSpan + 1;
    } else {
      const extra = document.createElement('th');
      topRow.appendChild(extra);
    }
  }
}

// מחשבת את סכום השורה (מתעלמת משורות "נושא שבוע"/הערה ומתאי טקסט לא-מספריים).
function recalcUnitRowTotal(row) {
  const totalCell = row.querySelector('.row-total-cell');
  if (!totalCell) return;
  if (row.classList.contains('topic-row') || row.classList.contains('special-note-row')) {
    totalCell.textContent = '';
    return;
  }
  let sum = 0;
  row.querySelectorAll('.cell-input').forEach(inp => {
    if (inp.classList.contains('topic-textarea')) return;
    const n = parseFloat(inp.value);
    if (!isNaN(n)) sum += n;
  });
  totalCell.textContent = sum;
}

function recalcUnitReqTotals(table) {
  Array.from(table.tBodies[0].rows).forEach(recalcUnitRowTotal);
}

// עדכון חי של עמודת "סה"כ" בעת הקלדה בטבלאות הדרישה היחידתיות.
document.addEventListener('input', (e) => {
  const inp = e.target;
  if (!inp || !inp.classList || !inp.classList.contains('cell-input')) return;
  const table = inp.closest('table');
  if (!table || !isUnitReqTable(table.id)) return;
  const row = inp.closest('tr');
  if (row) recalcUnitRowTotal(row);
});

function renderDynamicTableStructure(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  let category = null;
  let dataCols = 0;

  const kesherItem = KESHER_TABLE_LIST.find(t => t.id === tableId);
  const opticItem = OPTIC_TABLE_LIST.find(t => t.id === tableId);

  if (kesherItem) {
    category = 'kesher';
    dataCols = kesherItem.dataCols;
  } else if (opticItem) {
    category = 'optic';
    dataCols = opticItem.dataCols;
  } else {
    return;
  }

  const rowsList = getRowsForWeek(category, week, year);
  const tbody = table.tBodies[0];
  if (!tbody) return;

  let tbodyHtml = '';
  const totalCols = dataCols + 1;

  const isMasterTable = (tableId === 'keshertable' || tableId === 'optictable');

  rowsList.forEach((rowName, rowIndex) => {
    let deleteBtnHtml = '';
    if (rowIndex > 0 && isMasterTable) {
      deleteBtnHtml = `<button type="button" class="row-delete-icon" onclick="deleteRowItem('${category}', ${rowIndex})" title="מחק אמצעי משבוע זה והלאה">✕</button>`;
    }

    const isTopicRow = (rowIndex === 0);
    const isSpecialNoteRow = (category === 'kesher' && rowIndex === rowsList.length - 1 && rowName === "משיכה\\זיכוי");
    const isReorderable = isMasterTable && !isTopicRow && !isSpecialNoteRow;
    const rowClasses = [];
    if (isTopicRow) rowClasses.push('topic-row');
    if (isSpecialNoteRow) rowClasses.push('special-note-row');
    if (isReorderable) rowClasses.push('reorderable-row');
    const trClassAttr = rowClasses.length > 0 ? ` class="${rowClasses.join(' ')}"` : '';

    // ידית גרירה לשינוי סדר האמצעים (אפיון 1.6) - טבלת מנהל בלבד
    const dragHandleHtml = isReorderable
      ? `<span class="row-drag-handle" draggable="true" title="גרור לשינוי סדר האמצעי">⠿</span>`
      : '';

    let tds = `<td class="test">${dragHandleHtml}<span class="row-name-text">${rowName}</span> ${deleteBtnHtml}</td>`;
    for (let i = 1; i < totalCols; i++) {
      if (isTopicRow || isSpecialNoteRow) {
        tds += `<td><textarea class="cell-input topic-textarea" rows="1"></textarea></td>`;
      } else {
        tds += `<td><input type="text" class="cell-input"></td>`;
      }
    }
    if (!isMasterTable) {
      if (isTopicRow || isSpecialNoteRow) {
        tds += `<td class="row-total-cell"></td>`;
      } else {
        tds += `<td class="row-total-cell">0</td>`;
      }
    }
    tbodyHtml += `<tr${trClassAttr} data-rowindex="${rowIndex}">${tds}</tr>`;
  });

  tbody.innerHTML = tbodyHtml;

  if (isMasterTable) {
    initRowDragForMasterTable(table, category);
  }

  if (!isMasterTable) {
    ensureUnitTotalHeader(table);
    recalcUnitReqTotals(table);
  }
}

/* ================================
   גרירת שורות בטבלת המנהל (אפיון 1.6)
   שינוי סדר האמצעים; ממופה מחדש בנתונים ומשתקף בטבלאות הפלוגות.
================================ */
function initRowDragForMasterTable(table, category) {
  const tbody = table.tBodies[0];
  if (!tbody) return;
  let dragSrcIndex = null;

  tbody.querySelectorAll('.row-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', (e) => {
      const tr = handle.closest('tr');
      dragSrcIndex = parseInt(tr.dataset.rowindex);
      tr.classList.add('row-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragSrcIndex)); } catch (err) {}
    });
    handle.addEventListener('dragend', () => {
      tbody.querySelectorAll('.row-dragging, .row-drop-target').forEach(el => el.classList.remove('row-dragging', 'row-drop-target'));
    });
  });

  tbody.querySelectorAll('tr.reorderable-row').forEach(tr => {
    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tbody.querySelectorAll('.row-drop-target').forEach(el => el.classList.remove('row-drop-target'));
      tr.classList.add('row-drop-target');
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('row-drop-target'));
    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      tr.classList.remove('row-drop-target');
      const targetIndex = parseInt(tr.dataset.rowindex);
      let src = dragSrcIndex;
      if (src == null || isNaN(src)) {
        const dt = e.dataTransfer.getData('text/plain');
        src = dt ? parseInt(dt) : null;
      }
      if (src != null && !isNaN(src) && src !== targetIndex) {
        reorderCategoryRow(category, src, targetIndex);
      }
    });
  });
}

/**
 * משנה את סדר האמצעים (שורות) עבור השבוע הנוכחי, ממפה מחדש את הנתונים של
 * כל הטבלאות בקטגוריה (מנהל + פלוגות + גרסאות מאושרות) כדי לשמור התאמה.
 */
async function reorderCategoryRow(category, fromIndex, toIndex) {
  const rows = getRowsForWeek(category, currentWeek, currentYear);
  // שורת "נושא שבוע" (0) קבועה בראש - לא ניתנת לגרירה או ליעד
  if (fromIndex <= 0 || toIndex <= 0 || fromIndex >= rows.length || toIndex >= rows.length) return;

  await saveCurrentWeek(); // שמירת עריכות ה-DOM הנוכחיות לפני מיפוי מחדש

  // בניית תמורה (permutation) של אינדקסי השורות
  const order = rows.map((_, i) => i);
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);

  // רשימת אמצעים חדשה
  const newRows = order.map(i => rows[i]);
  localStorage.setItem(getRowsStorageKey(category, currentWeek, currentYear), JSON.stringify(newRows));

  // מיפוי מחדש של הנתונים לכל הטבלאות בקטגוריה
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;
  tableList.forEach(t => {
    ['', '_published'].forEach(suffix => {
      const key = getStorageKey(t.id, currentWeek, currentYear) + suffix;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let data;
      try { data = JSON.parse(raw); } catch (e) { return; }
      const newData = {};
      order.forEach((oldRow, newRow) => {
        for (let c = 0; c < t.dataCols; c++) {
          const oldIdx = oldRow * t.dataCols + c;
          const newIdx = newRow * t.dataCols + c;
          if (data[oldIdx] !== undefined) newData[newIdx] = data[oldIdx];
        }
      });
      localStorage.setItem(key, JSON.stringify(newData));
    });
  });

  // רענון טבלת המנהל הנוכחית
  const masterId = category === 'kesher' ? 'keshertable' : 'optictable';
  await loadTableData(masterId, currentWeek, currentYear);
  recalcAll(masterId, tableConfigs[masterId]);
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
}

function promptAddItemRow(category) {
  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  const itemName = prompt(`הכנס שם אמצעי חדש לטבלאות ${catName} (משבוע ${currentWeek} והלאה):`);
  if (!itemName || !itemName.trim()) return;
  addItemRow(category, itemName.trim());
}

function addItemRow(category, itemName) {
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;

  const snapshots = {};
  const hasExplicitSave = {};
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= TOTAL_WEEKS; w++) {
      const key = getRowsStorageKey(category, w, y);
      snapshots[`${w}_${y}`] = [...getRowsForWeek(category, w, y)];
      hasExplicitSave[`${w}_${y}`] = (localStorage.getItem(key) !== null);
    }
  }

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= TOTAL_WEEKS; w++) {
      const currentList = snapshots[`${w}_${y}`];
      
      let insertIdx = currentList.length;
      if (category === 'kesher' && currentList[currentList.length - 1] === "משיכה\\זיכוי") {
        insertIdx = currentList.length - 1;
      }
      
      const newList = [...currentList];
      newList.splice(insertIdx, 0, itemName);
      
      if ((w === currentWeek && y === currentYear) || hasExplicitSave[`${w}_${y}`]) {
        localStorage.setItem(getRowsStorageKey(category, w, y), JSON.stringify(newList));
      }

      tableList.forEach(t => {
        const key = getStorageKey(t.id, w, y);
        const savedRaw = localStorage.getItem(key);
        if (savedRaw) {
          const oldData = JSON.parse(savedRaw);
          const newData = {};
          const cols = t.dataCols;

          Object.keys(oldData).forEach(idxStr => {
            const idx = parseInt(idxStr);
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            if (r < insertIdx) {
              newData[idx] = oldData[idx];
            } else {
              const newIdx = (r + 1) * cols + c;
              newData[newIdx] = oldData[idx];
            }
          });

          localStorage.setItem(key, JSON.stringify(newData));
        }
      });
    }
  }

  updateUIForWeek();
}

function deleteRowItem(category, rowIndex) {
  const currentList = getRowsForWeek(category, currentWeek, currentYear);
  const itemName = currentList[rowIndex];
  if (!itemName) return;

  if (rowIndex === 0) {
    alert("לא ניתן למחוק את שורת נושא השבוע.");
    return;
  }

  const catName = category === 'kesher' ? 'קשר' : 'אופטיקה';
  if (!confirm(`האם למחוק את האמצעי "${itemName}" מטבלאות ${catName} משבוע ${currentWeek} והלאה?`)) {
    return;
  }

  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;

  const snapshots = {};
  const hasExplicitSave = {};
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= TOTAL_WEEKS; w++) {
      const key = getRowsStorageKey(category, w, y);
      snapshots[`${w}_${y}`] = [...getRowsForWeek(category, w, y)];
      hasExplicitSave[`${w}_${y}`] = (localStorage.getItem(key) !== null);
    }
  }

  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= TOTAL_WEEKS; w++) {
      const listW = snapshots[`${w}_${y}`];
      const targetIdx = listW.indexOf(itemName);
      if (targetIdx === -1) continue;

      const newList = listW.filter((_, idx) => idx !== targetIdx);
      
      if ((w === currentWeek && y === currentYear) || hasExplicitSave[`${w}_${y}`]) {
        localStorage.setItem(getRowsStorageKey(category, w, y), JSON.stringify(newList));
      }

      tableList.forEach(t => {
        const key = getStorageKey(t.id, w, y);
        const savedRaw = localStorage.getItem(key);
        if (savedRaw) {
          const oldData = JSON.parse(savedRaw);
          const newData = {};
          const cols = t.dataCols;

          Object.keys(oldData).forEach(idxStr => {
            const idx = parseInt(idxStr);
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            
            if (r === targetIdx) return;
            
            if (r < targetIdx) {
              newData[idx] = oldData[idx];
            } else if (r > targetIdx) {
              const newIdx = (r - 1) * cols + c;
              newData[newIdx] = oldData[idx];
            }
          });

          localStorage.setItem(key, JSON.stringify(newData));
        }
      });
    }
  }

  updateUIForWeek();
}

const KESHER_ROW_NAMES = DEFAULT_KESHER_ROWS;
const OPTIC_ROW_NAMES = DEFAULT_OPTIC_ROWS;

/**
 * בונה שורות הקצאה לתצוגה בלבד על בסיס נתונים שנשמרו בטבלאות המנהל.
 * @param {Object} data - נתוני הטבלה
 * @param {Array<string>|string} names - שמות השורות או שם הקטגוריה
 * @param {number} totalCols - סך העמודות
 * @param {number} startCol - עמודת התחלה
 * @param {number} endCol - עמודת סיום
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {Array<number>} [specialRowIndices=[0]] - אינדקסים של שורות מיוחדות להדגשה
 */
async function buildHaktzaotRows(data, names, totalCols, startCol, endCol, tbodyId, specialRowIndices = [0]) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (typeof names === 'string') {
    names = await getRowsForWeek(names, currentWeek, currentYear);
  } else if (names === KESHER_ROW_NAMES) {
    names = await getRowsForWeek('kesher', currentWeek, currentYear);
  } else if (names === OPTIC_ROW_NAMES) {
    names = await getRowsForWeek('optic', currentWeek, currentYear);
  }

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

    const isSpecialRow = rowIndex === 0 || (name === "משיכה\\זיכוי");
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

/** מרנדרת הקצאות מודיעין עבור מפח"ט */
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
    if (row.sectionRowIndex === 0 || row.cells[0]?.querySelector('textarea')) continue;
    
    if (tableId === 'keshertable' && row.cells.length >= 50) {
      recalcKesherRow(row);
    } else if (config) {
      recalcRow(row, config);
    }
  }
}

function getAckStorageKey(tableId, week, year) {
  return `mgrAck_${tableId}_week${week}_year${year}`;
}

/**
 * מאתחלת מאזיני אירועי הקלדה בטבלאות לשמירה וחישוב אוטומטי בזמן אמת.
 */
function initTableListeners() {
  const tables = getActiveTables();
  tables.forEach(tableId => {
    const table = document.getElementById(tableId);
    if (table) {
      table.addEventListener('input', (e) => {
        saveCurrentWeek();
        if (tableId === 'keshertable') recalcAll('keshertable');
        else if (tableConfigs[tableId]) recalcAll(tableId, tableConfigs[tableId]);
        if (tableId === 'keshertable' || tableId === 'optictable') {
          const targetInput = e.target;
          if (targetInput && targetInput.dataset && targetInput.dataset.subTableId !== undefined) {
            const subTableId = targetInput.dataset.subTableId;
            const subIndex = targetInput.dataset.subIndex;
            const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };
            const subKey = getStorageKey(subTableId, tw.week, tw.year);
            const subSavedRaw = localStorage.getItem(subKey);
            const subData = subSavedRaw ? JSON.parse(subSavedRaw) : {};
            const subVal = subData[subIndex] !== undefined ? String(subData[subIndex]).trim() : '';

            const ackKey = getAckStorageKey(tableId, tw.week, tw.year);
            const ackSavedRaw = localStorage.getItem(ackKey);
            const ackData = ackSavedRaw ? JSON.parse(ackSavedRaw) : {};
            ackData[`${subTableId}_${subIndex}`] = subVal;
            localStorage.setItem(ackKey, JSON.stringify(ackData));
          }
          checkRequirementChanges(tableId);
        }
      });
    }
  });
  
  const hipok = document.getElementById('hipoktable');
  if (hipok) hipok.addEventListener('input', () => {
    if (typeof saveHipokData === 'function') saveHipokData();
  });
}

/* ================================
   בדיקת שינויי דרישה (קשר ואופטיקה)
================================ */

const SUB_TABLE_MAPS = {
  keshertable: [
    { sourceTableId: 'esukkeshertable', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'kkeshertable', targetStartCol: 11, sourceCols: 6 },
    { sourceTableId: 'pkeshertable', targetStartCol: 20, sourceCols: 7 },
    { sourceTableId: 'tkeshertable', targetStartCol: 30, sourceCols: 8 },
    { sourceTableId: 'bkeshertable', targetStartCol: 41, sourceCols: 1 }
  ],
  optictable: [
    { sourceTableId: 'esukoptictable', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'koptictable', targetStartCol: 8, sourceCols: 6 },
    { sourceTableId: 'poptictable', targetStartCol: 14, sourceCols: 7 },
    { sourceTableId: 'toptictable', targetStartCol: 21, sourceCols: 8 },
    { sourceTableId: 'boptictable', targetStartCol: 29, sourceCols: 1 }
  ]
};

/**
 * בודקת וצובעת משבצות בטבלאות קשר ואופטיקה שבהן דרישת היחידה השתנתה ביחס לשיוך/אישור המנהל.
 * @param {string} tableId - מזהה הטבלה ('keshertable' / 'optictable')
 */
function checkRequirementChanges(tableId) {
  const table = document.getElementById(tableId);
  if (!table || !table.tBodies[0]) return;
  const configs = SUB_TABLE_MAPS[tableId];
  if (!configs) return;

  const targetRows = table.tBodies[0].rows;
  const tw = tableWeeks[tableId] || { week: currentWeek, year: currentYear };

  const ackKey = getAckStorageKey(tableId, tw.week, tw.year);
  const ackSavedRaw = localStorage.getItem(ackKey);
  const ackData = ackSavedRaw ? JSON.parse(ackSavedRaw) : {};

  configs.forEach(config => {
    const subKey = getStorageKey(config.sourceTableId, tw.week, tw.year);
    const subSavedRaw = localStorage.getItem(subKey);
    const subData = subSavedRaw ? JSON.parse(subSavedRaw) : {};

    for (let r = 0; r < targetRows.length; r++) {
      const row = targetRows[r];
      if (r === 0 || row.classList.contains('topic-row') || row.classList.contains('special-note-row') || row.cells[0]?.querySelector('textarea')) {
        continue;
      }
      for (let c = 0; c < config.sourceCols; c++) {
        const subIndex = r * config.sourceCols + c;
        const subVal = subData[subIndex] !== undefined ? String(subData[subIndex]).trim() : '';
        const targetCell = row.cells[config.targetStartCol + c];
        if (!targetCell) continue;
        const input = targetCell.querySelector('.cell-input');
        if (!input) continue;

        input.dataset.subTableId = config.sourceTableId;
        input.dataset.subIndex = subIndex;

        const ackVal = ackData[`${config.sourceTableId}_${subIndex}`];

        let isChanged = false;
        if (ackVal === undefined) {
          if (subVal !== '') {
            isChanged = true;
          }
        } else {
          if (subVal !== ackVal) {
            isChanged = true;
          }
        }

        if (isChanged) {
          input.classList.add('req-changed');
          targetCell.classList.add('req-changed-td');
          input.title = `הדרישה עודכנה ביחידה ל: ${subVal || 'ריק'}`;
        } else {
          input.classList.remove('req-changed');
          targetCell.classList.remove('req-changed-td');
          input.removeAttribute('title');
        }
      }
    }
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
 * @returns {Promise<Array<Object>>} מערך בקשות חדר"ג
 */
async function loadHadragRequests(week, year) {
  const key = getHadragRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/**
 * שומרת את בקשות החדר"ג ב-DataService.
 * @param {Array<Object>} requests - מערך בקשות חדר"ג
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function saveHadragRequests(requests, week, year) {
  const key = getHadragRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, requests);
  } else {
    localStorage.setItem(key, JSON.stringify(requests));
  }
}

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
  'bahalag.html': 'מפח"ט'
};

/**
 * מגישה בקשת שיבוץ חדר"ג חדשה מטעם יחידה ושומרת אותה כממתינה לאישור.
 * @param {string} [unitClass] - מחלקת צבע היחידה
 * @param {string} [unitName] - שם היחידה
 */
async function submitHadragRequest(unitClass, unitName) {
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

  const requests = await loadHadragRequests(currentWeek, currentYear);
  requests.push({ id: Date.now().toString(36), facility, text, day, startTime, endTime, unit: unitClass, unitName: unitName, status: 'pending' });
  await saveHadragRequests(requests, currentWeek, currentYear);

  document.getElementById('hadragTextInput').value = '';
  document.getElementById('hadragStartTime').value = '';
  document.getElementById('hadragEndTime').value = '';
  
  if(typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
}

/**
 * מוחקת בקשת חדר"ג ומעדכנת את הרשימות בתצוגה.
 * @param {string} id - מזהה הבקשה
 */
async function deleteHadragRequest(id) {
  const requests = (await loadHadragRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveHadragRequests(requests, currentWeek, currentYear);
  if(typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if(typeof renderHadragPendingRequests === 'function') await renderHadragPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות החדר"ג שהוגשו עבור עמוד היחידה הנוכחי.
 */
async function renderHadragRequestsList() {
  const container = document.getElementById('hadragRequestsList');
  if (!container) return;

  const requests = await loadHadragRequests(currentWeek, currentYear);
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
async function renderHadragPendingRequests() {
  const container = document.getElementById('hadragPendingList');
  if (!container) return; 

  const allRequests = await loadHadragRequests(currentWeek, currentYear);
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
async function approveHadragRequest(reqId) {
  const requests = await loadHadragRequests(currentWeek, currentYear);
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
  await saveHadragRequests(requests, currentWeek, currentYear);
  if (typeof saveHadragTables === 'function') saveHadragTables(); 
  await renderHadragPendingRequests(); 
}

/**
 * דוחה ומודקת בקשת חדר"ג לאחר אישור המשתמש.
 * @param {string} reqId - מזהה הבקשה
 */
async function rejectHadragRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    await deleteHadragRequest(reqId);
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
async function loadHadragTables(week, year) {
  const TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
  if (typeof generateTimeSlots !== 'function') return;

  for (const tableId of TABLE_IDS) {
    const tbody = document.getElementById(tableId);
    if (!tbody) continue;
    
    tbody.innerHTML = '';
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
  }
}

/* =========================================================
   מערכת שק"ם
========================================================= */

/** מפיקה מפתח שמירה לבקשות שק"ם */
function getShekemRequestsKey(week, year) { return `shekemRequests_week${week}_year${year}`; }

/** טוענת את בקשות השק"ם לשבוע ושנה נתונים */
async function loadShekemRequests(week, year) {
  const key = getShekemRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    const data = await DataService.getItem(key);
    return data || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

/** שומרת את בקשות השק"ם ב-DataService */
async function saveShekemRequests(requests, week, year) {
  const key = getShekemRequestsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, requests);
  } else {
    localStorage.setItem(key, JSON.stringify(requests));
  }
}

/**
 * מגישה בקשת שעות שק"ם חדשה מטעם יחידה.
 * @param {string} [unitClass] - מחלקת צבע היחידה
 * @param {string} [unitName] - שם היחידה
 */
async function submitShekemRequest(unitClass, unitName) {
  const text = document.getElementById('shekemTextInput').value.trim();
  const day = parseInt(document.getElementById('shekemDayInput').value);
  const startTime = document.getElementById('shekemStartTime').value;
  const endTime = document.getElementById('shekemEndTime').value;

  if (!text || !startTime || !endTime) { alert('יש למלא את כל השדות.'); return; }
  if (startTime >= endTime) { alert('שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.'); return; }

  const currentPage = window.location.pathname.split('/').pop();
  if (!unitClass) unitClass = PAGE_UNIT_MAP[currentPage] || 'bg-esuk';
  if (!unitName) unitName = PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק';

  const requests = await loadShekemRequests(currentWeek, currentYear);
  requests.push({ id: Date.now().toString(36), text, day, startTime, endTime, unit: unitClass, unitName: unitName, status: 'pending' });
  await saveShekemRequests(requests, currentWeek, currentYear);

  document.getElementById('shekemTextInput').value = '';
  document.getElementById('shekemStartTime').value = '';
  document.getElementById('shekemEndTime').value = '';
  
  if(typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
}

/**
 * מוחקת בקשת שק"ם ומעדכנת את התצוגות.
 * @param {string} id - מזהה הבקשה
 */
async function deleteShekemRequest(id) {
  const requests = (await loadShekemRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveShekemRequests(requests, currentWeek, currentYear);
  if(typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  if(typeof renderShekemPendingRequests === 'function') await renderShekemPendingRequests();
}

/**
 * מרנדרת את רשימת בקשות השק"ם בעמוד היחידה.
 */
async function renderShekemRequestsList() {
  const container = document.getElementById('shekemRequestsList');
  if (!container) return;

  const requests = await loadShekemRequests(currentWeek, currentYear);
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
async function renderShekemPendingRequests() {
  const container = document.getElementById('shekemPendingList');
  if (!container) return; 

  const allRequests = await loadShekemRequests(currentWeek, currentYear);
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
async function approveShekemRequest(reqId) {
  const requests = await loadShekemRequests(currentWeek, currentYear);
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
    textarea.style.height = '100%';
    textarea.value = req.text;
    const unitClass = req.unit || 'bg-esuk';
    firstCell.classList.add(unitClass, 'imported');
  }

  req.status = 'approved';
  await saveShekemRequests(requests, currentWeek, currentYear);
  if (typeof saveShekemTables === 'function') saveShekemTables(); 
  await renderShekemPendingRequests(); 
}

/**
 * דוחה בקשת שק"ם ומוחקת אותה.
 * @param {string} reqId - מזהה הבקשה
 */
async function rejectShekemRequest(reqId) {
  if (confirm('האם אתה בטוח שברצונך לדחות ולמחוק בקשה זו?')) {
    await deleteShekemRequest(reqId);
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
async function loadShekemTables(week, year) {
  if (typeof generateTimeSlots !== 'function') return;
  const tbody = document.getElementById('body-shekem');
  if (!tbody) return;
  
  tbody.innerHTML = '';
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
          textarea.style.height = '100%';
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

  Promise.resolve(updateUIForWeek()).then(() => {
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
  });

  if (typeof DataService !== 'undefined') {
    DataService.startAutoSync(async () => {
      await updateUIForWeek();
    });
  }

  window.addEventListener('storage', () => {
    checkRequirementChanges('keshertable');
    checkRequirementChanges('optictable');
  });
};

/* =========================================================
   מנגנון בטל / בצע שוב (Undo / Redo) - אפיון 1.4
   מבוסס צילומי-מצב (snapshots) של שדות העריכה בעמוד.
========================================================= */
let _undoStack = [];
let _redoStack = [];
let _undoCurrentState = null;
let _undoSuppressed = false;
let _undoRecordTimer = null;
const UNDO_LIMIT = 100;

function _getUndoFields() {
  return Array.from(document.querySelectorAll('.cell-input, .task-input, .time-input'));
}

function _captureUndoState() {
  return _getUndoFields().map(el => el.value);
}

function _applyUndoState(values) {
  const fields = _getUndoFields();
  if (fields.length !== values.length) {
    // מבנה הטבלה השתנה (נוספו/הוסרו שורות) - לא ניתן לשחזר בבטחה.
    return false;
  }
  _undoSuppressed = true;
  fields.forEach((el, i) => {
    if (el.value !== values[i]) {
      el.value = values[i];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  _undoSuppressed = false;
  return true;
}

// מאפסת את ההיסטוריה ומגדירה את מצב הבסיס הנוכחי (נקרא בעת מעבר שבוע/טעינה).
function resetUndoHistory() {
  _undoStack = [];
  _redoStack = [];
  _undoCurrentState = _captureUndoState();
}

// רושמת שינוי (מדורג) - דוחפת את המצב הקודם למחסנית הביטול.
function _recordUndoChange() {
  if (_undoSuppressed) return;
  clearTimeout(_undoRecordTimer);
  _undoRecordTimer = setTimeout(() => {
    const newState = _captureUndoState();
    if (_undoCurrentState && JSON.stringify(newState) !== JSON.stringify(_undoCurrentState)) {
      _undoStack.push(_undoCurrentState);
      if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
      _redoStack = [];
    }
    _undoCurrentState = newState;
  }, 350);
}

function doUndo() {
  clearTimeout(_undoRecordTimer);
  // אם יש שינוי שטרם נרשם (בתוך זמן ההשהיה), נרשום אותו קודם.
  const live = _captureUndoState();
  if (_undoCurrentState && JSON.stringify(live) !== JSON.stringify(_undoCurrentState)) {
    _undoStack.push(_undoCurrentState);
    _undoCurrentState = live;
  }
  if (!_undoStack.length) return;
  const prev = _undoStack.pop();
  if (_applyUndoState(prev)) {
    _redoStack.push(_undoCurrentState);
    _undoCurrentState = prev;
    if (typeof saveCurrentWeek === 'function') saveCurrentWeek();
  }
}

function doRedo() {
  clearTimeout(_undoRecordTimer);
  if (!_redoStack.length) return;
  const next = _redoStack.pop();
  if (_applyUndoState(next)) {
    _undoStack.push(_undoCurrentState);
    _undoCurrentState = next;
    if (typeof saveCurrentWeek === 'function') saveCurrentWeek();
  }
}

// רישום שינויים בעת הקלדה בשדות העריכה.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el && el.classList && (el.classList.contains('cell-input') || el.classList.contains('task-input') || el.classList.contains('time-input'))) {
    _recordUndoChange();
  }
});

// קיצורי מקלדת: Ctrl+Z לביטול, Ctrl+Y או Ctrl+Shift+Z לביצוע חוזר.
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    doUndo();
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    e.preventDefault();
    doRedo();
  }
});

/* =========================================================
   מרכז התראות (Notification Center) - אפיון 1.8
========================================================= */
const NOTIF_KEY = 'pakadex_notifications';

function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveNotifications(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(-100)));
}

/**
 * מוסיפה התראה חדשה למרכז ההתראות ומעדכנת את החיווי.
 */
function addNotification(message, type = 'info') {
  const list = loadNotifications();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    message, type, ts: Date.now(), read: false
  });
  saveNotifications(list);
  updateNotifBadge();
}

function getUnreadCount() {
  return loadNotifications().filter(n => !n.read).length;
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const count = getUnreadCount();
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function _formatNotifTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const list = loadNotifications().slice().reverse();
  let body;
  if (list.length === 0) {
    body = '<div class="notif-empty">אין התראות</div>';
  } else {
    body = list.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${_formatNotifTime(n.ts)}</div>
      </div>`).join('');
  }
  panel.innerHTML = `
    <div class="notif-header">
      <span>התראות</span>
      <button class="notif-clear" onclick="clearNotifications(event)">נקה הכל</button>
    </div>
    <div class="notif-list">${body}</div>`;
}

function toggleNotifPanel(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
    return;
  }
  renderNotifPanel();
  panel.style.display = 'block';
  // סימון כל ההתראות כנקראו
  const list = loadNotifications();
  let changed = false;
  list.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
  if (changed) { saveNotifications(list); }
  setTimeout(updateNotifBadge, 1500);
}

function clearNotifications(e) {
  if (e) e.stopPropagation();
  saveNotifications([]);
  renderNotifPanel();
  updateNotifBadge();
}

// סגירת הפאנל בלחיצה מחוץ אליו.
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  if (!panel || panel.style.display === 'none') return;
  if (e.target.closest('.notif-wrap')) return;
  panel.style.display = 'none';
});

/* =========================================================
   הקצאות מתקדמות (חדר"ג, שק"ם, חיפוקים) לפי צבע יחידה
========================================================= */

function rowToTimeStr(r) {
  const hour = Math.floor(6 + r / 2).toString().padStart(2, '0');
  const minutes = r % 2 === 0 ? '00' : '30';
  return `${hour}:${minutes}`;
}

const DAYS_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HADRAG_TABLES_MAP = {
  'body-chadrag': 'חדר"ג',
  'body-anafit8': 'אנפית 8',
  'body-anafit-bah': 'אנפית בא"ח',
  'body-tavor': 'תבור'
};

async function getHadragAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  const tableIds = Object.keys(HADRAG_TABLES_MAP);

  for (const tableId of tableIds) {
    const key = `hadragData_${tableId}_week${week}_year${year}`;
    let data = null;
    if (typeof DataService !== 'undefined') {
      data = await DataService.getItem(key);
    } else {
      const saved = localStorage.getItem(key);
      if (saved) data = JSON.parse(saved);
    }

    if (!data) continue;

    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 36; r++) {
        const cellData = data[`${r}_${c}`];
        if (cellData && cellData.classes && cellData.classes.includes(unitColor)) {
          const span = cellData.span || 1;
          const startTime = rowToTimeStr(r);
          const endTime = rowToTimeStr(r + span);
          
          allocations.push({
            day: DAYS_NAMES[c],
            facility: HADRAG_TABLES_MAP[tableId],
            startTime: startTime,
            endTime: endTime,
            text: cellData.val || ''
          });
          
          r += (span - 1);
        }
      }
    }
  }
  return allocations;
}

async function getShekemAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  const key = `shekemData_body-shekem_week${week}_year${year}`;
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }

  if (!data) return allocations;

  for (let c = 0; c < 7; c++) {
    for (let r = 0; r < 36; r++) {
      const cellData = data[`${r}_${c}`];
      if (cellData && cellData.classes && cellData.classes.includes(unitColor)) {
        const span = cellData.span || 1;
        const startTime = rowToTimeStr(r);
        const endTime = rowToTimeStr(r + span);
        
        allocations.push({
          day: DAYS_NAMES[c],
          startTime: startTime,
          endTime: endTime,
          text: cellData.val || ''
        });
        
        r += (span - 1);
      }
    }
  }
  return allocations;
}

async function getHipokimAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  const key = getStorageKey('hipoktable', week, year);
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }

  if (!data) return allocations;

  const DAY_LABELS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

  // הטבלה ב-hipokim.html מכילה 12 שורות כפול 7 ימים = 84 תאים
  // אינדקסים 0-41 הם חיפוק יבש (6 שורות)
  // אינדקסים 42-83 הם חיפוק רטוב (6 שורות)
  for (let i = 0; i < 84; i++) {
    const taskColor = data[`color_${i}`] || '';
    if (taskColor === unitColor) {
      const typeText = i < 42 ? 'חיפוק יבש' : 'חיפוק רטוב';
      const dayIndex = i % 7;
      const dayText = DAY_LABELS[dayIndex] || '';
      
      const taskText = data[`task_${i}`] || '';
      const timeText = data[`time_${i}`] || '';
      
      const fullTask = typeText + (taskText ? ' - ' + taskText : '');
      
      allocations.push({
        task: fullTask,
        day: dayText,
        time: timeText
      });
    }
  }
  
  return allocations;
}

async function renderUnitHaktzaotExtra(tbodyId, type, unitColor) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  // צבע כותרת הטבלה לפי הקבוצה
  const colorInfo = (typeof UNIT_BG_MAP !== 'undefined' && UNIT_BG_MAP[unitColor]) || null;
  const theadThs = tbody.closest('table')?.querySelectorAll('thead th') || [];
  if (colorInfo) {
    theadThs.forEach(th => {
      th.style.backgroundColor = colorInfo.bg;
      th.style.color = colorInfo.text;
      th.style.borderColor = colorInfo.border;
    });
  }

  if (type === 'hadrag') {
    const allocations = await getHadragAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold;">${a.facility}</td>
        <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
        <td style="text-align:center;">${a.text.replace(/\\n/g, '<br>')}</td>
      </tr>`;
    });
  } 
  else if (type === 'shekem') {
    const allocations = await getShekemAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
        <td style="text-align:center;">${a.text.replace(/\\n/g, '<br>')}</td>
      </tr>`;
    });
  }
  else if (type === 'hipokim') {
    const allocations = await getHipokimAllocationsForUnit(unitColor, currentWeek, currentYear);
    if (allocations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>';
      return;
    }
    allocations.forEach(a => {
      tbody.innerHTML += `<tr>
        <td style="text-align:center; font-weight:bold;">${a.day}</td>
        <td style="text-align:center; font-weight:bold;">${a.task}</td>
        <td style="text-align:center; font-weight:bold;">${a.time}</td>
      </tr>`;
    });
  }
}

/* =========================================================
   Excel-like Features: Drag & Drop, Copy & Paste
========================================================= */
let hadragClipboard = null;

function isHadragCell(cell) {
  return cell && cell.classList && cell.classList.contains('platoon-cell');
}

function clearHadragCellData(cell) {
  const tbody = cell.closest('tbody');
  const startRow = parseInt(cell.dataset.row);
  const col = parseInt(cell.dataset.col);
  const span = cell.rowSpan || 1;
  
  cell.rowSpan = 1;
  cell.className = 'platoon-cell';
  const ta = cell.querySelector('textarea');
  if (ta) {
    ta.value = '';
    ta.style.height = '100%';
  }
  
  for (let i = startRow + 1; i < startRow + span; i++) {
    const hiddenCell = tbody ? tbody.querySelector(`td.platoon-cell[data-row="${i}"][data-col="${col}"]`) : null;
    if (hiddenCell) {
      hiddenCell.style.display = '';
      hiddenCell.rowSpan = 1;
      hiddenCell.className = 'platoon-cell';
      const hiddenTa = hiddenCell.querySelector('textarea');
      if (hiddenTa) hiddenTa.value = '';
    }
  }
}

function pasteOrMoveBlock(targetCell, dataObj, preventOverwrite = false) {
  const tbody = targetCell.closest('tbody');
  const startRow = parseInt(targetCell.dataset.row);
  const col = parseInt(targetCell.dataset.col);
  const endRow = Math.min(35, startRow + dataObj.rowSpan - 1);
  const actualSpan = endRow - startRow + 1;
  
  if (preventOverwrite) {
    let hasConflict = false;
    for (let r = startRow; r <= endRow; r++) {
      const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
      if (!c) continue;
      if (c.style.display === 'none') { hasConflict = true; break; }
      const ta = c.querySelector('textarea');
      if (ta && ta.value.trim() !== '') { hasConflict = true; break; }
      if (typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
    }
    if (hasConflict) {
      alert('לא ניתן לבצע: השטח חופף לשיבוץ קיים. נא לפנות את השעות תחילה.');
      return false;
    }
  }
  
  // 1. Clear target space
  for (let r = startRow; r <= endRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (c && c.style.display !== 'none') {
       clearHadragCellData(c);
    }
  }
  
  // 2. Hide cells for merge
  for (let r = startRow + 1; r <= endRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (c) {
      c.style.display = 'none';
      c.rowSpan = 1;
      c.className = 'platoon-cell';
    }
  }
  
  // 3. Apply data
  targetCell.rowSpan = actualSpan;
  targetCell.className = 'platoon-cell';
  targetCell.classList.add('merged');
  if (dataObj.cellClass) {
    dataObj.cellClass.forEach(cls => {
      if(cls !== 'merged' && cls !== 'platoon-cell') {
        targetCell.classList.add(cls);
      }
    });
  }
  
  const ta = targetCell.querySelector('textarea');
  if (ta) {
    ta.value = dataObj.text;
    ta.style.height = '100%';
  }
  
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
}

// 1. Copy and Paste (Ctrl+C, Ctrl+V)
document.addEventListener('keydown', function(e) {
  if (!e.ctrlKey) return;
  const activeElement = document.activeElement;
  let cell = null;
  
  if (typeof activeSelectedCell !== 'undefined' && activeSelectedCell) {
    cell = activeSelectedCell;
  } else if (activeElement && activeElement.tagName === 'TEXTAREA') {
    cell = activeElement.closest('td.platoon-cell');
  } else if (activeElement && isHadragCell(activeElement)) {
    cell = activeElement;
  }
  
  if (!cell) {
    const hoverEl = document.querySelector('td.platoon-cell:hover');
    if (hoverEl) cell = hoverEl;
  }
  if (!cell) return;
  
  if (e.code === 'KeyC' || e.key.toLowerCase() === 'c' || e.key === 'ב') {
    e.preventDefault();
    const ta = cell.querySelector('textarea');
    hadragClipboard = {
      text: ta ? ta.value : '',
      rowSpan: cell.rowSpan || 1,
      cellClass: Array.from(cell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle')
    };
    cell.style.outline = '3px dashed #0284c7';
    cell.style.outlineOffset = '-3px';
    setTimeout(() => cell.style.outline = '', 600);
  } else if (e.code === 'KeyV' || e.key.toLowerCase() === 'v' || e.key === 'ה') {
    e.preventDefault();
    if (!hadragClipboard) return;
    pasteOrMoveBlock(cell, hadragClipboard, true);
    if (typeof selectCell === 'function') selectCell(cell);
  }
});

// 2. HTML5 Drag & Drop
let draggedHadragData = null;
let draggedSourceCell = null;

document.addEventListener('mouseover', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (cell && typeof isDragging !== 'undefined' && !isDragging) {
    const ta = cell.querySelector('textarea');
    const hasContent = ta && ta.value.trim() !== '';
    const hasColor = typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => cell.classList.contains(cls));
    if (hasContent || hasColor) {
      cell.setAttribute('draggable', 'true');
    } else {
      cell.removeAttribute('draggable');
    }
  }
});

document.addEventListener('dragstart', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;
  
  const ta = cell.querySelector('textarea');
  draggedHadragData = {
    text: ta ? ta.value : '',
    rowSpan: cell.rowSpan || 1,
    cellClass: Array.from(cell.classList)
  };
  draggedSourceCell = cell;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'hadrag-cell');
  setTimeout(() => cell.style.opacity = '0.5', 0);
});

document.addEventListener('dragover', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (cell && draggedHadragData) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
});

document.addEventListener('dragend', function(e) {
  if (draggedSourceCell) draggedSourceCell.style.opacity = '1';
  draggedHadragData = null;
  draggedSourceCell = null;
});

document.addEventListener('drop', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell || !draggedHadragData) return;
  e.preventDefault();
  
  if (draggedSourceCell && draggedSourceCell !== cell) {
    const tbody = cell.closest('tbody');
    const startRow = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);
    const endRow = Math.min(35, startRow + draggedHadragData.rowSpan - 1);
    
    const srcStart = parseInt(draggedSourceCell.dataset.row);
    const srcEnd = srcStart + (draggedSourceCell.rowSpan || 1) - 1;
    const srcCol = parseInt(draggedSourceCell.dataset.col);
    
    let hasConflict = false;
    for (let r = startRow; r <= endRow; r++) {
      if (col === srcCol && r >= srcStart && r <= srcEnd) continue;
      
      const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
      if (!c) continue;
      if (c.style.display === 'none') { hasConflict = true; break; }
      const ta = c.querySelector('textarea');
      if (ta && ta.value.trim() !== '') { hasConflict = true; break; }
      if (typeof ALL_COLOR_CLASSES !== 'undefined' && ALL_COLOR_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
    }
    
    if (hasConflict) {
      alert('לא ניתן להזיז: השטח חופף לשיבוץ קיים.');
      return;
    }
    
    clearHadragCellData(draggedSourceCell);
    pasteOrMoveBlock(cell, draggedHadragData, false);
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();
  }
});

/* =========================================================
   Excel-like Selection and Resizing Handle
========================================================= */
let activeSelectedCell = null;
let isResizing = false;
let resizeStartCell = null;
let resizeCurrentRow = -1;
let resizePreviewElement = null;

function clearSelection() {
  if (activeSelectedCell) {
    activeSelectedCell.classList.remove('selected-cell');
    const handle = activeSelectedCell.querySelector('.resize-handle');
    if (handle) handle.remove();
    activeSelectedCell = null;
  }
}

function selectCell(cell) {
  if (!cell || cell === activeSelectedCell) return;
  clearSelection();
  
  activeSelectedCell = cell;
  cell.classList.add('selected-cell');
  
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.addEventListener('mousedown', startResize);
  handle.addEventListener('click', e => e.stopPropagation());
  
  cell.appendChild(handle);
}

document.addEventListener('mousedown', function(e) {
  if (e.target.classList.contains('resize-handle')) return;
  
  const cell = e.target.closest('td.platoon-cell');
  if (cell) {
    selectCell(cell);
  } else {
    clearSelection();
  }
});

function startResize(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!activeSelectedCell) return;
  
  isResizing = true;
  resizeStartCell = activeSelectedCell;
  
  resizePreviewElement = document.createElement('div');
  resizePreviewElement.style.position = 'absolute';
  resizePreviewElement.style.border = '2px dashed #22c55e';
  resizePreviewElement.style.pointerEvents = 'none';
  resizePreviewElement.style.zIndex = '100';
  resizePreviewElement.style.background = 'rgba(34, 197, 94, 0.1)';
  document.body.appendChild(resizePreviewElement);
  
  updateResizePreview(e);
}

document.addEventListener('mousemove', function(e) {
  if (!isResizing || !resizeStartCell) return;
  
  const tbody = resizeStartCell.closest('tbody');
  
  for (let i = 0; i < tbody.rows.length; i++) {
    const tr = tbody.rows[i];
    const timeCell = tr.firstElementChild;
    if (timeCell) {
      const rect = timeCell.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        resizeCurrentRow = i;
        break;
      }
    }
  }
  
  const startRow = parseInt(resizeStartCell.dataset.row);
  if (resizeCurrentRow < startRow && resizeCurrentRow !== -1) {
    resizeCurrentRow = startRow;
  }
  
  updateResizePreview(e);
});

function updateResizePreview(e) {
  if (!resizeStartCell || !resizePreviewElement) return;
  
  const startRow = parseInt(resizeStartCell.dataset.row);
  let endRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (endRow < startRow) endRow = startRow;
  
  const tbody = resizeStartCell.closest('tbody');
  const col = parseInt(resizeStartCell.dataset.col);
  
  const startDom = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
  if (!startDom) return;
  const startRect = startDom.getBoundingClientRect();
  
  const endTr = tbody.rows[endRow];
  if (endTr) {
    const timeCellEnd = endTr.firstElementChild;
    if (timeCellEnd) {
      const endRect = timeCellEnd.getBoundingClientRect();
      resizePreviewElement.style.top = startRect.top + window.scrollY + 'px';
      resizePreviewElement.style.left = startRect.left + window.scrollX + 'px';
      resizePreviewElement.style.width = startRect.width + 'px';
      resizePreviewElement.style.height = (endRect.bottom - startRect.top) + 'px';
    }
  }
}

document.addEventListener('mouseup', function(e) {
  if (!isResizing || !resizeStartCell) return;
  
  if (resizePreviewElement) {
    resizePreviewElement.remove();
    resizePreviewElement = null;
  }
  
  isResizing = false;
  
  const startRow = parseInt(resizeStartCell.dataset.row);
  let newEndRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (newEndRow < startRow) newEndRow = startRow;
  
  const oldSpan = resizeStartCell.rowSpan || 1;
  const newSpan = newEndRow - startRow + 1;
  
  if (newSpan !== oldSpan) {
    const tbody = resizeStartCell.closest('tbody');
    const col = parseInt(resizeStartCell.dataset.col);
    
    const ta = resizeStartCell.querySelector('textarea');
    const dataObj = {
      text: ta ? ta.value : '',
      rowSpan: newSpan,
      cellClass: Array.from(resizeStartCell.classList).filter(c => c !== 'platoon-cell' && c !== 'selected-cell' && c !== 'dragging')
    };
    
    clearHadragCellData(resizeStartCell);
    
    const targetCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
    if (targetCell) {
      pasteOrMoveBlock(targetCell, dataObj);
      selectCell(targetCell);
      
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
    }
  }
  
  resizeStartCell = null;
  resizeCurrentRow = -1;
});

/* =========================================================
   Custom Context Menu
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const menuHTML = `
    <div id="custom-context-menu" style="display: none;">
      <button id="ctx-btn-copy">העתק שיבוץ</button>
      <button id="ctx-btn-paste">הדבק שיבוץ</button>
      <div class="ctx-divider"></div>
      <div class="ctx-colors-title">שנה יחידה:</div>
      <div class="ctx-colors-row">
        <div class="ctx-color-dot bg-esuk" data-color="bg-esuk" title="איסו&quot;ק"></div>
        <div class="ctx-color-dot bg-hirg" data-color="bg-hirg" title="חיר&quot;ג"></div>
        <div class="ctx-color-dot bg-pikud" data-color="bg-pikud" title="פיקוד"></div>
        <div class="ctx-color-dot bg-tazam" data-color="bg-tazam" title="תצ&quot;מ"></div>
        <div class="ctx-color-dot bg-maphat" data-color="bg-maphat" title="מפח&quot;ט"></div>
      </div>
      <div class="ctx-divider"></div>
      <button id="ctx-btn-delete">מחק שיבוץ</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', menuHTML);
  
  const ctxMenu = document.getElementById('custom-context-menu');
  let currentCtxCell = null;
  
  document.addEventListener('contextmenu', function(e) {
    const cell = e.target.closest('td.platoon-cell');
    if (cell) {
      e.preventDefault();
      
      currentCtxCell = cell;
      selectCell(cell);
      
      ctxMenu.style.display = 'flex';
      
      let x = e.pageX;
      let y = e.pageY;
      
      if (x + ctxMenu.offsetWidth > window.innerWidth) {
        x -= ctxMenu.offsetWidth;
      }
      if (y + ctxMenu.offsetHeight > window.innerHeight) {
        y -= ctxMenu.offsetHeight;
      }
      
      ctxMenu.style.left = x + 'px';
      ctxMenu.style.top = y + 'px';
    } else {
      ctxMenu.style.display = 'none';
    }
  });
  
  document.addEventListener('click', function(e) {
    if (e.target.closest('#custom-context-menu')) return;
    if (ctxMenu) ctxMenu.style.display = 'none';
  });
  
  document.getElementById('ctx-btn-copy')?.addEventListener('click', function() {
    if (currentCtxCell) {
      const ta = currentCtxCell.querySelector('textarea');
      hadragClipboard = {
        text: ta ? ta.value : '',
        rowSpan: currentCtxCell.rowSpan || 1,
        cellClass: Array.from(currentCtxCell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle' && c !== 'dragging')
      };
      currentCtxCell.style.outline = '3px dashed #0284c7';
      currentCtxCell.style.outlineOffset = '-3px';
      setTimeout(() => currentCtxCell.style.outline = '', 600);
    }
    ctxMenu.style.display = 'none';
  });

  document.getElementById('ctx-btn-paste')?.addEventListener('click', function() {
    if (currentCtxCell && typeof hadragClipboard !== 'undefined' && hadragClipboard) {
      pasteOrMoveBlock(currentCtxCell, hadragClipboard, true);
      if (typeof selectCell === 'function') selectCell(currentCtxCell);
    }
    ctxMenu.style.display = 'none';
  });
  
  document.getElementById('ctx-btn-delete')?.addEventListener('click', function(e) {
    e.stopPropagation();
    if (currentCtxCell) {
      clearHadragCellData(currentCtxCell);
      clearSelection();
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
    }
    ctxMenu.style.display = 'none';
  });
  
  document.querySelectorAll('.ctx-color-dot').forEach(dot => {
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      if (currentCtxCell) {
        const colors = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'imported', 'conflict-overlap'];
        colors.forEach(c => currentCtxCell.classList.remove(c));
        currentCtxCell.classList.add(this.dataset.color);
        
        clearSelection();
        
        if (typeof saveHadragTables === 'function') saveHadragTables();
        if (typeof saveShekemTables === 'function') saveShekemTables();
      }
      ctxMenu.style.display = 'none';
    });
  });
  // Track manual edits in manager tables and highlight orange if different from published
  document.addEventListener('input', async function(e) {
    if (e.target && e.target.classList.contains('cell-input')) {
      const table = e.target.closest('table');
      if (!table) return;
      const tableId = table.id;
      if (tableId === 'keshertable' || tableId === 'optictable') {
        const td = e.target.closest('td');
        if (!td) return;
        const tr = td.closest('tr');
        const tbody = table.tBodies[0];
        const rowIdx = Array.from(tbody.rows).indexOf(tr);
        const colIdx = Array.from(tr.cells).indexOf(td);
        if (rowIdx < 0 || colIdx < 1) return;
        
        const globalIndex = rowIdx * (tr.cells.length - 1) + (colIdx - 1);
        
        const managerPublishedKey = getStorageKey(tableId, currentWeek, currentYear) + '_published';
        let managerPublishedData = {};
        if (typeof fetchTableData === 'function') {
          managerPublishedData = await fetchTableData(managerPublishedKey) || {};
        } else {
          managerPublishedData = JSON.parse(localStorage.getItem(managerPublishedKey) || '{}');
        }
        
        const publishedVal = managerPublishedData[globalIndex] || '';
        if (e.target.value !== publishedVal) {
          td.classList.add('conflict-overlap');
        } else {
          td.classList.remove('conflict-overlap');
        }
      }
    }
  });
});
