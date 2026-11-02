/**
 * הופכת מחרוזת חופשית (טקסט שהוזן ע"י משתמש - שם אמצעי, טקסט בקשה וכו') לבטוחה להכנסה
 * ל-innerHTML, כדי למנוע הזרקת HTML/סקריפט (XSS) דרך שדות טקסט חופשיים במערכת.
 * יש להשתמש בה בכל מקום שמכניסים ערך שמקורו בקלט משתמש לתוך תבנית HTML (לא ל-.value של שדה קלט).
 * @param {*} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * שער-דילוג לתצוגות קריאה-בלבד שנטענות מחדש כל מחזור רענון אוטומטי (כל כמה שניות, ראו
 * CONFIG.SYNC_INTERVAL_MS/updateUIForWeek) - גם כשהנתונים בפועל לא השתנו כלל מהמחזור
 * הקודם. תיקוני "בנייה במעבר אחד" (בלי ריקון-ואז-מילוי) שנעשו קודם מנעו רק את חלון הזמן
 * שבו התא נראה ריק תוך כדי awaiting לשרת - הם *לא* מנעו את התופעה שנקודת המבט של המשתמש
 * היא "הטבלה מהבהבת/מרצדת כל כמה שניות", כי גם בנייה מלאה-במעבר-אחד עדיין הורסת ובונה
 * מחדש עשרות/מאות רכיבי DOM (עם כל הצביעה/מיזוג השורות שלהם) בכל מחזור, גם כשהתוצאה
 * הסופית זהה למה שכבר מוצג (אפיון QA: "עדיין מרצדים" - מודיעין, פלוגתי/חדר"ג, שק"ם,
 * מענים רפואיים, גם בדרישות וגם בטבלאות הגדולות). הפתרון: משווים חתימת JSON של הנתונים
 * שהתקבלו כרגע מול הפעם הקודמת עבור אותו מפתח-תצוגה, ומדלגים על כל מגע ב-DOM אם זהים -
 * כך שהתצוגה "יציבה" ברוב מחזורי הרענון (שבהם באמת לא השתנה כלום), ומתעדכנת מיד ברגע
 * שמשהו אכן משתנה (למשל אחרי אישור/פרסום).
 * @param {string} cacheKey - מזהה ייחודי לתצוגה הנתונה (למשל 'modiein_' + tbodyId)
 * @param {*} data - הנתונים שהתקבלו כרגע, כפי שיושוו (JSON.stringify) לפעם הקודמת
 * @returns {boolean} true אם הנתונים השתנו (יש לרנדר); false אם זהים (אפשר לדלג)
 */
let _renderSnapshotCache = {};
function _renderDataChanged(cacheKey, data) {
  const serialized = JSON.stringify(data);
  if (_renderSnapshotCache[cacheKey] === serialized) return false;
  _renderSnapshotCache[cacheKey] = serialized;
  return true;
}

/* ================================
   הגדרות טבלאות (לחישובים כלליים)
================================ */
const tableConfigs = {
  keshertable: { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, availableCol: 33, excessCol: 34 },
  optictable:  { startCol: 1, endCol: 29, totalUnitCol: 30, failCol: 31, totalRegulatedCol: 32, excessCol: 33 }
};

// טבלאות (מנהל + יחידה) שעליהן חל מעקב שינויים (הדגשה כתומה עד שמירה/הפצה) - אפיון 1.2 ו-1.9
const MANAGER_TRACKED_TABLES = [
  'keshertable', 'optictable', 'esukTable', 'hirgTable', 'pikudTable', 'tazamTable', 'bahalagTable',
  'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable',
  'esukkeshertable', 'kkeshertable', 'pkeshertable', 'tkeshertable', 'bkeshertable',
  'esukoptictable', 'koptictable', 'poptictable', 'toptictable', 'boptictable'
];

/* כללי הדגשה כתומה בטבלאות המשולבות (הגדולות) קשר/אופטיקה - אפיון QA:
   הסימון הכתום שם אינו נגזר יותר מהשוואת draft מול published (זה ערבב בין עריכה ישירה
   של המנהל לבין ייבוא מהיחידות, וגם סימן בטעות עמודות סה"כ מחושבות). במקום זאת מנוהלת
   רשימת "אינדקסים ממתינים" מפורשת שמתעדכנת אך ורק ע"י importFromSubTable (מוסיפה אינדקס
   כשהערך המיובא שונה מהמפורסם, ומסירה כשהוא זהה), ומתאפסת רק ע"י הפצה. כך:
   - ייבוא ראשון אי-פעם כן מסמן כתום (אין יותר תלות בקיום published קודם).
   - הקלדה ישירה של המנהל בטבלה הגדולה (בכל עמודה, כולל אחרי ריענון הדף) לעולם לא מוסיפה/
     מסירה סימון - ראו גם החסימה המוקדמת ל-MASTER_COMBINED_TABLES בהאזנת ה-input הגלובלית.
   - עמודות מחושבות/מסוכמות (דרישה, וויסות גדודי, עודף, סה"כ כללי) לעולם לא מגיעות לרשימה,
     כי importFromSubTable מלכתחילה כותבת רק לעמודות החברה/יחידה שבאמת מיובאות. */
const MASTER_COMBINED_TABLES = ['keshertable', 'optictable'];

// טבלאות המודיעין הגדולות (עמוד המנהל) - שייכות למנהל, בניגוד ל-reqXTable/XkeshertableX/
// XoptictableX שברשימת MANAGER_TRACKED_TABLES, ששייכות ליחידה עצמה (טרם יובאו). מקור אמת
// יחיד המשותף בין _adminOwnedDraftKeys (מה מפיצים) ל-hasAnySystemPendingChanges (מה בודקים) -
// ראו הערה ב-hasAnySystemPendingChanges על הבאג שקרה כששתי הרשימות האלה לא היו זהות.
const ADMIN_OWNED_MODIEIN_TABLES = ['esukTable', 'hirgTable', 'pikudTable', 'tazamTable', 'bahalagTable'];

function getPendingImportKey(tableId, week, year) {
  return `pendingImport_${tableId}_week${week}_year${year}`;
}

async function loadPendingImportIndexes(tableId, week, year) {
  const key = getPendingImportKey(tableId, week, year);
  const list = (typeof fetchTableData === 'function')
    ? await fetchTableData(key)
    : JSON.parse(localStorage.getItem(key) || 'null');
  return Array.isArray(list) ? list : [];
}

function savePendingImportIndexes(tableId, week, year, indexes) {
  persist(getPendingImportKey(tableId, week, year), indexes);
}

/* ================================
   מצב גלובלי (שבועות)
================================ */
let currentWeek = 1;
let currentYear = new Date().getFullYear();
const tableWeeks = {};

let _storageErrorNotified = false;
/**
 * מטפלת בכשל כתיבה ל-localStorage (בד"כ המכסה מלאה - QuotaExceededError) בצורה גלויה
 * למשתמש, במקום לבלוע אותו בשקט. בעבר כשל כזה לא הציג שום שגיאה, כך שהמשתמש היה חושב
 * שהעריכה נשמרה כשבפועל היא אבדה. מוצגת פעם אחת בלבד לטעינת עמוד (לא על כל הקשה חוזרת).
 * @param {*} err
 */
function _handleStorageWriteFailure(err) {
  console.warn('LocalStorage save failed:', err);
  if (_storageErrorNotified) return;
  _storageErrorNotified = true;
  // ה-alert קודם, ובלתי-תלוי בשמירה - אם האחסון באמת מלא, גם ניסיון להוסיף התראה (שגם
  // הוא כותב ל-localStorage) עלול להיכשל בעצמו, ואסור שזה ימנע מהמשתמש לראות את האזהרה.
  alert('שמירת הנתונים נכשלה! ייתכן שנפח האחסון המקומי (localStorage) של הדפדפן מלא. העריכה האחרונה שלך עלולה לא להישמר בפועל - מומלץ לגבות/לייצא נתונים ולפנות למנהל המערכת.');
  try {
    if (typeof addNotification === 'function') {
      addNotification('⚠️ שמירת נתונים נכשלה - ייתכן שנפח האחסון המקומי בדפדפן מלא. העריכה האחרונה עלולה לא להישמר.', 'error');
    }
  } catch (e2) { /* האחסון מלא לגמרי - האזהרה כבר הוצגה, אין מה לעשות נוסף */ }
}

/**
 * שמירת נתון דרך שכבת הסנכרון ההיברידית (אפיון חלק 2):
 * מנתב ל-DataService (localStorage מיידי + סנכרון לשרת/תור), עם נפילה חזרה ל-localStorage.
 * @param {string} key - מפתח השמירה
 * @param {*} data - אובייקט הנתונים (לא מחרוזת)
 */
function persist(key, data) {
  if (typeof DataService !== 'undefined') {
    DataService.setItem(key, data);
  } else {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { _handleStorageWriteFailure(e); }
  }
}

/* =========================================================
   אכיפת הרשאות (אפיון חלק 3)
   נעילת עריכה למשתמשים ללא הרשאה בעמוד הנוכחי.
========================================================= */

/** האם העמוד נמצא כרגע במצב צפייה בלבד */
function isReadOnlyMode() {
  return document.body.classList.contains('readonly-mode');
}

/**
 * מחילה את הרשאות המשתמש המחובר על העמוד:
 * נועלת שדות עריכה ומסתירה כפתורי פעולה כאשר אין הרשאת עריכה.
 * נקראת מחדש לאחר כל רינדור של טבלאות (השדות נוצרים דינמית).
 */
function applyPermissions() {
  if (typeof AUTH === 'undefined') return;
  const session = AUTH.getSession();
  if (!session) return;

  const canEdit = AUTH.canEditPage();
  document.body.classList.toggle('readonly-mode', !canEdit);
  // סימוני "שינויים שטרם הופצו" (כתום) מוצגים למנהל בלבד
  document.body.classList.toggle('hide-conflict-overlap', session.role !== 'admin');
  // גריד השיבוץ בחדר"ג/שק"ם (גרירה, שינוי גודל, צביעה, הדבקה) נעול למנהל בלבד - גם עורך
  // (שיכול לערוך כל טבלה אחרת) אינו אמור להזיז/לערוך שיבוצים בגריד הזה (אפיון QA).
  document.body.classList.toggle('hadrag-grid-readonly', session.role !== 'admin');
  if (canEdit) return;

  // נעילת שדות הקלט (למעט ניווט השבועות והסרגל העליון)
  document.querySelectorAll('input[type="text"], input[type="time"], textarea, select').forEach(el => {
    if (el.id === 'weekInput' || el.id === 'weekInputOptic') return;
    if (el.closest('#top-nav-placeholder')) return;
    if (el.tagName === 'SELECT') el.disabled = true;
    else el.readOnly = true;
  });

  // הסתרת כפתורי הפעולה
  const actionSelectors = [
    '#global-export-btn', '.add-row-btn', '.table-import-btn', '.week-copy-btn',
    '.undo-btn', '.status-btn', '.row-delete-icon', '.row-drag-handle',
    '.color-picker-toggle', '.hipok-choice-btn', '.btn-approve', '.btn-reject',
    '.hipok-delete-btn', '#openHipokModalBtn', '.excel-upload-btn'
  ];
  document.querySelectorAll(actionSelectors.join(',')).forEach(el => { el.style.display = 'none'; });

  // כפתורי ייבוא/הוספה המוגדרים inline בכותרות הטבלאות
  document.querySelectorAll('thead button').forEach(btn => {
    const action = btn.getAttribute('onclick') || '';
    if (/import|promptAddItemRow|submit|approve|reject/i.test(action)) btn.style.display = 'none';
  });
}

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

/**
 * מפיקה מחרוזת תאריך עברי להיום (למשל "18 באלול תשפ"ו") דרך תמיכת הדפדפן בלוח השנה העברי
 * (Intl.DateTimeFormat עם he-u-ca-hebrew) - בלי תלות בספריית לוח שנה עברי נפרדת. אם הדפדפן
 * לא תומך (לא צפוי בדפדפנים מודרניים, אך למקרה של דפדפן ישן ברשת הצבאית) מחזירה מחרוזת ריקה
 * במקום לזרוק שגיאה שתשבש את כל סרגל הניווט.
 */
/**
 * ממירה מספר (1-999) לאותיות עבריות לפי כללי הגימטריה המקובלים בלוח השנה העברי: גרש (׳)
 * אחרי אות בודדת, גרשיים (״) לפני האות האחרונה כשיש יותר מאחת. מטפלת בחריגים המקובלים
 * ט"ו/ט"ז (15/16) כדי לא לאיית צירוף שנחשב חלק משם ה'.
 */
function _numberToHebrewLetters(num) {
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';

  const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];
  const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

  let n = num;
  let letters = HUNDREDS[Math.floor(n / 100) % 10];
  n %= 100;
  letters += TENS[Math.floor(n / 10)];
  n %= 10;
  letters += UNITS[n];

  if (letters.length <= 1) return letters ? letters + "'" : '';
  return letters.slice(0, -1) + '"' + letters.slice(-1);
}

/**
 * ממירה שנה עברית מלאה (למשל 5786) לכתיב באותיות: אלפים (ה') + מאות/עשרות/יחידות (תשפ"ו) -
 * "ה' תשפ"ו". מניחה טווח האלף החמישי/השישי (5000-6999) - הטווח הרלוונטי בפועל היום ובעתיד
 * הנראה לעין; לא נדרשת תמיכה בשנים לפני כן במערכת הזו.
 */
function _hebrewYearToLetters(year) {
  const thousands = Math.floor(year / 1000);
  const remainder = year % 1000;
  return `${_numberToHebrewLetters(thousands)} ${_numberToHebrewLetters(remainder)}`;
}

function _getHebrewDateString() {
  try {
    const parts = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' }).formatToParts(new Date());
    const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
    const day = parseInt(get('day'), 10);
    const year = parseInt(get('year'), 10);
    const month = get('month');
    if (!day || !year || !month) return '';
    return `${_numberToHebrewLetters(day)} ב${month} ${_hebrewYearToLetters(year)}`;
  } catch (e) {
    return '';
  }
}

/** מפיקה מחרוזת תאריך לועזי להיום (DD.MM.YYYY). */
function _getGregorianDateString() {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

/**
 * מועדים/חגים עבריים עיקריים - מפתח (חודש עברי באנגלית, כפי שמוחזר מ-Intl עם en-u-ca-hebrew;
 * יום בחודש) -> שם. שימוש בשם החודש האנגלי (ולא העברי) כי הוא יציב וחד-משמעי (אין תלות
 * בכתיב "תשרי" מול "תשׁרי" וכו'). ימי חנוכה/פסח/סוכות שחלים בחודש קצר (29 יום, לא 30) פשוט
 * לעולם לא יתאימו לאף תאריך אמיתי באותה שנה - לא גורם להתאמות שווא.
 * יום הזיכרון/העצמאות **אינם** ברשימה הזו בכוונה - הם נדחים בפועל יום-יומיים בהתאם ליום
 * בשבוע שבו חל ה' באייר (כדי לא לחול בסמוך לשבת), ומחושבים בנפרד ב-_getIyarMemorialDates.
 */
const JEWISH_HOLIDAYS_TABLE = [
  { month: 'Tishri', day: 1, name: 'ראש השנה' },
  { month: 'Tishri', day: 2, name: 'ראש השנה' },
  { month: 'Tishri', day: 10, name: 'יום כיפור' },
  { month: 'Tishri', day: 15, name: 'סוכות' },
  { month: 'Tishri', day: 16, name: 'סוכות' },
  { month: 'Tishri', day: 17, name: 'חול המועד סוכות' },
  { month: 'Tishri', day: 18, name: 'חול המועד סוכות' },
  { month: 'Tishri', day: 19, name: 'חול המועד סוכות' },
  { month: 'Tishri', day: 20, name: 'חול המועד סוכות' },
  { month: 'Tishri', day: 21, name: 'הושענא רבה' },
  { month: 'Tishri', day: 22, name: 'שמיני עצרת' },
  { month: 'Tishri', day: 23, name: 'שמחת תורה' },
  { month: 'Kislev', day: 25, name: 'חנוכה' },
  { month: 'Kislev', day: 26, name: 'חנוכה' },
  { month: 'Kislev', day: 27, name: 'חנוכה' },
  { month: 'Kislev', day: 28, name: 'חנוכה' },
  { month: 'Kislev', day: 29, name: 'חנוכה' },
  { month: 'Kislev', day: 30, name: 'חנוכה' },
  { month: 'Tevet', day: 1, name: 'חנוכה' },
  { month: 'Tevet', day: 2, name: 'חנוכה' },
  { month: 'Tevet', day: 10, name: 'עשרה בטבת' },
  { month: 'Shevat', day: 15, name: 'ט"ו בשבט' },
  { month: 'Adar', day: 14, name: 'פורים' },
  { month: 'Adar', day: 15, name: 'שושן פורים' },
  { month: 'Adar II', day: 14, name: 'פורים' },
  { month: 'Adar II', day: 15, name: 'שושן פורים' },
  { month: 'Nisan', day: 15, name: 'פסח' },
  { month: 'Nisan', day: 16, name: 'פסח' },
  { month: 'Nisan', day: 17, name: 'חול המועד פסח' },
  { month: 'Nisan', day: 18, name: 'חול המועד פסח' },
  { month: 'Nisan', day: 19, name: 'חול המועד פסח' },
  { month: 'Nisan', day: 20, name: 'חול המועד פסח' },
  { month: 'Nisan', day: 21, name: 'שביעי של פסח' },
  { month: 'Nisan', day: 27, name: 'יום השואה' },
  { month: 'Iyar', day: 18, name: 'ל"ג בעומר' },
  { month: 'Iyar', day: 28, name: 'יום ירושלים' },
  { month: 'Sivan', day: 6, name: 'שבועות' },
  { month: 'Tammuz', day: 17, name: 'צום י"ז בתמוז' },
  { month: 'Av', day: 9, name: 'תשעה באב' }
];

/**
 * מחשבת את יום ראשון (תחילת השבוע כפי שמוצג בטבלאות - עמודת "ראשון") עבור שבוע/שנה נתונים,
 * לפי אותו חישוב ISO-8601 שמניב את מספר השבוע (getISOWeekInfo) - יום ב' של שבוע ISO, פחות
 * יום אחד. הופכת (week, year) -> תאריך, בניגוד ל-getISOWeekInfo שהופכת תאריך -> (week, year).
 * @returns {Date} תאריך יום ראשון (UTC חצות)
 */
function _getWeekStartDate(week, year) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(targetMonday);
  sunday.setUTCDate(targetMonday.getUTCDate() - 1);
  return sunday;
}

/**
 * מוצאת את התאריך הלועזי התואם ליום עברי נתון (שנה עברית + חודש + יום), בסריקה חסומה
 * (עד 120 יום) החל מ-1 במרץ של שנת ההערכה הלועזית שסופקה - כל חודשי אייר-סיוון-וכו' חלים
 * בטווח הזה. אין פונקציית המרה ישירה עברי->לועזי ב-Intl (רק ההפך), ולכן סריקה יום-אחר-יום
 * היא הדרך הפשוטה והאמינה ביותר כאן - מבוצעת פעם אחת בלבד לכל רינדור, לא יקרה.
 * @returns {Date|null} UTC חצות, או null אם לא נמצא בטווח הסריקה
 */
function _hebrewDateToGregorian(hebrewYear, monthName, day, estimateGregYear) {
  const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'short', year: 'numeric' });
  const d = new Date(Date.UTC(estimateGregYear, 2, 1));
  for (let i = 0; i < 120; i++) {
    const parts = fmt.formatToParts(d);
    const m = (parts.find(p => p.type === 'month') || {}).value;
    const dd = parseInt((parts.find(p => p.type === 'day') || {}).value, 10);
    const yy = parseInt((parts.find(p => p.type === 'year') || {}).value, 10);
    if (m === monthName && dd === day && yy === hebrewYear) return new Date(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}

/**
 * מחשבת את התאריכים הלועזיים בפועל של יום הזיכרון ויום העצמאות עבור שנה עברית נתונה, כולל
 * הדחייה הרשמית כשה' באייר (התאריך הבסיסי של העצמאות) חל בסמוך לשבת - ראו החוק הישראלי:
 * חל בשישי -> נדחה יומיים אחורה ליום חמישי (ג' באייר); חל בשבת -> נדחה יומיים אחורה ליום
 * חמישי (ג' באייר); חל בראשון -> (לא קורה בפועל בלוח העברי) נדחה יום קדימה לשני; חל בשני ->
 * נדחה יום קדימה לשלישי (ו' באייר) - כדי שיום הזיכרון (יום לפני) לא ייפול בשבת/ראשון.
 * בשאר הימים (שלישי/רביעי) אין דחייה. יום הזיכרון הוא תמיד יום אחד לפני העצמאות בפועל.
 * @param {number} hebrewYear
 * @param {number} estimateGregYear - שנה לועזית משוערת שבה חל אייר של השנה העברית הזו
 * @returns {{zikaron: Date, atzmaut: Date}|null}
 */
function _getIyarMemorialDates(hebrewYear, estimateGregYear) {
  const base5Iyar = _hebrewDateToGregorian(hebrewYear, 'Iyar', 5, estimateGregYear);
  if (!base5Iyar) return null;
  const atzmaut = new Date(base5Iyar);
  const dow = base5Iyar.getUTCDay(); // 0=Sun..6=Sat
  if (dow === 5) atzmaut.setUTCDate(atzmaut.getUTCDate() - 1);      // שישי -> חמישי
  else if (dow === 6) atzmaut.setUTCDate(atzmaut.getUTCDate() - 2); // שבת -> חמישי
  else if (dow === 0) atzmaut.setUTCDate(atzmaut.getUTCDate() + 1); // ראשון -> שני (לא קורה בפועל)
  else if (dow === 1) atzmaut.setUTCDate(atzmaut.getUTCDate() + 1); // שני -> שלישי
  const zikaron = new Date(atzmaut);
  zikaron.setUTCDate(zikaron.getUTCDate() - 1);
  return { zikaron, atzmaut };
}

/**
 * בודקת את שבעת ימי השבוע הנוכחי (ראשון עד שבת) מול טבלת המועדים העבריים הקבועים, ובנפרד
 * מול התאריכים המחושבים (עם הדחייה) של יום הזיכרון/העצמאות, ומחזירה רשימת שמות מועדים
 * ייחודיים שחלים באותו שבוע (חג רב-יומי כמו סוכות/פסח/חנוכה מופיע פעם אחת בלבד גם אם כמה
 * מימיו נופלים באותו שבוע).
 * @param {number} week
 * @param {number} year
 * @returns {string[]}
 */
function _getHolidayNamesForWeek(week, year) {
  try {
    const sunday = _getWeekStartDate(week, year);
    const fmt = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'short', year: 'numeric' });
    const found = [];
    let hebrewYearOfWeek = null;
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setUTCDate(sunday.getUTCDate() + i);
      const parts = fmt.formatToParts(d);
      const month = (parts.find(p => p.type === 'month') || {}).value;
      const day = parseInt((parts.find(p => p.type === 'day') || {}).value, 10);
      if (month === 'Iyar') hebrewYearOfWeek = parseInt((parts.find(p => p.type === 'year') || {}).value, 10);
      const match = JEWISH_HOLIDAYS_TABLE.find(h => h.month === month && h.day === day);
      if (match && !found.includes(match.name)) found.push(match.name);
    }

    // יום הזיכרון/העצמאות - רק אם השבוע הזה נופל בטווח אייר (hebrewYearOfWeek נקבע למעלה),
    // כדי לא לבצע חיפוש לועזי->עברי מיותר בכל שבוע בשנה.
    if (hebrewYearOfWeek !== null) {
      const memorial = _getIyarMemorialDates(hebrewYearOfWeek, sunday.getUTCFullYear());
      if (memorial) {
        const sundayTime = sunday.getTime(), saturdayTime = sunday.getTime() + 6 * 86400000;
        if (memorial.zikaron.getTime() >= sundayTime && memorial.zikaron.getTime() <= saturdayTime) found.push('יום הזיכרון');
        if (memorial.atzmaut.getTime() >= sundayTime && memorial.atzmaut.getTime() <= saturdayTime) found.push('יום העצמאות');
      }
    }

    return found;
  } catch (e) {
    return [];
  }
}

/**
 * מוסיפה/מעדכנת ליד הכותרת (PAKADEX) את תאריך היום (עברי מעל, לועזי מתחתיו, ומועד/חג של
 * השבוע הנצפה אם יש כזה) וסימון סיווג "-סודי-" באמצע שורת הזהות (container1). פועלת על
 * ה-DOM **אחרי** ההזרקה/הקיום של container1 - זהה בעמודי מנהל (container1 מוזרק דינמית כאן,
 * ראו identityRowBlock) ובעמודי יחידה (container1 קבוע וסטטי ב-HTML של העמוד עצמו) - כך שאין
 * צורך לשכפל את הלוגיקה בנפרד לכל עמוד יחידה.
 * אידמפוטנטית - קוראת שוב לאלמנטים קיימים ומעדכנת את התוכן שלהם במקום ליצור כפילויות, כי
 * נקראת גם מ-updateUIForWeek בכל מעבר שבוע (השבוע הנצפה יכול להשתנות בלי שה-container1 עצמו
 * נבנה מחדש, למשל בעמוד יחידה שבו הוא קבוע וסטטי) - אחרת שורת המועד הייתה נשארת "תקועה" על
 * השבוע שהוצג בטעינת העמוד הראשונה בלבד.
 */
function _injectDateAndClassificationBanner() {
  const container1 = document.querySelector('.container1');
  if (!container1) return;
  const titleWrap = container1.lastElementChild;
  if (!titleWrap) return;

  let dateBlock = titleWrap.querySelector(':scope > .app-date-block');
  if (!dateBlock) {
    dateBlock = document.createElement('div');
    dateBlock.className = 'app-date-block';
    dateBlock.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; line-height:1.3; margin-inline-end:6px;';
    dateBlock.innerHTML = `
      <span class="app-date-he" style="font-size:11px; color:#e2e8f0; font-weight:700; white-space:nowrap;"></span>
      <span class="app-date-greg" style="font-size:11px; color:#94a3b8; white-space:nowrap;"></span>
      <span class="app-date-holiday" style="font-size:11px; color:#fbbf24; font-weight:700; white-space:nowrap;"></span>
    `;
    titleWrap.insertAdjacentElement('afterbegin', dateBlock);
  }
  dateBlock.querySelector('.app-date-he').textContent = _getHebrewDateString();
  dateBlock.querySelector('.app-date-greg').textContent = _getGregorianDateString();

  const holidays = (typeof currentWeek !== 'undefined' && typeof currentYear !== 'undefined')
    ? _getHolidayNamesForWeek(currentWeek, currentYear)
    : [];
  const holidaySpan = dateBlock.querySelector('.app-date-holiday');
  holidaySpan.textContent = holidays.join(', ');
  holidaySpan.style.display = holidays.length ? '' : 'none';

  if (!container1.querySelector(':scope > .classification-banner')) {
    const classificationBanner = document.createElement('div');
    classificationBanner.className = 'classification-banner';
    classificationBanner.style.cssText = 'color:rgba(255,255,255,0.4); font-weight:900; font-size:15px; letter-spacing:3px;';
    classificationBanner.textContent = '-סודי-';
    titleWrap.insertAdjacentElement('beforebegin', classificationBanner);
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
      <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='index.html'">
        <h1 style="font-size:20px; color:white; margin:0;">PAKADEX</h1>
        <img src="images/לוגו בהלג בלי רקע.png" alt="לוגו" class="sidebar-image" width="36" style="height:auto;">
      </div>
    ` : '';

    // חיווי משתמש מחובר + יציאה (אפיון חלק 3)
    const session = (typeof AUTH !== 'undefined') ? AUTH.getSession() : null;
    const userChipBlock = session ? `
      <div class="user-chip-wrap">
      <div class="user-chip">
        <div class="user-chip-info">
          <span class="user-chip-name">${escapeHtml(session.name) || escapeHtml(session.pn)}</span>
          <span class="user-chip-role">${AUTH.roleLabel(session)}</span>
        </div>
        ${AUTH.canManageUsers()
          ? '<button class="user-chip-btn" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href=\'users.html\'" title="ניהול הרשאות">👥</button>'
          : ''}
      </div>
      <div class="support-note" title="פרטי קשר לתקלות">
        <span class="support-note-title">תקלות:</span>
        <span>ירין שטרית: <bdi>0543384656</bdi></span>
        <span class="support-note-sep">|</span>
        <span>מחשוב: <bdi>0529003347</bdi></span>
        <span class="support-note-sep">|</span>
        <span>שעות פעילות: <bdi>9:00 - 21:00</bdi></span>
      </div>
      </div>
    ` : '';

    // הוסר סממן טקסט נפרד למנהל ("✓ הכל הופץ" / "⏳ יש שינויים שלא הופצו") - במקומו כפתור
    // "הפץ שינויים" עצמו משנה צבע (אדום/ירוק) לפי updateGlobalExportButtonStatus, בהתבסס על
    // בדיקה גלובלית לכל המערכת (קשר/אופטיקה/מודיעין/מענים רפואיים/חדר"ג/שק"ם) לשבוע הנוכחי - לא רק העמוד הנוכחי.

    // הוסר גם סממן הטקסט הנפרד לעמוד יחידה ("✓ הכל נשמר" / "⏳ נוספו שינויים שטרם נשמרו") -
    // אותו קונספט של כפתור אדום/ירוק חל גם כאן: כפתור "שמור ומוכן לייבוא" עצמו (אותו כפתור
    // כללי לכל טבלאות הדרישה של הקבוצה - קשר, אופטיקה ומודיעין) משנה צבע לפי
    // updateGlobalExportButtonStatus, ולא רק לפי הטבלה/הכרטיסייה שפתוחה כרגע.

    // כפתור הדפסה (אפיון 1.6) - זמין בכל עמודי הטבלאות
    const printBtnBlock = '<button class="print-btn" onclick="window.print()" title="הדפס טבלה">🖨️</button>';

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

    // סרגל הזהות (לוגו + חיווי משתמש) - תמיד בשורה עצמאית לעמודי מנהל; בעמודי יחידה הלוגו כבר קבוע ב-HTML
    // (בתוך container1 סטטי עם placeholder לחיווי המשתמש) - ראו הזרקה ל-#user-chip-placeholder בהמשך.
    const identityRowBlock = !isUnitPage ? `
      <div class="container1">
        ${userChipBlock}
        ${logoBlock}
      </div>
    ` : '';

    const exportBtnBlock = !isUnitPage
      ? '<button id="global-export-btn" class="global-export-btn" onclick="globalExportManager()">הפץ שינויים</button>'
      : '<button id="global-export-btn" class="global-export-btn unit-ready" onclick="globalExportUnit()">שמור ומוכן לייבוא</button>';

    // כפתורי ניהול פלוגות (הוסף / הסר) - למנהל בלבד, בעמודי הטבלאות, במיכל נפרד לצד כפתורי הקטגוריות.
    const companyActionsBlock = (!isUnitPage && _coIsAdmin()) ? `
        <div class="company-actions">
          <button type="button" class="company-btn company-btn-add" onclick="openAddCompanyModal()" title="הוספת פלוגה לגדוד">➕ הוסף פלוגה</button>
          <button type="button" class="company-btn company-btn-remove" onclick="openRemoveCompanyModal()" title="הסרת פלוגה קיימת">➖ הסר פלוגה</button>
          <button type="button" class="company-btn company-btn-summary" onclick="openCompaniesSummaryModal()" title="סיכום פלוגות שנוספו/הוסרו, עריכה ושחזור">📋 סיכום פלוגות</button>
        </div>` : '';

    // שורת כלים: כרטיסיות ניווט בין הקטגוריות מימין, וכלי עבודה + פעולת ההפצה משמאל - מקובצים בבירור כדי לצמצם עומס חזותי.
    const toolbarRowBlock = !isMain ? `
      <div class="toolbar-row">
        <div class="nav-tabs ${!isUnitPage ? 'nav-tabs-master' : ''}">
          <button class="topnav-btn ${isKesher ? 'active' : ''}" id="btn-kesher" onclick="${isUnitPage ? "showTopSection('kesher')" : "window.location.href='kesher.html'"}">תקשוב</button>
          <button class="topnav-btn ${isOptic ? 'active' : ''}" id="btn-optic" onclick="${isUnitPage ? "showTopSection('optic')" : "window.location.href='optic.html'"}">אופטיקה</button>
          <button class="topnav-btn ${isModiein ? 'active' : ''}" id="btn-modiein" onclick="${isUnitPage ? "showTopSection('modiein')" : "window.location.href='modiein.html'"}">מודיעין</button>
          <button class="topnav-btn ${isHipok ? 'active' : ''}" id="btn-hipok" onclick="${isUnitPage ? "showTopSection('hipok')" : "window.location.href='hipokim.html'"}">מענה רפואי</button>
          <button class="topnav-btn ${isHadrag ? 'active' : ''}" id="btn-chadrag" onclick="${isUnitPage ? "showTopSection('chadrag')" : "window.location.href='hadrag.html'"}">פלוגתי</button>
          <button class="topnav-btn ${isShekem ? 'active' : ''}" id="btn-shekem" onclick="${isUnitPage ? "showTopSection('shekem')" : "window.location.href='shekem.html'"}">שעות שק"ם</button>
          ${!isUnitPage ? `<button class="topnav-btn ${currentPage.includes('general') ? 'active' : ''}" id="btn-excel" onclick="window.location.href='general.html'">📗 גאנט</button>` : ''}
        </div>
        ${companyActionsBlock}
        <div class="toolbar-actions">
          <div class="tool-group">
            ${bellBlock}
            ${undoRedoBlock}
            ${printBtnBlock}
          </div>
          <div class="toolbar-divider"></div>
          ${exportBtnBlock}
        </div>
      </div>
    ` : '';

    topNav.innerHTML = `${identityRowBlock}${toolbarRowBlock}`;

    // בעמודי יחידה חיווי המשתמש מוזרק לתוך ה-container1 הסטטי (הקבוע ב-HTML של העמוד עצמו),
    // כדי שיישב תמיד בצד ימין הכותרת יחד עם הלוגו - זהה למראה בעמודי המנהל.
    if (isUnitPage) {
      const chipPlaceholder = document.getElementById('user-chip-placeholder');
      if (chipPlaceholder) chipPlaceholder.innerHTML = userChipBlock;
    }

    _injectDateAndClassificationBanner();

    if (typeof updateNotifBadge === 'function') updateNotifBadge();
    if (typeof updateSyncIndicator === 'function') updateSyncIndicator();
    if (typeof updatePublishIndicator === 'function') updatePublishIndicator();
    if (typeof initPublishIndicatorObserver === 'function') initPublishIndicatorObserver();
  }

  // 2. הזרקת תפריט צדדי (Side Nav)
  if (sideNav) {
    const isTabels = ['tabels', 'kesher', 'optic', 'modiein', 'hipok', 'hadrag', 'shekem'].some(p => currentPage.includes(p));

    const isEsuk = currentPage.includes('esuk');
    const isHirg = currentPage.includes('hirg');
    const isPikud = currentPage.includes('pikud');
    const isTazam = currentPage.includes('tazam');
    const isBahalag = currentPage.includes('bahalag');

    // משתמש מסוג 'unit' רואה בסרגל הצד רק את הפלוגות שהוא מורשה להן (ייתכן כמה); שאר התפקידים רואים הכל.
    const canSeeUnit = (unitKey) => {
      if (typeof AUTH === 'undefined') return true;
      const session = AUTH.getSession();
      if (!session || session.role !== 'unit') return true;
      const units = Array.isArray(session.unit) ? session.unit : (session.unit ? [session.unit] : []);
      return units.includes(unitKey);
    };

    const unitBlock = (key, isActive, label, emoji) => `
        <button class="sidebar-btn ${isActive ? 'active' : ''}" onclick="toggleMenu('subMenu_${key}')">
          <span>${emoji}</span> <span class="sidebar-text">${label}</span>
        </button>
        <div id="subMenu_${key}" class="submenu ${isActive ? 'show' : ''}">
          <button class="sidebar-btn ${isActive && !isHaktzaotView ? 'active' : ''}" onclick="clearViewedWeek(); window.location.href='${key}.html?view=bakashot'">
            <span class="sidebar-text">דרישות</span>
          </button>
          <button class="sidebar-btn ${isActive && isHaktzaotView ? 'active' : ''}" onclick="clearViewedWeek(); window.location.href='${key}.html?view=haktzaot'">
            <span class="sidebar-text">הקצאות</span>
          </button>
        </div>`;

    sideNav.innerHTML = `
      <div class="container2 ${isCollapsedStored ? 'collapsed' : ''}" style="margin-top: 0;">
        <button id="sidebar-toggle" class="sidebar-toggle-btn" onclick="toggleSidebar()">
          <span>${isCollapsedStored ? '►' : '◄'}</span>
          <span class="sidebar-text">כווץ תפריט</span>
        </button>

        <button class="sidebar-btn ${isMain ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='index.html'">
          <span>🏠</span> <span class="sidebar-text">ראשי</span>
        </button>
        <button class="sidebar-btn ${isTabels ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='kesher.html'">
          <span>📊</span> <span class="sidebar-text">טבלאות</span>
        </button>
        ${(typeof AUTH !== 'undefined' && AUTH.canManageUsers()) ? `
        <button class="sidebar-btn ${currentPage.includes('users') ? 'active' : ''}" onclick="clearViewedWeek(); clearViewedCategory(); window.location.href='users.html'">
          <span>👥</span> <span class="sidebar-text">ניהול הרשאות</span>
        </button>` : ''}

        ${canSeeUnit('esuk') ? unitBlock('esuk', isEsuk, 'בא"ח איסו"ק', '🟡') : ''}
        ${canSeeUnit('hirg') ? unitBlock('hirg', isHirg, 'בא"ח חיר"ג', '🟢') : ''}
        ${canSeeUnit('pikud') ? unitBlock('pikud', isPikud, 'גדוד הפיקוד', '🔵') : ''}
        ${canSeeUnit('tazam') ? unitBlock('tazam', isTazam, 'ענף תצ"מ', '🟣') : ''}
        ${canSeeUnit('bahalag') ? unitBlock('bahalag', isBahalag, 'מפח"ט', '🟠') : ''}
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
 * מחשבת את מספר השבוע (ISO-8601) והשנה של תאריך נתון.
 * @param {Date} date
 * @returns {{week: number, year: number}}
 */
function getISOWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

/**
 * מספר השבועות בשנה - קבוע תמיד על 52 (לא לפי תקן ISO-8601, שבחלק מהשנים היה מחשב 53
 * ומייצר שבוע נוסף שלא מתאים למבנה הטבלאות/ניווט הקבוע של המערכת).
 * @param {number} year
 * @returns {number} 52 תמיד
 */
function getWeeksInYear(year) {
  return 52;
}

/**
 * מחשבת את מספר השבוע והשנה הנוכחיים לפי תקן ISO-8601 הבינלאומי.
 * @returns {{week: number, year: number}} אובייקט המכיל את השבוע והשנה
 */
function getCurrentWeekAndYear() {
  const info = getISOWeekInfo(new Date());
  const maxWeek = getWeeksInYear(info.year);
  return { week: Math.min(Math.max(info.week, 1), maxWeek), year: info.year };
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
  const desc = _coDesc(tableId);
  if (desc) {
    // טבלה שמבנה העמודות שלה תלוי ברשימת הפלוגות: המפתח נגזר מהשדה עצמו (פלוגה מקורית =
    // אותו מפתח מספרי כמו תמיד, פלוגה שנוספה = x<מזהה>_<שורה>) ולא ממיקומו הכללי בטבלה.
    _coKeyedInputs(table, desc).forEach(({ input, key }) => { data[key] = input.value; });
    return data;
  }
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
 * שומרת את כל נתוני הטבלאות, המענים הרפואיים, החדר"ג והשק"ם עבור השבוע והשנה הנוכחיים ב-DataService (SharePoint / Local).
 */
async function saveCurrentWeek() {
  const tables = getActiveTables();
  for (const tableId of tables) {
    const table = document.getElementById(tableId);
    if (table) {
      // טבלה בעלת מבנה עמודות דינמי שעדיין לא נטענה במלואה לשבוע שמוצג (מבנה שנבנה מחדש וריק,
      // או מעבר שבוע שהטעינה שלו עוד לא הסתיימה) - אסור לשמור את תוכן ה-DOM שלה כרגע, אחרת
      // התאים הריקים/של השבוע הקודם היו נכתבים על נתוני השבוע החדש (ראו _loadTableDataImpl).
      if (_coDesc(tableId) && !table._coReady) continue;
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
// מגינים מפני שתי קריאות חופפות ל-loadTableData על אותה טבלה בו-זמנית (למשל מחזור רענון
// תקופתי שמתנגש עם שמירה/ייבוא מפורש שעוד לא הסתיים, שתיהן נמשכות זמן ממשי מול שרת מרכזי
// אמיתי) - בלי ההגנה הזו, שתי הקריאות מבצעות את התאמת מספר-השורות של טבלה דינמית (מודיעין)
// בו-זמנית ובלתי-תלוי זו בזו, מה שגורם למספר השורות "לקפוץ" זמנית בין הערכים השונים שכל
// קריאה מחשבת - נראה למשתמש כטבלה שמאבדת ומחזירה שורות ("מהבהבת") ממש בזמן שמירה/ייבוא
// (אפיון QA: "טבלת המודיעין מרצדת... כשנשמר בשרפוינט"). קריאה שמגיעה בזמן שכבר יש קריאה
// פעילה לאותה טבלה לא מתבצעת במקביל - היא רק שומרת את הפרמטרים העדכניים ביותר, וכשהקריאה
// הפעילה מסתיימת היא מריצה הרצה נוספת (ולא יותר מאחת) עם הפרמטרים האלה.
const _loadTableDataInFlight = {};
const _loadTableDataRerunArgs = {};

async function loadTableData(tableId, week, year) {
  if (_loadTableDataInFlight[tableId]) {
    _loadTableDataRerunArgs[tableId] = { week, year };
    return;
  }
  _loadTableDataInFlight[tableId] = true;
  try {
    await _loadTableDataImpl(tableId, week, year);
  } finally {
    _loadTableDataInFlight[tableId] = false;
    const rerun = _loadTableDataRerunArgs[tableId];
    if (rerun) {
      delete _loadTableDataRerunArgs[tableId];
      loadTableData(tableId, rerun.week, rerun.year);
    }
  }
}

async function _loadTableDataImpl(tableId, week, year) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const coDesc = _coDesc(tableId);
  if (coDesc) {
    // טבלה שמוצגת כרגע לשבוע אחר ממה שעומדים לטעון לתוכה - עד שהמילוי יסתיים היא לא "מוכנה"
    // לשמירה (ראו saveCurrentWeek), כדי שתוכן השבוע הקודם לא ייכתב בטעות על השבוע החדש.
    if (table._coShown !== week + '_' + year) table._coReady = false;
  }

  if (KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId)) {
    renderDynamicTableStructure(tableId, week, year);
  } else if (coDesc && coDesc.kind === 'modiein') {
    _coEnsureModieinStructure(table, coDesc, week, year);
  }

  const dynamicTables = [
    'tazamTable', 'hirgTable', 'esukTable', 'pikudTable', 'bahalagTable',
    'reqesukTable', 'reqhirgTable', 'reqpikudTable', 'reqtazamTable', 'reqbahalagTable'
  ];
  const isDynamic = dynamicTables.includes(tableId);

  const key = getStorageKey(tableId, week, year);
  // בטבלאות המשולבות (קשר/אופטיקה) משתמש שאינו מורשה לערוך את העמוד הזה (יחידתי/צפייה בלבד)
  // חייב לראות את הגרסה המופצת בפועל, לא את הטיוטה החיה של המנהל - אחרת הוא רואה שינויים
  // שהמנהל עדיין לא הפיץ (אפיון QA: "מעדכן בטבלאות הגדולות לפני שהמנהל עשה הפצה").
  const isMasterCombined = MASTER_COMBINED_TABLES.includes(tableId);
  const canViewDraft = !isMasterCombined || typeof AUTH === 'undefined' || AUTH.canEditPage();
  const effectiveKey = canViewDraft ? key : (key + '_published');
  const data = await fetchTableData(effectiveKey);

  // אם המשתמש כבר עבר לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר (תשובה איטית מרשת
  // אמיתית, או מחזור רענון אוטומטי ישן שהתעכב) - זורקים את התוצאה הזו ולא נוגעים ב-DOM בכלל.
  // בלי הבדיקה הזו, תשובה איטית לשבוע ישן שמגיעה *אחרי* שכבר עברו לשבוע חדש "מדביקה" בטעות
  // את הנתונים הישנים על התצוגה של השבוע החדש - זה בדיוק הבאג שדווח ("שבוע מסוים מועתק
  // לשבוע אחר" בזמן מעבר בין שבועות, אומת ישירות עם מעקב רציף אחרי ה-DOM תחת השהיית רשת
  // מלאכותית - אפיון QA).
  if (week !== currentWeek || year !== currentYear) return;

  // מתאימים את מספר השורות (טבלאות דינמיות) *רק אם צריך בפועל* - בעבר הקוד תמיד כיווץ
  // ל-2 שורות ואז בנה מחדש, בכל מחזור רענון אוטומטי (כל כמה שניות) - גם כשמספר השורות בפועל
  // לא השתנה כלל, מה שגרם לשורות "להיעלם" לרגע (אותה תבנית באג כמו ב-renderDynamicTableStructure,
  // ראו שם - אפיון QA: "הנתונים נעלמים לרגע כל כמה שניות").
  if (isDynamic) {
    const tbody = table.tBodies[0];
    // מינימום: שורת נושא + שורה ריקה אחת. מספר השורות הנדרש נגזר מהמפתחות (כולל מפתחות של
    // פלוגות שנוספו, x<מזהה>_<שורה>) - ראו _coModieinRowsNeeded.
    const requiredRows = _coModieinRowsNeeded(coDesc, data, 2);
    while (tbody.rows.length > requiredRows) {
      tbody.deleteRow(-1);
    }
    while (tbody.rows.length < requiredRows) {
      addNewRow(tableId, false);
    }
  }

  // שדות הקלט עם מפתח האחסון שלהם: בטבלאות עם מבנה עמודות דינמי המפתח נגזר מהשדה עצמו, ובשאר
  // הטבלאות הוא האינדקס לפי סדר המסמך (כמו תמיד).
  const keyedInputs = coDesc
    ? _coKeyedInputs(table, coDesc)
    : Array.from(table.querySelectorAll('.cell-input')).map((input, idx) => ({ input, key: idx }));

  // Check for manager published data to highlight changes in orange
  let managerPublishedData = {};
  if (data && MANAGER_TRACKED_TABLES.includes(tableId)) {
    const managerPublishedKey = getStorageKey(tableId, week, year) + '_published';
    managerPublishedData = (typeof fetchTableData === 'function')
      ? (await fetchTableData(managerPublishedKey) || {})
      : JSON.parse(localStorage.getItem(managerPublishedKey) || '{}');
  }

  // סימוני "ממתין לייבוא" רלוונטיים רק למי שבכלל רואה את הטיוטה (מנהל/עורך) - צופה
  // שמוגבל לגרסה המופצת רואה ערכים שכבר זהים לפרסום מטבעם, ואין טעם/משמעות לסמן אותם.
  const pendingIndexes = (data && isMasterCombined && canViewDraft)
    ? await loadPendingImportIndexes(tableId, week, year)
    : [];
  const pendingSet = new Set(pendingIndexes);

  // ממלאים כל תא ישירות לערך הסופי שלו (מהנתון השמור אם קיים, אחרת ריק) - במעבר אחד על
  // פני כל התאים, בלי שלב-ביניים שמרוקן את כולם קודם ורק אחר כך ממלא מחדש. הריקון-ואז-מילוי
  // הישן יצר חלון זמן אמיתי (בזמן ה-await לשרת) שבו כל התאים נראים ריקים - בדיוק זה גרם
  // לנתונים "להיעלם לרגע" בכל מחזור רענון אוטומטי (כל כמה שניות, אפיון QA).
  keyedInputs.forEach(({ input, key: idx }) => {
    const hasVal = !!(data && data[idx] !== undefined);
    input.value = hasVal ? data[idx] : '';
    // הצבת value ישירות לא מפעילה אירוע 'input' (רק הקלדה אמיתית/dispatchEvent מפעילים אותו) -
    // בלי הקריאה הזו, תיבת "נושא שבוע"/"הערות משיכה\זיכוי" נשארת בגובה המינימלי שנקבע כשהתא
    // היה ריק, כך שטקסט ארוך שהוזן קודם נשאר קיים ב-value אך "נעלם" ויזואלית (אפיון QA:
    // "שיראו את כל הטקסט שמכניסים").
    if (input.classList.contains('topic-textarea')) autoResizeTopicTextarea(input);

    // קובעים אם התא הזה צריך סימון כתום (conflict-overlap) - ותמיד גם מסירים אותו כשלא,
    // לא רק מוסיפים כשכן. בטבלאות המשולבות (קשר/אופטיקה) הסימון נקבע לפי רשימת האינדקסים
    // הממתינים (pendingSet, ולא draft מול published, כדי לא לתלות אותו בעריכה ישירה של
    // המנהל); בשאר הטבלאות המנוהלות - השוואת draft מול published ישירות.
    // חשוב: התוצאה תמיד *מוחלת* (toggle, לא רק add) - כולל כשאין ערך בתא בכלל (hasVal=false).
    // בלי זה, תא שקיבל את הסימון בשבוע X (למשל דרך ייבוא מיחידה) היה נשאר מסומן גם בשבוע Y
    // אחר לגמרי אחרי מעבר שבוע - כי אופטימיזציית "לא בונים מחדש את מבנה הטבלה אם רשימת
    // הפריטים לא השתנתה" (renderDynamicTableStructure) משאירה את אותם תאי DOM ממש בין
    // שבועות, וכלום לא ניקה מהם בעבר את הסימון של השבוע הקודם (אפיון QA: "הסימון עובר גם
    // לשבועות אחרים").
    let shouldMarkConflict = false;
    if (hasVal) {
      if (MANAGER_TRACKED_TABLES.includes(tableId) && !isMasterCombined) {
        const publishedVal = managerPublishedData[idx] || '';
        if (data[idx] !== publishedVal) shouldMarkConflict = true;
      }
      if (isMasterCombined && canViewDraft && pendingSet.has(idx)) shouldMarkConflict = true;
    }
    const td = input.closest('td');
    if (td) td.classList.toggle('conflict-overlap', shouldMarkConflict);
  });

  if (data && isDynamic) {
    const tbody = table.tBodies[0];
    const lastRow = tbody.lastElementChild;
    if (lastRow) {
      const isLastRowEmpty = Array.from(lastRow.querySelectorAll('.cell-input')).every(input => input.value.trim() === '');
      if (!isLastRowEmpty) addNewRow(tableId, false);
    }
  }

  if (isUnitReqTable(tableId)) recalcUnitReqTotals(table);

  if (coDesc) {
    table._coShown = week + '_' + year;
    table._coReady = true;
    if (table._coRebase) {
      table._coRebase = false;
      if (typeof resetUndoHistory === 'function') resetUndoHistory();
    }
  }
}

/* ================================
   ניווט שבועות
================================ */

// השבוע שהמשתמש צופה בו כרגע, לפי חלון/כרטיסייה (sessionStorage) - כדי שמעבר בין טבלאות
// (קשר, אופטיקה, מודיעין וכו') לא יאפס בחזרה לשבוע הקלנדרי האמיתי (אפיון QA).
const VIEWED_WEEK_KEY = 'pakadex_viewed_week';

function saveViewedWeek(week, year) {
  try { sessionStorage.setItem(VIEWED_WEEK_KEY, JSON.stringify({ week, year })); } catch (e) {}
}

function loadViewedWeek() {
  try {
    const raw = sessionStorage.getItem(VIEWED_WEEK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isInteger(parsed.week) && Number.isInteger(parsed.year)) return parsed;
  } catch (e) {}
  return null;
}

// מנקה את השבוע הנצפה לפני ניווט לאזור/עמוד אחר בתפריט הצדדי (ראשי/טבלאות/ניהול הרשאות/
// עמוד יחידה) - כדי שמעבר בין *אזורים* שונים באפליקציה תמיד ינחת מחדש על השבוע הקלנדרי
// האמיתי, בניגוד למעבר בין *קטגוריות טבלה* (קשר/אופטיקה/מודיעין/מענים רפואיים/פלוגתי/שעות שק"ם)
// דרך סרגל הקטגוריות העליון, שממשיך לשמר את השבוע הנצפה כרגיל (אפיון QA: "בין עמודים תמיד
// לשבוע הנוכחי, אבל בין טבלה לטבלה באותו עמוד להישאר על השבוע שנבחר").
function clearViewedWeek() {
  try { sessionStorage.removeItem(VIEWED_WEEK_KEY); } catch (e) {}
}

// קטגוריית הטבלה הנצפית כרגע (קשר/אופטיקה/מודיעין/מענים רפואיים/פלוגתי/שעות שק"ם) בעמוד יחידה -
// נשמרת ב-sessionStorage כדי שמעבר בין "דרישות" ל"הקצאות" (שמבוצע כניווט מלא לעמוד עם
// ?view=... ולא כהחלפת סקשן פנימית) יישאר על אותה קטגוריה, במקום לקפוץ תמיד לקשר (אפיון QA).
const CURRENT_CATEGORY_KEY = 'pakadex_current_category';

function saveCurrentCategory(category) {
  try { sessionStorage.setItem(CURRENT_CATEGORY_KEY, category); } catch (e) {}
}

function loadCurrentCategory() {
  try { return sessionStorage.getItem(CURRENT_CATEGORY_KEY); } catch (e) { return null; }
}

// מנקה את הקטגוריה הנצפית - נקראת לצד clearViewedWeek() בניווט ל*אזור* אחר באפליקציה
// (ראשי/טבלאות/ניהול הרשאות/עמוד ראשי), כדי שכניסה טרייה לעמוד יחידה תתחיל מקשר כברירת מחדל.
// בכוונה *לא* נקראת בקישורי "דרישות"/"הקצאות" של אותה יחידה, כדי לשמר שם את הקטגוריה.
function clearViewedCategory() {
  try { sessionStorage.removeItem(CURRENT_CATEGORY_KEY); } catch (e) {}
}

/**
 * שומרת את השבוע הנוכחי ומעבירה את תצוגת המערכת לשבוע ושנה חדשים.
 * @param {number} year - השנה
 * @param {number} week - מספר השבוע
 */
async function loadWeek(year, week) {
  await saveCurrentWeek();
  currentWeek = week;
  currentYear = year;
  saveViewedWeek(week, year);
  await updateUIForWeek();
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
}

/**
 * מעבירה את התצוגה לשבוע הקודם (כולל מעבר שנה במידת הצורך).
 */
function prevWeek() {
  let week = currentWeek - 1, year = currentYear;
  if (week < 1) { year--; week = getWeeksInYear(year); }
  loadWeek(year, week);
}

/**
 * מעבירה את התצוגה לשבוע הבא (כולל מעבר שנה במידת הצורך).
 */
function nextWeek() {
  let week = currentWeek + 1, year = currentYear;
  if (week > getWeeksInYear(currentYear)) { week = 1; year++; }
  loadWeek(year, week);
}

/**
 * מעדכנת את כל רכיבי ממשק המשתמש (שדות שבוע, טבלאות, רשימות מענים רפואיים, חדר"ג ושק"ם) בעת החלפת שבוע.
 */
/**
 * מריצה פונקציה אסינכרונית על כל איבר במערך, בבאצ'ים חסומים בגודל `batchSize` (במקום כולם
 * במקביל, ובניגוד לרצף אחד-אחד) - כדי לא להציף שרת אמיתי (SharePoint) בעשרות בקשות בו-זמנית.
 * במצב שרת מרכזי אמיתי (בניגוד ל-localStorage המקומי שנבדק כאן) בקשות רבות-מדי בבת-אחת
 * עלולות להיכשל/להיחסם חלקית (הגבלת קצב/עומס) - כשל כזה ב-fetchTableData חוזר בשקט ל-
 * localStorage המקומי (ראו _loadFromSharePoint), שעלול להיות ריק/מיושן במכשיר שלא טען את
 * השבוע הזה בעצמו לאחרונה - בפועל זה בדיוק מה שגרם לחיפוש "לפספס" התאמות אמיתיות שקיימות
 * בפועל בשרת (אפיון QA: "מילה שקיימת כמה פעמים... נמצאה רק פעם אחת").
 */
async function _runInBatches(items, batchSize, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * סורקת את כל שבועות השנה הנתונה עבור טבלה מאוחדת (קשר/אופטיקה) ומחזירה את השבועות שבהם
 * שורת "נושא שבוע" מכילה את מחרוזת החיפוש - **כל** התאים התואמים בשורה (לא רק ההתאמה
 * הראשונה שנתקלים בה - יחידות שונות עלולות לכתוב את אותה מילה בתאי הנושא הנפרדים שלהן
 * באותו שבוע, וכולן רלוונטיות). קוראת ישירות מהטיוטה של המנהל (לא מ-published) - תואם למה
 * שהמנהל רואה בפועל בעריכה שלו (ראו loadTableData/canViewDraft).
 * שדה נושא-השבוע תמיד תופס את האינדקסים 0..dataCols-1 בדיוק (שורת הנושא היא תמיד השורה
 * הראשונה שנבנית, ו-readTableData ממספרת אינדקסים לפי סדר .cell-input במסמך - ראו שם).
 * @param {string} tableId - 'keshertable' או 'optictable'
 * @param {number} dataCols
 * @param {string} term - מחרוזת החיפוש (לא רגישה לרישיות - השוואת includes פשוטה)
 * @param {number} year
 * @returns {Promise<{week:number, year:number, snippet:string}[]>}
 */
async function _searchWeeklyTopic(tableId, dataCols, term, year) {
  const lowerTerm = term.trim().toLowerCase();
  if (!lowerTerm) return [];
  const weeksInYear = getWeeksInYear(year);
  const weeks = Array.from({ length: weeksInYear }, (_, i) => i + 1);
  const perWeek = await _runInBatches(weeks, 8, async (week) => {
    const data = await fetchTableData(getStorageKey(tableId, week, year));
    if (!data) return null;
    const snippets = [];
    const consider = (val) => {
      if (val && String(val).toLowerCase().includes(lowerTerm) && !snippets.includes(String(val))) {
        snippets.push(String(val));
      }
    };
    for (let i = 0; i < dataCols; i++) consider(data[i]);
    // נושא השבוע של פלוגות שנוספו נשמר תחת x<מזהה>_0 (שורה 0 = שורת הנושא)
    Object.keys(data).forEach(k => {
      const px = _coParseExtraKey(k);
      if (px && px.r === 0) consider(data[k]);
    });
    return snippets.length ? { week, year, snippet: snippets.join(' | ') } : null;
  });
  return perWeek.filter(Boolean);
}

/**
 * מזריקה (פעם אחת בלבד, מוגנת מהזרקה כפולה) תיבת חיפוש נושא-שבוע לצד כפתורי "העתק שבוע"/
 * "הדבק לכל השנה" בעמודי המנהל של קשר ואופטיקה בלבד - עבור טבלת המאסטר המאוחדת (keshertable/
 * optictable), לא עמודי יחידה. פועלת אחרי טעינת הדף (המפתח toolbarRow מזוהה לפי .add-row-btn
 * הקיים כבר ב-HTML הסטטי של העמוד, בלי צורך לשכפל הזרקה נפרדת לכל קובץ).
 */
function _initTopicSearchUI() {
  const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const isKesher = page === 'kesher.html';
  const isOptic = page === 'optic.html';
  if (!isKesher && !isOptic) return;
  if (document.getElementById('topic-search-wrap')) return;

  const tableId = isKesher ? 'keshertable' : 'optictable';
  const listEntry = (isKesher ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST).find(t => t.id === tableId);
  if (!listEntry) return;
  const dataCols = listEntry.dataCols;

  const toolbarRow = document.querySelector('.add-row-btn');
  const rightGroup = toolbarRow ? toolbarRow.parentElement.lastElementChild : null;
  if (!rightGroup) return;

  const wrap = document.createElement('div');
  wrap.id = 'topic-search-wrap';
  wrap.style.cssText = 'position:relative; display:flex; align-items:center; gap:6px;';

  const yearNow = (typeof currentYear !== 'undefined') ? currentYear : new Date().getFullYear();
  const yearOptions = [yearNow - 1, yearNow, yearNow + 1]
    .map(y => `<option value="${y}"${y === yearNow ? ' selected' : ''}>${y}</option>`).join('');

  wrap.innerHTML = `
    <div style="position:relative;">
      <button type="button" id="topic-search-icon" title="חפש" aria-label="חפש"
        style="position:absolute; top:50%; left:6px; transform:translateY(-50%); font-size:13px; opacity:0.6; border:none; background:none; padding:2px 4px; cursor:pointer; line-height:1;">🔍</button>
      <input type="text" id="topic-search-input" placeholder="חיפוש לפי נושא שבוע..."
        style="width:170px; height:32px; padding:0 8px 0 26px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
    </div>
    <select id="topic-search-year" style="height:32px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">${yearOptions}</select>
    <div id="topic-search-results" style="display:none; position:absolute; top:38px; left:0; z-index:50; background:#fff; border:1px solid #cbd5e1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.18); min-width:260px; max-width:360px; max-height:320px; overflow-y:auto; padding:4px;"></div>
  `;
  rightGroup.insertAdjacentElement('afterbegin', wrap);

  if (!document.getElementById('topic-search-style')) {
    const style = document.createElement('style');
    style.id = 'topic-search-style';
    style.textContent = '.topic-search-result:hover { background:#f1f5f9 !important; } #topic-search-icon:hover { opacity:1 !important; }';
    document.head.appendChild(style);
  }

  const input = wrap.querySelector('#topic-search-input');
  const yearSelect = wrap.querySelector('#topic-search-year');
  const icon = wrap.querySelector('#topic-search-icon');
  const resultsBox = wrap.querySelector('#topic-search-results');

  // מזהה חיפוש עולה (monotonic) - כדי שתשובה איטית לחיפוש ישן לא "תדביק" בטעות תוצאות
  // שגויות על גבי חיפוש חדש יותר שכבר הוקלד, אם שתי בקשות באוויר בו-זמנית (הקלדה מהירה).
  let searchToken = 0;

  const runSearch = async () => {
    const term = input.value.trim();
    const myToken = ++searchToken;
    if (!term) { resultsBox.style.display = 'none'; return; }
    const searchYear = parseInt(yearSelect.value, 10);
    resultsBox.style.display = 'block';
    resultsBox.innerHTML = '<div style="padding:8px; color:#64748b; font-size:13px;">מחפש...</div>';
    const matches = await _searchWeeklyTopic(tableId, dataCols, term, searchYear);
    if (myToken !== searchToken) return; // הוקלד חיפוש חדש בזמן שזה היה באוויר - מתעלמים מהתוצאה הישנה
    if (matches.length === 0) {
      resultsBox.innerHTML = '<div style="padding:8px; color:#64748b; font-size:13px;">לא נמצאו שבועות עם נושא זה.</div>';
      return;
    }
    resultsBox.innerHTML = matches.map(m => `
      <button type="button" class="topic-search-result" data-week="${m.week}" data-year="${m.year}"
        style="display:block; width:100%; text-align:right; padding:6px 8px; border:none; background:none; cursor:pointer; border-radius:4px; font-size:13px; color:#0f172a;">
        <strong>שבוע ${m.week} (${m.year})</strong><br><span style="color:#475569;">${escapeHtml(m.snippet)}</span>
      </button>
    `).join('');
  };

  // חיפוש חי תוך כדי הקלדה - עם דיליי קצר (debounce) כדי לא להריץ סריקת 52 שבועות על כל תו
  // בודד שמוקלד. האייקון (בצד שמאל של התיבה) ומקש Enter מריצים חיפוש מיידי, בלי להמתין
  // לדיליי - לבקשת המשתמש שהאייקון יהיה לחיץ.
  let debounceTimer = null;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSearch, 350);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(debounceTimer); runSearch(); } });
  icon.addEventListener('click', () => { clearTimeout(debounceTimer); runSearch(); });
  yearSelect.addEventListener('change', () => { if (input.value.trim()) runSearch(); });
  resultsBox.addEventListener('click', (e) => {
    const resBtn = e.target.closest('.topic-search-result');
    if (!resBtn) return;
    const w = parseInt(resBtn.dataset.week, 10), y = parseInt(resBtn.dataset.year, 10);
    resultsBox.style.display = 'none';
    if (typeof loadWeek === 'function') loadWeek(y, w);
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) resultsBox.style.display = 'none';
  });
}

/**
 * מוחקת מהמטמון (_renderSnapshotCache) כל מפתח שמתחיל בקידומת נתונה - כדי לאלץ רינדור מחדש
 * בפעם הבאה שהפונקציה המתאימה נקראת, גם אם הנתונים עצמם (בניגוד למשל למיקום/גודל בפיקסלים)
 * לא השתנו כלל. ראו שימוש ב-_initZoomSyncHandler.
 */
function _invalidateRenderCachePrefix(prefix) {
  Object.keys(_renderSnapshotCache).forEach(k => { if (k.startsWith(prefix)) delete _renderSnapshotCache[k]; });
}

/**
 * מחברת (פעם אחת בלבד, מוגנת מהזרקה כפולה) את סליידר הזום של עמוד חדר"ג (#zoomSlider,
 * hadrag.html) לרינדור-מחדש כפוי של שכבות ההתנגשות (renderStackedConflicts). השכבות
 * ממוקמות/ממודדות ב-position:absolute עם פיקסלים מוחלטים (getBoundingClientRect + scroll),
 * ומוצמדות ל-document.body - לא לתוך .table-container שעליו חל ה-CSS zoom של הסליידר עצמו.
 * המדידה עצמה (getBoundingClientRect) כן משקפת את רמת הזום *ברגע המדידה*, אבל _renderDataChanged
 * מדלג על רינדור מחדש כשנתוני ההתנגשות עצמם (לא הזום) לא השתנו - כך שאחרי שינוי זום בלי שינוי
 * נתונים, השכבות נשארות "תקועות" בגודל/מיקום מהזום הקודם, לא פרופורציונליות יותר לתאים
 * שהשתנו בגודלם (אפיון QA: "מגדילים את הטבלה... המשבצת על משבצת נשארת קטנה ביחס למשבצות").
 * לכן, בכל שינוי זום, מוחקים במפורש את המטמון של שכבות ההתנגשות ומרנדרים אותן מחדש - כדי
 * שהמדידה תתבצע מחדש ברמת הזום העדכנית.
 */
function _initZoomSyncHandler() {
  const slider = document.getElementById('zoomSlider');
  if (!slider || slider.dataset.stackedConflictSyncBound === 'true') return;
  slider.dataset.stackedConflictSyncBound = 'true';
  slider.addEventListener('input', () => {
    _invalidateRenderCachePrefix('stackedConflicts_hadrag_');
    if (typeof renderStackedConflicts === 'function') renderStackedConflicts('hadrag');
  });
}

async function updateUIForWeek() {
  const weekInput = document.getElementById('weekInput');
  const weekInputOptic = document.getElementById('weekInputOptic');
  if (weekInput) weekInput.value = currentWeek;
  if (weekInputOptic) weekInputOptic.value = currentWeek;

  // מעדכנת את שורת המועד/חג ליד הכותרת - השבוע הנצפה יכול להשתנות (ניווט קודם/הבא) בלי
  // שקוראים ל-renderNavbars מחדש, ראו ההערה המפורטת ב-_injectDateAndClassificationBanner.
  if (typeof _injectDateAndClassificationBanner === 'function') _injectDateAndClassificationBanner();
  if (typeof _initTopicSearchUI === 'function') _initTopicSearchUI();
  if (typeof _initZoomSyncHandler === 'function') _initZoomSyncHandler();

  // ספר הפלוגות (פלוגות שנוספו/הוסרו) חייב להיות טרי לפני שהטבלאות נבנות - מבנה העמודות
  // נגזר ממנו. נקרא מהשרת (אם מוגדר) אל המטמון המקומי שממנו getCompanyLayout קוראת.
  await refreshCompanyRoster();

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
  
  // ממקמות אוטומטית בקשות שפורסמו ("שמור ומוכן לייבוא") ישירות בטיוטת הטבלה - בלי צעד אישור
  // ידני של המנהל (בקשת המפקדים). פעולת נתונים טהורה (לא נוגעת ב-DOM) - בטוחה גם בעמוד יחידה.
  if (typeof autoPlaceRequests === 'function') await autoPlaceRequests('hadrag');
  if (typeof autoPlaceRequests === 'function') await autoPlaceRequests('shekem');

  // הטבלאות (עם סימוני הכתום) חייבות להיטען לפני גריד הבקשות של היחידה, כדי שהסריקה הישירה
  // של הגריד המפורסם (paintUnitRequestGrid) תפעל על נתונים עדכניים.
  if (typeof loadHadragTables === 'function') await loadHadragTables(currentWeek, currentYear);
  if (typeof renderStackedConflicts === 'function') await renderStackedConflicts('hadrag');
  if (typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if (typeof loadShekemTables === 'function') await loadShekemTables(currentWeek, currentYear);
  if (typeof renderStackedConflicts === 'function') await renderStackedConflicts('shekem');
  if (typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();

  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  // הטבלאות נבנות דינמית - יש להחיל מחדש את ההרשאות לאחר כל רינדור
  if (typeof applyPermissions === 'function') applyPermissions();
}

/* ================================
   סממן הפצה (ליד כפתור "הפץ שינויים")
   מבוסס על קיום/היעדר תאים מסומנים בכתום (.conflict-overlap) - סימן לשינויים שטרם הופצו.
================================ */
let _publishIndicatorObserver = null;

/**
 * מפעילה בדיקה שצובעת את כפתור "הפץ שינויים"/"שמור ומוכן לייבוא" (אדום/ירוק) -
 * ראו updateGlobalExportButtonStatus.
 */
// ההגנה מפני הרצות חופפות נמצאת בפועל בתוך updateGlobalExportButtonStatus עצמה (כדי לחול
// גם על מקומות בקוד שקוראים לה ישירות, לא רק דרך הפונקציה הזו) - ראו ההערה שם.
async function updatePublishIndicator() {
  await updateGlobalExportButtonStatus();
}

/**
 * מפעילה מעקב (MutationObserver) שמעדכן את סממן ההפצה בכל שינוי בסימוני הכתום בעמוד.
 * מקבצת (debounce) פרצי שינויים סמוכים למחזור בדיקה אחד - בטבלאות האינטראקטיביות
 * (חדר"ג/שק"ם/צביעת תאים/גרירה) שינויי class יכולים לקרות עשרות פעמים בשנייה; בלי הקיבוץ
 * הזה כל שינוי כזה פתח סבב בדיקות רשת נפרד לגמרי (אפיון QA).
 */
let _publishIndicatorDebounceTimer = null;
function initPublishIndicatorObserver() {
  if (_publishIndicatorObserver) return;
  _publishIndicatorObserver = new MutationObserver(() => {
    clearTimeout(_publishIndicatorDebounceTimer);
    _publishIndicatorDebounceTimer = setTimeout(() => updatePublishIndicator(), 300);
  });
  _publishIndicatorObserver.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
}

/* ================================
   בדיקה גלובלית: האם קיימים בכלל המערכת (לא רק בעמוד הנוכחי) שינויים שטרם הופצו
   לשבוע הנוכחי - קשר/אופטיקה (לפי רשימת הממתינים), טבלאות מודיעין/דרישת יחידה,
   חדר"ג, שק"ם ומענים רפואיים (השוואת draft מול published ישירות מהאחסון).
================================ */

/** מסננת ערכי תא "ריקים למעשה" (מחרוזת ריקה, או תא חדר"ג/שק"ם ללא טקסט וללא צבע) כדי שהשוואת draft מול published לא תיתקל בפער מלאכותי. */
function _isEffectivelyEmptyCell(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'object') {
    const valEmpty = !v.val || String(v.val).trim() === '';
    const noColor = !v.classes || v.classes.length === 0 || (v.classes.length === 1 && !v.classes[0]);
    return valEmpty && noColor;
  }
  return false;
}

function _normalizeCellDataForCompare(obj) {
  const out = {};
  if (!obj) return out;
  Object.keys(obj).forEach(k => {
    if (!_isEffectivelyEmptyCell(obj[k])) out[k] = obj[k];
  });
  return out;
}

async function _hasUnpublishedDraft(key) {
  const draft = await fetchTableData(key);
  const normalizedDraft = _normalizeCellDataForCompare(draft);
  if (Object.keys(normalizedDraft).length === 0) return false;
  const published = await fetchTableData(key + '_published');
  const normalizedPublished = _normalizeCellDataForCompare(published);
  // השוואה יציבה (ללא תלות בסדר המפתחות): מפתחות של פלוגות שנוספו (x12_3) הם טקסטואליים, וסדר
  // ההוספה שלהם לאובייקט יכול להשתנות בין טיוטה לפרסום (שמירה מה-DOM מול מיפוי שורות מחדש).
  return _stableStringify(normalizedDraft) !== _stableStringify(normalizedPublished);
}

async function hasAnySystemPendingChanges(week, year) {
  // כל הבדיקות כאן קריאה-בלבד ועצמאיות זו מזו (אין תלות סדר) - מריצים את כולן **במקביל**
  // (Promise.all) במקום ברצף עם await בלולאה. במצב שרת מרכזי (SharePoint) כל בדיקה היא
  // בקשת רשת אמיתית עם השהיה משלה - הרצה ברצף של עשרות בדיקות (טבלאות מנהל + חדר"ג + שק"ם +
  // מענים רפואיים + כל הרשימות) הצטברה להשהיה של כמה שניות עד שכפתור "הפץ שינויים" מתעדכן, מה
  // שנראה כאילו הוא "לא מתעדכן בזמן" ודורש כמה לחיצות (אפיון QA).
  const checks = [];

  // קשר/אופטיקה - כפתור "הפץ שינויים" הוא סממן גלובלי ("האם יש בכלל משהו שלא הופץ"), ולכן
  // בודק את הטיוטה מול הפרסום של הטבלה כולה - כולל עריכה ישירה של המנהל בטבלה הגדולה, לא רק
  // ייבוא (בשונה מהסימון הכתום על תא ספציפי, שנשאר מוגבל לייבוא בלבד כדי לא "ללכלך" תאים
  // שהמנהל פשוט מילא/תיקן בעצמו - ראו MASTER_COMBINED_TABLES והסימון ב-loadTableData).
  for (const tableId of MASTER_COMBINED_TABLES) {
    checks.push(_hasUnpublishedDraft(getStorageKey(tableId, week, year)));
  }

  // מודיעין (טבלאות המנהל בלבד - ADMIN_OWNED_MODIEIN_TABLES). **לא** כל MANAGER_TRACKED_TABLES:
  // הרשימה ההיא כוללת גם reqXTable/XkeshertableX/XoptictableX - טבלאות הדרישה של היחידות
  // עצמן (קשר/אופטיקה/מודיעין), ששייכות ליחידה ומתפרסמות רק דרך "שמור ומוכן לייבוא" שלה
  // (ראו _unitOwnedDraftKeys), לא דרך "הפץ שינויים" של המנהל בכלל. כשהן נכללו כאן, כל שינוי
  // לא-שמור של *כל* יחידה כלשהי (מצב שכמעט תמיד קיים בפועל) השאיר את כפתור המנהל אדום
  // לצמיתות בלי שום דרך של המנהל לתקן את זה - הוא לא יכול לפרסם נתונים שאינם שלו (אפיון QA:
  // "לוחץ על הפץ שינויים... לא משתנה לירוק, לא משנה מאיזה טבלה הוא עומד").
  for (const tableId of ADMIN_OWNED_MODIEIN_TABLES) {
    checks.push(_hasUnpublishedDraft(getStorageKey(tableId, week, year)));
  }

  // חדר"ג
  for (const tableId of Object.keys(HADRAG_TABLES_MAP)) {
    checks.push(_hasUnpublishedDraft(`hadragData_${tableId}_week${week}_year${year}`));
  }

  // שק"ם
  checks.push(_hasUnpublishedDraft(`shekemData_body-shekem_week${week}_year${year}`));

  // מענים רפואיים - טבלת המנהל עצמה
  checks.push(_hasUnpublishedDraft(getStorageKey('hipoktable', week, year)));

  // בקשות מענים רפואיים שיחידה פרסמה וטרם יובאו לטבלת המנהל
  checks.push((async () => {
    const publishedHipokEntries = (await fetchTableData(getHipokEntriesKey(week, year) + '_published')) || [];
    if (publishedHipokEntries.length === 0) return false;
    const importedIds = new Set(await loadHipokImportedIds(week, year));
    return publishedHipokEntries.some(e => !importedIds.has(e.id));
  })());

  // בקשות חדר"ג/שק"ם שיחידה פרסמה וטרם אושרו על ידי המנהל
  checks.push(
    fetchTableData(getHadragRequestsKey(week, year) + '_published')
      .then(list => (list || []).some(r => r.status !== 'approved'))
  );
  checks.push(
    fetchTableData(getShekemRequestsKey(week, year) + '_published')
      .then(list => (list || []).some(r => r.status !== 'approved'))
  );

  const results = await Promise.all(checks);
  return results.some(Boolean);
}

// טבלאות הדרישה של כל יחידה (קשר, אופטיקה, מודיעין) - "שמור ומוכן לייבוא" הוא כפתור כללי
// אחד לכולן יחד, ולכן גם צביעת הכפתור (אדום/ירוק) בודקת את כל השלוש, לא רק את הכרטיסייה הפתוחה כרגע.
const UNIT_OWN_TABLES = {
  'esuk.html': ['esukkeshertable', 'esukoptictable', 'reqesukTable'],
  'hirg.html': ['kkeshertable', 'koptictable', 'reqhirgTable'],
  'pikud.html': ['pkeshertable', 'poptictable', 'reqpikudTable'],
  'tazam.html': ['tkeshertable', 'toptictable', 'reqtazamTable'],
  'bahalag.html': ['bkeshertable', 'boptictable', 'reqbahalagTable']
};

// משווה תת-קבוצה (מסוננת ליחידה הנוכחית) מתוך רשימה משותפת (מענים רפואיים/חדר"ג/שק"ם) בין draft
// ל-published, כדי לגלות אם ליחידה יש רשומות משלה שעדיין לא נשמרו/פורסמו - ללא תלות
// בשינויים שביצעו יחידות אחרות באותה רשימה משותפת.
function _normalizeEntryListForCompare(list, filterFn) {
  return (list || [])
    .filter(filterFn)
    .map(item => ({ ...item }))
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
}

async function _hasUnitOwnEntryListPending(key, filterFn) {
  const draft = await fetchTableData(key);
  const published = await fetchTableData(key + '_published');
  const normDraft = _normalizeEntryListForCompare(draft, filterFn);
  const normPublished = _normalizeEntryListForCompare(published, filterFn);
  return JSON.stringify(normDraft) !== JSON.stringify(normPublished);
}

async function hasUnitPendingChanges(currentPage, week, year) {
  // בלוקים שממתינים בזיכרון בלבד נבדקים מיד וללא רשת - אין טעם להמתין לבדיקות הרשת אם כבר
  // ידוע שיש שינוי לא-שמור (אפיון QA - ראו הערה על ה-Promise.all למטה).
  if (typeof hadragStagedBlocks !== 'undefined' && hadragStagedBlocks.some(b => !b.reqId || b.dirty)) return true;
  if (typeof shekemStagedBlocks !== 'undefined' && shekemStagedBlocks.some(b => !b.reqId || b.dirty)) return true;

  // שאר הבדיקות קריאה-בלבד ועצמאיות זו מזו - מריצים את כולן במקביל (Promise.all) כדי לא
  // לצבור השהיית רשת אמיתית של כל בדיקה בנפרד ברצף (אותה בעיה בדיוק כמו ב-
  // hasAnySystemPendingChanges - ראו ההערה שם).
  const tables = UNIT_OWN_TABLES[currentPage] || [];
  const checks = tables.map(tableId => _hasUnpublishedDraft(getStorageKey(tableId, week, year)));

  // "שמור ומוכן לייבוא" הוא כפתור כללי - חל גם על בקשות מענים רפואיים/חדר"ג/שק"ם שהיחידה הגישה
  // (רשימות משותפות לכל היחידות, מסוננות כאן לפי הצבע של היחידה הנוכחית בלבד).
  const unitColor = PAGE_UNIT_MAP[currentPage];
  if (unitColor) {
    checks.push(_hasUnitOwnEntryListPending(getHipokEntriesKey(week, year), e => e.color === unitColor));
    checks.push(_hasUnitOwnEntryListPending(getHadragRequestsKey(week, year), r => r.unit === unitColor));
    checks.push(_hasUnitOwnEntryListPending(getShekemRequestsKey(week, year), r => r.unit === unitColor));
  }

  const results = await Promise.all(checks);
  if (results.some(Boolean)) return true;

  return false;
}

/**
 * צובעת את כפתור הייצוא (אדום = יש שינויים חדשים, ירוק = הכל מעודכן לשבוע הנוכחי):
 * - "הפץ שינויים" (עמודי מנהל) - בדיקה גלובלית לכל המערכת (קשר/אופטיקה/מודיעין/מענים רפואיים/
 *   חדר"ג/שק"ם), לא רק לעמוד הנוכחי.
 * - "שמור ומוכן לייבוא" (עמוד יחידה, מזוהה לפי מחלקת unit-ready) - כפתור כללי לכל טבלאות
 *   הדרישה של אותה קבוצה (קשר+אופטיקה+מודיעין), לא רק לכרטיסייה הפתוחה כרגע.
 */
// מגינים כאן, בפונקציית העבודה עצמה - לא רק ב-updatePublishIndicator - כי יש עוד כמה
// מקומות בקוד שקוראים לפונקציה הזו ישירות (לא דרך updatePublishIndicator), ובלי ההגנה כאן
// כל אחד מהם היה פותח סבב בקשות רשת מקביל משלו, עם אותה בעיית "תוצאה ישנה דורסת תוצאה
// חדשה" (אפיון QA: "לפעמים לוקח זמן או צריך ללחוץ כמה פעמים").
let _exportStatusInFlight = false;
let _exportStatusRerunQueued = false;

async function updateGlobalExportButtonStatus() {
  const btn = document.getElementById('global-export-btn');
  if (!btn) return;
  if (typeof currentWeek === 'undefined' || typeof currentYear === 'undefined') return;

  if (_exportStatusInFlight) {
    _exportStatusRerunQueued = true;
    return;
  }
  _exportStatusInFlight = true;
  try {
    const isUnitBtn = btn.classList.contains('unit-ready');
    const hasPending = isUnitBtn
      ? await hasUnitPendingChanges(AUTH.currentPage(), currentWeek, currentYear)
      : await hasAnySystemPendingChanges(currentWeek, currentYear);

    btn.classList.toggle('has-pending', hasPending);
    btn.classList.toggle('all-published', !hasPending);
  } finally {
    _exportStatusInFlight = false;
    if (_exportStatusRerunQueued) {
      _exportStatusRerunQueued = false;
      updateGlobalExportButtonStatus();
    }
  }
}

/**
 * פונקציית ייצוא מנהל: שומרת את הנתונים הנוכחיים למצב 'published'.
 * מנקה צבעים כתומים שסימנו שינויים.
 */
/**
 * בודקת אם הגרסה המפורסמת של אחד ממפתחות הטיוטה שעומדים להיכתב כבר השתנתה "מרחוק" (משתמש/
 * מכשיר אחר שהפיץ שינויים במקביל, במצב שרת מרכזי) מאז שהעותק המקומי האחרון נטען - כדי להזהיר
 * לפני הפצה שעלולה לדרוס בשקט את השינוי המקביל ההוא. פעילה רק כשמוגדר שרת מרכזי
 * (SharePoint/רשת צבאית); במצב מקומי (localStorage בלבד, ברירת המחדל) תמיד מחזירה false -
 * אין מכשיר אחר שיכול להתנגש איתו כשהאחסון הוא אותו localStorage בדיוק.
 * @param {string[]} draftKeys - מפתחות הטיוטה שעומדים להיות מועתקים ל-published
 * @returns {Promise<boolean>}
 */
async function _detectConcurrentPublish(draftKeys) {
  if (typeof DataService === 'undefined' || typeof DataService._isRemote !== 'function' || !DataService._isRemote()) {
    return false;
  }
  // בבאצ'ים (ראו _runInBatches) ולא ברצף אחד-אחד ולא כולם-במקביל - מול שרת מרכזי אמיתי,
  // "הפץ שינויים" בטבלה גדולה (הרבה מפתחות טיוטה - כל הפלוגות/הטבלאות) בדק כאן מפתח-אחר-מפתח
  // ברצף, מה שהצטבר להשהיה ארוכה (עשרות שניות) לפני שההפצה בכלל מתחילה - נראה למשתמש כאילו
  // הכפתור "לא מגיב"/"לא הופך לירוק" אחרי לחיצה (אפיון QA: "לוחץ על הפץ שינויים... לא משתנה
  // לירוק"), אותה תבנית בדיוק כמו שכבר תוקנה בחיפוש נושא השבוע ובבדיקת hasAnySystemPendingChanges.
  const results = await _runInBatches(draftKeys, 8, async (draftKey) => {
    const pubKey = draftKey + '_published';
    const localCached = localStorage.getItem(pubKey);
    let remote;
    try { remote = await DataService.getItem(pubKey); } catch (e) { return false; }
    const remoteStr = (remote !== null && remote !== undefined) ? JSON.stringify(remote) : null;
    return remoteStr !== null && remoteStr !== localCached;
  });
  return results.some(Boolean);
}

/**
 * מפתחות הרשימות המשותפות (לא שייכות למנהל או ליחידה ספציפית - כל הצדדים כותבים/קוראים
 * מאותו מערך משותף) - צריכות להתפרסם גם מפעולת המנהל וגם מפעולת כל יחידה.
 */
function _sharedRequestListKeys(week, year) {
  return [getHadragRequestsKey(week, year), getShekemRequestsKey(week, year), getHipokEntriesKey(week, year)];
}

/**
 * כל מפתחות ה"טיוטה" ששייכים בפועל למנהל (טבלאות מאוחדות/מאסטר וגריד חדר"ג/שק"ם) - בלי
 * טבלאות הדרישה של יחידות בודדות (אלה שייכות ליחידה עצמה, ראו _unitOwnedDraftKeys).
 */
function _adminOwnedDraftKeys(week, year) {
  const keys = [];
  MASTER_COMBINED_TABLES.forEach(tableId => {
    keys.push(getStorageKey(tableId, week, year));
    keys.push(getPendingImportKey(tableId, week, year));
  });
  ADMIN_OWNED_MODIEIN_TABLES.forEach(tableId => {
    keys.push(getStorageKey(tableId, week, year));
  });
  keys.push(getStorageKey('hipoktable', week, year));
  ['hadrag', 'shekem'].forEach(type => {
    _platoonTableIds(type).forEach(tableId => {
      keys.push(`${_platoonDataKeyPrefix(type)}_${tableId}_week${week}_year${year}`);
      keys.push(`${_platoonStackedKeyPrefix(type)}_${tableId}_week${week}_year${year}`);
    });
  });
  return keys.concat(_sharedRequestListKeys(week, year));
}

/**
 * כל מפתחות ה"טיוטה" ששייכים בפועל ליחידה נתונה (עמוד יחידה) - שלוש טבלאות הדרישה שלה
 * (קשר/אופטיקה/מודיעין) בלבד, בתוספת הרשימות המשותפות (ראו _sharedRequestListKeys).
 * @param {string} page - שם קובץ עמוד היחידה (למשל 'esuk.html')
 */
function _unitOwnedDraftKeys(page, week, year) {
  const ownTableIds = UNIT_OWN_TABLES[page] || [];
  return ownTableIds.map(id => getStorageKey(id, week, year)).concat(_sharedRequestListKeys(week, year));
}

/**
 * מציגה/מסירה מצב "עסוק" על כפתור "הפץ שינויים"/"שמור ומוכן לייבוא" בזמן שהפעולה בפועל
 * רצה (מול שרת מרכזי אמיתי זה יכול לקחת עשרות שניות - ראו הערה ב-globalExportManager) -
 * בלי זה הכפתור נראה "מת" ולא עונה בזמן שההפצה עדיין מתבצעת ברקע, והמשתמש נוטה ללחוץ שוב
 * או לחשוב שהפעולה נכשלה (אפיון QA: "לוחץ על הפץ שינויים... לא משתנה לירוק").
 */
function _setExportBtnBusy(busy, busyLabel) {
  const btn = document.getElementById('global-export-btn');
  if (!btn) return;
  if (busy) {
    if (btn.dataset.origLabel === undefined) btn.dataset.origLabel = btn.textContent;
    btn.textContent = busyLabel;
    btn.disabled = true;
  } else {
    if (btn.dataset.origLabel !== undefined) btn.textContent = btn.dataset.origLabel;
    btn.disabled = false;
  }
}

async function globalExportManager() {
  if (!confirm('האם אתה בטוח שברצונך להפיץ את כלל השינויים לשבוע זה? (פעולה זו תאשר את המצב הנוכחי ותנקה סימונים כתומים)')) return;

  // רשימת המפתחות השייכים בפועל למנהל (ראו _adminOwnedDraftKeys) - **כל** מפתח ברשימה הזו
  // נשלף ישירות (fetchTableData, מול שרת מרכזי אם קיים) ומופץ, בלי תלות בשאלה אם המכשיר/
  // העמוד הנוכחי כבר טען/שמר אותו בעבר בהפעלה הזו. בעבר הרשימה סוננה גם דרך
  // Object.keys(localStorage) - כלומר מפתח ששייך למנהל אבל שהדפדפן הזה מעולם לא טען באמת
  // (למשל המנהל פתח היום רק את עמוד "מענה רפואי" ומעולם לא ביקר השבוע בעמוד קשר/אופטיקה/
  // מודיעין/חדר"ג/שק"ם באותה הפעלה) היה נשמט בשקט מההפצה - למרות שהוא "שייך" למנהל ו-
  // hasAnySystemPendingChanges (שבודק תמיד מול השרת, לא מול localStorage) ממשיך לזהות אותו
  // כלא-מופץ, כך שהכפתור נשאר אדום לצמיתות אחרי הפצה "מלאה" כביכול (אפיון QA: "לוחץ על הפץ
  // שינויים בטבלאות הגדולות... לא משתנה לירוק", "לא משנה מאיזה טבלה הוא עומד"). ה-allowlist
  // עצמו (לא הסינון מול localStorage) הוא ההגנה מפני דליפת טיוטה של תפקיד אחר - ראו
  // ההיסטוריה בהערה שהייתה כאן קודם.
  const draftKeysSnapshot = _adminOwnedDraftKeys(currentWeek, currentYear);

  _setExportBtnBusy(true, 'בודק שינויים מקבילים...');
  try {
    if (await _detectConcurrentPublish(draftKeysSnapshot)) {
      _setExportBtnBusy(false);
      if (!confirm('שים לב: נראה שמשתמש/מכשיר אחר כבר הפיץ שינויים לשבוע זה מאז שהעמוד הזה נטען לאחרונה. המשך ההפצה עלול לדרוס את השינוי הזה. לרענן ולבדוק קודם מומלץ.\n\nלהמשיך בכל זאת ולהפיץ?')) return;
      _setExportBtnBusy(true, 'מפיץ שינויים...');
    } else {
      _setExportBtnBusy(true, 'מפיץ שינויים...');
    }

    // בבאצ'ים (לא ברצף אחד-אחד) - ראו הערה זהה ב-_detectConcurrentPublish. שולפים כל מפתח
    // עם fetchTableData (לא localStorage.getItem ישיר) כדי לקבל את הערך האמיתי גם אם המכשיר
    // הזה לא טען אותו קודם באותה הפעלה (ראו ההערה מעל draftKeysSnapshot).
    await _runInBatches(draftKeysSnapshot, 8, async (key) => {
      const data = await fetchTableData(key);
      if (data === null || data === undefined) return;
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(`${key}_published`, data);
      } else {
        localStorage.setItem(`${key}_published`, JSON.stringify(data));
      }
    });

    // 2. Remove orange highlights
    document.querySelectorAll('.conflict-overlap').forEach(el => {
      el.classList.remove('conflict-overlap');
    });

    // 2.5 מרוקנים את רשימות האינדקסים הממתינים בטבלאות המשולבות (קשר/אופטיקה) - ראו
    // MASTER_COMBINED_TABLES - כדי שהסימון הכתום שם יתאפס גם הוא עם ההפצה. חשוב לעשות זאת
    // *לפני* updatePublishIndicator, אחרת הבדיקה הגלובלית עדיין תמצא את הרשימה הישנה.
    MASTER_COMBINED_TABLES.forEach(tableId => savePendingImportIndexes(tableId, currentWeek, currentYear, []));

    if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

    // 3. Trigger save again so the orange class removal is saved (רק חדר"ג/שק"ם - קשר/אופטיקה/מודיעין/
    // מענים רפואיים לא נשמרים דרך פונקציית save ייעודית; סימון הכתום שלהם מחושב חי מהשוואת draft מול published
    // ומתעדכן ממילא בטעינה/עדכון הבא, לא צריך "שמירה חוזרת" מפורשת).
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();

    if (typeof addNotification === 'function') {
      addNotification(`📢 המנהל הפיץ שינויים לשבוע ${currentWeek} (${currentYear})`, 'distribute');
    }

    alert('השינויים הופצו בהצלחה!');
  } finally {
    _setExportBtnBusy(false);
  }
}

/**
 * בודקת שלכל טבלת דרישה של קשר/אופטיקה השייכת ליחידה הנוכחית (לפי UNIT_OWN_TABLES) יש
 * ערך ב"נושא שבוע" (השורה הראשונה, topic-textarea) - בקשת המפקדים: פלוגה לא יכולה לשמור
 * ולייבא (בשום פעולה - גם רק חדר"ג/שק"ם/מענה רפואי, לא משנה איזה חלק בעמוד היחידה נמצא
 * כרגע פתוח) בלי לתעד קודם על מה השבוע, תמיד - גם אם אין באותו שבוע שום עדכון חדש בקשר/
 * אופטיקה עצמם. מספיק תא אחד מלא בשורה (לא כל העמודות) כדי לא להכביד.
 * יוצא מהכלל: טבלה (קשר או אופטיקה בנפרד) שאין בה בכלל שום ערך (מלבד שורת הנושא עצמה) לא
 * נדרשת לנושא שבוע - אין טעם לחייב תיעוד על שבוע שלטבלה הזו אין בו בכלל מה לדווח (בקשת
 * המשתמש). הבדיקה נעשית לכל טבלה בנפרד - קשר עם ערכים ואופטיקה ריקה, למשל, עדיין תדרוש
 * נושא רק בקשר.
 * טבלה שלא קיימת כרגע ב-DOM (לא נטענה) לא נבדקת - אין מה לחסום על סמך משהו שלא קיים.
 * @returns {Promise<{ok: boolean, missing: string[]}>}
 */
async function _getUnitKesherOpticTopicStatus() {
  const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const tables = UNIT_OWN_TABLES[page];
  if (!tables) return { ok: true, missing: [] };
  const [kesherTableId, opticTableId] = tables;
  const missing = [];
  for (const { id, name } of [{ id: kesherTableId, name: 'תקשוב' }, { id: opticTableId, name: 'אופטיקה' }]) {
    const table = document.getElementById(id);
    const topicRow = table ? table.querySelector('tbody tr.topic-row') : null;
    if (!topicRow) continue;

    const hasAnyData = Array.from(table.querySelectorAll('tbody tr:not(.topic-row):not(.special-note-row) .cell-input'))
      .some(input => input.value.trim() !== '');
    if (!hasAnyData) continue;

    const filled = Array.from(topicRow.querySelectorAll('.topic-textarea')).some(ta => ta.value.trim() !== '');
    if (!filled) missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}

/**
 * פונקציית ייצוא פלוגה: שומרת את הטיוטה למצב שמאפשר למנהל לייבא.
 */
async function globalExportUnit() {
  if (!confirm('האם סיימת את השיבוץ וברצונך לשמור את הנתונים כך שיהיו מוכנים לייבוא על ידי המנהל?')) return;

  const topicStatus = await _getUnitKesherOpticTopicStatus();
  if (!topicStatus.ok) {
    alert(`יש למלא "נושא שבוע" בדרישות ה${topicStatus.missing.join(' וה')} לפני שמירה וייבוא.`);
    return;
  }

  // ממירים קודם כל בלוק "ממתין" שנוצר/הוזז בגריד הבקשות (חדר"ג/שק"ם) לרשומת בקשה בפועל -
  // אין כפתור "שמור בקשות" נפרד, "שמור ומוכן לייבוא" הוא הפעולה היחידה ששומרת אותן. אם יש
  // בלוק עם טקסט ריק העדכון עוצר כאן (ראו commitHadragStagedBlocks/commitShekemStagedBlocks).
  if (typeof commitHadragStagedBlocks === 'function' && !(await commitHadragStagedBlocks())) return;
  if (typeof commitShekemStagedBlocks === 'function' && !(await commitShekemStagedBlocks())) return;

  // רק מפתחות ששייכים בפועל ליחידה הזו (שלוש טבלאות הדרישה שלה + הרשימות המשותפות - ראו
  // _unitOwnedDraftKeys) - לא כל מפתח שמכיל את קידומת השבוע/שנה שקיים איכשהו ב-localStorage
  // של הדפדפן הזה. בלי ההגבלה הזו, אם אותו דפדפן שימש בעבר (למשל לבדיקה) גם כדי להיכנס
  // כמנהל, טיוטת מנהל שטרם הופצה (למשל שיבוץ ישיר בחדר"ג) הייתה מתפרסמת בטעות מתוך לחיצת
  // "שמור ומוכן לייבוא" של היחידה - בלי שהמנהל בכלל לחץ "הפץ שינויים" (אפיון QA: "שיבוץ
  // המנהל הופיע אפילו שהוא לא הפיץ אותו").
  // רשימת המפתחות השייכים בפועל ליחידה הזו (ראו _unitOwnedDraftKeys) - נשלפים ישירות עם
  // fetchTableData (לא סינון מול Object.keys(localStorage)) - ראו הערה זהה ומפורטת יותר
  // ב-globalExportManager.
  const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  const draftKeysSnapshot = _unitOwnedDraftKeys(page, currentWeek, currentYear);

  _setExportBtnBusy(true, 'בודק שינויים מקבילים...');
  try {
    if (await _detectConcurrentPublish(draftKeysSnapshot)) {
      _setExportBtnBusy(false);
      if (!confirm('שים לב: נראה שהנתונים האלה כבר עודכנו במקביל ממכשיר/משתמש אחר מאז שהעמוד הזה נטען. שמירה עכשיו עלולה לדרוס את העדכון הזה. לרענן ולבדוק קודם מומלץ.\n\nלהמשיך בכל זאת ולשמור?')) return;
      _setExportBtnBusy(true, 'שומר...');
    } else {
      _setExportBtnBusy(true, 'שומר...');
    }

    // בבאצ'ים (לא ברצף אחד-אחד) - ראו הערה זהה ב-globalExportManager/_detectConcurrentPublish.
    await _runInBatches(draftKeysSnapshot, 8, async (key) => {
      const data = await fetchTableData(key);
      if (data === null || data === undefined) return;
      if (typeof DataService !== 'undefined') {
        await DataService.setItem(`${key}_published`, data);
      } else {
        localStorage.setItem(`${key}_published`, JSON.stringify(data));
      }
    });

    document.querySelectorAll('.conflict-overlap').forEach(el => el.classList.remove('conflict-overlap'));
    if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

    if (typeof addNotification === 'function') {
      const notifyPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
      const unitName = (typeof UNIT_TITLE_MAP !== 'undefined' && UNIT_TITLE_MAP[notifyPage]) || 'יחידה';
      addNotification(`✅ ${unitName} שמרה נתונים מוכנים לייבוא לשבוע ${currentWeek} (${currentYear})`, 'unit-ready');
    }

    alert('הנתונים נשמרו ומוכנים לייבוא!');
  } finally {
    _setExportBtnBusy(false);
  }
}

/* ================================
   העתקת שבוע / הדבקה לכל השנה (אפיון 1.3) - מנהל בלבד
================================ */

// מעתיקה גם את מבנה השורות (rowList) כדי לשמור התאמה בין הנתונים לשמות האמצעים.
function copyRowListToWeek(category, targetWeek, targetYear) {
  const rows = getRowsForWeek(category, currentWeek, currentYear);
  persist(getRowsStorageKey(category, targetWeek, targetYear), rows);
}

/**
 * מזהה את הקטגוריה (קשר/אופטיקה) של טבלה נתונה - טבלת מנהל או טבלת דרישה יחידתית.
 * @param {string} tableId - מזהה הטבלה
 * @returns {'kesher'|'optic'|null}
 */
function getKesherOpticCategory(tableId) {
  if (KESHER_TABLE_LIST.some(t => t.id === tableId)) return 'kesher';
  if (OPTIC_TABLE_LIST.some(t => t.id === tableId)) return 'optic';
  return null;
}

/**
 * מעתיקה את תוכן טבלת קשר/אופטיקה (מנהל או יחידה) משבוע הנוכחי לשבוע יעד שנבחר.
 */
async function copyWeekToTarget(tableId) {
  const category = getKesherOpticCategory(tableId);
  const catName = category === 'kesher' ? 'תקשוב' : 'אופטיקה';
  const weeksInYear = getWeeksInYear(currentYear);
  const targetStr = prompt(`העתקת נתוני ${catName} משבוע ${currentWeek} (${currentYear}) לשבוע יעד.\nהזן מספר שבוע יעד (1-${weeksInYear}):`);
  if (targetStr === null) return;
  const target = parseInt(targetStr);
  if (isNaN(target) || target < 1 || target > weeksInYear) { alert('מספר שבוע לא תקין.'); return; }
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
 * בנוסף, שומרת ומייצאת (מפרסמת) אוטומטית את דרישות הפלוגות עבור השבוע הנוכחי ועבור כל
 * שבוע שאליו מדביקים:
 * - בטבלת מנהל משולבת (keshertable/optictable) - מפרסמת את טבלאות הבקשה היחידתיות
 *   שמיובאות אליה (ראו SUB_TABLE_MAPS), כדי שלא יווצר פער בין תוכן טבלת המנהל שהודבק
 *   לבין מצב "הדרישה המפורסמת" שהיחידות רואות (checkRequirementChanges קוראת רק מ-_published).
 * - בטבלת בקשה יחידתית עצמה (למשל esukkeshertable, מהעמוד של אותה יחידה) - מפרסמת אותה
 *   עצמה, אחרת טבלת המנהל לא תוכל לייבא ממנה (importFromSubTable קוראת גם היא רק מ-_published)
 *   עבור השבועות שאליהם הודבק, גם אם הטיוטה כן הועתקה.
 */
async function applyWeekToRestOfYear(tableId) {
  const category = getKesherOpticCategory(tableId);
  const catName = category === 'kesher' ? 'תקשוב' : 'אופטיקה';
  const weeksInYear = getWeeksInYear(currentYear);
  if (currentWeek >= weeksInYear) { alert('זהו השבוע האחרון בשנה - אין שבועות הבאים להדבקה.'); return; }
  if (!confirm(`פעולה זו תעתיק את תוכן טבלת ${catName} משבוע ${currentWeek} לכל השבועות ${currentWeek + 1}-${weeksInYear} בשנת ${currentYear}, ותדרוס את הנתונים הקיימים בהם.\nבנוסף, דרישות הפלוגות של השבוע הנוכחי יישמרו ויוצאו אוטומטית לכל אותם שבועות.\n\nלהמשיך?`)) return;

  await saveCurrentWeek();
  const data = await fetchTableData(getStorageKey(tableId, currentWeek, currentYear));
  if (!data) { alert('אין נתונים להעתקה בשבוע הנוכחי.'); return; }

  const isMasterCombined = MASTER_COMBINED_TABLES.includes(tableId);
  const subTableConfigs = isMasterCombined ? (SUB_TABLE_MAPS[tableId] || []) : [{ sourceTableId: tableId }];
  const subTableSnapshots = {};
  for (const cfg of subTableConfigs) {
    subTableSnapshots[cfg.sourceTableId] = (cfg.sourceTableId === tableId)
      ? data
      : await fetchTableData(getStorageKey(cfg.sourceTableId, currentWeek, currentYear));
  }
  for (const cfg of subTableConfigs) {
    const snap = subTableSnapshots[cfg.sourceTableId];
    if (!snap) continue;
    await DataService.setItem(getStorageKey(cfg.sourceTableId, currentWeek, currentYear) + '_published', snap);
  }

  let count = 0;
  for (let w = currentWeek + 1; w <= weeksInYear; w++) {
    await DataService.setItem(getStorageKey(tableId, w, currentYear), data);
    copyRowListToWeek(category, w, currentYear);

    for (const cfg of subTableConfigs) {
      const snap = subTableSnapshots[cfg.sourceTableId];
      if (!snap) continue;
      const subKey = getStorageKey(cfg.sourceTableId, w, currentYear);
      if (cfg.sourceTableId !== tableId) {
        await DataService.setItem(subKey, snap);
      }
      await DataService.setItem(subKey + '_published', snap);
    }

    count++;
  }

  if (typeof updatePublishIndicator === 'function') await updatePublishIndicator();

  alert(`הנתונים הועתקו ל-${count} שבועות (${currentWeek + 1}-${weeksInYear}), כולל שמירה וייצוא אוטומטיים של דרישות הפלוגות.`);
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
      // סדר הופעה הפוך (מהשבוע הגדול לקטן) - כדי שבתצוגה (RTL) השבוע הגדול/מאוחר יותר
      // יופיע בצד שמאל והקטן/מוקדם יותר בצד ימין, בהתאמה לכפתורי "הבא"/"קודם" שהוחלפו (אפיון QA).
      for (let offset = 2; offset >= -2; offset--) {
        let week = currentWeek + offset, year = currentYear;
        if (week < 1) { const prevYearWeeks = getWeeksInYear(year - 1); week += prevYearWeeks; year--; }
        if (week > getWeeksInYear(year)) { week -= getWeeksInYear(year); year++; }
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
      const maxWeek = (typeof getWeeksInYear === 'function') ? getWeeksInYear(currentYear) : 52;
      if (isNaN(val) || val < 1) val = 1;
      if (val > maxWeek) val = maxWeek;
      weekInput.value = val;
      loadWeek(currentYear, val);
    });
  });
}

/* ================================
   מערכת המענים הרפואיים (+ צבעים)
================================ */

/**
 * קוראת את נתוני טבלת המענים הרפואיים (משימות, שעות וצבעים) מתוך ה-DOM.
 * @returns {Object} אובייקט נתוני המענים הרפואיים
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
 * שומרת את נתוני טבלת המענים הרפואיים עבור השבוע והשנה הנוכחיים.
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

// מגינה מפני שתי קריאות חופפות ל-loadHipokData בו-זמנית - אותה סיבה בדיוק כמו ה-in-flight
// guard על loadTableData (ראו שם): שתי קריאות חופפות (למשל מחזור רענון תקופתי שמתנגש עם
// טעינה/שמירה אחרת שעוד לא הסתיימה מול שרת מרכזי אמיתי) עלולות לקרוא state שונה זו מזו
// ולהחיל className שונה על אותו תא לסירוגין - נראה כהבהוב (אפיון QA: "מענה רפואי מרצד").
let _loadHipokDataInFlight = false;
let _loadHipokDataRerunArgs = null;

async function loadHipokData(week, year) {
  if (_loadHipokDataInFlight) {
    _loadHipokDataRerunArgs = { week, year };
    return;
  }
  _loadHipokDataInFlight = true;
  try {
    await _loadHipokDataImpl(week, year);
  } finally {
    _loadHipokDataInFlight = false;
    if (_loadHipokDataRerunArgs) {
      const rerun = _loadHipokDataRerunArgs;
      _loadHipokDataRerunArgs = null;
      loadHipokData(rerun.week, rerun.year);
    }
  }
}

/**
 * טוענת את נתוני טבלת המענים הרפואיים עבור שבוע ושנה נתונים ומעדכנת את שדות הטבלה והצבעים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 */
async function _loadHipokDataImpl(week, year) {
  const table = document.getElementById('hipoktable');
  if (!table) return;

  const key = getStorageKey('hipoktable', week, year);
  let data = null;
  if (typeof DataService !== 'undefined') {
    data = await DataService.getItem(key);
  } else {
    const saved = localStorage.getItem(key);
    if (saved) data = JSON.parse(saved);
  }

  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
  // מקבילה ומפורטת ב-loadTableData).
  if (week !== currentWeek || year !== currentYear) return;

  // ממלאים כל תא ישירות לערך הסופי שלו (מהנתון השמור אם קיים, אחרת ריק) - במעבר אחד, בלי
  // שלב-ביניים שמרוקן הכל קודם (אותה תבנית באג בדיוק כמו ב-loadTableData - ראו שם: "הנתונים
  // נעלמים לרגע כל כמה שניות"). בנוסף - קודם ריקון-ואז-בדיקת-!data היה מוחק לצמיתות את
  // התוכן על המסך אם הבאת הנתונים נכשלה זמנית (למשל הפסקת רשת קצרה), בלי לשחזר כלום.
  document.querySelectorAll('#hipoktable .task-input').forEach((el, i) => {
    el.value = (data && data['task_' + i] !== undefined) ? data['task_' + i] : '';
  });
  document.querySelectorAll('#hipoktable .time-input').forEach((el, i) => {
    el.value = (data && data['time_' + i] !== undefined) ? data['time_' + i] : '';
  });
  // מחשבים את מחלקת ה-CSS היעד במלואה לפני נגיעה ב-DOM, ומחילים (className =) רק אם היא
  // בפועל שונה מהנוכחית - לא מרוקנים תמיד ואז בונים מחדש. ריקון-ואז-בנייה-מחדש תמיד (גם
  // כשהתוצאה הסופית זהה) עדיין גורם להבהוב חזותי אמיתי בצבע התא (יש רגע קצר בלי המחלקה
  // בכלל) בכל מחזור רענון - אותה סיבה בדיוק שכבר תוקנה במקומות אחרים (ראו _renderDataChanged
  // ברחבי הקובץ), רק שכאן זה קרה דרך className ולא דרך בנייה מחדש של DOM (אפיון QA: "מענה
  // רפואי מרצד בטבלה הגדולה").
  document.querySelectorAll('#hipoktable .cell-wrapper').forEach((wrapper, i) => {
    const classes = ['cell-wrapper'];
    if (data) {
      const taskVal = data['task_' + i];
      const timeVal = data['time_' + i];
      if ((taskVal && taskVal.trim() !== '') || (timeVal && timeVal.trim() !== '')) {
        classes.push('imported');
      }
      if (typeof ALL_HIPOK_COLORS !== 'undefined' && data['color_' + i]) {
        classes.push(data['color_' + i]);
      }
    }
    const targetClassName = classes.join(' ');
    if (wrapper.className !== targetClassName) wrapper.className = targetClassName;
  });
}

const HIPOK_DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const HIPOK_MAX_SLOTS_PER_GROUP = 6;

/**
 * מפיקה מפתח שמירה עבור רשימת בקשות המענים הרפואיים של היחידות.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {string} מפתח שמירה
 */
function getHipokEntriesKey(week, year) { return `hipokEntries_week${week}_year${year}`; }

/**
 * טוענת את רשימת בקשות המענים הרפואיים המאוחסנות לשבוע ושנה מסוימים.
 * @param {number} week - מספר השבוע
 * @param {number} year - השנה
 * @returns {Promise<Array<Object>>} מערך אובייקטי בקשות מענה רפואי
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
 * שומרת את רשימת בקשות המענים הרפואיים ב-DataService.
 * @param {Array<Object>} entries - מערך בקשות המענה הרפואי
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
 * מוסיפה בקשת מענה רפואי חדשה לרשימה ומעדכנת את השמירה.
 * @param {string} type - סוג המענה הרפואי ('dry' / 'wet')
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
 * מוחקת בקשת מענה רפואי ספציפית לפי מזהה ייחודי.
 * @param {string} id - מזהה הבקשה
 * @returns {Array<Object>} הרשימה המעודכנת לאחר המחיקה
 */
async function deleteHipokEntry(id) {
  const entries = (await loadHipokEntries(currentWeek, currentYear)).filter(e => e.id !== id);
  await saveHipokEntriesList(entries, currentWeek, currentYear);
  return entries;
}

/**
 * מוחקת בקשת מענה רפואי ומעדכנת את התצוגה בעמוד היחידה.
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
 * מרנדרת את רשימת בקשות המענים הרפואיים המוגשות בעמוד היחידה הרלוונטית.
 */
async function renderHipokEntriesList() {
  const container = document.getElementById('hipokEntriesList');
  if (!container) return;
  const reqWeek = currentWeek, reqYear = currentYear;

  const entries = await loadHipokEntries(reqWeek, reqYear);
  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
  // מפורטת ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredEntries = entries;
  if (targetColor) {
    filteredEntries = entries.filter(e => e.color === targetColor);
  }

  // מדלגים על בניית הרשימה אם היא זהה למה שכבר מוצג - ראו _renderDataChanged
  if (_renderDataChanged('hipokEntriesList_' + currentPage, filteredEntries)) {
  if (filteredEntries.length === 0) {
    container.innerHTML = '<p style="color:#666; text-align:center; padding: 15px; font-weight:bold;">אין מענים רפואיים שהוזנו לשבוע זה.</p>';
  } else {
    container.innerHTML = filteredEntries.map(entry => {
      const typeText = entry.type === 'dry' ? 'מענה רפואי יבש' : 'מענה רפואי רטוב';
      const dayText = HIPOK_DAY_LABELS[entry.day] !== undefined ? 'יום ' + HIPOK_DAY_LABELS[entry.day] : '';
      const styleObj = UNIT_BG_MAP[entry.color] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

      return `
        <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <span style="font-weight: bold; width: 100px; color: ${styleObj.text}; text-align: right;">${typeText}</span>
          <span style="font-weight: bold; width: 80px; color: #333;">${dayText}</span>
          <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(entry.text) || '-'}</span>
          <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 15px;">${escapeHtml(entry.time)}</span>
          <button class="hipok-delete-btn" onclick="removeHipokEntry('${entry.id}')">✕</button>
        </div>
      `;
    }).join('');
  }
  } // סוף if (_renderDataChanged)

  // רענון טבלת ההקצאות אם היא גלויה
  const haktzaotSection = document.getElementById('haktzaot');
  if (haktzaotSection && haktzaotSection.style.display !== 'none') {
    if (typeof renderHaktzaotHipok === 'function') await renderHaktzaotHipok();
  }
}


/**
 * מוצאת ומחזירה תא ספציפי בטבלת המענים הרפואיים לפי סוג המענה הרפואי, היום ואינדקס המשבצת.
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
 * מפתח השמירה של רשימת מזהי בקשות המענה הרפואי שכבר יובאו לטבלת המנהל לשבוע נתון -
 * מונע ייבוא כפול (אפיון QA: לחיצה חוזרת על "ייבוא" יצרה עותק נוסף לבקשות שכבר יובאו).
 */
function getHipokImportedIdsKey(week, year) { return `hipokImportedIds_week${week}_year${year}`; }

async function loadHipokImportedIds(week, year) {
  const key = getHipokImportedIdsKey(week, year);
  if (typeof DataService !== 'undefined') {
    return (await DataService.getItem(key)) || [];
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

async function saveHipokImportedIds(ids, week, year) {
  const key = getHipokImportedIdsKey(week, year);
  if (typeof DataService !== 'undefined') {
    await DataService.setItem(key, ids);
  } else {
    localStorage.setItem(key, JSON.stringify(ids));
  }
}

/**
 * מייבאת את בקשות המענים הרפואיים של היחידות לתוך טבלת המענים הרפואיים של המנהל מול מגבלת המשבצות.
 */
async function importHipukim() {
  const table = document.getElementById('hipoktable');
  if (!table) { alert('טבלת המענים הרפואיים לא נמצאה'); return; }

  // מייבאים רק מענים רפואיים שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") - לא בקשה שהוקלדה
  // ועדיין לא נשמרה על ידי היחידה (אפיון QA).
  const publishedKey = getHipokEntriesKey(currentWeek, currentYear) + '_published';
  const allEntries = (await fetchTableData(publishedKey)) || [];
  if (allEntries.length === 0) {
    alert('אין מענים רפואיים מאושרים (לא בוצע שמירה לייבוא) לשבוע זה.');
    return;
  }

  const importedIds = await loadHipokImportedIds(currentWeek, currentYear);
  const importedIdSet = new Set(importedIds);
  const entries = allEntries.filter(entry => !importedIdSet.has(entry.id));

  if (entries.length === 0) {
    alert('כל המענים הרפואיים שהוזנו כבר יובאו לטבלה.');
    return;
  }

  const slotCounters = {};
  const overflow = [];
  const newlyImportedIds = [];

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
    newlyImportedIds.push(entry.id);
  });

  await saveHipokImportedIds([...importedIds, ...newlyImportedIds], currentWeek, currentYear);
  saveHipokData();
  if (typeof updateHipokConflictHighlight === 'function') updateHipokConflictHighlight(currentWeek, currentYear);
  if (overflow.length > 0) {
    alert(`יובאו ${entries.length - overflow.length} מענים רפואיים.\n${overflow.length} לא נכנסו (חריגה מ-6 משבצות).`);
  } else {
    alert(`יובאו ${entries.length} מענים רפואיים בהצלחה`);
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
  // טבלת מודיעין עם מבנה עמודות דינמי: השורה החדשה נבנית מתוכנית העמודות הנוכחית (כולל פלוגות
  // שנוספו, בלי אלה שהוסרו) ולא משכפול מספר קלטים קבוע.
  const coDesc = _coDesc(tableId);
  if (coDesc && coDesc.kind === 'modiein' && table._coPlan) {
    tbody.insertAdjacentHTML('beforeend', _coModieinRowHtml(coDesc, table._coPlan, tbody.rows.length, table));
    if (autoSave) saveCurrentWeek();
    return;
  }
  let referenceRow = tbody.rows[1] || tbody.rows[0];
  const inputsCount = referenceRow.querySelectorAll('.cell-input').length;
  const newRow = document.createElement('tr');
  let tds = '';
  for (let i = 0; i < inputsCount; i++) { tds += `<td><input type="text" class="cell-input"></td>`; }
  if (hasUnitTotalColumn(tableId)) { tds += `<td class="row-total-cell">0</td>`; }
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
  
  // טבלת מנהל משולבת: הפלוגות של הגדוד הזה (כולל חדשות) נמצאות לפי מפתח אחסון ולא לפי אינדקס
  // עמודה - אחרי הוספה/הסרת פלוגות מיקום העמודות בטבלה משתנה. עמודת הבסיס הראשונה של הגדוד
  // בטבלת היעד (d0) נגזרת ממתאר הטבלה (כפרמטר targetStartCol הישן נשאר לתאימות בלבד).
  const coDesc = _coDesc(targetTableId);
  const mapEntry = (SUB_TABLE_MAPS[targetTableId] || []).find(m => m.sourceTableId === sourceTableId);
  const seg = coDesc && coDesc.segs ? coDesc.segs.find(s => mapEntry && s.bn === mapEntry.bn) : null;
  if (!sourceCols) sourceCols = mapEntry ? mapEntry.sourceCols : 7;
  const segD0 = seg ? seg.d0 : (targetStartCol - 1);
  const targetDataCols = coDesc ? coDesc.dataCols : (target.tBodies[0].rows[0].cells.length - 1);

  // Get manager's published data to compare
  const managerPublishedKey = getStorageKey(targetTableId, currentWeek, currentYear) + '_published';
  const managerPublishedData = await fetchTableData(managerPublishedKey) || {};

  // רשימת האינדקסים הממתינים להפצה בטבלה המשולבת (ראו MASTER_COMBINED_TABLES) - הייבוא הוא
  // המקום היחיד שמוסיף/מסיר מהרשימה הזו, כדי שהסימון הכתום ישקף אך ורק דרישות מיובאות
  // שטרם הופצו, ולא ישתנה כתוצאה מעריכה ישירה של המנהל.
  const isMasterCombined = MASTER_COMBINED_TABLES.includes(targetTableId);
  const pendingSet = isMasterCombined
    ? new Set(await loadPendingImportIndexes(targetTableId, currentWeek, currentYear))
    : null;

  const inputByKey = new Map();
  (coDesc ? _coKeyedInputs(target, coDesc) : []).forEach(o => inputByKey.set(String(o.key), o.input));
  Object.entries(data).forEach(([indexStr, value]) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    // פלוגה שנוספה: אותו מפתח בדיוק בטבלת היחידה ובטבלת המנהל (x<מזהה>_<שורה>).
    // פלוגה מקורית: מפתח מספרי של היחידה (שורה*עמודות-יחידה + עמודה) -> מפתח בטבלת המנהל.
    const px = _coParseExtraKey(indexStr);
    let targetKey;
    if (px) {
      targetKey = indexStr;
    } else {
      const index = parseInt(indexStr);
      if (isNaN(index)) return;
      const row = Math.floor(index / sourceCols);
      const col = index % sourceCols;
      targetKey = row * targetDataCols + segD0 + col;
    }
    const input = inputByKey.get(String(targetKey));
    if (!input) return; // הפלוגה לא קיימת בטבלת המנהל בשבוע הזה (הוסרה / מחוץ לטווח) או שורה שלא קיימת
    const targetCell = input.closest('td');
    input.value = value;
    // Compare with manager's published data
    const publishedVal = managerPublishedData[targetKey] || '';
    if (value !== publishedVal) {
      if (targetCell) targetCell.classList.add('conflict-overlap');
      if (pendingSet) pendingSet.add(targetKey);
    } else {
      if (targetCell) targetCell.classList.remove('conflict-overlap');
      if (pendingSet) pendingSet.delete(targetKey);
    }
  });
  if (pendingSet) savePendingImportIndexes(targetTableId, currentWeek, currentYear, [...pendingSet]);
  saveCurrentWeek();
  const ackKey = getAckStorageKey(targetTableId, currentWeek, currentYear);
  const ackData = (await fetchTableData(ackKey)) || {};
  Object.entries(data).forEach(([indexStr, value]) => {
    const subVal = value !== undefined && value !== null ? String(value).trim() : '';
    ackData[`${sourceTableId}_${indexStr}`] = subVal;
  });
  persist(ackKey, ackData);

  if (targetTableId === 'keshertable') recalcAll(targetTableId);
  else recalcAll(targetTableId, tableConfigs[targetTableId]);
  checkRequirementChanges(targetTableId);
  if (typeof updateGlobalExportButtonStatus === 'function') await updateGlobalExportButtonStatus();
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
  // מייבאים רק נתונים שהיחידה שמרה ופרסמה בפועל ("שמור ומוכן לייבוא") - לא טיוטה חיה שעדיין
  // לא אושרה על ידי היחידה (אפיון QA).
  const key = getStorageKey(sourceTableId, currentWeek, currentYear) + '_published';
  const data = await fetchTableData(key);
  if (!data) { alert(`אין נתונים מאושרים (לא בוצע שמירה לייבוא) לשבוע ${currentWeek}`); return; }
  
  // מספר השורות הנדרש נגזר מכל המפתחות (כולל פלוגות שנוספו), והשדות ממולאים לפי מפתח אחסון.
  const coDesc = _coDesc(targetTableId);
  if (coDesc) {
    const requiredRows = _coModieinRowsNeeded(coDesc, data, 2);
    while (target.tBodies[0].rows.length < requiredRows) { addNewRow(targetTableId, false); }
    _coKeyedInputs(target, coDesc).forEach(({ input, key }) => {
      const v = data[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') input.value = v;
    });
  }

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
  "מזוודת הטענה בומבה", "מזוודת הטענה ליתיום", "הערות משיכה\\זיכוי"
];

const DEFAULT_OPTIC_ROWS = [
  "נושא שבוע", "מת\"ן", "עמית", "עמית איכון", "חצובת עמית", "חצובת תבל", "יובל", "תבל ידני",
  "מיני תבל ידני", "תבל נשלט", "מיני תבל נשלט", "רחפן מטריס 300", "רחפן איבו",
  "רחפן אווטא (ערכה זוגית)", "15X80", "מצפן מעלות", "שטיינר", "צגון", "מצלמת NIKON",
  "איבו אלפא", "התקני הטלה/ כדור ברזל"
];

const KESHER_TABLE_LIST = [
  { id: 'keshertable', dataCols: 48 },
  { id: 'esukkeshertable', dataCols: 7 },
  { id: 'kkeshertable', dataCols: 6 },
  { id: 'pkeshertable', dataCols: 7 },
  { id: 'tkeshertable', dataCols: 8 },
  { id: 'bkeshertable', dataCols: 1 }
];

const OPTIC_TABLE_LIST = [
  { id: 'optictable', dataCols: 33 },
  { id: 'esukoptictable', dataCols: 7 },
  { id: 'koptictable', dataCols: 6 },
  { id: 'poptictable', dataCols: 7 },
  { id: 'toptictable', dataCols: 8 },
  { id: 'boptictable', dataCols: 1 }
];

function getRowsStorageKey(category, week, year) {
  return `rowList_${category}_week${week}_year${year}`;
}

/**
 * מרעננת מהשרת (אם מוגדר) את רשימות השורות המותאמות-אישית (אמצעי קשר/אופטיקה שנוספו/נמחקו)
 * לשבוע הנוכחי. getRowsForWeek נשארת סינכרונית בכוונה (נקראת גם בזמן בניית/רינדור טבלה, לא
 * רק בפעולות מנהל נדירות), אז במקום להפוך אותה ל-async בכל מקום, שומרים אותה כמו שהיא
 * וממלאים לה מטמון טרי מהשרת ברקע - אותה גישה בדיוק כמו refreshSubTablePublishedCache.
 */
async function refreshRowListsCache() {
  if (typeof fetchTableData !== 'function') return;
  await Promise.all([
    fetchTableData(getRowsStorageKey('kesher', currentWeek, currentYear)),
    fetchTableData(getRowsStorageKey('optic', currentWeek, currentYear))
  ]);
}

function getRowsForWeek(category, week, year) {
  const key = getRowsStorageKey(category, week, year);
  const saved = localStorage.getItem(key);
  if (saved) {
    const rows = JSON.parse(saved);
    // מיגרציה חד-פעמית בזמן טעינה: שבועות שכבר נשמרו לפני שינוי שם שורת "משיכה\זיכוי" ל"הערות
    // משיכה\זיכוי" עדיין מכילים את השם הישן במערך השמור - מתקנים אותו כאן כדי שכל השבועות
    // (גם ישנים) יציגו את השם המעודכן, בלי לפגוע בהגנות על השורה המיוחדת (מחיקה/גרירה/הדגשה).
    if (category === 'kesher') {
      const oldIdx = rows.indexOf("משיכה\\זיכוי");
      if (oldIdx !== -1) rows[oldIdx] = "הערות משיכה\\זיכוי";
    }
    return rows;
  }

  if (week > 1) {
    return getRowsForWeek(category, week - 1, year);
  } else if (year > new Date().getFullYear() - 2) {
    const prevYearKey = getRowsStorageKey(category, getWeeksInYear(year - 1), year - 1);
    if (localStorage.getItem(prevYearKey) !== null) {
      return getRowsForWeek(category, getWeeksInYear(year - 1), year - 1);
    }
  }

  return category === 'kesher' ? [...DEFAULT_KESHER_ROWS] : [...DEFAULT_OPTIC_ROWS];
}

/* =========================================================
   פלוגות דינמיות - הוספה/הסרה של פלוגה ע"י המנהל
   ---------------------------------------------------------
   העיקרון: הנתונים הקיימים (מפתחות מספריים לפי מיקום) לא זזים ולא עוברים מיגרציה.
   - "ספר פלוגות" (COMPANY_ROSTER_KEY, קובץ אחד ב-SharePoint) מתעד פלוגות שנוספו (גדוד, שם,
     טווח שבועות) ופלוגות מקוריות שהוסרו (מאיזה שבוע והלאה).
   - לכל שבוע מחושב "מבנה עמודות" (getCompanyLayout) מתוך הספר; טבלאות קשר/אופטיקה/מודיעין
     (מנהל + יחידה + הקצאות) נבנות לפיו.
   - תא של פלוגה מקורית שומר את אותו מפתח מספרי כמו תמיד (שורה*עמודות + עמודה); תא של פלוגה
     שנוספה שומר מפתח טקסטואלי x<מזהה>_<שורה> באותו אובייקט שבועי - ולכן העתקת שבוע, הדבקה
     לכל השנה, פרסום, ייבוא וכו' (שמעתיקים את האובייקט כולו) עובדים ללא שינוי.
   - פלוגה שהוסרה פשוט לא נבנית מהשבוע שנקבע והלאה (העמודה לא קיימת ב-DOM ולכן לא נכללת
     בסכומים); נתוני שבועות קודמים נשמרים.
========================================================= */
const COMPANY_ROSTER_KEY = 'companyRoster';
const CO_BN_ORDER = ['esuk', 'hirg', 'pikud', 'tazam', 'bahalag'];
const CO_BN_NAMES = {
  esuk: 'בא"ח איסו"ק', hirg: 'בא"ח חיר"ג', pikud: 'גדוד הפיקוד', tazam: 'ענף תצ"מ', bahalag: 'מפח"ט'
};
const CO_BN_EMOJI = { esuk: '🟡', hirg: '🟢', pikud: '🔵', tazam: '🟣', bahalag: '🟠' };

// הפלוגות המקוריות של כל גדוד, כפי שהן מופיעות בכותרות. hq = מספר עמודות המפקדה שמקדימות את
// הפלוגות בטבלאות קשר/אופטיקה (בא"ח איסו"ק בלבד: הכנ"ס / סמג"ד) - עמודות מפקדה אינן "פלוגה"
// ולכן אינן ניתנות להסרה. בטבלאות מודיעין אין עמודת מפקדה (modiein קצר ב-hq עמודות).
const CO_BASE = {
  esuk: {
    hq: 1,
    kesher: ['הכנ"ס', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'],
    optic: ['סמג"ד', 'א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳'],
    modiein: ['אומץ', 'ברק', 'גולן', 'דביר', 'הראל', 'ונוס']
  },
  hirg: {
    hq: 0,
    kesher: ['קרקל', 'ברדלס', 'אריות הירדן', 'פנתר', 'לביא', 'יגואר'],
    optic: ['קרקל', 'ברדלס', 'אריות הירדן', 'פנתר', 'לביא', 'יגואר'],
    modiein: ['קרקל', 'ברדלס', 'אריות הירדן', 'פנתר', 'לביא', 'יגואר']
  },
  pikud: {
    hq: 0,
    kesher: ['מפג"ד', 'קקא"ס נגב', 'קמ"א תבור', 'קמ"כ מצדה', 'קק"צ מגן', 'קמ"כ ירדן', 'הכנה לשדה'],
    optic: ['מפג"ד', 'קקא"ס נגב', 'קמ"א תבור', 'קמ"כ מצדה', 'קק"צ מגן', 'קמ"כ ירדן', 'הכנה לשדה'],
    modiein: ['מפג"ד', 'קקא"ס נגב', 'קמ"א תבור', 'קמ"כ מצדה', 'קק"צ מגן', 'קמ"כ ירדן', 'הכנה לשדה']
  },
  tazam: {
    hq: 0,
    kesher: ['קמ"א רותם', 'קקא"ס חרמון', 'טל', 'יהל', 'כחל', 'קמ"ד', 'מקצועות', 'הכנה למעוז'],
    optic: ['קמ"א רותם', 'קקא"ס חרמון', 'טל', 'יהל', 'כחל', 'קמ"ד', 'מקצועות', 'הכנה למעוז'],
    modiein: ['קמ"א רותם', 'קקא"ס חרמון', 'טל', 'יהל', 'כחל', 'קמ"ד', 'מקצועות', 'הכנה למעוז']
  },
  bahalag: {
    hq: 0,
    kesher: ['מפח"ט'], optic: ['מפח"ט'], modiein: ['מפח"ט']
  }
};

// מזהי הטבלאות של כל גדוד: n = מספר עמודות בסיס בקשר/אופטיקה, nM = במודיעין.
const CO_UNIT_TABLES = [
  { bn: 'esuk', n: 7, nM: 6, kesher: 'esukkeshertable', optic: 'esukoptictable', req: 'reqesukTable', adm: 'esukTable',
    hkK: 'haktzaot-esuk-kesher-table', hkO: 'haktzaot-esuk-optic-table', hkM: 'haktzaot-esuk-table' },
  { bn: 'hirg', n: 6, nM: 6, kesher: 'kkeshertable', optic: 'koptictable', req: 'reqhirgTable', adm: 'hirgTable',
    hkK: 'haktzaot-hirg-kesher-table', hkO: 'haktzaot-hirg-optic-table', hkM: 'haktzaot-hirg-table' },
  { bn: 'pikud', n: 7, nM: 7, kesher: 'pkeshertable', optic: 'poptictable', req: 'reqpikudTable', adm: 'pikudTable',
    hkK: 'haktzaot-pikud-kesher-table', hkO: 'haktzaot-pikud-optic-table', hkM: 'haktzaot-pikud-table' },
  { bn: 'tazam', n: 8, nM: 8, kesher: 'tkeshertable', optic: 'toptictable', req: 'reqtazamTable', adm: 'tazamTable',
    hkK: 'haktzaot-tazam-kesher-table', hkO: 'haktzaot-tazam-optic-table', hkM: 'haktzaot-tazam-table' },
  { bn: 'bahalag', n: 1, nM: 1, kesher: 'bkeshertable', optic: 'boptictable', req: 'reqbahalagTable', adm: 'bahalagTable',
    hkK: 'haktzaot-bahalag-kesher-table', hkO: 'haktzaot-bahalag-optic-table', hkM: 'haktzaot-bahalag-table' }
];

/**
 * מתארי הטבלאות שמבנה העמודות שלהן תלוי ברשימת הפלוגות:
 *  master  - טבלת קשר/אופטיקה הגדולה של המנהל (כל הגדודים; d0 = אינדקס נתונים ראשון של הגדוד,
 *            n = מספר עמודות בסיס, sum = עמודות דרישה/וויסות/עודף של הגדוד (קשר בלבד), tot = סיכומים)
 *  unit    - טבלת דרישות קשר/אופטיקה של גדוד בודד
 *  modiein - טבלת מודיעין (דרישות היחידה / טבלת המנהל)
 *  hk      - טבלת הקצאות (קריאה בלבד) בעמוד היחידה
 */
const CO_DESCS = (function () {
  const d = {};
  d.keshertable = {
    id: 'keshertable', kind: 'master', cat: 'kesher', dataCols: 48, hasSum: true,
    segs: [
      { bn: 'esuk', d0: 0, n: 7, sum: [7, 8, 9] },
      { bn: 'hirg', d0: 10, n: 6, sum: [16, 17, 18] },
      { bn: 'pikud', d0: 19, n: 7, sum: [26, 27, 28] },
      { bn: 'tazam', d0: 29, n: 8, sum: [37, 38, 39] },
      { bn: 'bahalag', d0: 40, n: 1, sum: [41, 42, 43] }
    ],
    tot: [44, 45, 46, 47], totRoles: ['tu', 'fail', 'treg', 'exc']
  };
  d.optictable = {
    id: 'optictable', kind: 'master', cat: 'optic', dataCols: 33, hasSum: false,
    segs: [
      { bn: 'esuk', d0: 0, n: 7 },
      { bn: 'hirg', d0: 7, n: 6 },
      { bn: 'pikud', d0: 13, n: 7 },
      { bn: 'tazam', d0: 20, n: 8 },
      { bn: 'bahalag', d0: 28, n: 1 }
    ],
    tot: [29, 30, 31, 32], totRoles: ['tu', 'fail', 'treg', 'exc']
  };
  CO_UNIT_TABLES.forEach(u => {
    d[u.kesher] = { id: u.kesher, kind: 'unit', cat: 'kesher', bn: u.bn, baseN: u.n, dataCols: u.n };
    d[u.optic] = { id: u.optic, kind: 'unit', cat: 'optic', bn: u.bn, baseN: u.n, dataCols: u.n };
    d[u.req] = { id: u.req, kind: 'modiein', cat: 'modiein', bn: u.bn, baseN: u.nM };
    d[u.adm] = { id: u.adm, kind: 'modiein', cat: 'modiein', bn: u.bn, baseN: u.nM };
    d[u.hkK] = { id: u.hkK, kind: 'hk', cat: 'kesher', bn: u.bn, baseN: u.n };
    d[u.hkO] = { id: u.hkO, kind: 'hk', cat: 'optic', bn: u.bn, baseN: u.n };
    d[u.hkM] = { id: u.hkM, kind: 'hk', cat: 'modiein', bn: u.bn, baseN: u.nM };
  });
  return d;
})();

function _coDesc(tableId) { return CO_DESCS[tableId] || null; }

/** מפתח סדר כרונולוגי של שבוע (שנה*100 + שבוע) - להשוואת טווחי שבועות. */
function _coOrd(w, y) { return y * 100 + w; }

function _coPrevWeek(w, y) {
  return w > 1 ? { w: w - 1, y } : { w: getWeeksInYear(y - 1), y: y - 1 };
}

function _coWeekLabel(wk) { return `שבוע ${wk.w} (${wk.y})`; }

/* ---------- ספר הפלוגות (נשמר ב-SharePoint כקובץ אחד: companyRoster.txt) ---------- */

function _coEmptyRoster() { return { seq: 0, added: [], removedBase: [] }; }

function _coValidWk(x) {
  return !!x && Number.isInteger(+x.w) && Number.isInteger(+x.y) && +x.w >= 1 && +x.w <= 60 && +x.y >= 2000 && +x.y <= 2200;
}

/** מנרמלת אובייקט שנטען מהאחסון (או null) למבנה תקין, ומתעלמת מרשומות פגומות. */
function _coNormalizeRoster(r) {
  const out = _coEmptyRoster();
  if (!r || typeof r !== 'object') return out;
  out.seq = Number(r.seq) || 0;
  (Array.isArray(r.added) ? r.added : []).forEach(c => {
    if (!c || !CO_BN_NAMES[c.bn] || !_coValidWk(c.from) || !/^\d+$/.test(String(c.id))) return;
    if (c.to && !_coValidWk(c.to)) return;
    if (c.to && _coOrd(+c.to.w, +c.to.y) < _coOrd(+c.from.w, +c.from.y)) return;
    out.added.push({
      id: String(c.id), bn: c.bn, name: String(c.name || '').trim().slice(0, 30),
      from: { w: +c.from.w, y: +c.from.y }, to: c.to ? { w: +c.to.w, y: +c.to.y } : null
    });
    out.seq = Math.max(out.seq, +c.id);
  });
  (Array.isArray(r.removedBase) ? r.removedBase : []).forEach(b => {
    if (!b || !CO_BN_NAMES[b.bn] || !Number.isInteger(+b.j) || !_coValidWk(b.from)) return;
    if (+b.j < CO_BASE[b.bn].hq || +b.j >= CO_BASE[b.bn].kesher.length) return;
    if (b.to && !_coValidWk(b.to)) return;
    if (b.to && _coOrd(+b.to.w, +b.to.y) < _coOrd(+b.from.w, +b.from.y)) return;
    out.removedBase.push({ bn: b.bn, j: +b.j, from: { w: +b.from.w, y: +b.from.y }, to: b.to ? { w: +b.to.w, y: +b.to.y } : null });
  });
  return out;
}

/** האם פלוגה מקורית (גדוד bn, עמודה j) מוסתרת בשבוע שמפתחו ord - לפי טווחי ההסרה בספר. */
function _coIsHiddenAt(roster, bn, j, ord) {
  return roster.removedBase.some(b => b.bn === bn && b.j === j
    && ord >= _coOrd(b.from.w, b.from.y) && (!b.to || ord <= _coOrd(b.to.w, b.to.y)));
}

/** ממזגת טווחי הסרה חופפים/צמודים של אותה פלוגה מקורית לטווח אחד (שומרת את הרשימה קצרה ונקייה). */
function _coMergeRemovedBase(list) {
  const out = [];
  const groups = {};
  list.forEach(b => { (groups[b.bn + ':' + b.j] = groups[b.bn + ':' + b.j] || []).push(b); });
  Object.keys(groups).forEach(k => {
    const arr = groups[k].slice().sort((a, b) => _coOrd(a.from.w, a.from.y) - _coOrd(b.from.w, b.from.y));
    let cur = null;
    arr.forEach(b => {
      if (!cur) { cur = { ...b }; return; }
      const curEnd = cur.to ? _coOrd(cur.to.w, cur.to.y) : Infinity;
      const nextStart = _coOrd(b.from.w, b.from.y);
      // חופף או צמוד (השבוע שאחרי סוף הטווח הנוכחי)
      const adjacentLimit = cur.to ? _coOrd(_coAddWeeks(cur.to, 1).w, _coAddWeeks(cur.to, 1).y) : Infinity;
      if (nextStart <= curEnd || nextStart <= adjacentLimit) {
        const bEnd = b.to ? _coOrd(b.to.w, b.to.y) : Infinity;
        if (bEnd > curEnd) cur.to = b.to;
      } else { out.push(cur); cur = { ...b }; }
    });
    if (cur) out.push(cur);
  });
  return out;
}

let _coRosterCache = { raw: undefined, roster: _coEmptyRoster() };
let _coLayoutCache = {};

/** קוראת סינכרונית את ספר הפלוגות מהמטמון המקומי (מתעדכן מהשרת ב-refreshCompanyRoster). */
function getCompanyRoster() {
  let raw = null;
  try { raw = localStorage.getItem(COMPANY_ROSTER_KEY); } catch (e) { raw = null; }
  if (raw === _coRosterCache.raw) return _coRosterCache.roster;
  let parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
  _coRosterCache = { raw, roster: _coNormalizeRoster(parsed) };
  _coLayoutCache = {};
  return _coRosterCache.roster;
}

/** מרעננת מהשרת (אם מוגדר) את ספר הפלוגות לפני שטבלאות נבנות - ראו updateUIForWeek. */
async function refreshCompanyRoster() {
  // שינוי ספר שעדיין ממתין בתור הסנכרון (השמירה לשרת נכשלה) הוא הגרסה העדכנית - לא דורסים אותו
  // בגרסה הישנה מהשרת (אחרת הפלוגה "נעלמת" מהתצוגה עד שהתור ישוגר).
  if (typeof DataService !== 'undefined' && DataService._syncQueue
      && Object.prototype.hasOwnProperty.call(DataService._syncQueue, COMPANY_ROSTER_KEY)) {
    try { localStorage.setItem(COMPANY_ROSTER_KEY, JSON.stringify(DataService._syncQueue[COMPANY_ROSTER_KEY])); } catch (e) {}
    return;
  }
  try { await fetchTableData(COMPANY_ROSTER_KEY); } catch (e) { /* נשארים עם המטמון המקומי */ }
}

/**
 * מבנה הפלוגות בשבוע נתון: לכל גדוד - הפלוגות שנוספו ופעילות בשבוע הזה (extras) ואינדקסי
 * הפלוגות המקוריות שהוסרו עד אליו (hidden; אינדקס = עמודה בטבלת קשר/אופטיקה של הגדוד).
 */
function getCompanyLayout(week, year) {
  const roster = getCompanyRoster();
  const ck = week + '_' + year;
  if (_coLayoutCache[ck]) return _coLayoutCache[ck];
  const ord = _coOrd(week, year);
  const out = {};
  CO_BN_ORDER.forEach(bn => { out[bn] = { extras: [], hidden: new Set() }; });
  roster.added.forEach(c => {
    const toOrd = c.to ? _coOrd(c.to.w, c.to.y) : Infinity;
    if (ord >= _coOrd(c.from.w, c.from.y) && ord <= toOrd) out[c.bn].extras.push({ id: c.id, name: c.name });
  });
  roster.removedBase.forEach(b => {
    if (_coIsHiddenAt(roster, b.bn, b.j, ord)) out[b.bn].hidden.add(b.j);
  });
  _coLayoutCache[ck] = out;
  return out;
}

/* ---------- בניית "תוכנית עמודות" לטבלה לפי המבנה של שבוע ---------- */

/**
 * מחזירה {cols, sig}. כל פריט ב-cols:
 *  co  - עמודת פלוגה: {t:'co', bn, x:false, j, d} (מקורית; d = אינדקס הנתונים) או {t:'co', bn, x:true, id, name}
 *  sum - עמודת דרישה/וויסות/עודף של גדוד (master קשר): {t:'sum', bn, role, d}
 *  tot - עמודת סיכום כללי (master): {t:'tot', role, d}
 * sep = עמודה שאחריה קו הפרדה מודגש (סוף קבוצת גדוד).
 */
function _coBuildPlan(desc, layout) {
  const cols = [];
  const segList = desc.kind === 'master'
    ? desc.segs
    : [{ bn: desc.bn, d0: 0, n: desc.baseN }];

  segList.forEach(seg => {
    const L = layout[seg.bn];
    const hq = CO_BASE[seg.bn].hq;
    const items = [];
    for (let j = 0; j < seg.n; j++) {
      const jk = desc.cat === 'modiein' ? j + hq : j; // hidden מאונדקס לפי עמודות קשר/אופטיקה
      if (L.hidden.has(jk)) continue;
      items.push({ t: 'co', bn: seg.bn, x: false, j, d: seg.d0 + j });
    }
    L.extras.forEach(e => items.push({ t: 'co', bn: seg.bn, x: true, id: e.id, name: e.name }));
    if (items.length) items[items.length - 1].sep = true;
    items.forEach(it => cols.push(it));
    if (desc.hasSum && seg.sum) {
      ['dem', 'reg', 'sur'].forEach((role, k) => {
        cols.push({ t: 'sum', bn: seg.bn, role, d: seg.sum[k], sep: k === 2 });
      });
    }
  });
  if (desc.kind === 'master') {
    desc.tot.forEach((d, k) => cols.push({ t: 'tot', role: desc.totRoles[k], d }));
  }

  const bns = desc.kind === 'master' ? CO_BN_ORDER : [desc.bn];
  const sig = bns.map(bn => {
    const L = layout[bn];
    return bn + ':' + L.extras.map(e => e.id + '=' + e.name).join(',') + '/' + Array.from(L.hidden).sort((a, b) => a - b).join(',');
  }).join('|');
  return { cols, sig };
}

function _coCellClasses(item) {
  const c = ['co-cell'];
  if (item.t === 'co') { c.push('co-c', 'co-bn-' + item.bn); if (item.x) c.push('co-xtd'); }
  else if (item.t === 'sum') c.push('co-sum', 'co-bn-' + item.bn);
  else c.push('co-tot');
  if (item.sep) c.push('co-sep');
  return c.join(' ');
}

function _coCellRole(item) { return item.t === 'co' ? 'co' : item.role; }
function _coItemCk(item) { return item.t === 'co' ? (item.x ? 'x' + item.id : 'b' + item.j) : ''; }

/** HTML של תא נתונים אחד (קלט רגיל, או textarea בשורות נושא שבוע/הערות). */
function _coCellHtml(item, textarea) {
  const attrs = item.x ? `data-xc="${item.id}"` : `data-d="${item.d}"`;
  const field = textarea
    ? `<textarea class="cell-input topic-textarea" rows="1" ${attrs}></textarea>`
    : `<input type="text" class="cell-input" ${attrs}>`;
  const bnAttr = item.bn ? ` data-bn="${item.bn}"` : '';
  const ckAttr = item.t === 'co' ? ` data-ck="${_coItemCk(item)}"` : '';
  return `<td class="${_coCellClasses(item)}" data-role="${_coCellRole(item)}"${bnAttr}${ckAttr}>${field}</td>`;
}

/** מפתח האחסון של שדה קלט בשורה r (נשען על data-d / data-xc / data-lbl של השדה). */
function _coKeyFor(desc, input, r) {
  const xc = input.dataset.xc;
  if (xc !== undefined) return 'x' + xc + '_' + r;
  if (desc.kind === 'modiein') {
    const N = desc.baseN;
    if (input.dataset.lbl !== undefined) return N + (r - 1) * (N + 1);
    const m = +input.dataset.d;
    return r === 0 ? m : N + (r - 1) * (N + 1) + 1 + m;
  }
  return r * desc.dataCols + (+input.dataset.d);
}

/** כל שדות הקלט של הטבלה עם מפתח האחסון שלהם: [{input, key, r}] */
function _coKeyedInputs(table, desc) {
  const out = [];
  const tbody = table.tBodies[0];
  if (!tbody) return out;
  Array.from(tbody.rows).forEach((tr, r) => {
    tr.querySelectorAll('.cell-input').forEach(input => out.push({ input, key: _coKeyFor(desc, input, r), r }));
  });
  return out;
}

/** כמה שורות נדרשות בטבלת מודיעין כדי להכיל את כל הערכים הלא-ריקים באובייקט הנתונים. */
function _coModieinRowsNeeded(desc, data, minRows) {
  const N = desc.baseN;
  let rows = minRows;
  if (!data) return rows;
  Object.keys(data).forEach(k => {
    const v = data[k];
    if (v === undefined || v === null || String(v).trim() === '') return;
    let r;
    const m = /^x\d+_(\d+)$/.exec(k);
    if (m) r = +m[1];
    else if (/^\d+$/.test(k)) { const idx = +k; r = idx < N ? 0 : 1 + Math.floor((idx - N) / (N + 1)); }
    else return;
    rows = Math.max(rows, r + 1);
  });
  return rows;
}

/** מפרקת מפתח של פלוגה שנוספה ("x12_3") ל-{id, r}; null אם זה לא מפתח כזה. */
function _coParseExtraKey(k) {
  const m = /^x(\d+)_(\d+)$/.exec(String(k));
  return m ? { id: m[1], r: +m[2] } : null;
}

/* ---------- כותרות (thead) ---------- */

/** שומרת עותק נקי של שורות הכותרת המקוריות (לפני כל שינוי) - הבסיס לבנייה מחדש בכל שינוי מבנה. */
function _coCapturePristine(table) {
  if (table._coPristine) return;
  const rows = table.tHead ? Array.from(table.tHead.rows) : [];
  table._coPristine = {
    r0: rows.length > 1 ? Array.from(rows[0].cells).map(c => c.cloneNode(true)) : null,
    r1: rows.length ? Array.from(rows[rows.length - 1].cells).map(c => c.cloneNode(true)) : []
  };
}

/**
 * בונה מחדש את שורות הכותרת לפי התוכנית: עמודות שהוסרו נעלמות, פלוגות חדשות נכנסות בסוף קבוצת
 * הגדוד שלהן, וה-colspan של כותרות הגדוד מתעדכן. התא הראשון בכל שורה (שבוע / "פלוגה") נשאר
 * אותו אלמנט חי (כולל שדה מספר השבוע ומאזיניו).
 */
function _coRebuildHead(table, desc, plan) {
  const thead = table.tHead;
  if (!thead || !thead.rows.length) return;
  _coCapturePristine(table);
  const P = table._coPristine;
  const rows = thead.rows;
  const nameRow = rows[rows.length - 1];
  const groupRow = rows.length > 1 ? rows[0] : null;

  const segList = desc.kind === 'master' ? desc.segs : [{ bn: desc.bn, d0: 0, n: desc.baseN }];
  const protoByBn = {};
  segList.forEach(seg => { protoByBn[seg.bn] = P.r1[1 + seg.d0]; });

  const decorate = (th, item) => {
    th.classList.add('co-th');
    if (item.bn) th.classList.add('co-bn-' + item.bn);
    if (item.t === 'co') th.classList.add('co-c');
    else if (item.t === 'sum') th.classList.add('co-sum');
    else th.classList.add('co-tot');
    if (item.sep) th.classList.add('co-sep');
    return th;
  };

  const nameThs = plan.cols.map(item => {
    let th;
    if (item.t === 'co' && item.x) {
      th = (protoByBn[item.bn] || P.r1[1]).cloneNode(true);
      th.textContent = item.name;
      th.classList.add('co-xth');
    } else {
      th = P.r1[1 + item.d].cloneNode(true);
    }
    return decorate(th, item);
  });
  nameRow.replaceChildren(nameRow.cells[0], ...nameThs);

  if (!groupRow) return;
  const coCount = bn => plan.cols.filter(c => c.t === 'co' && c.bn === bn).length;
  if (desc.kind === 'master') {
    const heads = [];
    let idx = 1;
    desc.segs.forEach(seg => {
      const head = P.r0[idx++].cloneNode(true);
      head.colSpan = coCount(seg.bn);
      head.classList.add('co-bh', 'co-bn-' + seg.bn);
      heads.push(head);
      if (desc.hasSum) {
        const sumHead = P.r0[idx++].cloneNode(true);
        sumHead.classList.add('co-sep'); // סוף קבוצת הגדוד - קו הפרדה מודגש
        heads.push(sumHead);
      } else {
        head.classList.add('co-sep');
      }
    });
    heads.push(P.r0[idx++].cloneNode(true));
    groupRow.replaceChildren(groupRow.cells[0], ...heads);
  } else if (P.r0 && P.r0.length === 1) {
    groupRow.cells[0].colSpan = 1 + coCount(desc.bn);
  } else if (groupRow.cells.length >= 2) {
    groupRow.cells[1].colSpan = coCount(desc.bn);
  }
}

/**
 * נקראת כשמבנה העמודות של טבלה נבנה מחדש. אם זו לא הבנייה הראשונה של הטבלה (כלומר המבנה השתנה
 * תוך כדי עבודה - למשל מנהל אחר הוסיף/הסיר פלוגה והרענון האוטומטי קלט את זה), היסטוריית
 * הביטול/ביצוע-חוזר מתאפסת: היא ממופה לפי מיקום שדה בטבלה, והמיקומים השתנו.
 */
function _coNoteRebuild(table) {
  // האיפוס עצמו נעשה רק אחרי שהטבלה נטענה מחדש בנתונים (ראו סוף _loadTableDataImpl) - לא כאן,
  // כשהיא עדיין ריקה, אחרת מצב הבסיס של הביטול היה "טבלה ריקה".
  if (table._coBuiltOnce) table._coRebase = true;
  table._coBuiltOnce = true;
}

/* ---------- טבלאות מודיעין (שורות דינמיות) ---------- */

function _coModieinRowHtml(desc, plan, r, table) {
  const cos = plan.cols.filter(c => c.t === 'co');
  let html = '';
  if (r === 0) {
    html += `<td class="${table._coLabelCls || ''}">נושא שבוע</td>`;
  } else {
    html += `<td><input type="text" class="cell-input" data-lbl="1"></td>`;
  }
  cos.forEach(item => {
    const attrs = item.x ? `data-xc="${item.id}"` : `data-d="${item.d}"`;
    html += `<td data-role="co" data-bn="${item.bn}" data-ck="${_coItemCk(item)}"><input type="text" class="cell-input" ${attrs}></td>`;
  });
  return `<tr>${html}</tr>`;
}

/** מוודאת שמבנה העמודות של טבלת מודיעין תואם לשבוע (בונה מחדש רק כשמשהו השתנה). */
function _coEnsureModieinStructure(table, desc, week, year) {
  const layout = getCompanyLayout(week, year);
  const plan = _coBuildPlan(desc, layout);
  if (!table._coPristine) {
    _coCapturePristine(table);
    const firstRow = table.tBodies[0] && table.tBodies[0].rows[0];
    table._coLabelCls = firstRow && firstRow.cells[0] ? firstRow.cells[0].className : '';
  }
  if (table._coPlan && table._coPlan.sig === plan.sig) return plan;
  table._coPlan = plan;
  table._coReady = false;
  _coRebuildHead(table, desc, plan);
  _coNoteRebuild(table);
  table.tBodies[0].innerHTML = _coModieinRowHtml(desc, plan, 0, table) + _coModieinRowHtml(desc, plan, 1, table);
  return plan;
}

/** מוודאת שכותרת טבלת הקצאות (קריאה בלבד) תואמת לשבוע; מחזירה את התוכנית. */
function _coEnsureHkHead(table, desc, week, year) {
  const layout = getCompanyLayout(week, year);
  const plan = _coBuildPlan(desc, layout);
  _coCapturePristine(table);
  if (!table._coPlan || table._coPlan.sig !== plan.sig) {
    table._coPlan = plan;
    _coRebuildHead(table, desc, plan);
  }
  return plan;
}

/* ---------- השוואה יציבה (ללא תלות בסדר מפתחות) ---------- */
function _stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(_stableStringify).join(',') + ']';
  return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
}

/* ---------- ניהול הפלוגות: חלונות "הוסף פלוגה" / "הסר פלוגה" (מנהל בלבד) ---------- */

function _coIsAdmin() {
  return typeof AUTH !== 'undefined' && typeof AUTH.isAdmin === 'function' && AUTH.isAdmin();
}

function _coCloseModal() {
  const m = document.getElementById('co-modal-overlay');
  if (m) m.remove();
}

function _coOpenModal(innerHtml) {
  _coCloseModal();
  const ov = document.createElement('div');
  ov.id = 'co-modal-overlay';
  ov.className = 'co-modal-overlay';
  ov.innerHTML = `<div class="co-modal" dir="rtl" role="dialog"><button type="button" class="co-modal-close" onclick="_coCloseModal()" title="סגור">&times;</button>${innerHtml}</div>`;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) _coCloseModal(); });
  document.body.appendChild(ov);
  return ov.querySelector('.co-modal');
}

/** מוסיפה k שבועות לשבוע נתון (עם מעבר שנה). */
function _coAddWeeks(wk, k) {
  let w = wk.w, y = wk.y;
  for (let i = 0; i < k; i++) {
    w++;
    if (w > getWeeksInYear(y)) { w = 1; y++; }
  }
  for (let i = 0; i > k; i--) {
    w--;
    if (w < 1) { y--; w = getWeeksInYear(y); }
  }
  return { w, y };
}

/** מבנה הפלוגות של שבוע לפי ספר נתון (לא בהכרח זה השמור) - לבדיקת תקינות לפני שמירה. */
function _coLayoutFromRoster(roster, week, year) {
  const ord = _coOrd(week, year);
  const out = {};
  CO_BN_ORDER.forEach(bn => { out[bn] = { extras: [], hidden: new Set() }; });
  roster.added.forEach(c => {
    const toOrd = c.to ? _coOrd(c.to.w, c.to.y) : Infinity;
    if (ord >= _coOrd(c.from.w, c.from.y) && ord <= toOrd) out[c.bn].extras.push({ id: c.id, name: c.name });
  });
  roster.removedBase.forEach(b => {
    if (_coIsHiddenAt(roster, b.bn, b.j, ord)) out[b.bn].hidden.add(b.j);
  });
  return out;
}

/** מספר הפלוגות (לא כולל מפקדה) שגדוד מציג בשבוע לפי ספר נתון. */
function _coCompanyCount(layout, bn) {
  const base = CO_BASE[bn];
  let n = 0;
  for (let j = base.hq; j < base.kesher.length; j++) if (!layout[bn].hidden.has(j)) n++;
  return n + layout[bn].extras.length;
}

/**
 * בודקת שבכל שבוע מהשבוע הנתון ואילך (שנתיים קדימה) נשארת בכל גדוד לפחות פלוגה אחת - גדוד בלי
 * אף פלוגה היה משאיר קבוצת עמודות ריקה בטבלאות. מחזירה את הגדוד הראשון שנפגע (או null).
 */
function _coFindEmptyBattalion(roster, fromWk, span) {
  const n = span || 104;
  for (let k = 0; k <= n; k++) {
    const wk = _coAddWeeks(fromWk, k);
    const layout = _coLayoutFromRoster(roster, wk.w, wk.y);
    for (const bn of CO_BN_ORDER) {
      if (_coCompanyCount(layout, bn) < 1) return { bn, wk };
    }
  }
  return null;
}

function _coNameKey(s) {
  return String(s || '').replace(/[​-‏‪-‮⁦-⁩﻿]/g, '').replace(/\s+/g, ' ').trim();
}

async function _coSaveRoster(roster) {
  if (typeof DataService !== 'undefined') return await DataService.setItem(COMPANY_ROSTER_KEY, roster);
  try { localStorage.setItem(COMPANY_ROSTER_KEY, JSON.stringify(roster)); } catch (e) { return false; }
  return true;
}

/* מנעול: פעולת ניהול פלוגות אחת בכל רגע (מונע כפל הוספה בלחיצה כפולה/הרצה מקבילה). */
let _coBusy = false;
async function _coLocked(fn, ...args) {
  if (_coBusy) return;
  _coBusy = true;
  try { return await fn(...args); } finally { _coBusy = false; }
}
function _coApplyAdd(spec) { return _coLocked(_coApplyAddImpl, spec); }
function _coApplyRemove(spec) { return _coLocked(_coApplyRemoveImpl, spec); }
function _coApplyEdit(id, spec) { return _coLocked(_coApplyEditImpl, id, spec); }
function _coApplyRestore(bn, j, wk) { return _coLocked(_coApplyRestoreImpl, bn, j, wk); }

/* --- הוספה --- */
let _coAddState = null;

function openAddCompanyModal() {
  if (!_coIsAdmin()) { alert('הוספת פלוגה זמינה למנהל בלבד.'); return; }
  const wk = { w: currentWeek, y: currentYear };
  _coAddState = { bn: null, name: '', mode: 'perm', from: wk, to: _coAddWeeks(wk, 3) };
  _coAddStep1();
}

function _coAddStep1() {
  const btns = CO_BN_ORDER.map(bn =>
    `<button type="button" class="co-bn-btn co-bn-btn-${bn}" onclick="_coAddPickBn('${bn}')">${CO_BN_EMOJI[bn]} ${escapeHtml(CO_BN_NAMES[bn])}</button>`
  ).join('');
  _coOpenModal(`
    <h3 class="co-modal-title">הוספת פלוגה</h3>
    <p class="co-modal-sub">שלב 1 מתוך 3: לאיזה גדוד להוסיף את הפלוגה?</p>
    <div class="co-bn-grid">${btns}</div>
  `);
}

function _coAddPickBn(bn) {
  _coAddState.bn = bn;
  _coAddStep2();
}

function _coAddStep2() {
  const st = _coAddState;
  const modal = _coOpenModal(`
    <h3 class="co-modal-title">הוספת פלוגה - ${escapeHtml(CO_BN_NAMES[st.bn])}</h3>
    <p class="co-modal-sub">שלב 2 מתוך 3: שם הפלוגה החדשה</p>
    <input type="text" id="co-name-input" class="co-input" maxlength="30" placeholder="למשל: ז׳" autocomplete="off">
    <div class="co-modal-actions">
      <button type="button" class="co-btn co-btn-secondary" onclick="_coAddStep1()">חזור</button>
      <button type="button" class="co-btn co-btn-primary" onclick="_coAddNameNext()">המשך</button>
    </div>
  `);
  const input = modal.querySelector('#co-name-input');
  input.value = st.name;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') _coAddNameNext(); });
  setTimeout(() => input.focus(), 0);
}

function _coAddNameNext() {
  const input = document.getElementById('co-name-input');
  const name = _coNameKey(input ? input.value : '');
  if (!name) { alert('יש להזין שם לפלוגה.'); return; }
  _coAddState.name = name;
  _coAddStep3();
}

function _coAddStep3() {
  const st = _coAddState;
  const limited = st.mode === 'limited';
  const modal = _coOpenModal(`
    <h3 class="co-modal-title">הוספת פלוגה - ${escapeHtml(CO_BN_NAMES[st.bn])} - ${escapeHtml(st.name)}</h3>
    <p class="co-modal-sub">שלב 3 מתוך 3: למשך כמה זמן הפלוגה קיימת?</p>
    <label class="co-radio"><input type="radio" name="co-mode" value="perm" ${limited ? '' : 'checked'}> קבועה - מהשבוע שנבחר ואילך, ללא הגבלה</label>
    <label class="co-radio"><input type="radio" name="co-mode" value="limited" ${limited ? 'checked' : ''}> לתקופה מוגבלת של שבועות</label>
    <div class="co-weeks-row">
      <span>משבוע</span>
      <input type="number" id="co-from-w" class="co-input co-input-sm" min="1" max="${getWeeksInYear(st.from.y)}" value="${st.from.w}">
      <span>שנה</span>
      <input type="number" id="co-from-y" class="co-input co-input-md" min="2000" max="2200" value="${st.from.y}">
    </div>
    <div class="co-weeks-row" id="co-to-row" style="display:${limited ? 'flex' : 'none'};">
      <span>עד שבוע (כולל)</span>
      <input type="number" id="co-to-w" class="co-input co-input-sm" min="1" max="${getWeeksInYear(st.to.y)}" value="${st.to.w}">
      <span>שנה</span>
      <input type="number" id="co-to-y" class="co-input co-input-md" min="2000" max="2200" value="${st.to.y}">
    </div>
    <p class="co-modal-note" id="co-range-note"></p>
    <div class="co-modal-actions">
      <button type="button" class="co-btn co-btn-secondary" onclick="_coAddStep2()">חזור</button>
      <button type="button" class="co-btn co-btn-primary" id="co-confirm-add" onclick="_coAddConfirm()">הוסף פלוגה</button>
    </div>
  `);
  const refreshNote = () => {
    const mode = modal.querySelector('input[name="co-mode"]:checked').value;
    modal.querySelector('#co-to-row').style.display = mode === 'limited' ? 'flex' : 'none';
    const f = { w: +modal.querySelector('#co-from-w').value, y: +modal.querySelector('#co-from-y').value };
    const t = { w: +modal.querySelector('#co-to-w').value, y: +modal.querySelector('#co-to-y').value };
    modal.querySelector('#co-range-note').textContent = mode === 'limited'
      ? `הפלוגה תופיע מ${_coWeekLabel(f)} עד ${_coWeekLabel(t)} (כולל).`
      : `הפלוגה תופיע מ${_coWeekLabel(f)} ואילך, ללא הגבלה.`;
  };
  modal.addEventListener('input', refreshNote);
  modal.addEventListener('change', refreshNote);
  refreshNote();
}

function _coAddConfirm() {
  const modal = document.querySelector('#co-modal-overlay .co-modal');
  if (!modal) return;
  const st = _coAddState;
  const mode = modal.querySelector('input[name="co-mode"]:checked').value;
  const from = { w: +modal.querySelector('#co-from-w').value, y: +modal.querySelector('#co-from-y').value };
  const to = { w: +modal.querySelector('#co-to-w').value, y: +modal.querySelector('#co-to-y').value };
  const okWk = (x) => Number.isInteger(x.w) && Number.isInteger(x.y) && x.w >= 1 && x.w <= getWeeksInYear(x.y) && x.y >= 2000 && x.y <= 2200;
  if (!okWk(from)) { alert('שבוע/שנת ההתחלה אינם תקינים (שבוע 1-' + getWeeksInYear(from.y) + ').'); return; }
  if (mode === 'limited') {
    if (!okWk(to)) { alert('שבוע/שנת הסיום אינם תקינים (שבוע 1-' + getWeeksInYear(to.y) + ').'); return; }
    if (_coOrd(to.w, to.y) < _coOrd(from.w, from.y)) { alert('שבוע הסיום חייב להיות אחרי שבוע ההתחלה (או שווה לו).'); return; }
  }
  st.mode = mode; st.from = from; st.to = to;
  const btn = document.getElementById('co-confirm-add');
  if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
  _coApplyAdd({ bn: st.bn, name: st.name, from, to: mode === 'limited' ? to : null });
}

async function _coApplyAddImpl(spec) {
  try {
    spec = { ...spec, name: _coNameKey(spec.name).slice(0, 30) };
    if (!spec.name) { alert('יש להזין שם לפלוגה.'); return; }
    // שומרים קודם את מה שמוצג כרגע (לפי המבנה הנוכחי), ורק אחר כך משנים את המבנה
    await saveCurrentWeek();
    const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));

    // אין להוסיף פלוגה בשם זהה לפלוגה קיימת בגדוד באותה תקופה
    const key = _coNameKey(spec.name);
    const base = CO_BASE[spec.bn];
    const baseNames = base.kesher.slice(base.hq).concat(base.modiein);
    if (baseNames.some(n => _coNameKey(n) === key)) {
      alert(`כבר קיימת פלוגה בשם "${spec.name}" ב${CO_BN_NAMES[spec.bn]}.`);
      if (_coAddState) _coAddStep2(); else _coCloseModal();
      return;
    }
    const newFrom = _coOrd(spec.from.w, spec.from.y);
    const newTo = spec.to ? _coOrd(spec.to.w, spec.to.y) : Infinity;
    const clash = roster.added.some(c => c.bn === spec.bn && _coNameKey(c.name) === key
      && _coOrd(c.from.w, c.from.y) <= newTo && (c.to ? _coOrd(c.to.w, c.to.y) : Infinity) >= newFrom);
    if (clash) {
      alert(`כבר קיימת פלוגה בשם "${spec.name}" ב${CO_BN_NAMES[spec.bn]} בתקופה חופפת.`);
      if (_coAddState) _coAddStep2(); else _coCloseModal();
      return;
    }

    roster.seq += 1;
    roster.added.push({ id: String(roster.seq), bn: spec.bn, name: spec.name, from: spec.from, to: spec.to });
    const ok = await _coSaveRoster(roster);
    _coCloseModal();
    await updateUIForWeek();
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    if (typeof addNotification === 'function') {
      addNotification(`🏷️ המנהל הוסיף פלוגה "${spec.name}" ל${CO_BN_NAMES[spec.bn]}`, 'distribute');
    }
    const range = spec.to ? `מ${_coWeekLabel(spec.from)} עד ${_coWeekLabel(spec.to)}` : `מ${_coWeekLabel(spec.from)} ואילך`;
    alert(`הפלוגה "${spec.name}" נוספה ל${CO_BN_NAMES[spec.bn]} (${range}) - בטבלאות קשר, אופטיקה ומודיעין, בדרישות ובהקצאות.`
      + (ok ? '' : '\n\nשים לב: השמירה בשרת עדיין לא הושלמה - השינוי נשמר מקומית וייסנכרן אוטומטית כשהחיבור יחזור.'));
  } catch (err) {
    console.error('add company failed', err);
    _coCloseModal();
    alert('הוספת הפלוגה נכשלה. נסה שוב.');
  }
}

/* --- עריכה / שחזור / סיכום --- */

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('co-modal-overlay')) _coCloseModal();
});

/** תיאור טווח קריא של פלוגה שנוספה. */
function _coRangeText(c) {
  return c.to ? `${_coWeekLabel(c.from)} עד ${_coWeekLabel(c.to)}` : `${_coWeekLabel(c.from)} ואילך`;
}

/** סטטוס פלוגה שנוספה ביחס לשבוע הנצפה. */
function _coStatusText(c, ord) {
  const f = _coOrd(c.from.w, c.from.y);
  const t = c.to ? _coOrd(c.to.w, c.to.y) : Infinity;
  if (ord < f) return 'עתידית';
  if (ord > t) return 'הסתיימה';
  return 'פעילה השבוע';
}

async function openCompaniesSummaryModal() {
  if (!_coIsAdmin()) { alert('סיכום הפלוגות זמין למנהל בלבד.'); return; }
  const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));
  const wk = { w: currentWeek, y: currentYear };
  const ord = _coOrd(wk.w, wk.y);
  const groups = CO_BN_ORDER.map(bn => {
    const added = roster.added.filter(c => c.bn === bn);
    const removed = roster.removedBase.filter(b => b.bn === bn);
    const base = CO_BASE[bn];
    const addedRows = added.map(c => `
      <div class="co-rm-row">
        <span class="co-rm-name">${escapeHtml(c.name)}</span>
        <span class="co-rm-tag">${escapeHtml(_coRangeText(c))} · ${escapeHtml(_coStatusText(c, ord))}</span>
        <button type="button" class="co-btn co-btn-secondary co-btn-sm" onclick="openEditCompanyModal('${c.id}')">ערוך</button>
      </div>`).join('');
    const removedRows = removed.map(b => {
      const alias = base.hq ? ` (${base.modiein[b.j - base.hq]})` : '';
      const label = base.kesher[b.j] + alias;
      const rangeTxt = b.to ? `${_coWeekLabel(b.from)} עד ${_coWeekLabel(b.to)}` : `${_coWeekLabel(b.from)} ואילך`;
      return `
      <div class="co-rm-row">
        <span class="co-rm-name">${escapeHtml(label)}</span>
        <span class="co-rm-tag">מוסתרת: ${escapeHtml(rangeTxt)}</span>
        <button type="button" class="co-btn co-btn-primary co-btn-sm" onclick="openRestoreCompanyModal('${bn}', ${b.j})">שחזר</button>
      </div>`;
    }).join('');
    const body = (addedRows + removedRows) || '<div class="co-rm-empty">אין שינויים בגדוד הזה</div>';
    return `<div class="co-rm-group co-rm-group-${bn}"><div class="co-rm-group-title">${CO_BN_EMOJI[bn]} ${escapeHtml(CO_BN_NAMES[bn])}</div>${body}</div>`;
  }).join('');
  _coOpenModal(`
    <h3 class="co-modal-title">סיכום פלוגות</h3>
    <p class="co-modal-sub">פלוגות שנוספו (ניתן לערוך שם וטווח) ופלוגות מקוריות שהוסתרו (ניתן לשחזר). השבוע הנצפה: ${escapeHtml(_coWeekLabel(wk))}.</p>
    <div class="co-rm-list">${groups}</div>
  `);
}

/** קוראת את הספר מהמטמון המקומי (סינכרוני) - לפתיחת חלון עריכה. */
function _coRosterLocal() {
  return getCompanyRoster();
}

/* --- עריכת פלוגה שנוספה --- */
function openEditCompanyModal(id) {
  const roster = _coRosterLocal();
  const c = roster.added.find(x => x.id === String(id));
  if (!c) { alert('הפלוגה לא נמצאה.'); return; }
  const limited = !!c.to;
  const to = c.to || _coAddWeeks(c.from, 3);
  const modal = _coOpenModal(`
    <h3 class="co-modal-title">עריכת פלוגה - ${escapeHtml(CO_BN_NAMES[c.bn])}</h3>
    <p class="co-modal-sub">שינוי שם משפיע על כל השבועות (הנתונים נשמרים). קיצור הטווח מוחק את נתוני הפלוגה בשבועות שיוצאו ממנו בשמירה הבאה שלהם.</p>
    <input type="text" id="co-edit-name" class="co-input" maxlength="30" autocomplete="off">
    <label class="co-radio"><input type="radio" name="co-edit-mode" value="perm" ${limited ? '' : 'checked'}> קבועה - ללא הגבלת סיום</label>
    <label class="co-radio"><input type="radio" name="co-edit-mode" value="limited" ${limited ? 'checked' : ''}> לתקופה מוגבלת</label>
    <div class="co-weeks-row"><span>משבוע</span>
      <input type="number" id="co-edit-from-w" class="co-input co-input-sm" min="1" max="52" value="${c.from.w}">
      <span>שנה</span><input type="number" id="co-edit-from-y" class="co-input co-input-md" min="2000" max="2200" value="${c.from.y}"></div>
    <div class="co-weeks-row" id="co-edit-to-row" style="display:${limited ? 'flex' : 'none'};"><span>עד שבוע (כולל)</span>
      <input type="number" id="co-edit-to-w" class="co-input co-input-sm" min="1" max="52" value="${to.w}">
      <span>שנה</span><input type="number" id="co-edit-to-y" class="co-input co-input-md" min="2000" max="2200" value="${to.y}"></div>
    <div class="co-modal-actions">
      <button type="button" class="co-btn co-btn-secondary" onclick="openCompaniesSummaryModal()">חזור</button>
      <button type="button" class="co-btn co-btn-primary" id="co-edit-save" onclick="_coEditConfirm('${c.id}')">שמור שינויים</button>
    </div>
  `);
  modal.querySelector('#co-edit-name').value = c.name;
  modal.addEventListener('change', () => {
    const mode = modal.querySelector('input[name="co-edit-mode"]:checked').value;
    modal.querySelector('#co-edit-to-row').style.display = mode === 'limited' ? 'flex' : 'none';
  });
}

function _coEditConfirm(id) {
  const modal = document.querySelector('#co-modal-overlay .co-modal');
  if (!modal) return;
  const name = _coNameKey(modal.querySelector('#co-edit-name').value);
  const mode = modal.querySelector('input[name="co-edit-mode"]:checked').value;
  const from = { w: +modal.querySelector('#co-edit-from-w').value, y: +modal.querySelector('#co-edit-from-y').value };
  const to = { w: +modal.querySelector('#co-edit-to-w').value, y: +modal.querySelector('#co-edit-to-y').value };
  const okWk = (x) => Number.isInteger(x.w) && Number.isInteger(x.y) && x.w >= 1 && x.w <= getWeeksInYear(x.y) && x.y >= 2000 && x.y <= 2200;
  if (!name) { alert('יש להזין שם לפלוגה.'); return; }
  if (!okWk(from)) { alert('שבוע/שנת ההתחלה אינם תקינים (שבוע 1-' + getWeeksInYear(from.y) + ').'); return; }
  if (mode === 'limited') {
    if (!okWk(to)) { alert('שבוע/שנת הסיום אינם תקינים (שבוע 1-' + getWeeksInYear(to.y) + ').'); return; }
    if (_coOrd(to.w, to.y) < _coOrd(from.w, from.y)) { alert('שבוע הסיום חייב להיות אחרי שבוע ההתחלה (או שווה לו).'); return; }
  }
  const btn = document.getElementById('co-edit-save');
  if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
  _coApplyEdit(id, { name, from, to: mode === 'limited' ? to : null });
}

async function _coApplyEditImpl(id, spec) {
  try {
    spec = { ...spec, name: _coNameKey(spec.name).slice(0, 30) };
    if (!spec.name) { alert('יש להזין שם לפלוגה.'); return; }
    await saveCurrentWeek();
    const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));
    const c = roster.added.find(x => x.id === String(id));
    if (!c) { alert('הפלוגה כבר לא קיימת.'); _coCloseModal(); await updateUIForWeek(); return; }
    const key = _coNameKey(spec.name);
    const base = CO_BASE[c.bn];
    if (base.kesher.slice(base.hq).concat(base.modiein).some(n => _coNameKey(n) === key)) {
      alert(`כבר קיימת פלוגה בשם "${spec.name}" ב${CO_BN_NAMES[c.bn]}.`); openEditCompanyModal(id); return;
    }
    const newFrom = _coOrd(spec.from.w, spec.from.y);
    const newTo = spec.to ? _coOrd(spec.to.w, spec.to.y) : Infinity;
    const clash = roster.added.some(o => o.id !== c.id && o.bn === c.bn && _coNameKey(o.name) === key
      && _coOrd(o.from.w, o.from.y) <= newTo && (o.to ? _coOrd(o.to.w, o.to.y) : Infinity) >= newFrom);
    if (clash) { alert(`כבר קיימת פלוגה בשם "${spec.name}" ב${CO_BN_NAMES[c.bn]} בתקופה חופפת.`); openEditCompanyModal(id); return; }

    const oldFrom = { ...c.from };
    const before = JSON.stringify({ n: c.name, f: c.from, t: c.to });
    c.name = spec.name; c.from = spec.from; c.to = spec.to;
    if (before === JSON.stringify({ n: c.name, f: c.from, t: c.to })) { _coCloseModal(); return; }

    // השינוי לא יכול להשאיר גדוד בלי פלוגות בשבוע כלשהו - בודקים מהשבוע המוקדם מבין הישן/החדש,
    // לאורך כל הטווח המושפע ועוד שנתיים קדימה.
    const earliest = _coOrd(oldFrom.w, oldFrom.y) < newFrom ? oldFrom : spec.from;
    const lastYear = Math.max(spec.to ? spec.to.y : spec.from.y, currentYear);
    const weeksSpan = (lastYear - earliest.y + 1) * 53 + 110;
    const empty = _coFindEmptyBattalion(roster, earliest, weeksSpan);
    if (empty) {
      alert(`לא ניתן לשמור: ב${CO_BN_NAMES[empty.bn]} לא תישאר אף פלוגה ב${_coWeekLabel(empty.wk)}.`);
      openEditCompanyModal(id);
      return;
    }

    const ok = await _coSaveRoster(roster);
    _coCloseModal();
    await updateUIForWeek();
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    if (typeof addNotification === 'function') {
      addNotification(`🏷️ המנהל עדכן את הפלוגה "${spec.name}" ב${CO_BN_NAMES[c.bn]} (${_coRangeText(c)})`, 'distribute');
    }
    alert(`הפלוגה "${spec.name}" עודכנה (${_coRangeText(c)}).`
      + (ok ? '' : '\n\nשים לב: השמירה בשרת עדיין לא הושלמה - השינוי נשמר מקומית וייסנכרן אוטומטית כשהחיבור יחזור.'));
  } catch (err) {
    console.error('edit company failed', err);
    _coCloseModal();
    alert('עדכון הפלוגה נכשל. נסה שוב.');
  }
}

/* --- שחזור פלוגה מקורית שהוסתרה --- */
function openRestoreCompanyModal(bn, j) {
  const base = CO_BASE[bn];
  const alias = base.hq ? ` (${base.modiein[j - base.hq]})` : '';
  const label = base.kesher[j] + alias;
  const wk = { w: currentWeek, y: currentYear };
  _coOpenModal(`
    <h3 class="co-modal-title">שחזור פלוגה - ${escapeHtml(label)}</h3>
    <p class="co-modal-sub">הפלוגה תחזור לטבלאות של ${escapeHtml(CO_BN_NAMES[bn])} (קשר, אופטיקה ומודיעין) מהשבוע שתבחר ואילך. נתוניה בשבועות שנשמרו מאז ההסרה נמחקו - העמודה תחזור ריקה.</p>
    <div class="co-weeks-row"><span>החל משבוע</span>
      <input type="number" id="co-restore-w" class="co-input co-input-sm" min="1" max="52" value="${wk.w}">
      <span>שנה</span><input type="number" id="co-restore-y" class="co-input co-input-md" min="2000" max="2200" value="${wk.y}"></div>
    <div class="co-modal-actions">
      <button type="button" class="co-btn co-btn-secondary" onclick="openCompaniesSummaryModal()">חזור</button>
      <button type="button" class="co-btn co-btn-primary" id="co-restore-ok" onclick="_coRestoreConfirm('${bn}', ${j})">שחזר</button>
    </div>
  `);
}

function _coRestoreConfirm(bn, j) {
  const w = +document.getElementById('co-restore-w').value, y = +document.getElementById('co-restore-y').value;
  if (!(Number.isInteger(w) && Number.isInteger(y) && w >= 1 && w <= getWeeksInYear(y) && y >= 2000 && y <= 2200)) {
    alert('שבוע/שנה אינם תקינים (שבוע 1-' + getWeeksInYear(y) + ').'); return;
  }
  const btn = document.getElementById('co-restore-ok');
  if (btn) { btn.disabled = true; btn.textContent = 'שומר...'; }
  _coApplyRestore(bn, j, { w, y });
}

async function _coApplyRestoreImpl(bn, j, wk) {
  try {
    await saveCurrentWeek();
    const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));
    const ord = _coOrd(wk.w, wk.y);
    const next = [];
    roster.removedBase.forEach(b => {
      if (b.bn !== bn || b.j !== j) { next.push(b); return; }
      const f = _coOrd(b.from.w, b.from.y);
      const t = b.to ? _coOrd(b.to.w, b.to.y) : Infinity;
      if (t < ord) { next.push(b); return; }            // הסתיים לפני שבוע השחזור - לא נוגעים
      if (f >= ord) return;                               // כולו מהשבוע הזה ואילך - נמחק
      next.push({ ...b, to: _coAddWeeks(wk, -1) });       // נחתך: נשאר מוסתר רק עד השבוע שלפני
    });
    roster.removedBase = next;
    const ok = await _coSaveRoster(roster);
    _coCloseModal();
    await updateUIForWeek();
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    const label = CO_BASE[bn].kesher[j];
    if (typeof addNotification === 'function') {
      addNotification(`🏷️ המנהל שחזר את הפלוגה "${label}" ב${CO_BN_NAMES[bn]} (מ${_coWeekLabel(wk)})`, 'distribute');
    }
    alert(`הפלוגה "${label}" שוחזרה מ${_coWeekLabel(wk)} ואילך.`
      + (ok ? '' : '\n\nשים לב: השמירה בשרת עדיין לא הושלמה - השינוי נשמר מקומית וייסנכרן אוטומטית כשהחיבור יחזור.'));
  } catch (err) {
    console.error('restore company failed', err);
    _coCloseModal();
    alert('שחזור הפלוגה נכשל. נסה שוב.');
  }
}

/* --- הסרה --- */

/** רשימת הפלוגות שניתן להסיר: מקוריות שעוד מוצגות בשבוע הנצפה + שנוספו ועוד לא הסתיימו עד השבוע הנצפה. */
function _coCollectRemovable(roster, wk) {
  const ord = _coOrd(wk.w, wk.y);
  const out = [];
  CO_BN_ORDER.forEach(bn => {
    const base = CO_BASE[bn];
    for (let j = base.hq; j < base.kesher.length; j++) {
      if (_coIsHiddenAt(roster, bn, j, ord)) continue;
      const alias = base.hq ? ` (${base.modiein[j - base.hq]})` : '';
      const sched = roster.removedBase.find(b => b.bn === bn && b.j === j && _coOrd(b.from.w, b.from.y) > ord);
      out.push({ type: 'base', bn, j, label: base.kesher[j] + alias, tag: sched ? `קבועה (הסרה מתוזמנת מ${_coWeekLabel(sched.from)})` : 'קבועה' });
    }
    roster.added.filter(c => c.bn === bn).forEach(c => {
      const toOrd = c.to ? _coOrd(c.to.w, c.to.y) : Infinity;
      if (toOrd < ord) return; // כבר הסתיימה
      if (c.to && toOrd === ord && _coOrd(c.from.w, c.from.y) <= ord) return; // מסתיימת בדיוק בשבוע הנצפה - אין מה להסיר
      const tag = c.to ? `זמנית: ${_coWeekLabel(c.from)} - ${_coWeekLabel(c.to)}` : `קבועה (מ${_coWeekLabel(c.from)})`;
      out.push({ type: 'added', bn, id: c.id, label: c.name, tag });
    });
  });
  return out;
}

async function openRemoveCompanyModal() {
  if (!_coIsAdmin()) { alert('הסרת פלוגה זמינה למנהל בלבד.'); return; }
  const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));
  const wk = { w: currentWeek, y: currentYear };
  const items = _coCollectRemovable(roster, wk);
  window._coRemoveItems = items;
  const groups = CO_BN_ORDER.map(bn => {
    const rows = items.map((it, idx) => ({ it, idx })).filter(o => o.it.bn === bn).map(o => `
      <div class="co-rm-row">
        <span class="co-rm-name">${escapeHtml(o.it.label)}</span>
        <span class="co-rm-tag">${escapeHtml(o.it.tag)}</span>
        <button type="button" class="co-btn co-btn-danger co-btn-sm" onclick="_coRemoveAsk(${o.idx})">הסר</button>
      </div>`).join('');
    return `<div class="co-rm-group co-rm-group-${bn}"><div class="co-rm-group-title">${CO_BN_EMOJI[bn]} ${escapeHtml(CO_BN_NAMES[bn])}</div>${rows || '<div class="co-rm-empty">אין פלוגות</div>'}</div>`;
  }).join('');
  _coOpenModal(`
    <h3 class="co-modal-title">הסרת פלוגה</h3>
    <p class="co-modal-sub">הפלוגה שתבחר תוסר מהשבוע שאחרי ${escapeHtml(_coWeekLabel(wk))} (${escapeHtml(_coWeekLabel(_coAddWeeks(wk, 1)))}) והלאה - מטבלאות קשר, אופטיקה ומודיעין, מהדרישות ומההקצאות, ולא תיכלל בסכומים. ב${escapeHtml(_coWeekLabel(wk))} ובשבועות קודמים היא נשארת עם כל נתוניה.</p>
    <div class="co-rm-list">${groups}</div>
  `);
}

function _coRemoveAsk(idx) {
  const it = (window._coRemoveItems || [])[idx];
  if (!it) return;
  const wk = { w: currentWeek, y: currentYear };
  const nextWk = _coAddWeeks(wk, 1);
  if (!confirm(`להסיר את הפלוגה "${it.label}" של ${CO_BN_NAMES[it.bn]} מ${_coWeekLabel(nextWk)} והלאה?\n\nהיא תימחק מטבלאות קשר, אופטיקה ומודיעין (מנהל ויחידה, דרישות והקצאות) ולא תיכלל בסכומים ובעמודות הגדודיות מהשבוע הזה והלאה.\nב${_coWeekLabel(wk)} ובשבועות קודמים היא נשארת עם כל הנתונים שלה.\n\nשים לב: הנתונים שלה בשבועות שהיא מוסרת מהם יימחקו בשמירה הבאה של אותם שבועות, ולא ניתן לשחזר אותם (שחזור פלוגה מחזיר את העמודה בלבד, ריקה).`)) return;
  _coApplyRemove(it);
}

async function _coApplyRemoveImpl(spec) {
  try {
    await saveCurrentWeek();
    const roster = _coNormalizeRoster(await fetchTableData(COMPANY_ROSTER_KEY));
    const wk = { w: currentWeek, y: currentYear };
    const ord = _coOrd(wk.w, wk.y);
    // ההסרה חלה מהשבוע *שאחרי* השבוע הנצפה: בשבוע הנצפה ובשבועות קודמים הפלוגה והנתונים שלה נשארים.
    const nextWk = _coAddWeeks(wk, 1);
    const nextOrd = _coOrd(nextWk.w, nextWk.y);
    let label = spec.label;

    if (spec.type === 'added') {
      const c = roster.added.find(x => x.id === spec.id);
      if (!c) { alert('הפלוגה כבר לא קיימת.'); _coCloseModal(); await updateUIForWeek(); return; }
      label = c.name;
      if (_coOrd(c.from.w, c.from.y) > ord) {
        // הפלוגה מתחילה רק אחרי השבוע הנצפה - אין שבוע עד אליו שבו היא קיימת: מבטלים אותה לגמרי
        roster.added = roster.added.filter(x => x !== c);
      } else if (!c.to || _coOrd(c.to.w, c.to.y) > ord) {
        c.to = wk; // הפלוגה נשארת כולל השבוע הנצפה, ונעלמת מהשבוע שאחריו
      }
    } else {
      // טווח הסרה חדש מהשבוע הבא ואילך; טווחים חופפים/צמודים של אותה פלוגה ממוזגים
      roster.removedBase.push({ bn: spec.bn, j: spec.j, from: nextWk, to: null });
      roster.removedBase = _coMergeRemovedBase(roster.removedBase);
    }

    const empty = _coFindEmptyBattalion(roster, nextWk);
    if (empty) {
      alert(`לא ניתן להסיר: ב${CO_BN_NAMES[empty.bn]} לא תישאר אף פלוגה ב${_coWeekLabel(empty.wk)}. יש להוסיף פלוגה אחרת לפני ההסרה.`);
      return;
    }

    const ok = await _coSaveRoster(roster);
    _coCloseModal();
    await updateUIForWeek();
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    if (typeof addNotification === 'function') {
      addNotification(`🏷️ המנהל הסיר את הפלוגה "${label}" מ${CO_BN_NAMES[spec.bn]} (מ${_coWeekLabel(nextWk)})`, 'distribute');
    }
    alert(`הפלוגה "${label}" הוסרה מ${_coWeekLabel(nextWk)} והלאה. ב${_coWeekLabel(wk)} ובשבועות קודמים היא נשארת עם נתוניה.`
      + (ok ? '' : '\n\nשים לב: השמירה בשרת עדיין לא הושלמה - השינוי נשמר מקומית וייסנכרן אוטומטית כשהחיבור יחזור.'));
  } catch (err) {
    console.error('remove company failed', err);
    _coCloseModal();
    alert('הסרת הפלוגה נכשלה. נסה שוב.');
  }
}

/* ================================
   עמודת "סה"כ" בטבלאות הדרישה היחידתיות (אפיון 1.7)
   מסכמת את כמות האמצעים המבוקשת בכל שורה. לא חלה על טבלאות המנהל.
================================ */
function isUnitReqTable(tableId) {
  const inList = KESHER_TABLE_LIST.some(t => t.id === tableId) || OPTIC_TABLE_LIST.some(t => t.id === tableId);
  return inList && tableId !== 'keshertable' && tableId !== 'optictable';
}

// מפח"ט (bahalag) מכיל עמודת אמצעי בודדת בלבד - עמודת "סה"כ" תהיה תמיד זהה לערך היחיד ולכן מיותרת שם.
function hasUnitTotalColumn(tableId) {
  return isUnitReqTable(tableId) && tableId !== 'bkeshertable' && tableId !== 'boptictable';
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
    totalCell.innerHTML = '';
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

  // אם רשימת שמות האמצעים לא השתנתה מאז הבנייה הקודמת של הטבלה הזו - מדלגים על בנייה מחדש
  // של כל ה-HTML (tbody.innerHTML). בעבר זה נבנה מחדש בכל קריאה - כולל בכל מחזור רענון
  // אוטומטי (כל כמה שניות, ראו CONFIG.SYNC_INTERVAL_MS) גם כשדבר לא השתנה בפועל - מה שגרם
  // לכל הטבלה (קלטים כולל) "להיעלם" לרגע ולהיבנות מחדש שוב ושוב (אפיון QA: "הנתונים נעלמים
  // לרגע כל כמה שניות"). מילוי הערכים עצמם ממשיך לקרות תמיד ב-loadTableData אחרי הפונקציה
  // הזו, גם כשהמבנה לא נבנה מחדש.
  // מבנה העמודות (פלוגות שנוספו / הוסרו) חלק מהחתימה - שינוי בו בונה מחדש גם את הכותרת וגם הגוף.
  const coDesc = _coDesc(tableId);
  const coPlan = coDesc ? _coBuildPlan(coDesc, getCompanyLayout(week, year)) : null;
  const rowsSignature = JSON.stringify(rowsList) + (coPlan ? '#' + coPlan.sig : '');
  if (tbody.dataset.rowsSignature === rowsSignature) return;
  tbody.dataset.rowsSignature = rowsSignature;

  if (coPlan) {
    table._coPlan = coPlan;
    table._coReady = false;
    _coRebuildHead(table, coDesc, coPlan);
    _coNoteRebuild(table);
  }

  let tbodyHtml = '';
  const totalCols = dataCols + 1;

  const isMasterTable = (tableId === 'keshertable' || tableId === 'optictable');

  rowsList.forEach((rowName, rowIndex) => {
    const isTopicRow = (rowIndex === 0);
    // שורת "הערות משיכה\זיכוי" בקשר היא שורה קבועה (תמיד אחרונה) - אסור שתהיה ניתנת למחיקה או לגרירה
    // (ראו גם ההגנה הזהה ב-deleteRowItem ואי-הוספת מחלקת reorderable-row).
    const isSpecialNoteRow = (category === 'kesher' && rowIndex === rowsList.length - 1 && rowName === "הערות משיכה\\זיכוי");
    const isReorderable = isMasterTable && !isTopicRow && !isSpecialNoteRow;

    let deleteBtnHtml = '';
    if (rowIndex > 0 && isMasterTable && !isSpecialNoteRow) {
      deleteBtnHtml = `<button type="button" class="row-delete-icon" onclick="deleteRowItem('${category}', ${rowIndex})" title="מחק אמצעי משבוע זה והלאה">✕</button>`;
    }
    const rowClasses = [];
    if (isTopicRow) rowClasses.push('topic-row');
    if (isSpecialNoteRow) rowClasses.push('special-note-row');
    if (isReorderable) rowClasses.push('reorderable-row');
    const trClassAttr = rowClasses.length > 0 ? ` class="${rowClasses.join(' ')}"` : '';

    // ידית גרירה לשינוי סדר האמצעים (אפיון 1.6) - טבלת מנהל בלבד
    const dragHandleHtml = isReorderable
      ? `<span class="row-drag-handle" draggable="true" title="גרור לשינוי סדר האמצעי">⠿</span>`
      : '';

    let tds = `<td class="test"><span class="row-name-text">${escapeHtml(rowName)}</span> ${dragHandleHtml}${deleteBtnHtml}</td>`;
    if (coPlan) {
      coPlan.cols.forEach(item => { tds += _coCellHtml(item, isTopicRow || isSpecialNoteRow); });
    } else {
      for (let i = 1; i < totalCols; i++) {
        if (isTopicRow || isSpecialNoteRow) {
          tds += `<td><textarea class="cell-input topic-textarea" rows="1"></textarea></td>`;
        } else {
          tds += `<td><input type="text" class="cell-input"></td>`;
        }
      }
    }
    if (hasUnitTotalColumn(tableId)) {
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

  if (hasUnitTotalColumn(tableId)) {
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
  persist(getRowsStorageKey(category, currentWeek, currentYear), newRows);

  // מיפוי מחדש של הנתונים לכל הטבלאות בקטגוריה
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;
  // oldRow -> newRow (להמרת מפתחות של פלוגות שנוספו: x<מזהה>_<שורה>)
  const newRowOf = {};
  order.forEach((oldRow, newRow) => { newRowOf[oldRow] = newRow; });
  for (const t of tableList) {
    for (const suffix of ['', '_published']) {
      const key = getStorageKey(t.id, currentWeek, currentYear) + suffix;
      const data = await fetchTableData(key);
      if (!data) continue;
      const newData = {};
      order.forEach((oldRow, newRow) => {
        for (let c = 0; c < t.dataCols; c++) {
          const oldIdx = oldRow * t.dataCols + c;
          const newIdx = newRow * t.dataCols + c;
          if (data[oldIdx] !== undefined) newData[newIdx] = data[oldIdx];
        }
      });
      Object.keys(data).forEach(k => {
        const px = _coParseExtraKey(k);
        if (px && newRowOf[px.r] !== undefined) newData['x' + px.id + '_' + newRowOf[px.r]] = data[k];
      });
      persist(key, newData);
    }
  }

  // רענון טבלת המנהל הנוכחית
  const masterId = category === 'kesher' ? 'keshertable' : 'optictable';
  await loadTableData(masterId, currentWeek, currentYear);
  recalcAll(masterId, tableConfigs[masterId]);
  if (typeof resetUndoHistory === 'function') resetUndoHistory();
}

function promptAddItemRow(category) {
  const catName = category === 'kesher' ? 'תקשוב' : 'אופטיקה';
  const itemName = prompt(`הכנס שם אמצעי חדש לטבלאות ${catName} (משבוע ${currentWeek} והלאה):`);
  if (!itemName || !itemName.trim()) return;
  addItemRow(category, itemName.trim());
}

// אוספת לרשימה שטוחה של {week, year} כל השבועות מהשבוע הנוכחי ועד סוף השנה הבאה - טווח
// ה"מכאן ואילך" ששינוי מבנה שורה (הוספה/מחיקה) חל עליו (ראו addItemRow/deleteRowItem).
function _weeksFromCurrentOnward() {
  const out = [];
  for (let y = currentYear; y <= currentYear + 1; y++) {
    const startW = (y === currentYear) ? currentWeek : 1;
    for (let w = startW; w <= getWeeksInYear(y); w++) out.push({ w, y });
  }
  return out;
}

/**
 * שינוי מבנה שורה (הוספה/מחיקה) חייב לקרוא ולכתוב את נתוני הטבלה דרך fetchTableData/persist
 * (מודעים לשרת מרכזי) ולא ישירות מ-localStorage - אחרת שבוע עתידי שהמכשיר הזה מעולם לא טען
 * באופן מקומי (סביר מאוד עבור שבועות רחוקים) נשמט בשקט מהמיפוי-מחדש: רשימת השורות שלו
 * מתעדכנת (דרך ירושה/fallback), אבל הנתונים הקיימים בשרת נשארים באינדקסים הישנים - כלומר
 * אחרי הוספת/מחיקת שורה, ערכים שהוזנו מראש לשבוע עתידי "זזים" לשורה הלא נכונה ברגע שהשבוע
 * הזה נטען. אומת ישירות בסימולציה: יחידה מילאה שבוע+5 בדפדפן אחד, מנהל (בדפדפן/פרופיל אחר,
 * שמעולם לא טען את השבוע הזה) הוסיף אמצעי - נתוני שבוע+5 בשרת נשארו לגמרי לא ממופים מחדש.
 * מטפלת גם ב-_published (כמו reorderCategoryRow) - בלעדיה, המיפוי-מחדש של הטיוטה מצליח אבל
 * הגרסה שפורסמה נשארת במבנה הישן, מה שגורם לכל תא אחרי נקודת ההוספה/מחיקה להיראות "השתנה
 * מאז הפרסום" בטעות (סימון כתום שגוי בכל הטבלה).
 */
async function _remapRowStructureForward(category, transform) {
  const tableList = category === 'kesher' ? KESHER_TABLE_LIST : OPTIC_TABLE_LIST;
  const weeks = _weeksFromCurrentOnward();

  const rowListSnapshots = {};
  const hasExplicitSave = {};
  await _runInBatches(weeks, 8, async ({ w, y }) => {
    const key = getRowsStorageKey(category, w, y);
    const remote = await fetchTableData(key);
    hasExplicitSave[`${w}_${y}`] = remote !== null && remote !== undefined;
    rowListSnapshots[`${w}_${y}`] = remote || getRowsForWeek(category, w, y);
  });

  const rowListWrites = [];
  const dataTasks = [];
  for (const { w, y } of weeks) {
    const currentList = rowListSnapshots[`${w}_${y}`];
    const { newList, insertIdx } = transform(currentList);
    if (!newList) continue; // transform מחזירה null אם אין שינוי רלוונטי לשבוע הזה (למשל אמצעי שכבר לא קיים)

    if ((w === currentWeek && y === currentYear) || hasExplicitSave[`${w}_${y}`]) {
      rowListWrites.push({ key: getRowsStorageKey(category, w, y), data: newList });
    }
    tableList.forEach(t => {
      ['', '_published'].forEach(suffix => {
        dataTasks.push({ key: getStorageKey(t.id, w, y) + suffix, cols: t.dataCols, insertIdx });
      });
    });
  }

  await _runInBatches(rowListWrites, 8, async ({ key, data }) => persist(key, data));

  await _runInBatches(dataTasks, 8, async ({ key, cols, insertIdx }) => {
    const oldData = await fetchTableData(key);
    if (!oldData) return;
    const newData = {};
    Object.keys(oldData).forEach(idxStr => {
      // מפתח של פלוגה שנוספה (x<מזהה>_<שורה>) - רק מספר השורה משתנה, העמודה היא המזהה עצמו.
      const px = _coParseExtraKey(idxStr);
      if (px) {
        const newRx = insertIdx(px.r);
        if (newRx !== null) newData['x' + px.id + '_' + newRx] = oldData[idxStr];
        return;
      }
      const idx = parseInt(idxStr);
      if (isNaN(idx)) return;
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const newR = insertIdx(r);
      if (newR !== null) newData[newR * cols + c] = oldData[idxStr];
    });
    persist(key, newData);
  });
}

async function addItemRow(category, itemName) {
  await _remapRowStructureForward(category, (currentList) => {
    let insertAt = currentList.length;
    if (category === 'kesher' && currentList[currentList.length - 1] === "הערות משיכה\\זיכוי") {
      insertAt = currentList.length - 1;
    }
    const newList = [...currentList];
    newList.splice(insertAt, 0, itemName);
    return { newList, insertIdx: (r) => (r < insertAt ? r : r + 1) };
  });

  updateUIForWeek();
}

async function deleteRowItem(category, rowIndex) {
  const currentList = getRowsForWeek(category, currentWeek, currentYear);
  const itemName = currentList[rowIndex];
  if (!itemName) return;

  if (rowIndex === 0) {
    alert("לא ניתן למחוק את שורת נושא השבוע.");
    return;
  }

  if (category === 'kesher' && rowIndex === currentList.length - 1 && itemName === "הערות משיכה\\זיכוי") {
    alert("לא ניתן למחוק את שורת \"הערות משיכה\\זיכוי\".");
    return;
  }

  const catName = category === 'kesher' ? 'תקשוב' : 'אופטיקה';
  if (!confirm(`האם למחוק את האמצעי "${itemName}" מטבלאות ${catName} משבוע ${currentWeek} והלאה?`)) {
    return;
  }

  await _remapRowStructureForward(category, (listW) => {
    const targetIdx = listW.indexOf(itemName);
    if (targetIdx === -1) return { newList: null };
    const newList = listW.filter((_, idx) => idx !== targetIdx);
    return { newList, insertIdx: (r) => (r === targetIdx ? null : (r < targetIdx ? r : r - 1)) };
  });

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

  // טבלת הקצאות של גדוד: עמודות הפלוגות (כולל פלוגות שנוספו, בלי אלה שהוסרו) נקבעות לפי
  // מבנה הפלוגות של השבוע - ראו "פלוגות דינמיות". הכותרת נבנית מחדש לפי אותה תוכנית.
  const hkTable = tbody.closest('table');
  const hkDesc = hkTable ? _coDesc(hkTable.id) : null;
  const hkPlan = hkDesc ? _coEnsureHkHead(hkTable, hkDesc, currentWeek, currentYear) : null;
  const hkCols = hkPlan ? hkPlan.cols.filter(c => c.t === 'co') : null;

  // מדלגים על ריקון+בנייה מחדש של כל השורות אם הנתונים זהים למה שכבר מוצג - ראו
  // _renderDataChanged. בלי זה טבלת ההקצאות (קשר/אופטיקה בעמוד יחידה) "נעלמת ומופיעה" בכל
  // מחזור רענון אוטומטי (כל כמה שניות) כשתצוגת "הקצאות" פתוחה, גם כשלא השתנה כלום - אותה
  // תבנית בדיוק כמו loadHadragTables/loadShekemTables/renderHaktzaotModieinUnit (אפיון QA: "מרצד").
  if (!_renderDataChanged('haktzaot_' + tbodyId, { data, names, sig: hkPlan ? hkPlan.sig : '' })) return;

  tbody.innerHTML = '';
  let hasAny = false;

  names.forEach((name, rowIndex) => {
    let hasValue = false;
    const values = [];

    if (hkCols) {
      hkCols.forEach(c => {
        // פלוגה מקורית: אותו אינדקס מספרי כמו תמיד בטבלת המנהל; פלוגה שנוספה: x<מזהה>_<שורה>
        const k = c.x ? ('x' + c.id + '_' + rowIndex) : (rowIndex * (totalCols - 1) + (startCol - 1 + c.j));
        const val = data[k] || '';
        values.push(val);
        if (val !== '') hasValue = true;
      });
    } else {
      for (let col = startCol; col <= endCol; col++) {
        const globalIndex = rowIndex * (totalCols - 1) + (col - 1);
        const val = data[globalIndex] || '';
        values.push(val);
        if (val !== '') hasValue = true;
      }
    }

    if (!hasValue) return;
    hasAny = true;

    const isSpecialRow = rowIndex === 0 || (name === "הערות משיכה\\זיכוי");
    let tds = `<td class="test">${escapeHtml(name)}</td>`;
    values.forEach(val => {
      tds += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
    });
    tbody.innerHTML += `<tr class="${isSpecialRow ? 'special-row' : ''}">${tds}</tr>`;
  });

  if (!hasAny) {
    const colSpan = hkCols ? (hkCols.length + 1) : (endCol - startCol + 2);
    tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">אין נתונים לשבוע זה</td></tr>`;
  }
}

/**
 * מרנדרת את תצוגת הקצאות המודיעין עבור יחידה ספציפית לפי מספר הפלוגות.
 * @param {string} sourceTableId - מזהה טבלת המקור של המודיעין
 * @param {string} tbodyId - מזהה tbody ביעד
 * @param {number} [companyCount=6] - מספר הפלוגות ביחידה
 */
async function renderHaktzaotModieinUnit(sourceTableId, tbodyId, companyCount = 6) {
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  // חשוב: fetchTableData (לא localStorage.getItem ישיר) - כדי שגם במצב שרת מרוחק (SharePoint/
  // רשת צבאית) הנתונים ייטענו דרך DataService.getItem בפועל, ולא רק מתוך מטמון מקומי שעלול
  // להיות ריק/מיושן במכשיר שלא ביצע בעצמו את הפעולה האחרונה שכתבה למפתח הזה.
  const reqWeek = currentWeek, reqYear = currentYear;
  const key = getStorageKey(sourceTableId, reqWeek, reqYear) + '_published';
  const data = await fetchTableData(key);
  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
  // מפורטת ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  // עמודות הפלוגות לשבוע הזה (מקוריות שלא הוסרו + חדשות) - ראו "פלוגות דינמיות". הכותרת של
  // טבלת ההקצאות נבנית מחדש לפי אותה תוכנית.
  const hkTable = tbody.closest('table');
  const hkDesc = hkTable ? _coDesc(hkTable.id) : null;
  const hkPlan = hkDesc ? _coEnsureHkHead(hkTable, hkDesc, reqWeek, reqYear) : null;
  const cos = hkPlan
    ? hkPlan.cols.filter(c => c.t === 'co')
    : Array.from({ length: companyCount }, (_, m) => ({ t: 'co', x: false, j: m, d: m }));
  const N = companyCount;
  const keyOf = (c, r) => (c.x ? 'x' + c.id + '_' + r : (r === 0 ? c.d : N + (r - 1) * (N + 1) + 1 + c.d));

  // מדלגים על כל מגע ב-DOM אם הנתונים המפורסמים זהים לגמרי למה שכבר מוצג - ראו _renderDataChanged
  if (!_renderDataChanged('modiein_' + tbodyId, { data, sig: hkPlan ? hkPlan.sig : '' })) return;

  const emptyHtml = `<tr><td colspan="${cos.length + 1}" style="text-align:center;">אין נתונים מאושרים לשבוע זה</td></tr>`;
  if (!data) { tbody.innerHTML = emptyHtml; return; }

  const requiredRows = _coModieinRowsNeeded({ baseN: N }, data, 1);

  // בונים את כל השורות ב-HTML לפני נגיעה ב-DOM (במעבר אחד, לא appendChild מצטבר) - כדי
  // שהחלפת התוכן תהיה אטומית ולא תגרום להבהוב מיותר.
  let rowsHtml = '';
  for (let r = 0; r < requiredRows; r++) {
    if (r === 0) {
      let rowHtml = `<td class="test">נושא שבוע</td>`;
      let rowHasData = false;
      cos.forEach(c => {
        const val = data[keyOf(c, 0)] || '';
        if (val) rowHasData = true;
        rowHtml += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
      });
      if (rowHasData) rowsHtml += `<tr class="special-row">${rowHtml}</tr>`;
    } else {
      let isEmpty = true;
      // העמודה הראשונה בשורות הרגילות היא שדה חופשי (תיאור השורה) - נשמרת תמיד, בלי קשר לפלוגות
      const labelVal = data[N + (r - 1) * (N + 1)] || '';
      if (labelVal !== '') isEmpty = false;
      let rowHtml = `<td style="text-align:center; font-weight:bold;">${escapeHtml(labelVal)}</td>`;
      cos.forEach(c => {
        const val = data[keyOf(c, r)] || '';
        if (val !== '') isEmpty = false;
        rowHtml += `<td style="text-align:center; font-weight:bold;">${escapeHtml(val)}</td>`;
      });
      if (!isEmpty) rowsHtml += `<tr>${rowHtml}</tr>`;
    }
  }
  tbody.innerHTML = rowsHtml || emptyHtml;
}

/** מרנדרת הקצאות מודיעין עבור בא"ח איסו"ק */
async function renderHaktzaotEsuk() {
  await renderHaktzaotModieinUnit('esukTable', 'haktzaot-esuk-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור בא"ח חיר"ג */
async function renderHaktzaotHirg() {
  await renderHaktzaotModieinUnit('hirgTable', 'haktzaot-hirg-body', 6);
}

/** מרנדרת הקצאות מודיעין עבור גדוד הפיקוד */
async function renderHaktzaotPikud() {
  await renderHaktzaotModieinUnit('pikudTable', 'haktzaot-pikud-body', 7);
}

/** מרנדרת הקצאות מודיעין עבור ענף תצ"מ */
async function renderHaktzaotTazam() {
  await renderHaktzaotModieinUnit('tazamTable', 'haktzaot-tazam-body', 8);
}

/** מרנדרת הקצאות מודיעין עבור מפח"ט */
async function renderHaktzaotBahalag() {
  await renderHaktzaotModieinUnit('bahalagTable', 'haktzaot-bahalag-body', 1);
}

/* ================================
   חישובים (נוסחאות) לטבלת קשר ולשאר
================================ */

/**
 * מסמנת תא "סה"כ" מחושב (עודף/עודף כללי/זמין) באדום אם ערכו הנוכחי שלילי - כלומר יש יותר
 * דרישה מכמות האמצעים בפועל (בקשת המפקדים). לא נוגעת בתאים ריקים - שלילי רק כשיש ערך
 * מספרי בפועל וקטן מאפס.
 * @param {HTMLInputElement} input
 */
function _applyNegativeHighlight(input) {
  if (!input) return;
  const raw = input.value !== '' ? parseFloat(input.value) : NaN;
  input.classList.toggle('negative-value', !isNaN(raw) && raw < 0);
}

/**
 * מריצה נוסחאות וחישובי סיכום, דרישה, ויסות ועודפים עבור שורה בטבלת קשר.
 * @param {HTMLTableRowElement} row - שורת הטבלה
 */
// תא קלט של עמודה לפי תפקידה (data-role) וגדודה (data-bn) בשורה של טבלה משולבת - במקום אינדקס
// עמודה קבוע: מיקום העמודות משתנה כשמוסיפים/מסירים פלוגות (ראו "פלוגות דינמיות").
function _coRowInput(row, role, bn) {
  const td = row.querySelector(bn ? `td[data-role="${role}"][data-bn="${bn}"]` : `td[data-role="${role}"]`);
  return td ? td.querySelector('.cell-input') : null;
}

function recalcKesherRow(row) {
  // כל גדוד: עמודות הפלוגות שלו (כולל פלוגות שנוספו, ללא אלה שהוסרו) + עמודות דרישה/וויסות/עודף
  const groups = CO_BN_ORDER.map(bn => ({
    bn,
    companyInputs: Array.from(row.querySelectorAll(`td[data-role="co"][data-bn="${bn}"] .cell-input`)),
    demandInput: _coRowInput(row, 'dem', bn),
    regInput: _coRowInput(row, 'reg', bn),
    surplusInput: _coRowInput(row, 'sur', bn)
  }));

  let totalRegulatedAll = 0;
  let hasAnyCompanyInputOverall = false;

  groups.forEach(group => {
    let groupDemand = 0;
    let hasGroupCompanyInput = false;

    group.companyInputs.forEach(input => {
      if (input && input.value.trim() !== '') {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          groupDemand += val;
          hasGroupCompanyInput = true;
          hasAnyCompanyInputOverall = true;
          input.classList.remove('invalid-number-input');
        } else {
          // ערך לא-מספרי מוחרג בשקט מהסיכום - מסמנים ויזואלית (מחלקת CSS בלבד; לא נוגעים
          // ב-title, כי checkRequirementChanges כבר "בעלים" של אותו attribute על אותם תאים
          // ומאפס אותו בכל הקלדה) כדי שהמשתמש ידע שהתא הזה לא נכלל בחישוב.
          input.classList.add('invalid-number-input');
        }
      } else if (input) {
        input.classList.remove('invalid-number-input');
      }
    });

    totalRegulatedAll += groupDemand;

    const { demandInput, regInput, surplusInput } = group;
    if (demandInput) {
      demandInput.value = hasGroupCompanyInput ? groupDemand : '';
    }

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
      _applyNegativeHighlight(surplusInput);
    }
  });

  const totalUnitInput = _coRowInput(row, 'tu');
  const failInput = _coRowInput(row, 'fail');

  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';

  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyCompanyInputOverall;

  const totalRegInput = _coRowInput(row, 'treg');
  if (totalRegInput) {
    totalRegInput.value = hasAnyCompanyInputOverall ? totalRegulatedAll : '';
  }

  const excessInput = _coRowInput(row, 'exc');
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - totalRegulatedAll;
    } else {
      excessInput.value = '';
    }
    _applyNegativeHighlight(excessInput);
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

  // שורה בטבלה משולבת שנבנתה לפי תוכנית עמודות (אופטיקה): העמודות נמצאות לפי תפקידן (data-role),
  // לא לפי אינדקס קבוע - ראו "פלוגות דינמיות". שורה בלי data-role (טבלאות אחרות) - התנהגות ישנה.
  const roleBased = !!row.querySelector('td[data-role]');
  const companyInputs = roleBased
    ? Array.from(row.querySelectorAll('td[data-role="co"] .cell-input'))
    : Array.from({ length: Math.max(0, endCol - startCol + 1) }, (_, k) => row.cells[startCol + k]?.querySelector('.cell-input'));
  const cellInput = (role, col) => roleBased ? _coRowInput(row, role) : (col === undefined ? null : row.cells[col]?.querySelector('.cell-input'));

  for (const input of companyInputs) {
    if (input && input.value.trim() !== '') {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        sum += val;
        hasAnyValue = true;
        input.classList.remove('invalid-number-input');
      } else {
        // ראו הערה מקבילה ב-recalcKesherRow - ערך לא-מספרי מוחרג בשקט מהסכום, ולכן מסומן
        // ויזואלית (מחלקת CSS בלבד, לא title) כדי שהמשתמש ידע שהוא לא נכלל.
        input.classList.add('invalid-number-input');
      }
    } else if (input) {
      input.classList.remove('invalid-number-input');
    }
  }

  const totalUnitInput = cellInput('tu', totalUnitCol);
  const failInput = cellInput('fail', failCol);

  const totalUnitRaw = totalUnitInput ? totalUnitInput.value.trim() : '';
  const failRaw = failInput ? failInput.value.trim() : '';

  const totalUnit = (totalUnitRaw !== '' && !isNaN(parseFloat(totalUnitRaw))) ? parseFloat(totalUnitRaw) : 0;
  const fail = (failRaw !== '' && !isNaN(parseFloat(failRaw))) ? parseFloat(failRaw) : 0;

  const hasBaseData = totalUnitRaw !== '' || failRaw !== '' || hasAnyValue;

  const totalRegInput = cellInput('treg', totalRegulatedCol);
  if (totalRegInput) totalRegInput.value = hasAnyValue ? sum : '';

  const availableInput = cellInput('avail', availableCol);
  if (availableInput) {
    if (totalUnitRaw !== '' || failRaw !== '') {
      availableInput.value = totalUnit - fail;
    } else {
      availableInput.value = '';
    }
    _applyNegativeHighlight(availableInput);
  }

  const excessInput = cellInput('exc', excessCol);
  if (excessInput) {
    if (hasBaseData) {
      excessInput.value = totalUnit - fail - sum;
    } else {
      excessInput.value = '';
    }
    _applyNegativeHighlight(excessInput);
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
    
    if (tableId === 'keshertable' && row.querySelector('td[data-role]')) {
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
            persist(ackKey, ackData);
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
    { sourceTableId: 'esukkeshertable', bn: 'esuk', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'kkeshertable', bn: 'hirg', targetStartCol: 11, sourceCols: 6 },
    { sourceTableId: 'pkeshertable', bn: 'pikud', targetStartCol: 20, sourceCols: 7 },
    { sourceTableId: 'tkeshertable', bn: 'tazam', targetStartCol: 30, sourceCols: 8 },
    { sourceTableId: 'bkeshertable', bn: 'bahalag', targetStartCol: 41, sourceCols: 1 }
  ],
  optictable: [
    { sourceTableId: 'esukoptictable', bn: 'esuk', targetStartCol: 1, sourceCols: 7 },
    { sourceTableId: 'koptictable', bn: 'hirg', targetStartCol: 8, sourceCols: 6 },
    { sourceTableId: 'poptictable', bn: 'pikud', targetStartCol: 14, sourceCols: 7 },
    { sourceTableId: 'toptictable', bn: 'tazam', targetStartCol: 21, sourceCols: 8 },
    { sourceTableId: 'boptictable', bn: 'bahalag', targetStartCol: 29, sourceCols: 1 }
  ]
};

/**
 * מרעננת מהשרת (אם מוגדר) את הנתונים המפורסמים (_published) של כל טבלאות המשנה היחידתיות,
 * וכן את מפתחות "אישור המנהל" (mgrAck) - אלה בדיוק המפתחות ש-checkRequirementChanges קוראת
 * בקריאה מקומית-ישירה וסינכרונית (localStorage.getItem, לא DataService) כדי להישאר מהירה
 * גם כשהיא רצה על כל הקשה בטבלת המנהל. בלי הרענון התקופתי הזה, מכשיר של מנהל שלא ביצע
 * בעצמו ייבוא לאחרונה היה עלול לא לראות שיחידה עדכנה את הנתונים המפורסמים שלה במכשיר אחר,
 * עד שהוא עצמו יבצע פעולת ייבוא (ראו הערה מפורטת ליד checkRequirementChanges/importFromSubTable).
 */
async function refreshSubTablePublishedCache() {
  if (typeof fetchTableData !== 'function') return;
  const keys = [];
  Object.entries(SUB_TABLE_MAPS).forEach(([tableId, configs]) => {
    keys.push(getAckStorageKey(tableId, currentWeek, currentYear));
    configs.forEach(cfg => {
      keys.push(getStorageKey(cfg.sourceTableId, currentWeek, currentYear) + '_published');
    });
  });
  await Promise.all(keys.map(k => fetchTableData(k)));
}

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
    // קוראים מה-published (לא הטיוטה הגולמית) - הסימון הזה מיועד להראות למנהל רק דרישה
    // שהיחידה כבר שמרה ופרסמה בפועל ("שמור ומוכן לייבוא"), לא כל הקלדה שטרם פורסמה (אפיון QA).
    const subKey = getStorageKey(config.sourceTableId, tw.week, tw.year) + '_published';
    const subSavedRaw = localStorage.getItem(subKey);
    const subData = subSavedRaw ? JSON.parse(subSavedRaw) : {};

    const coDesc = _coDesc(tableId);
    const seg = coDesc && coDesc.segs ? coDesc.segs.find(s => s.bn === config.bn) : null;
    for (let r = 0; r < targetRows.length; r++) {
      const row = targetRows[r];
      if (r === 0 || row.classList.contains('topic-row') || row.classList.contains('special-note-row') || row.cells[0]?.querySelector('textarea')) {
        continue;
      }
      // תאי הפלוגות של הגדוד הזה בשורה (מקוריות + חדשות; בלי אלה שהוסרו) לפי תפקיד/גדוד, לא
      // לפי אינדקס עמודה קבוע. מפתח הנתון ביחידה: מקורית = שורה*עמודות+עמודה, חדשה = x<מזהה>_<שורה>.
      row.querySelectorAll(`td[data-role="co"][data-bn="${config.bn}"]`).forEach(targetCell => {
        const input = targetCell.querySelector('.cell-input');
        if (!input) return;
        const subIndex = input.dataset.xc !== undefined
          ? 'x' + input.dataset.xc + '_' + r
          : r * config.sourceCols + (+input.dataset.d - (seg ? seg.d0 : 0));
        const subVal = subData[subIndex] !== undefined ? String(subData[subIndex]).trim() : '';

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
      });
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
  'anafit8': 'ענפית 1',
  'anafit-bah': 'ענפית בא"ח',
  'tavor': 'פיקוד 1'
};
const HADRAG_DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
// 'bg-blocked' - סימון "חסום" של המנהל (בקשה חדר"ג/שק"ם - מונע מיחידות לשבץ בקשה במשבצת
// הזו בכלל, גם אם לא הוזן בה טקסט - ראו reqGridHasConflict/paintUnitRequestGrid).
const ALL_COLOR_CLASSES = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'bg-blocked', 'imported', 'conflict-overlap'];
// 'conflict-overlap' הוא סימון ויזואלי-בלבד המחושב חי (updatePlatoonGridConflictHighlight) מהשוואת draft מול
// published, ואסור לו להישמר/להיגרר כחלק ממצב התא עצמו - אחרת השמירה מיד לאחר ניקוי הסימון הכתום בהפצה
// (globalExportManager, שלב 3) כותבת draft שונה מה-published שכבר הועתק, וכפתור "הפץ שינויים" נשאר אדום.
const PERSISTABLE_CELL_CLASSES = ALL_COLOR_CLASSES.filter(c => c !== 'conflict-overlap');

/* בדיקת חפיפת טווחי שעות (HH:MM) - עבור התראת התנגשות (אפיון 1.1) */
function _timeRangesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && s2 < e1;
}

/* =========================================================
   גריד בקשות חדר"ג/שק"ם בעמוד היחידה (מחליף את טופס הבקשה הישן + תצוגת "לו"ז משובץ").
   היחידה רואה את כל השיבוצים המאושרים כמו שהם (קריאה בלבד, נטען מה-published בכל רינדור),
   ויכולה לגרור על תא ריק ליצירת בלוק "ממתין לאישור" (צבע מעומעם/מקווקו), לגרור בלוק ממתין
   כזה למשבצת אחרת, ולמחוק אותו. אין כפתור שמירה ייעודי - רק בלחיצה על "שמור ומוכן לייבוא"
   הכללי (globalExportUnit, ראו commitHadragStagedBlocks/commitShekemStagedBlocks) נגזרים
   day/startTime/endTime בפועל ממיקום הבלוק הנוכחי ונכתבים כרשומת בקשה (status: 'pending',
   אותה סכימה כמו קודם - תהליך האישור/דחייה של המנהל לא משתנה).
========================================================= */

let hadragStagedBlocks = [];
let shekemStagedBlocks = [];
let reqGridDragMode = null; // null | 'create' | 'move' | 'resize'
let reqGridDragCtx = null;

/**
 * מאפסת את כל תאי הגריד (td.req-cell) חזרה למצב "ריק" נקי - בלי להרוס ולבנות מחדש את
 * שלד הטבלה (36 השורות/288 התאים) עצמו. משמשת את buildReqTableBody במקום innerHTML
 * מלא כשהשלד כבר קיים - ראו ההערה שם.
 */
function resetReqTableBody(tbody) {
  tbody.querySelectorAll('td.req-cell').forEach(cell => {
    cell.className = 'req-cell';
    cell.rowSpan = 1;
    cell.style.display = '';
    delete cell.dataset.stagedIdx;
    while (cell.firstChild) cell.removeChild(cell.firstChild);
  });
}

/**
 * בונה תא-שעה + 7 תאי גריד ריקים (ללא textarea כברירת מחדל) לכל 36 השורות. נקראת
 * מ-paintUnitRequestGrid בכל רענון (כולל מחזור הרענון האוטומטי כל כמה שניות) - בדיוק כמו
 * generateTimeSlots, אם השלד כבר קיים לא הורסים ובונים מחדש 288 תאים מאפס (הרס+בנייה של
 * DOM בסדר גודל כזה כל כמה שניות הוא בדיוק מה שגרם ל"רצידה" הנמשכת בטבלאות הבקשות של
 * חדר"ג/שק"ם - אפיון QA), אלא רק מאפסים את התאים הקיימים דרך resetReqTableBody.
 */
function buildReqTableBody(tbody) {
  if (tbody.rows.length > 0) {
    resetReqTableBody(tbody);
    return;
  }
  let html = '';
  for (let r = 0; r < 36; r++) {
    html += `<tr><td class="time-col">${rowIndexToTime(r)}</td>`;
    for (let c = 0; c < 7; c++) {
      html += `<td class="req-cell" data-row="${r}" data-col="${c}"></td>`;
    }
    html += `</tr>`;
  }
  tbody.innerHTML = html;
}

/** מציירת בלוק מאושר (קריאה בלבד) - טקסט דרך textContent, בטוח מ-XSS. */
function paintApprovedBlock(tbody, day, startRow, span, text, unitClasses) {
  const cell = tbody.querySelector(`td.req-cell[data-row="${startRow}"][data-col="${day}"]`);
  if (!cell) return;
  cell.rowSpan = span;
  cell.classList.add('approved-block', ...unitClasses);
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-weight:800;font-size:11.5px;padding:1px 2px;overflow:hidden;';
  div.textContent = text;
  cell.appendChild(div);
  for (let r = startRow + 1; r < startRow + span; r++) {
    const covered = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${day}"]`);
    if (covered) covered.style.display = 'none';
  }
}

/**
 * מציירת משבצת "חסומה" (המנהל סימן אותה בשחור בטבלה הגדולה) בגריד הבקשות של היחידה -
 * קריאה-בלבד, בלי אינטראקציה (pointer-events:none דרך אותה מחלקת approved-block), כדי
 * שהיחידה לא תוכל בכלל לגרור/ליצור עליה בקשה. מוצגת גם אם המנהל לא הקליד טקסט לתוכה
 * בכלל - הסימון עצמו (הצבע השחור) הוא מה שחוסם, לא תוכן התא (בקשת המפקדים).
 */
function paintBlockedCell(tbody, day, startRow, span, text) {
  const cell = tbody.querySelector(`td.req-cell[data-row="${startRow}"][data-col="${day}"]`);
  if (!cell) return;
  cell.rowSpan = span;
  cell.classList.add('approved-block', 'bg-blocked');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;font-weight:800;font-size:11px;color:#fff;padding:1px 2px;overflow:hidden;';
  div.textContent = (text && text.trim()) ? text : '🔒 חסום';
  cell.appendChild(div);
  for (let r = startRow + 1; r < startRow + span; r++) {
    const covered = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${day}"]`);
    if (covered) covered.style.display = 'none';
  }
}

let reqBlockTextPersistTimer = null;

/** מציירת בלוק "ממתין לאישור" של היחידה - ידית גרירה, אייקון מחיקה, textarea לעריכת הטקסט. */
function paintPendingBlock(tbody, block, idx) {
  const cell = tbody.querySelector(`td.req-cell[data-row="${block.startRow}"][data-col="${block.day}"]`);
  if (!cell) return;
  cell.rowSpan = block.span;
  cell.classList.add('pending-block', block.unitClass || 'bg-esuk');
  cell.dataset.stagedIdx = String(idx);

  const handle = document.createElement('span');
  handle.className = 'req-drag-handle';
  handle.textContent = '⠿';
  handle.title = 'גרור למשבצת אחרת';
  handle.dataset.stagedIdx = String(idx);

  const del = document.createElement('span');
  del.className = 'req-delete-icon';
  del.textContent = '✕';
  del.title = 'מחק בקשה';
  del.dataset.stagedIdx = String(idx);

  const resizeHandle = document.createElement('span');
  resizeHandle.className = 'resize-handle';
  resizeHandle.title = 'שנה משך (גרור למעלה/למטה)';
  resizeHandle.dataset.stagedIdx = String(idx);

  const ta = document.createElement('textarea');
  ta.placeholder = 'פרטי הבקשה...';
  ta.value = block.text || '';
  ta.dataset.stagedIdx = String(idx);
  ta.addEventListener('input', () => {
    block.text = ta.value;
    block.dirty = true;
    if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
    // רישום מדורג (לא מיידי) - כמו הקלדה בתאי הגריד של המנהל (generateTimeSlots) - כדי
    // שכל תו לא ייצור צעד ביטול נפרד, אבל Ctrl+Z עדיין יחזיר טקסט שהוקלד ולא רק פעולות בדידות.
    if (typeof _recordUndoChange === 'function') _recordUndoChange();
    // שמירת הטיוטה (לא ציור מחדש - זה היה מאבד פוקוס/מיקום סמן באמצע הקלדה) בדיליי קצר,
    // כדי שטקסט שהוקלד בבלוק חדש (בלי reqId עדיין) לא ילך לאיבוד במעבר לעמוד/שבוע אחר לפני
    // ששמרו בפועל (ראו _persistUnitStagedDraft/getUnitStagedDraftKey).
    clearTimeout(reqBlockTextPersistTimer);
    const persistType = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    reqBlockTextPersistTimer = setTimeout(() => _persistUnitStagedDraft(persistType), 400);
  });
  // ממקדים את reqSelectedCell גם דרך פוקוס רגיל על תיבת הטקסט (לא רק קליק ימני) - כדי ש-Ctrl+C
  // יעבוד באופן טבעי מיד אחרי לחיצה/הקלדה בבלוק, בלי צורך לעבור דרך תפריט קליק ימני קודם.
  ta.addEventListener('focus', () => { reqSelectedCell = cell; });

  cell.appendChild(handle);
  cell.appendChild(del);
  cell.appendChild(resizeHandle);
  cell.appendChild(ta);

  for (let r = block.startRow + 1; r < block.startRow + block.span; r++) {
    const covered = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${block.day}"]`);
    if (covered) covered.style.display = 'none';
  }
}

/**
 * מציירת מחדש את גריד הבקשות (חדר"ג/שק"ם) - מבוססת על נתונים מפורסמים טריים (נשלפים כאן, לא
 * ממטמון) ועל מערך הבלוקים הממתינים הנוכחי בזיכרון. לא נוגעת באחסון - שימוש רגיל אחרי כל
 * יצירה/הזזה/מחיקה של בלוק ממתין, בלי לאבד בלוקים שעדיין לא נשמרו.
 * @param {'hadrag'|'shekem'} type
 */
async function paintUnitRequestGrid(type) {
  const isHadrag = type === 'hadrag';
  const facilities = isHadrag ? Object.keys(HADRAG_FACILITY_NAMES) : ['shekem'];
  const stagedArr = isHadrag ? hadragStagedBlocks : shekemStagedBlocks;

  const publishedByFacility = {};
  for (const facility of facilities) {
    const dataTableId = isHadrag ? ('body-' + facility) : 'body-shekem';
    const pubKey = `${isHadrag ? 'hadragData' : 'shekemData'}_${dataTableId}_week${currentWeek}_year${currentYear}_published`;
    publishedByFacility[facility] = await fetchTableData(pubKey);
  }

  // מדלגים על ריקון+ציור מחדש של כל תאי הגריד (252 תאים לכל מתקן) אם דבר לא השתנה מאז
  // הרינדור הקודם באותו טעינת-עמוד - בלי זה גריד הבקשות של היחידה "נעלם ומופיע" בכל מחזור
  // רענון אוטומטי (כל כמה שניות) גם כשלא השתנה כלום (אפיון QA: "מרצד") - אותה תבנית בדיוק
  // כמו _renderDataChanged ב-loadHadragTables/loadShekemTables.
  if (!_renderDataChanged('unitReqGrid_' + type, { published: publishedByFacility, staged: stagedArr })) {
    if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
    return;
  }

  _persistUnitStagedDraft(type);

  for (const facility of facilities) {
    const tbody = document.getElementById('req-body-' + facility);
    if (!tbody) continue;
    buildReqTableBody(tbody);

    const published = publishedByFacility[facility];
    if (!published) continue;

    for (let c = 0; c < 7; c++) {
      for (let r = 0; r < 36; r++) {
        const cellData = published[`${r}_${c}`];
        if (!cellData) continue;
        // משבצת "חסומה" (bg-blocked) מוצגת ונחשבת תפוסה גם בלי טקסט בכלל - הסימון של המנהל
        // הוא-הוא החסימה, לא תוכן התא (ראו paintBlockedCell/reqGridHasConflict).
        const isBlocked = (cellData.classes || []).includes('bg-blocked');
        const hasText = cellData.val && String(cellData.val).trim() !== '';
        if (isBlocked) {
          const span = cellData.span || 1;
          paintBlockedCell(tbody, c, r, span, cellData.val);
          r += (span - 1);
        } else if (hasText) {
          const span = cellData.span || 1;
          const unitClasses = (cellData.classes || []).filter(cls => UNIT_BG_MAP[cls]);
          paintApprovedBlock(tbody, c, r, span, cellData.val, unitClasses.length ? unitClasses : ['bg-esuk']);
          r += (span - 1);
        }
      }
    }
  }

  stagedArr.forEach((block, idx) => {
    const facility = isHadrag ? block.facility : 'shekem';
    const tbody = document.getElementById('req-body-' + facility);
    if (tbody) paintPendingBlock(tbody, block, idx);
  });

  // אין כפתור "שמור בקשות" ייעודי לצבוע - מצב "יש שינויים שלא נשמרו" (block.dirty/reqId חסר)
  // נבדק כחלק מ-hasUnitPendingChanges, שכבר קובע את הצבע (אדום/ירוק) של הכפתור הכללי
  // "שמור ומוכן לייבוא".
  if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
}

/**
 * טוענת מהאחסון את הבקשות הממתינות של היחידה הנוכחית לתוך מערך הבלוקים בזיכרון (מחליפה כל
 * מצב זמני שלא נשמר) ומציירת את הגריד מחדש. נקראת בכל מעבר ללשונית/שינוי שבוע/אחרי שמירה
 * או מחיקה שכתבו לאחסון - במצבים האלה אין בעיה "לאבד" מצב זמני כי האחסון כבר עדכני.
 * @param {'hadrag'|'shekem'} type
 */
async function loadUnitRequestGridState(type) {
  const isHadrag = type === 'hadrag';
  const currentPage = window.location.pathname.split('/').pop();
  const unitClass = PAGE_UNIT_MAP[currentPage] || 'bg-esuk';
  const unitName = PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק';
  const reqWeek = currentWeek, reqYear = currentYear;

  const allRequests = isHadrag
    ? await loadHadragRequests(reqWeek, reqYear)
    : await loadShekemRequests(reqWeek, reqYear);

  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה, בלי לדרוס
  // את hadragStagedBlocks/shekemStagedBlocks בנתונים של שבוע לא-רלוונטי (ראו הערה מפורטת
  // ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  const ownAll = allRequests.filter(r => (r.unit || 'bg-esuk') === unitClass);

  // "עדיין שלה לראות בגריד הבקשות שלה" = טרם מופיעה בפועל בגריד המפורסם - לא בודקים לפי
  // r.status בלבד: autoPlaceRequests (ראו שם) עלולה לסמן בקשה 'approved' עוד לפני שהמנהל
  // בפועל לחץ "הפץ שינויים" (היא רק הונחה בטיוטה) - אם היינו מסתמכים על הסטטוס בלבד, הבלוק
  // היה "נעלם" מהתצוגה של היחידה בפער הזמן שבין המיקום האוטומטי לבין ההפצה בפועל (אפיון QA:
  // "כפתור שמור ומוכן לייבוא לא עובד" - זה בדיוק מה שנראה למשתמש). המקור האמיתי הוא: האם
  // התא בגריד ה-*_published מכיל reqId שתואם לבקשה הזו.
  const publishedCache = {};
  const own = [];
  for (const r of ownAll) {
    const dataTableId = isHadrag ? ('body-' + r.facility) : 'body-shekem';
    if (!(dataTableId in publishedCache)) {
      const pubKey = `${isHadrag ? 'hadragData' : 'shekemData'}_${dataTableId}_week${reqWeek}_year${reqYear}_published`;
      publishedCache[dataTableId] = (await fetchTableData(pubKey)) || {};
    }
    const isLive = Object.values(publishedCache[dataTableId]).some(c => c && c.reqId === r.id);
    if (!isLive) own.push(r);
  }
  // שוב בדיקת שבוע/שנה - ה-fetch-ים למעלה יכלו לקחת זמן (אותה תבנית בדיוק כמו ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  const staged = own.map(r => {
    const startRow = timeToRowIndex(r.startTime);
    return {
      reqId: r.id,
      facility: r.facility || null,
      day: r.day,
      startRow,
      span: Math.max(1, timeToRowIndex(r.endTime) - startRow),
      text: r.text,
      unitClass: r.unit || unitClass,
      unitName: r.unitName || unitName,
      dirty: false
    };
  });

  // בלוקים שנוצרו/הוזזו בגריד אך עדיין לא נשמרו בפועל (אין להם reqId, ולכן לא מופיעים כלל
  // ב-allRequests למעלה) - נשמרים בנפרד (ראו getUnitStagedDraftKey/paintUnitRequestGrid) כדי
  // שמעבר לעמוד/שבוע אחר וחזרה לא ימחק אותם, ומוחזרים כאן לגריד.
  const draftBlocks = await loadUnitStagedDraft(type, unitClass, reqWeek, reqYear);
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  if (isHadrag) hadragStagedBlocks = [...staged, ...draftBlocks];
  else shekemStagedBlocks = [...staged, ...draftBlocks];

  await paintUnitRequestGrid(type);
}

/**
 * בודקת חפיפה בין טווח שורות (startRow..endRow) בעמודת יום נתונה לבין: (1) המצב המפורסם
 * בפועל בגריד (נשלף טרי בכל קריאה - כדי שהבדיקה תישאר נכונה גם אם המנהל הזיז שיבוץ מאושר
 * מיד קודם לכן), ו-(2) בלוקים ממתינים אחרים של אותה יחידה (מונע שיבוץ-כפול-של-עצמך). לא
 * נוגעת בשדות רשומת בקשה קיימת - ראו ההערה ליד relinkGridRequestToCell.
 */
async function reqGridHasConflict(type, facility, day, startRow, endRow, stagedArr, excludeIdx) {
  const isHadrag = type === 'hadrag';
  const dataTableId = isHadrag ? ('body-' + facility) : 'body-shekem';
  const pubKey = `${isHadrag ? 'hadragData' : 'shekemData'}_${dataTableId}_week${currentWeek}_year${currentYear}_published`;
  const published = await fetchTableData(pubKey);
  if (published) {
    for (let r = 0; r < 36; r++) {
      const cellData = published[`${r}_${day}`];
      // תא "חסום" (bg-blocked) נחשב תפוס גם בלי טקסט - ראו paintBlockedCell.
      const isBlocked = cellData && (cellData.classes || []).includes('bg-blocked');
      const hasText = cellData && cellData.val && String(cellData.val).trim() !== '';
      if (hasText || isBlocked) {
        const span = cellData.span || 1;
        const cellEnd = r + span - 1;
        if (startRow <= cellEnd && r <= endRow) return true;
      }
    }
  }
  for (let i = 0; i < stagedArr.length; i++) {
    if (i === excludeIdx) continue;
    const b = stagedArr[i];
    if (isHadrag && b.facility !== facility) continue;
    if (b.day !== day) continue;
    const bEnd = b.startRow + b.span - 1;
    if (startRow <= bEnd && b.startRow <= endRow) return true;
  }
  return false;
}

function markReqPreview(tbody, day, startRow, span) {
  for (let r = startRow; r < startRow + span && r < 36; r++) {
    const cell = tbody.querySelector(`td.req-cell[data-row="${r}"][data-col="${day}"]`);
    if (cell) cell.classList.add('req-preview-cell');
  }
}
function clearReqPreview(tbody) {
  tbody.querySelectorAll('.req-preview-cell').forEach(c => c.classList.remove('req-preview-cell'));
}

/** מתחילה מצב שינוי-משך על בלוק ממתין נתון (idx במערך הבלוקים של tbody). */
function startReqResize(tbody, idx) {
  if (!tbody || isNaN(idx)) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[idx];
  if (!block) return;
  reqGridDragMode = 'resize';
  reqGridDragCtx = { type, tbody, resizingIdx: idx, currentEndRow: block.startRow + block.span - 1 };
}

// 1. תחילת גרירה: יצירת בלוק חדש (mousedown על תא ריק), הזזת בלוק ממתין קיים (מהידית ⠿, כולל
//    בין טבלאות מתקנים שונות), או שינוי משך (מנקודת האחיזה resize-handle - ראו גם הגיבוי
//    למטה: בלוק בן שורה אחת בזום 75% הופך את נקודת האחיזה (כ-10px) לקשה מאוד לפגיעה מדויקת,
//    ופספוס קטן נופל על תא הבלוק עצמו שלא עושה כלום - נראה למשתמש כאילו "ההקטנה לא עובדת").
document.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (isReadOnlyMode()) return;

  const resizeHandle = e.target.closest('td.req-cell .resize-handle');
  if (resizeHandle) {
    e.preventDefault();
    startReqResize(resizeHandle.closest('tbody'), parseInt(resizeHandle.dataset.stagedIdx, 10));
    return;
  }

  const handle = e.target.closest('.req-drag-handle');
  if (handle) {
    e.preventDefault();
    const tbody = handle.closest('tbody');
    if (!tbody) return;
    const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    reqGridDragMode = 'move';
    reqGridDragCtx = { type, tbody, movingIdx: parseInt(handle.dataset.stagedIdx, 10) };
    return;
  }

  if (e.target.closest('.req-delete-icon')) return;

  // גיבוי: קליק בתוך אזור הבלוק (לא ב-textarea עצמו) בטווח 8px האחרונים מהקצה התחתון של
  // הבלוק נחשב תפיסה של נקודת שינוי-המשך, גם אם לא פגעו בדיוק בה - זה בדיוק מה שמאפשר
  // להקטין בלוק קצר (שורה אחת) שבו נקודת האחיזה כמעט חופפת לשאר התא.
  const pendingCell = e.target.closest('td.req-cell.pending-block');
  if (pendingCell) {
    if (e.target.closest('textarea')) return;
    const rect = pendingCell.getBoundingClientRect();
    if (e.clientY >= rect.bottom - 8) {
      e.preventDefault();
      startReqResize(pendingCell.closest('tbody'), parseInt(pendingCell.dataset.stagedIdx, 10));
    }
    return;
  }

  const cell = e.target.closest('td.req-cell');
  if (!cell) return;
  if (cell.style.display === 'none' || cell.classList.contains('approved-block')) return;

  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const row = parseInt(cell.dataset.row, 10);
  reqGridDragMode = 'create';
  reqGridDragCtx = { type, tbody, day: parseInt(cell.dataset.col, 10), startRow: row, currentRow: row };
  markReqPreview(tbody, reqGridDragCtx.day, row, 1);
});

// 2א. מהלך גרירת-יצירה (mouseover רגיל מספיק - תאים ריקים לעולם לא display:none).
document.addEventListener('mouseover', function(e) {
  if (reqGridDragMode !== 'create' || !reqGridDragCtx) return;
  const cell = e.target.closest('td.req-cell');
  if (!cell) return;
  const tbody = cell.closest('tbody');
  if (!tbody || tbody !== reqGridDragCtx.tbody) return;

  const hoverRow = parseInt(cell.dataset.row, 10);
  const hoverCol = parseInt(cell.dataset.col, 10);
  if (hoverCol !== reqGridDragCtx.day || hoverRow < reqGridDragCtx.startRow) return;
  clearReqPreview(tbody);
  reqGridDragCtx.currentRow = hoverRow;
  markReqPreview(tbody, reqGridDragCtx.day, reqGridDragCtx.startRow, hoverRow - reqGridDragCtx.startRow + 1);
});

// 2ב. מהלך הזזה/שינוי-משך - מבוסס קואורדינטת Y בפועל (getRowIndexAtY, כמו אצל המנהל) ולא
//    mouseover על תא ספציפי: כשמקטינים בלוק, השורות שצריך לגרור אליהן הן בדיוק השורות שכרגע
//    "מכוסות" (display:none) על ידי הבלוק עצמו (rowSpan) - mouseover לעולם לא נורה על תא
//    מוסתר, כך שהתא הראשון של הבלוק "בולע" את כל אירועי ה-mouseover באזור שלו ומונע כל
//    הקטנה (דיווח משתמש). getRowIndexAtY מודדת מול עמודת השעה (תמיד גלויה בכל שורה) ולא
//    תלויה בזה שהתא הספציפי בעמודת היום גלוי.
document.addEventListener('mousemove', function(e) {
  if (reqGridDragMode !== 'resize' && reqGridDragMode !== 'move') return;
  const ctx = reqGridDragCtx;
  if (!ctx) return;

  if (reqGridDragMode === 'resize') {
    const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
    const block = stagedArr[ctx.resizingIdx];
    if (!block) return;
    const row = getRowIndexAtY(ctx.tbody, e.clientY);
    if (row === -1 || row < block.startRow || row === ctx.currentEndRow) return;
    clearReqPreview(ctx.tbody);
    ctx.currentEndRow = row;
    markReqPreview(ctx.tbody, block.day, block.startRow, row - block.startRow + 1);
  } else if (reqGridDragMode === 'move') {
    const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
    const cellAtPoint = elAtPoint ? elAtPoint.closest('td.req-cell') : null;
    if (!cellAtPoint) return;
    const tbody = cellAtPoint.closest('tbody');
    if (!tbody || !tbody.id.startsWith('req-body-')) return;
    const hoverType = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    if (hoverType !== ctx.type) return;

    const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
    const block = stagedArr[ctx.movingIdx];
    if (!block) return;
    const hoverCol = parseInt(cellAtPoint.dataset.col, 10);
    const row = getRowIndexAtY(tbody, e.clientY);
    if (row === -1) return;
    let previewStart = Math.min(row, 36 - block.span);
    if (previewStart < 0) previewStart = 0;
    if (tbody === ctx.previewTbody && hoverCol === ctx.previewDay && previewStart === ctx.previewStartRow) return;

    const prevPreviewTbody = ctx.previewTbody;
    if (prevPreviewTbody && prevPreviewTbody !== tbody) clearReqPreview(prevPreviewTbody);
    clearReqPreview(tbody);
    ctx.previewTbody = tbody;
    ctx.previewDay = hoverCol;
    ctx.previewStartRow = previewStart;
    markReqPreview(tbody, hoverCol, previewStart, block.span);
  }
});

// 3. סיום גרירה: בדיקת התנגשות מול הגריד המפורסם (טרי) ומול בלוקים ממתינים אחרים, ואז מימוש/ביטול
async function finishReqGridDrag() {
  if (!reqGridDragMode || !reqGridDragCtx) return;
  const mode = reqGridDragMode;
  const ctx = reqGridDragCtx;
  reqGridDragMode = null;
  reqGridDragCtx = null;
  clearReqPreview(ctx.tbody);
  if (ctx.previewTbody) clearReqPreview(ctx.previewTbody);

  const stagedArr = ctx.type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const facility = ctx.tbody.id.replace('req-body-', '');

  if (mode === 'create') {
    const span = ctx.currentRow - ctx.startRow + 1;
    const conflict = await reqGridHasConflict(ctx.type, facility, ctx.day, ctx.startRow, ctx.startRow + span - 1, stagedArr, -1);
    if (conflict) {
      alert('⛔ המשבצת תפוסה! יש לבחור שעה פנויה.');
    } else {
      const currentPage = window.location.pathname.split('/').pop();
      stagedArr.push({
        reqId: null,
        facility: ctx.type === 'hadrag' ? facility : null,
        day: ctx.day,
        startRow: ctx.startRow,
        span,
        text: '',
        unitClass: PAGE_UNIT_MAP[currentPage] || 'bg-esuk',
        unitName: PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק'
      });
      await paintUnitRequestGrid(ctx.type);
      if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
      // פוקוס אוטומטי על ה-textarea של הבלוק החדש - כדי שהיחידה יכולה להתחיל להקליד מיד,
      // ובאותה הזדמנות שדה ממוקד מפעיל את השער הקיים (isEditingField) שמונע מהרענון האוטומטי
      // (ראו DataService.startAutoSync) לדרוס את הבלוק שעדיין לא נשמר.
      const newCell = ctx.tbody.querySelector(`td.req-cell[data-row="${ctx.startRow}"][data-col="${ctx.day}"]`);
      const newTextarea = newCell ? newCell.querySelector('textarea') : null;
      if (newTextarea) newTextarea.focus();
      return;
    }
    await paintUnitRequestGrid(ctx.type);
  } else if (mode === 'resize') {
    const block = stagedArr[ctx.resizingIdx];
    if (block) {
      const newSpan = Math.max(1, ctx.currentEndRow - block.startRow + 1);
      if (newSpan !== block.span) {
        const conflict = await reqGridHasConflict(ctx.type, block.facility, block.day, block.startRow, block.startRow + newSpan - 1, stagedArr, ctx.resizingIdx);
        if (conflict) {
          alert('⛔ המשבצת תפוסה! לא ניתן לשנות לגודל הזה.');
        } else {
          block.span = newSpan;
          block.dirty = true;
          if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
        }
      }
    }
    await paintUnitRequestGrid(ctx.type);
  } else if (mode === 'move') {
    const block = stagedArr[ctx.movingIdx];
    if (block && ctx.previewDay !== undefined && ctx.previewTbody) {
      const newFacility = ctx.type === 'hadrag' ? ctx.previewTbody.id.replace('req-body-', '') : null;
      const conflict = await reqGridHasConflict(ctx.type, newFacility, ctx.previewDay, ctx.previewStartRow, ctx.previewStartRow + block.span - 1, stagedArr, ctx.movingIdx);
      if (conflict) {
        alert('⛔ המשבצת תפוסה! יש לבחור מיקום פנוי.');
      } else {
        block.facility = newFacility;
        block.day = ctx.previewDay;
        block.startRow = ctx.previewStartRow;
        block.dirty = true;
        if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
      }
    }
    await paintUnitRequestGrid(ctx.type);
  }
}
document.addEventListener('mouseup', finishReqGridDrag);
window.addEventListener('blur', () => {
  if (reqGridDragCtx) {
    clearReqPreview(reqGridDragCtx.tbody);
    if (reqGridDragCtx.previewTbody) clearReqPreview(reqGridDragCtx.previewTbody);
  }
  reqGridDragMode = null;
  reqGridDragCtx = null;
});

// 4. מחיקת בלוק ממתין - אם כבר נשמר כרשומה, מוחקת אותה מהאחסון (ומתרנדרת מחדש דרך
//    renderHadragRequestsList/renderShekemRequestsList); אם עדיין לא נשמר, רק מסירה מהזיכרון.
//    פונקציה משותפת לאייקון ה-✕ ולתפריט הקליק-הימני (ראו למטה).
async function deletePendingReqBlock(type, idx) {
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[idx];
  if (!block) return;

  if (block.reqId) {
    if (type === 'hadrag') await deleteHadragRequest(block.reqId);
    else await deleteShekemRequest(block.reqId);
  } else {
    stagedArr.splice(idx, 1);
    await paintUnitRequestGrid(type);
  }
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

document.addEventListener('click', async function(e) {
  const del = e.target.closest('.req-delete-icon');
  if (!del) return;
  if (isReadOnlyMode()) return;
  const tbody = del.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  await deletePendingReqBlock(type, parseInt(del.dataset.stagedIdx, 10));
});

// 5. העתק/הדבק שיבוץ (תפריט קליק-ימני + Ctrl+C/Ctrl+V) - מקביל למנגנון ההעתקה-הדבקה של
//    המנהל (hadragClipboard/pasteOrMoveBlock), אך עצמאי ומצומצם לבלוק {text, span} בלבד -
//    שני הצדדים כותבים לזיכרון בלבד (hadragStagedBlocks/shekemStagedBlocks), לא ל-hadragData.
let reqClipboard = null;

/** מעתיקה בלוק "ממתין" מתא נתון (td.req-cell.pending-block) ל-reqClipboard. */
function reqCopyFromCell(cell) {
  if (!cell || cell.dataset.stagedIdx === undefined) return;
  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const block = stagedArr[parseInt(cell.dataset.stagedIdx, 10)];
  if (!block) return;
  reqClipboard = { text: block.text, span: block.span };
  cell.style.outline = '3px dashed #0284c7';
  cell.style.outlineOffset = '-3px';
  setTimeout(() => { cell.style.outline = ''; }, 600);
}

/** מדביקה את reqClipboard כבלוק "ממתין" חדש בתא ריק נתון (יום/שורה נגזרים מהתא). */
async function reqPasteToCell(cell) {
  if (!reqClipboard || !cell) return;
  if (cell.classList.contains('pending-block') || cell.classList.contains('approved-block')) {
    alert('אפשר להדביק רק על משבצת ריקה.');
    return;
  }
  const tbody = cell.closest('tbody');
  if (!tbody) return;
  const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
  const day = parseInt(cell.dataset.col, 10);
  const startRow = parseInt(cell.dataset.row, 10);
  const facility = tbody.id.replace('req-body-', '');
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const endRow = Math.min(35, startRow + reqClipboard.span - 1);
  const span = endRow - startRow + 1;

  const conflict = await reqGridHasConflict(type, facility, day, startRow, endRow, stagedArr, -1);
  if (conflict) { alert('⛔ המשבצת תפוסה! יש לבחור מיקום פנוי.'); return; }

  const currentPage = window.location.pathname.split('/').pop();
  stagedArr.push({
    reqId: null,
    facility: type === 'hadrag' ? facility : null,
    day, startRow, span,
    text: reqClipboard.text,
    unitClass: PAGE_UNIT_MAP[currentPage] || 'bg-esuk',
    unitName: PAGE_UNIT_NAMES[currentPage] || 'בא"ח איסו"ק'
  });
  await paintUnitRequestGrid(type);
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
}

// 6. תפריט קליק-ימני - מקביל לתפריט הקליק-הימני של המנהל (#custom-context-menu), אך תפריט
//    נפרד עבור הגריד של היחידה (העתק/הדבק/מחק בלבד - אין צביעה-מחדש ליחידה אחרת, זו תמיד
//    היחידה של העמוד) - אין למחזר את התפריט של המנהל כי הוא מוגדר ל-td.platoon-cell בלבד.
//    ה-CSS (מיקום/עיצוב) ממוחזר מ-hadrag.css (.req-context-menu, בהשראת #custom-context-menu).
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('req-context-menu')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="req-context-menu" class="req-context-menu" style="display:none;">
      <button id="req-ctx-btn-copy">העתק שיבוץ</button>
      <button id="req-ctx-btn-paste">הדבק שיבוץ</button>
      <div class="ctx-divider"></div>
      <button id="req-ctx-btn-delete">מחק בקשה</button>
    </div>
  `);
  const menu = document.getElementById('req-context-menu');
  let ctxCell = null;

  document.addEventListener('contextmenu', function(e) {
    const cell = e.target.closest('td.req-cell');
    if (!cell || cell.classList.contains('approved-block') || isReadOnlyMode()) return;
    e.preventDefault();
    ctxCell = cell;
    reqSelectedCell = cell;
    menu.style.left = e.pageX + 'px';
    menu.style.top = e.pageY + 'px';
    menu.style.display = 'flex';
  });

  document.addEventListener('click', () => { menu.style.display = 'none'; });

  document.getElementById('req-ctx-btn-copy').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    reqCopyFromCell(ctxCell);
  });

  document.getElementById('req-ctx-btn-paste').addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    await reqPasteToCell(ctxCell);
  });

  document.getElementById('req-ctx-btn-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    menu.style.display = 'none';
    if (!ctxCell || ctxCell.dataset.stagedIdx === undefined) return;
    const tbody = ctxCell.closest('tbody');
    if (!tbody) return;
    const type = tbody.id.includes('shekem') ? 'shekem' : 'hadrag';
    await deletePendingReqBlock(type, parseInt(ctxCell.dataset.stagedIdx, 10));
  });
});

// 7. קיצורי מקלדת Ctrl+C / Ctrl+V - מקביל למנגנון של המנהל (script.js, "Copy and Paste"):
//    התא הרלוונטי נקבע מ-reqSelectedCell (נקבע בקליק ימני או בפוקוס על textarea של בלוק),
//    אחרת מ-document.activeElement (אם זה textarea/req-cell בתוך הגריד), ואחרת מה-:hover -
//    אותה שרשרת בדיוק שהמנהל כבר משתמש בה, כדי שההתנהגות תהיה "אותו דבר" כמבוקש.
let reqSelectedCell = null;

document.addEventListener('keydown', async function(e) {
  if (!e.ctrlKey || isReadOnlyMode()) return;

  let cell = reqSelectedCell;
  const activeElement = document.activeElement;
  if (!cell && activeElement && activeElement.tagName === 'TEXTAREA') {
    cell = activeElement.closest('td.req-cell');
  }
  if (!cell && activeElement && activeElement.classList && activeElement.classList.contains('req-cell')) {
    cell = activeElement;
  }
  if (!cell) {
    cell = document.querySelector('td.req-cell:hover');
  }
  if (!cell || cell.classList.contains('approved-block')) return;

  if (e.code === 'KeyC' || e.key.toLowerCase() === 'c' || e.key === 'ב') {
    e.preventDefault();
    reqCopyFromCell(cell);
  } else if (e.code === 'KeyV' || e.key.toLowerCase() === 'v' || e.key === 'ה') {
    e.preventDefault();
    await reqPasteToCell(cell);
  }
});

/**
 * ממירה כל בלוק "ממתין" בגריד הבקשות של חדר"ג לרשומת בקשה בפועל (יוצרת חדשה או מעדכנת
 * קיימת), לפי המיקום הנוכחי שלו - day/startTime/endTime/facility/text. אין כפתור "שמור
 * בקשות" ייעודי - זו נקראת כחלק מ-"שמור ומוכן לייבוא" (globalExportUnit), לפני שהוא ממשיך
 * לפרסום הרגיל, כדי שהפרסום יכלול גם בקשות שנוצרו/הוזזו בגריד ועדיין לא נכתבו לרשומה.
 * @returns {Promise<boolean>} false אם יש בלוק עם טקסט ריק (ומתריעה, בלי לשמור כלום);
 *   true אחרת - כולל כשאין בלוקים בכלל, זה לא מצב שגיאה.
 */
async function commitHadragStagedBlocks() {
  if (hadragStagedBlocks.length === 0) return true;
  if (hadragStagedBlocks.some(b => !b.text || !b.text.trim())) {
    alert('יש להזין טקסט לכל בקשת חדר"ג בגריד לפני השמירה.');
    return false;
  }

  const requests = await loadHadragRequests(currentWeek, currentYear);
  hadragStagedBlocks.forEach((block, i) => {
    const startTime = rowIndexToTime(block.startRow);
    const endTime = rowIndexToTime(block.startRow + block.span);
    if (block.reqId) {
      const existing = requests.find(r => r.id === block.reqId);
      if (existing) {
        existing.facility = block.facility;
        existing.day = block.day;
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.text = block.text.trim();
      }
    } else {
      requests.push({
        id: Date.now().toString(36) + i,
        facility: block.facility,
        text: block.text.trim(),
        day: block.day,
        startTime, endTime,
        unit: block.unitClass,
        unitName: block.unitName,
        status: 'pending'
      });
    }
  });

  await saveHadragRequests(requests, currentWeek, currentYear);
  // מרוקנים במפורש את אחסון הטיוטה (ראו getUnitStagedDraftKey/_persistUnitStagedDraft) - כל
  // הבלוקים שהיו בה הפכו הרגע לרשומות בקשה אמיתיות (עם reqId). בלי הריקון המפורש הזה,
  // loadUnitRequestGridState (שרץ מיד אחרי, דרך renderHadragRequestsList) היה טוען את
  // הטיוטה הישנה בנוסף לרשומה שכבר קיימת עכשיו ב-allRequests - ומשכפל את אותו בלוק פעמיים.
  const commitPage = window.location.pathname.split('/').pop();
  const commitUnitClass = PAGE_UNIT_MAP[commitPage];
  if (commitUnitClass) {
    await DataService.setItem(getUnitStagedDraftKey('hadrag', commitUnitClass, currentWeek, currentYear), []);
  }
  if (typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  return true;
}

/** מקבילה ל-commitHadragStagedBlocks עבור שק"ם (ללא שדה facility). */
async function commitShekemStagedBlocks() {
  if (shekemStagedBlocks.length === 0) return true;
  if (shekemStagedBlocks.some(b => !b.text || !b.text.trim())) {
    alert('יש להזין טקסט לכל בקשת שק"ם בגריד לפני השמירה.');
    return false;
  }

  const requests = await loadShekemRequests(currentWeek, currentYear);
  shekemStagedBlocks.forEach((block, i) => {
    const startTime = rowIndexToTime(block.startRow);
    const endTime = rowIndexToTime(block.startRow + block.span);
    if (block.reqId) {
      const existing = requests.find(r => r.id === block.reqId);
      if (existing) {
        existing.day = block.day;
        existing.startTime = startTime;
        existing.endTime = endTime;
        existing.text = block.text.trim();
      }
    } else {
      requests.push({
        id: Date.now().toString(36) + i,
        text: block.text.trim(),
        day: block.day,
        startTime, endTime,
        unit: block.unitClass,
        unitName: block.unitName,
        status: 'pending'
      });
    }
  });

  await saveShekemRequests(requests, currentWeek, currentYear);
  // מרוקנים במפורש את אחסון הטיוטה - ראו הערה מפורטת ב-commitHadragStagedBlocks.
  const commitPage = window.location.pathname.split('/').pop();
  const commitUnitClass = PAGE_UNIT_MAP[commitPage];
  if (commitUnitClass) {
    await DataService.setItem(getUnitStagedDraftKey('shekem', commitUnitClass, currentWeek, currentYear), []);
  }
  if (typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  return true;
}

/**
 * מפתח האחסון של "טיוטת בלוקים ממתינים" של יחידה - בלוקים שנוצרו/הוזזו בגריד הבקשות שלה
 * אך עדיין לא נשמרו בפועל (אין להם reqId, ולכן לא קיימים ברשימת הבקשות עצמה בכלל). בלי
 * המפתח הזה, מעבר לעמוד/שבוע אחר וחזרה היה מוחק לגמרי בלוק כזה - loadUnitRequestGridState
 * בונה את hadragStagedBlocks/shekemStagedBlocks מחדש רק מתוך רשימת הבקשות השמורות, שלבלוק
 * שטרם נשמר אין בה כלל ייצוג (אפיון QA: "השיבוץ נמחק... אני רוצה שהוא ישאר, פשוט עוד לא
 * ישלח עד שלוחצים שמור"). ראו _persistUnitStagedDraft/_loadUnitStagedDraft.
 * @param {'hadrag'|'shekem'} type
 * @param {string} unitClass
 * @param {number} week
 * @param {number} year
 * @returns {string}
 */
function getUnitStagedDraftKey(type, unitClass, week, year) {
  return `${type}StagedDraft_${unitClass}_week${week}_year${year}`;
}

/** טוענת את בלוקי הטיוטה הממתינים (בלי reqId) שנשמרו עבור יחידה/שבוע/שנה נתונים - ריק אם אין. */
async function loadUnitStagedDraft(type, unitClass, week, year) {
  const list = await DataService.getItem(getUnitStagedDraftKey(type, unitClass, week, year));
  return Array.isArray(list) ? list : [];
}

/**
 * שומרת את חלקו של הגריד שעדיין לא נשמר בפועל (בלוקים בלי reqId) לאחסון בר-קיימא - קריאה
 * "חסרת מגע" ב-DOM בכוונה (לא קוראת ל-paintUnitRequestGrid), כדי שאפשר יהיה לקרוא לה גם
 * תוך כדי הקלדה בבלוק (ראו paintPendingBlock) בלי לגרום לבנייה-מחדש של הגריד שהייתה מאבדת
 * פוקוס/מיקום סמן באמצע הקלדה. "מנוקה" אוטומטית אחרי שמירה בפועל - ברגע שלכל הבלוקים יש
 * reqId, ה-uncommitted מתרוקן ונשמר ריק, בלי צעד ניקוי נפרד.
 * @param {'hadrag'|'shekem'} type
 */
function _persistUnitStagedDraft(type) {
  const stagedArr = type === 'hadrag' ? hadragStagedBlocks : shekemStagedBlocks;
  const currentPage = window.location.pathname.split('/').pop();
  const unitClass = PAGE_UNIT_MAP[currentPage];
  if (!unitClass) return;
  const uncommitted = stagedArr.filter(b => !b.reqId);
  DataService.setItem(getUnitStagedDraftKey(type, unitClass, currentWeek, currentYear), uncommitted);
}

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

/* =========================================================
   מיקום אוטומטי של בקשות חדר"ג/שק"ם בטבלה - בלי צעד אישור ידני של המנהל (בקשת המפקדים).
   בקשה שהיחידה שמרה ופרסמה ("שמור ומוכן לייבוא") מונחת ישירות בטיוטת הטבלה הגדולה. אם
   המשבצת המבוקשת כבר תפוסה (או חסומה - bg-blocked) - הבקשה לא נדרסת ולא נדחית, אלא עוברת
   ל"מחסנית התנגשויות" נפרדת (hadragStacked_/shekemStacked_) שמוצגת בגריד כמה שכבות מוזזות
   באלכסון ומעט שקופות מעל אותה משבצת (renderStackedConflicts), וניתנת לגרירה ע"י המנהל
   למשבצת פנויה לבחירתו (ראו מנגנון הגרירה הייעודי בהמשך הקובץ, ליד "Excel-like Drag & Drop").
========================================================= */

/** רשימת ה-tbody-ים הרלוונטיים לסוג נתון - 4 מתקנים לחדר"ג, טבלה אחת לשק"ם. */
function _platoonTableIds(type) {
  return type === 'hadrag' ? ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'] : ['body-shekem'];
}
function _platoonDataKeyPrefix(type) { return type === 'hadrag' ? 'hadragData' : 'shekemData'; }
function _platoonStackedKeyPrefix(type) { return type === 'hadrag' ? 'hadragStacked' : 'shekemStacked'; }

/**
 * בודקת האם משבצת/טווח משבצות (r1..r2 בעמודה col) תפוסות בפועל בנתוני טבלה נתונים - תא עם
 * טקסט, תא חסום (bg-blocked), או תא מכוסה (disp:'none', כלומר בתוך rowSpan של בלוק שהתחיל
 * קודם). משמשת גם את autoPlaceRequests וגם את הטלת-הגרירה (drop) של פתרון התנגשות.
 */
function _platoonRangeOccupied(tableData, day, startRow, endRow) {
  for (let r = startRow; r <= endRow; r++) {
    const c = tableData[`${r}_${day}`];
    if (c && (c.disp === 'none' || (c.val && String(c.val).trim() !== '') || (c.classes || []).includes('bg-blocked'))) {
      return true;
    }
  }
  return false;
}

/**
 * ממקמת אוטומטית כל בקשה שפורסמה וטרם שובצה/הוערמה. רצה **רק** בעמוד שבו קיימת בפועל
 * טבלת המנהל הרלוונטית (hadrag.html/shekem.html) - לא בעמוד יחידה כלשהו. זו לא רק שאלת
 * ביצועים: globalExportUnit (כפתור "שמור ומוכן לייבוא" של היחידה) מפרסם באופן גורף כל
 * מפתח שתואם את קידומת השבוע הנוכחי שקיים ב-localStorage שלו - אילו הפונקציה הזו הייתה
 * נוגעת ב-hadragData/shekemData (טיוטת טבלת המנהל) גם מעמוד יחידה, קריאת/כתיבת הנתונים
 * דרך DataService הייתה משאירה עותק שלהם ב-localStorage המקומי של אותה יחידה, וקליק על
 * "שמור ומוכן לייבוא" שלה היה עלול לפרסם בטעות את כל טיוטת הטבלה הגדולה של המנהל - גם אם
 * הוא כלל לא ביקש להפיץ (אפיון QA: "כפתור שמור ומוכן לייבוא לא עובד על פלוגתי ושק"ם" -
 * הבקשה שלה עצמה "נעלמה" כי autoPlaceRequests הספיקה לסמן אותה 'approved' לפני שהמנהל
 * פרסם בפועל - ראו גם התיקון המקביל ב-loadUnitRequestGridState).
 * @param {'hadrag'|'shekem'} type
 */
async function autoPlaceRequests(type) {
  if (!_platoonTableIds(type).some(id => document.getElementById(id))) return;

  // קולטים את השבוע/שנה הנוכחיים **פעם אחת בלבד**, לפני כל await, ומשתמשים רק במשתנים
  // המקומיים האלה (reqWeek/reqYear) בכל בניית מפתח שמירה בפונקציה הזו - גם בקריאה וגם
  // בכתיבה. הפונקציה הזו רצה בכל מחזור רענון אוטומטי וכוללת כמה await ברצף (בקשות רשת
  // אמיתיות במצב שרת מרכזי) - אם היא הייתה ממשיכה לקרוא את currentWeek/currentYear הגלובליים
  // בכל שלב מחדש, ניווט לשבוע אחר (למשל לחיצת "שבוע הבא") באמצע הריצה היה גורם לה לקרוא
  // נתונים עם השבוע הישן אך לכתוב אותם תחת מפתח השבוע החדש - בפועל מעתיק את תוכן השבוע
  // הישן לתוך אחסון השבוע החדש (אפיון QA: "מילאתי שעות בפלוגתי לשבוע 37 וזה העתיק את השעות
  // משבוע 36"). עכשיו, גם אם המשתמש עבר שבוע באמצע, הפונקציה משלימה את עבודתה בעקביות מלאה
  // על השבוע שאיתו התחילה - לא "קופצת" בין שבועות באמצע.
  const reqWeek = currentWeek, reqYear = currentYear;

  const isHadrag = type === 'hadrag';
  const loadRequests = isHadrag ? loadHadragRequests : loadShekemRequests;
  const saveRequests = isHadrag ? saveHadragRequests : saveShekemRequests;
  const requestsKeyBase = isHadrag ? getHadragRequestsKey(reqWeek, reqYear) : getShekemRequestsKey(reqWeek, reqYear);

  const allRequests = await loadRequests(reqWeek, reqYear);
  const publishedRequests = (await fetchTableData(requestsKeyBase + '_published')) || [];
  const publishedIds = new Set(publishedRequests.map(r => r.id));
  const candidates = allRequests.filter(req => req.status !== 'approved' && publishedIds.has(req.id));
  if (candidates.length === 0) return;

  const dataPrefix = _platoonDataKeyPrefix(type);
  const stackedPrefix = _platoonStackedKeyPrefix(type);
  const tableIds = _platoonTableIds(type);

  const dataByTable = {}, stackedByTable = {};
  const changedData = new Set(), changedStacked = new Set();
  for (const tableId of tableIds) {
    dataByTable[tableId] = (await DataService.getItem(`${dataPrefix}_${tableId}_week${reqWeek}_year${reqYear}`)) || {};
    stackedByTable[tableId] = (await DataService.getItem(`${stackedPrefix}_${tableId}_week${reqWeek}_year${reqYear}`)) || [];
  }

  let requestsChanged = false;

  for (const req of candidates) {
    const tableId = isHadrag ? ('body-' + req.facility) : 'body-shekem';
    if (!dataByTable[tableId]) continue;

    const alreadyPlaced = Object.values(dataByTable[tableId]).some(c => c && c.reqId === req.id);
    const alreadyStacked = stackedByTable[tableId].some(s => s.reqId === req.id);
    if (alreadyPlaced || alreadyStacked) continue;

    const startRow = timeToRowIndex(req.startTime);
    const endRow = Math.max(startRow, timeToRowIndex(req.endTime) - 1);
    const span = endRow - startRow + 1;

    if (_platoonRangeOccupied(dataByTable[tableId], req.day, startRow, endRow)) {
      stackedByTable[tableId].push({
        reqId: req.id, day: req.day, startRow, span,
        text: req.text, unitClass: req.unit || 'bg-esuk', unitName: req.unitName || ''
      });
      changedStacked.add(tableId);
    } else {
      for (let r = startRow; r <= endRow; r++) {
        dataByTable[tableId][`${r}_${req.day}`] = (r === startRow)
          ? { val: req.text, span, disp: '', classes: [req.unit || 'bg-esuk', 'imported'], reqId: req.id }
          : { val: '', span: 1, disp: 'none', classes: [], reqId: null };
      }
      changedData.add(tableId);
      req.status = 'approved';
      requestsChanged = true;
    }
  }

  for (const tableId of changedData) {
    await DataService.setItem(`${dataPrefix}_${tableId}_week${reqWeek}_year${reqYear}`, dataByTable[tableId]);
  }
  for (const tableId of changedStacked) {
    await DataService.setItem(`${stackedPrefix}_${tableId}_week${reqWeek}_year${reqYear}`, stackedByTable[tableId]);
  }
  if (requestsChanged) {
    await saveRequests(allRequests, reqWeek, reqYear);
  }
}

/**
 * מציירת "שכבות" חזותיות (overlay מוחלט מעל התא, מוזז באלכסון ומעט שקוף) עבור כל בקשה
 * שנתקלה בהתנגשות ב-autoPlaceRequests ולכן לא הונחה בפועל - עם אפשרות גרירה למשבצת פנויה
 * (ראו מנגנון הגרירה הייעודי) ומחיקה (✕ קטן בפינת השכבה).
 * @param {'hadrag'|'shekem'} type
 */
async function renderStackedConflicts(type) {
  const stackedPrefix = _platoonStackedKeyPrefix(type);

  for (const tableId of _platoonTableIds(type)) {
    const tbody = document.getElementById(tableId);
    if (!tbody) continue;
    const stacked = (await DataService.getItem(`${stackedPrefix}_${tableId}_week${currentWeek}_year${currentYear}`)) || [];

    // מדלגים על הריקון+בנייה מחדש של שכבות ההתנגשות אם הנתונים זהים למה שכבר מוצג - בלי זה
    // השכבות (מוצמדות ל-document.body, לא לתוך התא) נעלמות ומופיעות מחדש בכל מחזור רענון
    // אוטומטי (כל כמה שניות) גם כשלא השתנה כלום, מה שנראה כ"הבהוב" בעמוד (אפיון QA: "פלוגתי
    // מרצד") - אותה תבנית בדיוק כמו _renderDataChanged ב-loadHadragTables/loadShekemTables.
    if (!_renderDataChanged('stackedConflicts_' + type + '_' + tableId, stacked)) continue;

    document.querySelectorAll(`.stacked-conflict-overlay[data-type="${type}"][data-table-id="${tableId}"]`).forEach(el => el.remove());

    const headerRow = tbody.closest('table')?.querySelector('thead tr');

    stacked.forEach((item, idx) => {
      // מיקום המשבצת (item.startRow) עלול ליפול בתוך תא "מכוסה" (disp:'none') של בלוק ממוזג
      // קיים - למשל התנגשות שמתחילה מאוחר יותר מהשיבוץ התפוס אך עדיין בתוך טווח השעות שלו.
      // תא מכוסה כזה מוחזר כן מ-querySelector, אבל getBoundingClientRect שלו הוא אפס לגמרי
      // (רוחב/גובה/מיקום 0), מה שהזיז את השכבה (וה-✕ שלה) לפינה השמאלית-עליונה של המסך במקום
      // למקום הנכון (אפיון QA: "רואים רק איקס בצד שמאל של המסך"). לכן שואבים את הגיאומטריה לא
      // מהתא הספציפי (שעלול להיות מכוסה) אלא משני מקורות שתמיד גלויים: תא עמודת השעה של אותה
      // שורה (time-col, לעולם לא ממוזג/מוסתר - נותן top/height אמינים לשורה בודדת) ותא הכותרת
      // (thead) של אותו יום (לעולם לא מושפע ממיזוגים בגוף הטבלה - נותן left/width אמינים).
      const tr = tbody.rows[item.startRow];
      const timeCell = tr ? tr.firstElementChild : null;
      const headerCell = headerRow ? headerRow.children[item.day + 1] : null;
      if (!timeCell || !headerCell) return;
      const rowRect = timeCell.getBoundingClientRect();
      const colRect = headerCell.getBoundingClientRect();
      if (rowRect.height === 0 || colRect.width === 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'stacked-conflict-overlay ' + (item.unitClass || 'bg-esuk');
      overlay.draggable = true;
      overlay.dataset.tableId = tableId;
      overlay.dataset.type = type;
      overlay.dataset.reqId = item.reqId;
      overlay.dataset.span = String(item.span);
      overlay.dataset.unitClass = item.unitClass || 'bg-esuk';
      overlay.dataset.unitName = item.unitName || '';
      overlay.dataset.text = item.text || '';
      overlay.title = (item.unitName ? item.unitName + ' - ' : '') + 'התנגשות זמנים - גרור למשבצת פנויה כדי לפתור';
      overlay.innerHTML = `<span class="stacked-conflict-text">${escapeHtml(item.text)}</span><span class="stacked-conflict-del" title="מחק בקשה">✕</span>`;
      // top מיושר בדיוק לפי rowRect, בלי שום היסט - כדי שהשעות של הבקשה יהיו קריאות במדויק
      // מול עמודת השעה (בקשת המשתמש: "לשים את השיבוץ ממש על השעות"). ההיסט (idx + 1, לא idx
      // - כדי שגם השכבה הראשונה תוזז מהתוכן התפוס שמתחתיה) הוא אך ורק אופקי (בצד), כדי
      // שהתנגשויות מרובות עדיין יהיו ניתנות להבחנה זו מזו בלי לפגוע ביישור האנכי המדויק.
      overlay.style.top = (rowRect.top + window.scrollY) + 'px';
      overlay.style.left = (colRect.left + window.scrollX + (idx + 1) * 8) + 'px';
      overlay.style.width = colRect.width + 'px';
      overlay.style.height = (rowRect.height * item.span) + 'px';
      overlay.style.zIndex = String(200 + idx);
      document.body.appendChild(overlay);
    });
  }
}

/**
 * מוחקת בקשת חדר"ג ומעדכנת את הרשימות בתצוגה - כולל הסרה ממחסנית ההתנגשויות אם הבקשה
 * הייתה שם (אחרת "שכבה" יתומה הייתה נשארת מוצגת לצמיתות).
 * @param {string} id - מזהה הבקשה
 */
async function deleteHadragRequest(id) {
  const requests = (await loadHadragRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveHadragRequests(requests, currentWeek, currentYear);
  for (const tableId of _platoonTableIds('hadrag')) {
    const key = `hadragStacked_${tableId}_week${currentWeek}_year${currentYear}`;
    const stacked = await DataService.getItem(key);
    if (stacked && stacked.some(s => s.reqId === id)) {
      await DataService.setItem(key, stacked.filter(s => s.reqId !== id));
    }
  }
  if(typeof renderHadragRequestsList === 'function') await renderHadragRequestsList();
  if(typeof renderStackedConflicts === 'function') await renderStackedConflicts('hadrag');
}

/**
 * מרנדרת את רשימת בקשות החדר"ג שהוגשו עבור עמוד היחידה הנוכחי.
 */
async function renderHadragRequestsList() {
  const container = document.getElementById('hadragRequestsList');
  if (!container) return;
  const reqWeek = currentWeek, reqYear = currentYear;

  await loadUnitRequestGridState('hadrag');

  const requests = await loadHadragRequests(reqWeek, reqYear);
  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשות האלה היו באוויר - זורקים את התוצאה (ראו הערה
  // מפורטת ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  // מדלגים על בניית הרשימה מחדש אם היא זהה למה שכבר מוצג - ראו _renderDataChanged
  // (אותה תבנית בדיוק כמו renderHipokEntriesList) - בלי זה הרשימה "נעלמת ומופיעה" בכל מחזור
  // רענון אוטומטי גם כשלא השתנה כלום (אפיון QA: "מרצד").
  if (!_renderDataChanged('hadragRequestsList_' + currentPage, filteredRequests)) return;

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map((req) => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 90px; color: ${styleObj.text}; text-align: right;">${HADRAG_FACILITY_NAMES[req.facility] || 'חדר"ג'}</span>
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(req.text)}</span>
        <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 14px;">${req.startTime} - ${req.endTime}</span>
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

/**
 * הופכת אינדקס שורה (0-35) בטבלאות חדר"ג/שק"ם למחרוזת שעה (HH:MM).
 * פונקציה הפוכה ל-timeToRowIndex.
 * @param {number} rowIndex
 * @returns {string}
 */
function rowIndexToTime(rowIndex) {
  const hour = Math.floor(6 + rowIndex / 2);
  const minutes = rowIndex % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minutes}`;
}

/**
 * מוחקת בקשת חדר"ג/שק"ם שהשיבוץ שלה בגריד נמחק או נדרס (לא מוחקת מהגריד עצמו).
 * מזהה אם התא שייך לטבלת חדר"ג או שק"ם ומנתבת למחיקה המתאימה.
 * @param {string} reqId
 * @param {HTMLElement} tbody
 */
async function removeGridRequestLink(reqId, tbody) {
  if (!reqId || !tbody) return;
  if (tbody.id === 'body-shekem') {
    if (typeof deleteShekemRequest === 'function') await deleteShekemRequest(reqId);
  } else {
    if (typeof deleteHadragRequest === 'function') await deleteHadragRequest(reqId);
  }
}

/**
 * מתייגת מחדש את התא (לאחר הזזה/שינוי גודל בגריד) ב-reqId, כדי שמחיקה עתידית
 * של השיבוץ עדיין תדע לנקות את הבקשה המקושרת.
 * חשוב: אינה נוגעת בשדות הבקשה המקורית (day/startTime/endTime/facility) בכוונה -
 * הבקשה היא תיעוד של מה שהיחידה ביקשה, והזיהוי/תצוגה של המיקום בפועל תמיד
 * נעשית לפי סריקת הגריד (צבע), ראו paintUnitRequestGrid. שינוי שדות הבקשה
 * כאן גרם לבאג: כתיבה ל-localStorage תוך כדי הזזה יכולה להתנגש עם מחזור ה"הפצה"
 * שרץ מיד אחרי (globalExportManager), ולגרום להקצאות לא להופיע בכלל.
 * @param {string} reqId
 * @param {HTMLElement} cell - התא החדש שאליו הועבר/הורחב השיבוץ
 */
function relinkGridRequestToCell(reqId, cell) {
  if (!reqId || !cell) return;
  cell.dataset.reqId = reqId;
}

const UNIT_BG_MAP = {
  'bg-esuk':   { bg: '#fff9c4', border: '#ffe082', text: '#856404' },
  'bg-hirg':   { bg: '#c8e6c9', border: '#81c784', text: '#1b5e20' },
  'bg-pikud':  { bg: '#bbdefb', border: '#64b5f6', text: '#0d47a1' },
  'bg-tazam':  { bg: '#e1bee7', border: '#ba68c8', text: '#4a148c' },
  'bg-maphat': { bg: '#ffe0b2', border: '#ffb74d', text: '#e65100' }
};

// renderHadragPendingRequests/approveHadragRequest/rejectHadragRequest הוסרו - הוחלפו
// ב-autoPlaceRequests/renderStackedConflicts (למעלה, ליד deleteHadragRequest): בקשות
// ממוקמות אוטומטית בטבלה, ואם יש התנגשות מוצגות כשכבות ניתנות לגרירה במקום ברשימת אישור.

/**
 * שומרת את מצב תאי הטבלאות ומיזוגי השורות בכל מתקני החדר"ג לשבוע הנוכחי.
 */
/**
 * משווה תאי גריד חדר"ג/שק"ם (drag-to-merge) מול הגרסה שהופצה לאחרונה,
 * ומסמנת בכתום (.conflict-overlap) תאים ששונו מאז - עד להפצת המנהל (אפיון 1.2).
 * @param {string[]} tableIds - מזהי ה-tbody של הטבלאות
 * @param {string} keyPrefix - קידומת מפתח השמירה (hadragData / shekemData)
 */
async function updatePlatoonGridConflictHighlight(tableIds, keyPrefix) {
  for (const tableId of tableIds) {
    const tbody = document.getElementById(tableId);
    if (!tbody) continue;
    const pubKey = `${keyPrefix}_${tableId}_week${currentWeek}_year${currentYear}_published`;
    let published;
    if (typeof DataService !== 'undefined') {
      published = await DataService.getItem(pubKey);
    } else {
      published = JSON.parse(localStorage.getItem(pubKey) || 'null');
    }
    const pub = published || {};
    for (let r = 0; r < 36; r++) {
      for (let c = 0; c < 7; c++) {
        const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;
        const textarea = cell.querySelector('textarea');
        const curVal = textarea ? textarea.value : '';
        const pubEntry = pub[`${r}_${c}`];
        const pubVal = pubEntry ? (pubEntry.val || '') : '';
        cell.classList.toggle('conflict-overlap', curVal !== pubVal);
      }
    }
  }
}

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
        const textVal = textarea ? textarea.value : '';
        if (cell.dataset.reqId && textVal.trim() === '') {
          // הטקסט נוקה ידנית (הקלדה) בלי לעבור דרך תפריט המחיקה - יש לנתק את הבקשה המקושרת
          if (typeof removeGridRequestLink === 'function') removeGridRequestLink(cell.dataset.reqId, tbody);
          delete cell.dataset.reqId;
        }
        tableData[`${r}_${c}`] = {
          val: textVal,
          span: cell.rowSpan,
          disp: cell.style.display,
          classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
          reqId: cell.dataset.reqId || null
        };
      }
    }
    persist(`hadragData_${tableId}_week${currentWeek}_year${currentYear}`, tableData);
  });
  updatePlatoonGridConflictHighlight(TABLE_IDS, 'hadragData');
  if (typeof _recordUndoChange === 'function') _recordUndoChange();
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

    // generateTimeSlots לא בונה מחדש אם השורות כבר קיימות (יש לה שמירה פנימית) - לכן *לא*
    // מרוקנים את ה-tbody קודם כמו שהיה (tbody.innerHTML = '') - זה בדיוק מה שביטל את השמירה
    // הזו וגרם לכל הגריד האינטראקטיבי (תאים ממוזגים, צבעים, ידיות) להיבנות מחדש מאפס בכל
    // מחזור רענון אוטומטי (כל כמה שניות, אפיון QA: "הנתונים נעלמים לרגע כל כמה שניות").
    generateTimeSlots(tableId);

    const hKey = `hadragData_${tableId}_week${week}_year${year}`;
    const tableData = (typeof DataService !== 'undefined')
      ? await DataService.getItem(hKey)
      : JSON.parse(localStorage.getItem(hKey) || 'null');

    // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
    // מקבילה ומפורטת ב-loadTableData). ממשיכים ללולאה הבאה, לא ל-tableId הבא בלבד - כי אם
    // שבוע אחד כבר לא רלוונטי, כל שאר הטבלאות בלולאה הזו גם לא יהיו רלוונטיות.
    if (week !== currentWeek || year !== currentYear) return;

    // מדלגים על איפוס+אכלוס מחדש של הטבלה הזו אם הנתונים זהים למה שכבר מוצג - ראו
    // _renderDataChanged. בלי זה, כל 252 התאים נהרסים ונבנים מחדש (איפוס rowSpan/display/
    // class/textarea ואז מילוי חוזר) בכל מחזור רענון אוטומטי גם כשלא השתנה כלום, מה שגרם
    // ל"רצידה" הנמשכת בטבלאות הגדולות (אפיון QA).
    if (!_renderDataChanged('hadragTable_' + tableId, tableData)) continue;

    // מאפסים ומאכלסים מחדש **באותו מעבר סינכרוני** (בלי await בין השלבים) - כדי שלא יהיה
    // חלון זמן שבו כל התאים נראים ריקים בזמן ה-await לשרת (אותה תבנית באג בדיוק כמו
    // ב-loadTableData/loadHipokData - ראו שם).
    resetHadragOrShekemTable(tbody);
    if (!tableData) continue;

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
          if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
        }
      }
    }
  }
  await updatePlatoonGridConflictHighlight(TABLE_IDS, 'hadragData');
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
 * מוחקת בקשת שק"ם ומעדכנת את התצוגות - כולל הסרה ממחסנית ההתנגשויות אם הבקשה הייתה שם
 * (ראו ההערה המקבילה ב-deleteHadragRequest).
 * @param {string} id - מזהה הבקשה
 */
async function deleteShekemRequest(id) {
  const requests = (await loadShekemRequests(currentWeek, currentYear)).filter(req => req.id !== id);
  await saveShekemRequests(requests, currentWeek, currentYear);
  for (const tableId of _platoonTableIds('shekem')) {
    const key = `shekemStacked_${tableId}_week${currentWeek}_year${currentYear}`;
    const stacked = await DataService.getItem(key);
    if (stacked && stacked.some(s => s.reqId === id)) {
      await DataService.setItem(key, stacked.filter(s => s.reqId !== id));
    }
  }
  if(typeof renderShekemRequestsList === 'function') await renderShekemRequestsList();
  if(typeof renderStackedConflicts === 'function') await renderStackedConflicts('shekem');
}

/**
 * מרנדרת את רשימת בקשות השק"ם בעמוד היחידה.
 */
async function renderShekemRequestsList() {
  const container = document.getElementById('shekemRequestsList');
  if (!container) return;
  const reqWeek = currentWeek, reqYear = currentYear;

  await loadUnitRequestGridState('shekem');

  const requests = await loadShekemRequests(reqWeek, reqYear);
  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשות האלה היו באוויר - זורקים את התוצאה (ראו הערה
  // מפורטת ב-loadTableData).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;

  const currentPage = window.location.pathname.split('/').pop();
  const targetColor = PAGE_UNIT_MAP[currentPage];

  let filteredRequests = requests;
  if (targetColor) {
    filteredRequests = requests.filter(req => (req.unit || 'bg-esuk') === targetColor);
  }

  // מדלגים על בניית הרשימה מחדש אם היא זהה למה שכבר מוצג - ראו _renderDataChanged
  // (אותה תבנית בדיוק כמו renderHipokEntriesList/renderHadragRequestsList).
  if (!_renderDataChanged('shekemRequestsList_' + currentPage, filteredRequests)) return;

  if (filteredRequests.length === 0) {
    container.innerHTML = '<p style="color:#666;">אין בקשות לשבוע זה.</p>';
    return;
  }

  container.innerHTML = filteredRequests.map((req) => {
    const styleObj = UNIT_BG_MAP[req.unit] || { bg: '#fff9c4', border: '#ffe082', text: '#856404' };

    return `
      <div class="hipok-entry-row" style="max-width: 700px; margin: 0 auto 10px auto; background-color: ${styleObj.bg}; border: 2px solid ${styleObj.border}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <span style="font-weight: bold; width: 80px; color: #333;">יום ${HADRAG_DAY_LABELS[req.day]}</span>
        <span style="flex:1; text-align:right; padding-right: 15px; color: #000;">${escapeHtml(req.text)}</span>
        <span style="direction: ltr; font-weight: bold; color: #333; margin-left: 14px;">${req.startTime} - ${req.endTime}</span>
        <button class="hipok-delete-btn" onclick="deleteShekemRequest('${req.id}')">✕</button>
      </div>
    `;
  }).join('');
}

// renderShekemPendingRequests/approveShekemRequest/rejectShekemRequest הוסרו - הוחלפו
// ב-autoPlaceRequests/renderStackedConflicts (ראו ההערה המקבילה ליד deleteHadragRequest).

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
      const textVal = textarea ? textarea.value : '';
      if (cell.dataset.reqId && textVal.trim() === '') {
        // הטקסט נוקה ידנית (הקלדה) בלי לעבור דרך תפריט המחיקה - יש לנתק את הבקשה המקושרת
        if (typeof removeGridRequestLink === 'function') removeGridRequestLink(cell.dataset.reqId, tbody);
        delete cell.dataset.reqId;
      }
      tableData[`${r}_${c}`] = {
        val: textVal,
        span: cell.rowSpan,
        disp: cell.style.display,
        classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
        reqId: cell.dataset.reqId || null
      };
    }
  }
  persist(`shekemData_body-shekem_week${currentWeek}_year${currentYear}`, tableData);
  updatePlatoonGridConflictHighlight(['body-shekem'], 'shekemData');
  if (typeof _recordUndoChange === 'function') _recordUndoChange();
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

  // ראו הערה מקבילה ב-loadHadragTables: generateTimeSlots כבר לא בונה מחדש אם השורות קיימות,
  // ולכן לא מרוקנים את ה-tbody קודם (זה בדיוק מה שביטל את השמירה הזו וגרם לגריד להיבנות
  // מחדש מאפס בכל מחזור רענון - אפיון QA: "טבלת השק"ם נראית מוזר"/"נעלם לרגע כל כמה שניות").
  generateTimeSlots('body-shekem');

  const sKey = `shekemData_body-shekem_week${week}_year${year}`;
  const tableData = (typeof DataService !== 'undefined')
    ? await DataService.getItem(sKey)
    : JSON.parse(localStorage.getItem(sKey) || 'null');

  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
  // מקבילה ומפורטת ב-loadTableData).
  if (week !== currentWeek || year !== currentYear) return;

  // מדלגים על איפוס+אכלוס מחדש אם הנתונים זהים למה שכבר מוצג - ראו _renderDataChanged
  // (אותה הערה כמו ב-loadHadragTables - זו הסיבה ש"טבלת השק"ם" עדיין המשיכה "לרצד" כל כמה
  // שניות גם אחרי תיקון חלון-הריקון-הזמני).
  if (_renderDataChanged('shekemTable_body-shekem', tableData)) {
    // מאפסים ומאכלסים מחדש באותו מעבר סינכרוני - בלי await בין השלבים (ראו הערה ב-loadHadragTables).
    resetHadragOrShekemTable(tbody);
    if (tableData) {
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
            if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
          }
        }
      }
    }
  }
  await updatePlatoonGridConflictHighlight(['body-shekem'], 'shekemData');
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
    if (cell.style.display === 'none' || cell.rowSpan > 1 || cell.classList.contains('merged') || PERSISTABLE_CELL_CLASSES.some(cls => cell.classList.contains(cls))) {
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
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
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
    if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
  }
}

// 1. תחילת גרירה (לחיצה שמאלית)
document.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  if (isReadOnlyMode()) return;

  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;
  
  const ta = cell.querySelector('textarea');
  const hasContent = ta && ta.value.trim() !== '';
  const hasColor = PERSISTABLE_CELL_CLASSES.some(cls => cell.classList.contains(cls));

  if (!hasContent && !hasColor && cell.style.display !== 'none') {
    isDragging = true;
    dragStartCell = cell;
    dragStartRow = parseInt(cell.dataset.row);
    dragCol = parseInt(cell.dataset.col);
  }
});

// 2. מהלך הגרירה (הרחבת/צמצום הבלוק לפי מיקום העכבר בפועל - getRowIndexAtY, ולא mouseover
//    על תא ספציפי): mouseover לא נורה על כל שורה שהעכבר חולף מעליה בתזוזה מהירה אמיתית - הוא
//    יורה רק על התא שהעכבר נמצא מעליו *באירוע האחרון שנקלט*, מדלג על כל מה שבין לבין. הקוד
//    הישן הסתיר (display:none) רק את התא שקיבל את אירוע ה-mouseover האחרון וקבע rowSpan גדול
//    על תא ההתחלה שמכסה גם שורות שמעולם לא עברו עיבוד משלהן - נשארות `<td>` נפרדות, גלויות,
//    בתוך טווח שכבר "מכוסה" ע"י rowSpan של תא קודם, מבנה טבלה לא-חוקי שגורם לדפדפן לרנדר
//    תא רפאים/עמודה נוספת (דיווח משתמש + סרטון מסך - נראה כ"עמודה/שורה מיותרת נוספה").
//    getRowIndexAtY מודדת מול עמודת השעה (תמיד גלויה), ומעדכנת את כל טווח השורות בכל אירוע -
//    בלי תלות בכמה שורות העכבר "דילג" ביניהן.
function updateHadragDragExtent(clientY) {
  const tbody = dragStartCell.closest('tbody');
  let targetRow = getRowIndexAtY(tbody, clientY);
  if (targetRow === -1) return;
  if (targetRow < dragStartRow) targetRow = dragStartRow;

  const prevSpan = dragStartCell.rowSpan || 1;
  const prevEndRow = dragStartRow + prevSpan - 1;

  // קביעת הטווח התקף בפועל: עוצרים בשורה הראשונה שכבר תפוסה (שיבוץ אחר עם rowSpan>1, טקסט
  // או צבע) שעדיין לא הייתה חלק מהבלוק הזה בגרירה הנוכחית (r <= prevEndRow = כבר "שלנו").
  let maxValidRow = dragStartRow;
  for (let r = dragStartRow + 1; r <= targetRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (!c) break;
    if (r > prevEndRow) {
      const ta = c.querySelector('textarea');
      const hasContent = ta && ta.value.trim() !== '';
      const hasColor = PERSISTABLE_CELL_CLASSES.some(cls => c.classList.contains(cls));
      if (c.rowSpan > 1 || hasContent || hasColor) break;
    }
    maxValidRow = r;
  }

  // משחררים תאים שהיו חלק מהבלוק קודם בגרירה הזו אבל כבר לא בטווח החדש (למשל גררו למטה ואז חזרה למעלה)
  for (let r = prevEndRow; r > maxValidRow; r--) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (c) { c.style.display = ''; c.rowSpan = 1; }
  }

  // מסתירים את כל התאים בטווח הסופי (אידמפוטנטי - לא משנה כמה שורות דולגו באירוע האחרון)
  for (let r = dragStartRow + 1; r <= maxValidRow; r++) {
    const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${dragCol}"]`);
    if (c) c.style.display = 'none';
  }

  const newSpan = maxValidRow - dragStartRow + 1;
  dragStartCell.rowSpan = newSpan;
  dragStartCell.classList.toggle('merged', newSpan > 1);

  const startTa = dragStartCell.querySelector('textarea');
  if (startTa) startTa.style.height = '100%';
}

document.addEventListener('mousemove', function(e) {
  if (!isDragging || !dragStartCell) return;
  updateHadragDragExtent(e.clientY);
});

// 3. סיום גרירה (עזיבת העכבר/פוקוס)
document.addEventListener('mouseup', stopDragging);
window.addEventListener('blur', stopDragging);

// *הערה: פונקציית הקליק הימני לביטול (contextmenu) כבר מובנית בקבצי ה-HTML של החדר"ג והשק"ם.
/* ================================
   אתחול (בעת עליית העמוד)
================================ */
window.onload = function () {
  // שומר כניסה: ללא סשן פעיל - הפניה למסך ההתחברות (אפיון חלק 3)
  if (typeof AUTH !== 'undefined' && !AUTH.requireAuth()) return;

  // חסימת גישה ישירה (הקלדת URL/מועדפים) לעמוד יחידה שאינה שייכת למשתמש הפלוגתי המחובר -
  // בעבר requireAuth בדק רק שקיים סשן כלשהו, בלי לבדוק שהעמוד הנוכחי מותר לתפקיד/יחידה שלו
  // (הסתרת הקישור בתפריט הצדדי/בעמוד הראשי לא מנעה גישה ישירה ל-URL). פרצת הרשאות (אפיון QA).
  if (typeof AUTH !== 'undefined' && !AUTH.canViewUnitPage()) {
    window.location.replace('index.html');
    return;
  }

  // משתמשים בשבוע שהמשתמש צפה בו לאחרונה (אם קיים באותה כרטיסייה/סשן) במקום לאפס תמיד
  // לשבוע הקלנדרי האמיתי - כדי שמעבר בין טבלאות ישמור על אותו שבוע (אפיון QA).
  const viewed = loadViewedWeek();
  const { week, year } = viewed || getCurrentWeekAndYear();
  currentWeek = week;
  currentYear = year;

  renderNavbars();
  // renderNavbars() בונה את סרגל הקטגוריות (קשר/אופטיקה/...) מחדש לפי שם הקובץ בלבד,
  // ולכן בעמודי יחידה (esuk/hirg/pikud/tazam/bahalag) היא תמיד מאבדת את סימון ה"active"
  // שנקבע קודם לכן (ב-DOMContentLoaded של העמוד) - כי היא לא מכירה את currentCategory
  // הפנימי של העמוד. לכן צריך להחיל שוב את הסימון אחרי שהניווט המשותף עלה מחדש.
  if (typeof updateCategoryView === 'function') updateCategoryView();
  applyPermissions();
  initTableListeners();
  initTopicExpansion();
  initDynamicRows();
  initWeekInput();

  Promise.resolve(updateUIForWeek()).then(() => {
    if (typeof resetUndoHistory === 'function') resetUndoHistory();
    applyPermissions();
  });

  if (typeof DataService !== 'undefined') {
    DataService.startAutoSync(async () => {
      // מרכז ההתראות (🔔) לא נוגע בשדות עריכה בכלל, אז מרעננים אותו תמיד בכל מחזור - גם
      // כשהמשתמש באמצע הקלדה בטבלה אחרת (בניגוד ל-updateUIForWeek למטה, שנדחית במקרה הזה).
      if (typeof refreshNotifications === 'function') await refreshNotifications();

      // מרעננים גם את מטמון הנתונים המפורסמים של טבלאות המשנה (ראו הערה ליד הפונקציה) - זה
      // רק מעדכן ערכים במפתח localStorage, לא בונה מחדש DOM, אז בטוח לבצע גם תוך כדי הקלדה.
      if (typeof refreshSubTablePublishedCache === 'function') {
        await refreshSubTablePublishedCache();
        if (document.getElementById('keshertable')) checkRequirementChanges('keshertable');
        if (document.getElementById('optictable')) checkRequirementChanges('optictable');
      }
      if (typeof refreshRowListsCache === 'function') await refreshRowListsCache();

      // updateUIForWeek בונה מחדש את ה-HTML של הטבלאות מאפס (innerHTML), כולל התא הממוקד -
      // כשזה קורה תוך כדי שהמשתמש מקליד (הריענון האוטומטי רץ כל כמה שניות, ראו
      // CONFIG.SYNC_INTERVAL_MS), הפוקוס וההקלדה שלו "נתקעים"/נקטעים באמצע משפט, במיוחד
      // בתאים שלוקח יותר זמן להקליד לתוכם (כמו "נושא שבוע"). לכן מדלגים על מחזור הריענון
      // הזה כל עוד יש פוקוס בתוך שדה עריכה כלשהו - הריענון הבא (בעוד כמה שניות) ישלים את
      // הסנכרון ברגע שהמשתמש יעזוב את השדה (אפיון QA).
      const active = document.activeElement;
      const isEditingField = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
      if (isEditingField) return;

      // אותה בעיה בדיוק קיימת כשתפריט הקליק-הימני של חדר"ג/שק"ם פתוח (או שגרירה/שינוי-גודל
      // באמצע ביצוע): קליק ימני לא ממקד input, אז הבדיקה למעלה לא תופסת את המקרה הזה - אם
      // המשתמש פותח את התפריט ולוקח לו כמה שניות לבחור פעולה, הריענון האוטומטי היה יכול
      // לבנות מחדש את הגריד באמצע ולהשאיר את currentCtxCell/resizeStartCell/draggedSourceCell
      // מצביעים על תא שכבר לא קיים בפועל - הפעולה (מחיקה/צביעה/הדבקה) נכשלת בשקט (אפיון QA).
      const ctxMenu = document.getElementById('custom-context-menu');
      const reqCtxMenu = document.getElementById('req-context-menu');
      const isContextMenuOpen = (ctxMenu && ctxMenu.style.display !== 'none' && ctxMenu.style.display !== '')
        || (reqCtxMenu && reqCtxMenu.style.display !== 'none' && reqCtxMenu.style.display !== '');
      // אותה בעיה קיימת גם בגריד הבקשות של היחידה (esuk/hirg/pikud/tazam/bahalag.html): בלוק
      // "ממתין לאישור" שנוצר/הוזז אבל עדיין לא נשמר קיים רק בזיכרון (hadragStagedBlocks/
      // shekemStagedBlocks) - רענון אוטומטי באמצע היה קורא מחדש מהאחסון (loadUnitRequestGridState)
      // ומאבד אותו בשקט, גם אם אין באותו רגע פוקוס בתוך שדה עריכה (למשל בין הגרירה לבין
      // תחילת ההקלדה, או תוך כדי גרירת בלוק קיים מהידית).
      const hasUnsavedReqGridBlocks = (typeof hadragStagedBlocks !== 'undefined' && hadragStagedBlocks.some(b => !b.reqId))
        || (typeof shekemStagedBlocks !== 'undefined' && shekemStagedBlocks.some(b => !b.reqId));
      const isGridInteractionActive = (typeof isDragging !== 'undefined' && isDragging)
        || (typeof isResizing !== 'undefined' && isResizing)
        || (typeof draggedHadragData !== 'undefined' && draggedHadragData)
        || (typeof reqGridDragMode !== 'undefined' && reqGridDragMode)
        || hasUnsavedReqGridBlocks;
      if (isContextMenuOpen || isGridInteractionActive) return;

      await updateUIForWeek();
    });
    // קריאה מיידית אחת בטעינה - כדי שהתראות שנוצרו במכשיר אחר יופיעו כבר בטעינה הראשונה,
    // ולא רק אחרי מחזור הרענון התקופתי הראשון (SYNC_INTERVAL_MS).
    if (typeof refreshNotifications === 'function') refreshNotifications();
  }

  window.addEventListener('storage', () => {
    checkRequirementChanges('keshertable');
    checkRequirementChanges('optictable');
    // הרחבה: נותנת נדנוד חי גם לחדר"ג/שק"ם/סטטוס ההפצה כשטאב אחר (אותו דפדפן) שינה נתונים -
    // בלי לטעון מחדש את הגריד הניתן לעריכה (שעלול לדרוס עריכה פעילה באמצע), רק מרעננת
    // תצוגות קריאה-בלבד (רשימות ממתינות) וסממנים (כפתור הפצה, התראות).
    if (typeof renderStackedConflicts === 'function') renderStackedConflicts('hadrag');
    if (typeof renderStackedConflicts === 'function') renderStackedConflicts('shekem');
    if (typeof updateGlobalExportButtonStatus === 'function') updateGlobalExportButtonStatus();
    if (typeof updateNotifBadge === 'function') updateNotifBadge();
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

/**
 * ממפה כל שדה עריכה למפתח יציב שלא תלוי במיקום הגלובלי בעמוד (table-id + אינדקס מקומי בטבלה),
 * כך שהוספת/הסרת שורות בטבלה אחת (למשל בעת הדבקת שורה בסוף טבלה דינמית) לא "מזיזה" ומשבשת
 * את שיוך הערכים של שדות בטבלאות אחרות, ומאפשרת לבטל/לשחזר גם כשמספר השדות הכולל בעמוד השתנה.
 */
function _getUndoFieldMap() {
  const map = new Map();
  const seenPerTable = new Map();
  document.querySelectorAll('.cell-input, .task-input, .time-input').forEach(el => {
    const table = el.closest('table');
    const tableKey = (table && table.id) ? table.id : '_free';
    const idx = seenPerTable.get(tableKey) || 0;
    seenPerTable.set(tableKey, idx + 1);
    map.set(`${tableKey}#${idx}`, el);
  });
  return map;
}

// גריד המיזוג של חדר"ג/שק"ם (גרירה/מיזוג/שינוי גודל/הדבקה/תפריט קליק ימני) לא היה מכוסה
// ע"י מנגנון הביטול/ביצוע-חוזר בכלל (רק שדות .cell-input/.task-input/.time-input) - כלומר
// מחיקה/הזזה בטעות בגריד לא הייתה ניתנת לשחזור. כל נתיבי העריכה בגריד עוברים בסופו של דבר
// דרך saveHadragTables/saveShekemTables, ולכן החיבור למנגנון הביטול נעשה שם (ראו למטה).
const UNDO_HADRAG_TABLE_IDS = ['body-chadrag', 'body-anafit8', 'body-anafit-bah', 'body-tavor'];
const UNDO_SHEKEM_TABLE_IDS = ['body-shekem'];

function _captureGridState(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return null;
  const cells = {};
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      const ta = cell.querySelector('textarea');
      cells[`${r}_${c}`] = {
        val: ta ? ta.value : '',
        span: cell.rowSpan,
        disp: cell.style.display,
        classes: Array.from(cell.classList).filter(cls => ['merged', ...PERSISTABLE_CELL_CLASSES].includes(cls)),
        reqId: cell.dataset.reqId || null
      };
    }
  }
  return cells;
}

function _applyGridState(tbodyId, cells) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody || !cells) return;
  for (let r = 0; r < 36; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = tbody.querySelector(`td[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      const data = cells[`${r}_${c}`] || { val: '', span: 1, disp: '', classes: [], reqId: null };
      const ta = cell.querySelector('textarea');
      if (ta) { ta.value = data.val || ''; ta.style.height = '100%'; }
      cell.rowSpan = data.span || 1;
      cell.style.display = data.disp || '';
      cell.className = 'platoon-cell';
      (data.classes || []).forEach(cls => cell.classList.add(cls));
      if (data.reqId) cell.dataset.reqId = data.reqId; else delete cell.dataset.reqId;
    }
  }
}

// שיבוץ מאושר בגריד חדר"ג/שק"ם מתויג ב-reqId המקשר אותו לרשומת בקשה נפרדת (hadragRequests/
// shekemRequests). ביטול/ביצוע-חוזר של הגריד לבדו (בלי הרשימות האלה) היה משאיר "רפאים": התא
// חוזר ויזואלית עם reqId שמצביע לרשומה שכבר נמחקה בפועל (למשל אחרי מחיקה+Ctrl+Z), כי המחיקה
// המקורית מסירה את הרשומה לצמיתות מהרשימה המשותפת - לכן חובה לתעד/לשחזר גם את הרשימות עצמן.
function _captureRequestsState() {
  const state = {};
  if (typeof getHadragRequestsKey === 'function') {
    const k = getHadragRequestsKey(currentWeek, currentYear);
    const raw = localStorage.getItem(k);
    if (raw !== null) state[k] = raw;
  }
  if (typeof getShekemRequestsKey === 'function') {
    const k = getShekemRequestsKey(currentWeek, currentYear);
    const raw = localStorage.getItem(k);
    if (raw !== null) state[k] = raw;
  }
  return state;
}

function _applyRequestsState(reqState) {
  let changed = false;
  Object.keys(reqState || {}).forEach(key => {
    if (localStorage.getItem(key) !== reqState[key]) {
      try {
        // עוברים דרך persist() (לא כתיבה ישירה ל-localStorage) כדי שהשחזור גם יתוזמן
        // לסנכרון מרוחק (SharePoint/רשת צבאית) במצב שרת, בדיוק כמו כל שמירה רגילה אחרת.
        persist(key, JSON.parse(reqState[key]));
      } catch (e) { /* ignore */ }
      changed = true;
    }
  });
  if (changed) {
    if (typeof renderHadragRequestsList === 'function') renderHadragRequestsList();
    if (typeof renderShekemRequestsList === 'function') renderShekemRequestsList();
    // שחזור בטל/בצע-שוב יכול להחזיר בקשה למצב "ממתין" - מריצים מיקום אוטומטי מחדש כדי
    // שהיא תשתקף נכון (בטבלה או כשכבת התנגשות), לא רק מרעננים תצוגה ישנה.
    (async () => {
      if (typeof autoPlaceRequests === 'function') { await autoPlaceRequests('hadrag'); await autoPlaceRequests('shekem'); }
      if (typeof loadHadragTables === 'function') await loadHadragTables(currentWeek, currentYear);
      if (typeof loadShekemTables === 'function') await loadShekemTables(currentWeek, currentYear);
      if (typeof renderStackedConflicts === 'function') { await renderStackedConflicts('hadrag'); await renderStackedConflicts('shekem'); }
    })();
  }
}

// צביעת תא מענים רפואיים (setCellColor ב-hipokim.html) היא מחלקת CSS על ה-wrapper, לא .value של
// שדה - לכן לא נתפסת ע"י _getUndoFieldMap/.task-input/.time-input, וללא הקוד הזה שינוי צבע
// בלבד לא היה ניתן לביטול (Ctrl+Z) בכלל.
function _captureHipokColorsState() {
  if (typeof ALL_HIPOK_COLORS === 'undefined') return null;
  const wrappers = document.querySelectorAll('#hipoktable .cell-wrapper');
  if (!wrappers.length) return null;
  const colors = {};
  wrappers.forEach((wrapper, i) => {
    colors[i] = ALL_HIPOK_COLORS.find(c => wrapper.classList.contains(c)) || '';
  });
  return colors;
}

function _applyHipokColorsState(colors) {
  if (!colors || typeof ALL_HIPOK_COLORS === 'undefined') return false;
  const wrappers = document.querySelectorAll('#hipoktable .cell-wrapper');
  if (!wrappers.length) return false;
  let changed = false;
  wrappers.forEach((wrapper, i) => {
    const target = colors[i] || '';
    const current = ALL_HIPOK_COLORS.find(c => wrapper.classList.contains(c)) || '';
    if (current !== target) {
      wrapper.classList.remove(...ALL_HIPOK_COLORS);
      if (target) wrapper.classList.add(target);
      changed = true;
    }
  });
  return changed;
}

// גריד הבקשות של היחידה (esuk/hirg/pikud/tazam/bahalag.html) שומר את הבלוקים ה"ממתינים" רק
// בזיכרון (hadragStagedBlocks/shekemStagedBlocks) עד שהם נשמרים כרשומה בפועל - לכן, בניגוד
// לגריד המיזוג של המנהל (_captureGridState, DOM-מבוסס) או לרשומות שכבר נשמרו (_captureRequestsState,
// localStorage-מבוסס), צריך תיעוד/שחזור ייעודי כאן שפשוט משכפל את מערכי הבלוקים עצמם.
function _captureReqGridState() {
  if (typeof hadragStagedBlocks === 'undefined') return null;
  return {
    hadrag: hadragStagedBlocks.map(b => ({ ...b })),
    shekem: shekemStagedBlocks.map(b => ({ ...b }))
  };
}

function _applyReqGridState(state) {
  if (!state || typeof hadragStagedBlocks === 'undefined') return false;
  const newHadrag = state.hadrag || [];
  const newShekem = state.shekem || [];
  const changed = JSON.stringify(hadragStagedBlocks) !== JSON.stringify(newHadrag)
    || JSON.stringify(shekemStagedBlocks) !== JSON.stringify(newShekem);
  if (changed) {
    hadragStagedBlocks = newHadrag.map(b => ({ ...b }));
    shekemStagedBlocks = newShekem.map(b => ({ ...b }));
    if (typeof paintUnitRequestGrid === 'function') {
      paintUnitRequestGrid('hadrag');
      paintUnitRequestGrid('shekem');
    }
  }
  return changed;
}

function _captureUndoState() {
  const state = { fields: {}, grid: {}, requests: {}, hipokColors: null, reqGrid: null };
  _getUndoFieldMap().forEach((el, key) => { state.fields[key] = el.value; });
  [...UNDO_HADRAG_TABLE_IDS, ...UNDO_SHEKEM_TABLE_IDS].forEach(tbodyId => {
    const g = _captureGridState(tbodyId);
    if (g) state.grid[tbodyId] = g;
  });
  state.requests = _captureRequestsState();
  state.hipokColors = _captureHipokColorsState();
  state.reqGrid = _captureReqGridState();
  return state;
}

function _applyUndoState(state) {
  const fieldMap = _getUndoFieldMap();
  _undoSuppressed = true;
  Object.keys(state.fields || {}).forEach(key => {
    const el = fieldMap.get(key);
    // אם השדה כבר לא קיים (השורה נמחקה בינתיים) - מדלגים עליו בלבד, לא נכשלים על כל הפעולה.
    if (el && el.value !== state.fields[key]) {
      el.value = state.fields[key];
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  const gridTables = Object.keys(state.grid || {});
  gridTables.forEach(tbodyId => _applyGridState(tbodyId, state.grid[tbodyId]));
  _applyRequestsState(state.requests);
  if (gridTables.length > 0) {
    if (typeof saveHadragTables === 'function') saveHadragTables();
    if (typeof saveShekemTables === 'function') saveShekemTables();
  }
  const hipokColorsChanged = _applyHipokColorsState(state.hipokColors);
  if (hipokColorsChanged) {
    if (typeof saveHipokData === 'function') saveHipokData();
    if (typeof updateHipokConflictHighlight === 'function' && typeof currentWeek !== 'undefined') {
      updateHipokConflictHighlight(currentWeek, currentYear);
    }
  }
  if (typeof _applyReqGridState === 'function') _applyReqGridState(state.reqGrid);
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

// גרסה לא-מדורגת (ללא debounce) של _recordUndoChange - מיועדת לפעולות גריד בדידות ושלמות
// (גרירה, שינוי גודל, מחיקה, שינוי צבע, הדבקה, שיבוץ ישיר, אישור בקשה) בחדר"ג/שק"ם. בלי זה,
// כל הפעולות האלה עברו דרך אותו טיימר משותף של 350ms עם הקלדה בתיבות טקסט - כך שרצף טבעי של
// "גרור ליצירת בלוק ואז הקלד טקסט בתוכו" (נפוץ מאוד בשימוש בפועל) מתמזג לצעד ביטול אחד בלבד,
// וCtrl+Z נראה כאילו הוא "מבטל יותר מדי בבת אחת" או "לא עובד" (אפיון QA: תלונה על חדר"ג/שק"ם).
function _recordUndoChangeImmediate() {
  if (_undoSuppressed) return;
  clearTimeout(_undoRecordTimer);
  const newState = _captureUndoState();
  if (_undoCurrentState && JSON.stringify(newState) !== JSON.stringify(_undoCurrentState)) {
    _undoStack.push(_undoCurrentState);
    if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    _redoStack = [];
  }
  _undoCurrentState = newState;
}

function doUndo() {
  if (isReadOnlyMode()) return;
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
  if (isReadOnlyMode()) return;
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
   בחירה מרובה + העתק/הדבק בלוק (אפיון 1.3)
   פועל על טבלאות גריד (.cell-input) בלבד - לא על טבלאות המיזוג (חדר"ג/שק"ם).
   משתמש באירועי copy/paste האמיתיים -> יציב, ומאפשר גם העתקה מ/אל Excel.
========================================================= */
let _msTable = null;
let _msAnchor = null;      // {r, c}
let _msFocus = null;       // {r, c}
let _msSelecting = false;
let _msRowMode = false;    // בחירת שורות שלמות (לחיצה על תא-השם)
let _blockClipboard = null;

function _isGridInput(el) {
  return el && el.classList && el.classList.contains('cell-input');
}
function _isMergeTable(table) {
  return !!(table && table.querySelector('td.platoon-cell'));
}
function _isGridTable(table) {
  return !!(table && table.querySelector('.cell-input') && !_isMergeTable(table));
}
function _cellCoord(input) {
  const tr = input.closest('tr');
  const tbody = tr.parentElement;
  const r = Array.from(tbody.rows).indexOf(tr);
  const inputs = Array.from(tr.querySelectorAll('.cell-input'));
  const c = inputs.indexOf(input);
  return { r, c, tbody };
}
function _inputAt(tbody, r, c) {
  const tr = tbody.rows[r];
  if (!tr) return null;
  const inputs = tr.querySelectorAll('.cell-input');
  return inputs[c] || null;
}
function _maxCols(tbody) {
  let m = 0;
  for (const tr of tbody.rows) {
    const n = tr.querySelectorAll('.cell-input').length;
    if (n > m) m = n;
  }
  return m;
}
function _clearRangeHighlight() {
  document.querySelectorAll('td.range-selected').forEach(td => td.classList.remove('range-selected'));
}
function _rangeBounds() {
  const tbody = _msTable.tBodies[0];
  const r1 = Math.min(_msAnchor.r, _msFocus.r), r2 = Math.max(_msAnchor.r, _msFocus.r);
  let c1, c2;
  if (_msRowMode) { c1 = 0; c2 = _maxCols(tbody) - 1; }
  else { c1 = Math.min(_msAnchor.c, _msFocus.c); c2 = Math.max(_msAnchor.c, _msFocus.c); }
  return { r1, r2, c1, c2 };
}
function _applyRangeHighlight() {
  _clearRangeHighlight();
  if (!_msTable || !_msAnchor || !_msFocus) return;
  const tbody = _msTable.tBodies[0];
  const { r1, r2, c1, c2 } = _rangeBounds();
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const inp = _inputAt(tbody, r, c);
      if (inp) inp.closest('td').classList.add('range-selected');
    }
    if (_msRowMode) {
      const nameCell = tbody.rows[r] && tbody.rows[r].querySelector('td.test');
      if (nameCell) nameCell.classList.add('range-selected');
    }
  }
}
function _hasSelection() {
  if (!_msTable || !_msAnchor || !_msFocus) return false;
  if (_msRowMode) return true;
  return _msAnchor.r !== _msFocus.r || _msAnchor.c !== _msFocus.c;
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest) return;

  // בחירת שורה שלמה: לחיצה על תא-השם (td.test) - למעט לחיצה על ידית הגרירה עצמה,
  // כדי לא לחסום את מנגנון גרירת השורות (dragstart) שמתחיל מאותו אלמנט (אפיון 1.6).
  if (e.target.closest('.row-drag-handle')) return;
  const nameCell = e.target.closest('td.test');
  if (nameCell) {
    const table = nameCell.closest('table');
    const tr = nameCell.closest('tr');
    if (table && _isGridTable(table) && tr) {
      const r = Array.from(table.tBodies[0].rows).indexOf(tr);
      _msTable = table; _msRowMode = true;
      if (e.shiftKey && _msAnchor) { _msFocus = { r, c: 0 }; }
      else { _msAnchor = { r, c: 0 }; _msFocus = { r, c: 0 }; }
      _msSelecting = true;
      _applyRangeHighlight();
      e.preventDefault();
      return;
    }
  }

  const inp = e.target.closest('.cell-input');
  if (!_isGridInput(inp)) return;
  const table = inp.closest('table');
  if (!table || _isMergeTable(table)) return;

  const coord = _cellCoord(inp);
  if (e.shiftKey && _msTable === table && _msAnchor) {
    _msRowMode = false;
    _msFocus = { r: coord.r, c: coord.c };
    _applyRangeHighlight();
    e.preventDefault();
    return;
  }
  _msTable = table;
  _msRowMode = false;
  _msAnchor = { r: coord.r, c: coord.c };
  _msFocus = { r: coord.r, c: coord.c };
  _msSelecting = true;
  _clearRangeHighlight();
});

document.addEventListener('mousemove', (e) => {
  if (!_msSelecting || !_msTable) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || !el.closest) return;

  if (_msRowMode) {
    const nameCell = el.closest('td.test');
    if (!nameCell || nameCell.closest('table') !== _msTable) return;
    const tr = nameCell.closest('tr');
    const r = Array.from(_msTable.tBodies[0].rows).indexOf(tr);
    if (r !== _msFocus.r) {
      _msFocus = { r, c: 0 };
      e.preventDefault();
      window.getSelection && window.getSelection().removeAllRanges();
      _applyRangeHighlight();
    }
    return;
  }

  const inp = el.closest('.cell-input');
  if (!_isGridInput(inp) || inp.closest('table') !== _msTable) return;
  const coord = _cellCoord(inp);
  if (coord.r !== _msFocus.r || coord.c !== _msFocus.c) {
    _msFocus = { r: coord.r, c: coord.c };
    if (_hasSelection()) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      window.getSelection && window.getSelection().removeAllRanges();
      _applyRangeHighlight();
    }
  }
});

document.addEventListener('mouseup', () => {
  if (!_msSelecting) return;
  _msSelecting = false;
  if (!_hasSelection()) _clearRangeHighlight();
});

// בונה בלוק ערכים מהבחירה הנוכחית
function _selectionBlock() {
  const tbody = _msTable.tBodies[0];
  const { r1, r2, c1, c2 } = _rangeBounds();
  const block = [];
  for (let r = r1; r <= r2; r++) {
    const row = [];
    for (let c = c1; c <= c2; c++) {
      const inp = _inputAt(tbody, r, c);
      row.push(inp ? inp.value : '');
    }
    block.push(row);
  }
  return { block, startR: r1, startC: c1 };
}

// אירוע העתקה אמיתי - יציב יותר מיירוט keydown, ותומך בהעתקה ל-Excel
/**
 * עוטפת שדה TSV במרכאות (RFC4180-style) אם הוא מכיל טאב/ירידת שורה/מרכאה - כדי שהעתקה
 * של תוכן רב-שורתי (למשל textarea) תישאר ערך אחד תקין בהדבקה חוזרת (גם ל-Excel וגם חזרה
 * לתוך המערכת), במקום להישבר לכמה תאים/שורות.
 */
function _tsvEscapeField(val) {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[\t\n"]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function _blockToTsv(block) {
  return block.map(row => row.map(_tsvEscapeField).join('\t')).join('\n');
}

document.addEventListener('copy', (e) => {
  if (!_hasSelection()) return;
  const { block } = _selectionBlock();
  _blockClipboard = block;
  const tsv = _blockToTsv(block);
  if (e.clipboardData) {
    e.clipboardData.setData('text/plain', tsv);
    e.preventDefault();
  }
});

document.addEventListener('cut', (e) => {
  if (isReadOnlyMode()) return;
  if (!_hasSelection()) return;
  const { block, startR, startC } = _selectionBlock();
  _blockClipboard = block;
  const tsv = _blockToTsv(block);
  if (e.clipboardData) { e.clipboardData.setData('text/plain', tsv); e.preventDefault(); }
  // ניקוי התאים שנגזרו
  const tbody = _msTable.tBodies[0];
  for (let i = 0; i < block.length; i++) {
    for (let j = 0; j < block[i].length; j++) {
      const inp = _inputAt(tbody, startR + i, startC + j);
      if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }
  }
});

// אירוע הדבקה אמיתי - מפרק TSV (גם מ-Excel) או משתמש בבלוק הפנימי
/**
 * מפרשת טקסט TSV שהועתק (כולל מ-Excel) לבלוק דו-ממדי, עם תמיכה בשדות עטופים במרכאות
 * (RFC4180-style) שיכולים להכיל טאבים/ירידות שורה מוטבעות - כפי שאקסל עוטף תא שהתוכן שלו
 * כולל ירידת שורה. פיצול נאיבי לפי \t/\n (כפי שהיה קודם) היה מפצל תא כזה לכמה שורות/תאים
 * בטעות במקום לשמור אותו כערך אחד.
 * @param {string} text
 * @returns {string[][]}
 */
function parseTsvClipboard(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === '\t') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  row.push(field);
  rows.push(row);
  while (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

document.addEventListener('paste', (e) => {
  if (isReadOnlyMode()) { e.preventDefault(); return; }
  const active = document.activeElement;
  const inGrid = _isGridInput(active) && active.closest('table') && !_isMergeTable(active.closest('table'));
  if (!inGrid && !_hasSelection()) return;

  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  let block = null;
  if (text) {
    // יש טקסט בלוח (כולל מ-Excel): טקסט רב-תאי -> בלוק; ערך בודד -> הדבקה טבעית
    if (text.indexOf('\t') >= 0 || text.indexOf('\n') >= 0) {
      block = parseTsvClipboard(text);
    } else {
      return; // ערך בודד -> להשאיר להדבקה טבעית של הדפדפן
    }
  } else if (_blockClipboard && (_blockClipboard.length > 1 || (_blockClipboard[0] && _blockClipboard[0].length > 1))) {
    // גיבוי פנימי (למשל כשאין גישה ללוח המערכת)
    block = _blockClipboard;
  }
  if (!block) return;

  e.preventDefault();

  let tbody, startR, startC;
  if (inGrid) {
    const coord = _cellCoord(active);
    startR = coord.r; startC = coord.c;
    tbody = active.closest('table').tBodies[0];
  } else {
    const b = _rangeBounds();
    startR = b.r1; startC = b.c1;
    tbody = _msTable.tBodies[0];
  }

  for (let i = 0; i < block.length; i++) {
    for (let j = 0; j < block[i].length; j++) {
      const inp = _inputAt(tbody, startR + i, startC + j);
      if (inp) {
        inp.value = block[i][j];
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
});

/* =========================================================
   חיווי מצב סנכרון נתונים (אפיון חלק 2)
========================================================= */
function updateSyncIndicator() {
  const chip = document.getElementById('sync-chip');
  if (!chip) return;
  if (typeof DataService === 'undefined' || typeof DataService.getSyncStatus !== 'function') {
    chip.style.display = 'none';
    return;
  }
  const s = DataService.getSyncStatus();
  chip.style.display = 'inline-flex';
  chip.classList.remove('sync-ok', 'sync-pending', 'sync-offline', 'sync-local', 'sync-disabled');

  if (!s.remote) { chip.classList.add('sync-local'); chip.textContent = '💾 מקומי'; return; }
  if (s.disabled) { chip.classList.add('sync-disabled'); chip.textContent = '⚪ שרת לא זמין'; return; }
  if (!s.online) { chip.classList.add('sync-offline'); chip.textContent = `🔴 לא מקוון${s.pending ? ` (${s.pending})` : ''}`; return; }
  if (s.pending > 0) { chip.classList.add('sync-pending'); chip.textContent = `🟡 מסנכרן… ${s.pending}`; return; }
  chip.classList.add('sync-ok'); chip.textContent = '🟢 מסונכרן';
}
if (typeof window !== 'undefined') window.updateSyncIndicator = updateSyncIndicator;

/* =========================================================
   מרכז התראות (Notification Center) - אפיון 1.8
========================================================= */
const NOTIF_KEY = 'pakadex_notifications';

function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); }
  catch (e) { return []; }
}

// שמירה דרך persist() (DataService + סנכרון לשרת, ראו script.js:96) ולא localStorage ישיר -
// מרכז ההתראות הוא רשימה משותפת (הודעות כמו "המנהל הפיץ שינויים"/"פלוגה שמרה נתונים מוכנה
// לייבוא" מיועדות לכל המשתמשים, לא רק למכשיר שיצר אותן) ולכן חייבת להיות מסונכרנת בין
// מכשירים במצב שרת מרוחק (SharePoint/רשת צבאית), בדיוק כמו כל שאר נתוני האפליקציה.
function saveNotifications(list) {
  const trimmed = list.slice(-100);
  if (typeof persist === 'function') persist(NOTIF_KEY, trimmed);
  else localStorage.setItem(NOTIF_KEY, JSON.stringify(trimmed));
}

/**
 * מרעננת את מרכז ההתראות מהשרת (אם מוגדר) - כדי שהתראות שנוצרו במכשיר אחר (למשל "פלוגה
 * שמרה נתונים מוכנים לייבוא" שנוצרה בעמוד היחידה) יופיעו גם כאן. נקראת מהמחזור התקופתי
 * של DataService.startAutoSync (ראו window.onload), באותה תדירות שבה שאר הנתונים מתרעננים.
 */
async function refreshNotifications() {
  if (typeof fetchTableData !== 'function') return;
  const remote = await fetchTableData(NOTIF_KEY);
  if (!Array.isArray(remote)) return;
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(remote)); } catch (e) {}
  updateNotifBadge();
  const panel = document.getElementById('notif-panel');
  if (panel && panel.style.display !== 'none') renderNotifPanel();
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
        <div class="notif-msg">${escapeHtml(n.message)}</div>
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
   הקצאות מתקדמות (חדר"ג, שק"ם, מענים רפואיים) לפי צבע יחידה
========================================================= */

function rowToTimeStr(r) {
  const hour = Math.floor(6 + r / 2).toString().padStart(2, '0');
  const minutes = r % 2 === 0 ? '00' : '30';
  return `${hour}:${minutes}`;
}

const DAYS_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HADRAG_TABLES_MAP = {
  'body-chadrag': 'חדר"ג',
  'body-anafit8': 'ענפית 1',
  'body-anafit-bah': 'ענפית בא"ח',
  'body-tavor': 'פיקוד 1'
};

async function getHadragAllocationsForUnit(unitColor, week, year) {
  const allocations = [];
  const tableIds = Object.keys(HADRAG_TABLES_MAP);

  for (const tableId of tableIds) {
    // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
    const key = `hadragData_${tableId}_week${week}_year${year}_published`;
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
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  const key = `shekemData_body-shekem_week${week}_year${year}_published`;
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
  // הקצאות מוצגות ליחידה רק לאחר שהמנהל הפיץ בפועל - קוראים מה-published, לא מה-draft (אפיון QA)
  const key = getStorageKey('hipoktable', week, year) + '_published';
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
  // אינדקסים 0-41 הם מענה רפואי יבש (6 שורות)
  // אינדקסים 42-83 הם מענה רפואי רטוב (6 שורות)
  for (let i = 0; i < 84; i++) {
    const taskColor = data[`color_${i}`] || '';
    if (taskColor === unitColor) {
      const typeText = i < 42 ? 'מענה רפואי יבש' : 'מענה רפואי רטוב';
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
  const reqWeek = currentWeek, reqYear = currentYear;

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

  let html = '';
  if (type === 'hadrag') {
    const allocations = await getHadragAllocationsForUnit(unitColor, currentWeek, currentYear);
    html = allocations.length === 0
      ? '<tr><td colspan="4" style="text-align:center;">אין נתונים לשבוע זה</td></tr>'
      : allocations.map(a => `<tr>
          <td style="text-align:center; font-weight:bold;">${a.day}</td>
          <td style="text-align:center; font-weight:bold;">${a.facility}</td>
          <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
          <td style="text-align:center;">${escapeHtml(a.text).replace(/\n/g, '<br>')}</td>
        </tr>`).join('');
  }
  else if (type === 'shekem') {
    const allocations = await getShekemAllocationsForUnit(unitColor, currentWeek, currentYear);
    html = allocations.length === 0
      ? '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>'
      : allocations.map(a => `<tr>
          <td style="text-align:center; font-weight:bold;">${a.day}</td>
          <td style="text-align:center; font-weight:bold; direction:ltr;">${a.startTime} - ${a.endTime}</td>
          <td style="text-align:center;">${escapeHtml(a.text).replace(/\n/g, '<br>')}</td>
        </tr>`).join('');
  }
  else if (type === 'hipokim') {
    const allocations = await getHipokimAllocationsForUnit(unitColor, currentWeek, currentYear);
    html = allocations.length === 0
      ? '<tr><td colspan="3" style="text-align:center;">אין נתונים לשבוע זה</td></tr>'
      : allocations.map(a => `<tr>
          <td style="text-align:center; font-weight:bold;">${a.day}</td>
          <td style="text-align:center; font-weight:bold;">${escapeHtml(a.task)}</td>
          <td style="text-align:center; font-weight:bold;">${escapeHtml(a.time)}</td>
        </tr>`).join('');
  }

  // אם כבר עברו לשבוע/שנה אחרים בזמן שהבקשה הזו הייתה באוויר - זורקים את התוצאה (ראו הערה
  // מפורטת ב-loadTableData) - לפני שמציבים את כל ה-HTML במעבר אחד. לא מרוקנים קודם ורק אחר
  // כך ממתינים ל-await (אותה תבנית באג בדיוק כמו בשאר הטבלאות - ראו loadTableData). זה בדיוק
  // מה שגרם לטבלאות ההקצאות של מענים רפואיים/פלוגתי/שק"ם להמשיך "לרצד" גם אחרי התיקון בטבלאות
  // הניתנות לעריכה (אפיון QA).
  if (reqWeek !== currentWeek || reqYear !== currentYear) return;
  // מדלגים על ההצבה בפועל אם ה-HTML זהה למה שכבר מוצג - ראו _renderDataChanged. גם בנייה
  // אטומית (מעבר אחד, בלי ריקון קודם) עדיין הורסת ובונה מחדש את כל השורות בכל מחזור רענון
  // אוטומטי אם לא בודקים זאת קודם - זה מה שהשאיר את "רצידת" ההקצאות קיימת חלקית.
  if (!_renderDataChanged('haktzaotExtra_' + tbodyId, html)) return;
  tbody.innerHTML = html;
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
  const reqId = cell.dataset.reqId || null;

  cell.rowSpan = 1;
  cell.className = 'platoon-cell';
  delete cell.dataset.reqId;
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
      delete hiddenCell.dataset.reqId;
      const hiddenTa = hiddenCell.querySelector('textarea');
      if (hiddenTa) hiddenTa.value = '';
    }
  }
  return reqId;
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
      if (typeof PERSISTABLE_CELL_CLASSES !== 'undefined' && PERSISTABLE_CELL_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
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
       const displacedReqId = clearHadragCellData(c);
       if (displacedReqId && typeof removeGridRequestLink === 'function') removeGridRequestLink(displacedReqId, tbody);
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
  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
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
      cellClass: Array.from(cell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle' && c !== 'conflict-overlap')
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
let dragPreviewElement = null;

document.addEventListener('mouseover', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (cell && typeof isDragging !== 'undefined' && !isDragging) {
    const ta = cell.querySelector('textarea');
    const hasContent = ta && ta.value.trim() !== '';
    const hasColor = typeof PERSISTABLE_CELL_CLASSES !== 'undefined' && PERSISTABLE_CELL_CLASSES.some(cls => cell.classList.contains(cls));
    if (hasContent || hasColor) {
      cell.setAttribute('draggable', 'true');
    } else {
      cell.removeAttribute('draggable');
    }
  }
});

/**
 * מוצאת את אינדקס השורה (data-row) שבה נמצא Y נתון בתוך ה-tbody, לפי גבולות תא עמודת השעה
 * של כל שורה - מדויק יותר מ-e.target.closest, שעלול "לפספס" עקב תאים ממוזגים (rowSpan)
 * שמכסים חזותית כמה שורות עם td.platoon-cell בודד.
 */
function getRowIndexAtY(tbody, clientY) {
  if (!tbody) return -1;
  for (let i = 0; i < tbody.rows.length; i++) {
    const timeCell = tbody.rows[i].firstElementChild;
    if (timeCell) {
      const rect = timeCell.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return i;
    }
  }
  return -1;
}

document.addEventListener('dragstart', function(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell) return;

  // שומרים את השורה הספציפית (בתוך הבלוק המרובה-שורות) שבה המשתמש בפועל תפס את הגרירה -
  // כדי שבזמן ההטלה נשמור על אותו יחס, ולא תמיד "יקפוץ" ראש הבלוק למקום העכבר (אפיון QA:
  // "המשבצת תנחת בדיוק איפה שאני שם אותה").
  const tbody = cell.closest('tbody');
  const startRow = parseInt(cell.dataset.row);
  const grabbedRow = getRowIndexAtY(tbody, e.clientY);
  const grabOffset = grabbedRow !== -1 ? Math.max(0, grabbedRow - startRow) : 0;

  const ta = cell.querySelector('textarea');
  draggedHadragData = {
    text: ta ? ta.value : '',
    rowSpan: cell.rowSpan || 1,
    cellClass: Array.from(cell.classList),
    grabOffset: grabOffset
  };
  draggedSourceCell = cell;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'hadrag-cell');
  setTimeout(() => cell.style.opacity = '0.5', 0);
});

/**
 * מחשבת את שורת/עמודת ההתחלה שבהן ינחת הבלוק הנגרר אם ישוחרר עכשיו - לפי מיקום העכבר
 * בפועל בתוך ה-tbody, בהפחתת האופסט שבו נתפס הבלוק (grabOffset).
 */
function computeDragTarget(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell || !draggedHadragData) return null;
  const tbody = cell.closest('tbody');
  if (!tbody) return null;

  const col = parseInt(cell.dataset.col);
  const hoverRow = getRowIndexAtY(tbody, e.clientY);
  const baseRow = hoverRow !== -1 ? hoverRow : parseInt(cell.dataset.row);
  const startRow = Math.max(0, baseRow - (draggedHadragData.grabOffset || 0));
  const maxStartRow = tbody.rows.length - draggedHadragData.rowSpan;
  const clampedStartRow = Math.min(startRow, Math.max(0, maxStartRow));
  const endRow = Math.min(tbody.rows.length - 1, clampedStartRow + draggedHadragData.rowSpan - 1);

  return { tbody, col, startRow: clampedStartRow, endRow };
}

document.addEventListener('dragover', function(e) {
  const target = computeDragTarget(e);
  if (!target) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  // תצוגה מקדימה חיה (מסגרת ירוקה מקווקוות) של המקום המדויק שבו הבלוק ינחת - זהה בסגנון
  // לתצוגה המקדימה של גרירת ידית שינוי הגודל, כדי שהמשתמש יראה בבירור לפני השחרור.
  const startDom = target.tbody.querySelector(`td.platoon-cell[data-row="${target.startRow}"][data-col="${target.col}"]`);
  const endTr = target.tbody.rows[target.endRow];
  if (!startDom || !endTr) return;
  const startRect = startDom.getBoundingClientRect();
  const timeCellEnd = endTr.firstElementChild;
  if (!timeCellEnd) return;
  const endRect = timeCellEnd.getBoundingClientRect();

  if (!dragPreviewElement) {
    dragPreviewElement = document.createElement('div');
    dragPreviewElement.style.position = 'absolute';
    dragPreviewElement.style.border = '2px dashed #22c55e';
    dragPreviewElement.style.pointerEvents = 'none';
    dragPreviewElement.style.zIndex = '100';
    dragPreviewElement.style.background = 'rgba(34, 197, 94, 0.15)';
    document.body.appendChild(dragPreviewElement);
  }
  dragPreviewElement.style.top = startRect.top + window.scrollY + 'px';
  dragPreviewElement.style.left = startRect.left + window.scrollX + 'px';
  dragPreviewElement.style.width = startRect.width + 'px';
  dragPreviewElement.style.height = (endRect.bottom - startRect.top) + 'px';
});

document.addEventListener('dragend', function(e) {
  if (draggedSourceCell) draggedSourceCell.style.opacity = '1';
  if (dragPreviewElement) { dragPreviewElement.remove(); dragPreviewElement = null; }
  draggedHadragData = null;
  draggedSourceCell = null;
});

document.addEventListener('drop', function(e) {
  const target = computeDragTarget(e);
  if (!target || !draggedHadragData || !draggedSourceCell) return;
  e.preventDefault();
  if (dragPreviewElement) { dragPreviewElement.remove(); dragPreviewElement = null; }

  const targetCell = target.tbody.querySelector(`td.platoon-cell[data-row="${target.startRow}"][data-col="${target.col}"]`);
  if (!targetCell || targetCell === draggedSourceCell) return;

  const { startRow, endRow, col } = target;
  const srcStart = parseInt(draggedSourceCell.dataset.row);
  const srcEnd = srcStart + (draggedSourceCell.rowSpan || 1) - 1;
  const srcCol = parseInt(draggedSourceCell.dataset.col);

  let hasConflict = false;
  for (let r = startRow; r <= endRow; r++) {
    if (col === srcCol && r >= srcStart && r <= srcEnd) continue;

    const c = target.tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!c) continue;
    if (c.style.display === 'none') { hasConflict = true; break; }
    const ta = c.querySelector('textarea');
    if (ta && ta.value.trim() !== '') { hasConflict = true; break; }
    if (typeof PERSISTABLE_CELL_CLASSES !== 'undefined' && PERSISTABLE_CELL_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
  }

  if (hasConflict) {
    alert('לא ניתן להזיז: השטח חופף לשיבוץ קיים.');
    return;
  }

  const movedReqId = clearHadragCellData(draggedSourceCell);
  pasteOrMoveBlock(targetCell, draggedHadragData, false);
  if (movedReqId && typeof relinkGridRequestToCell === 'function') relinkGridRequestToCell(movedReqId, targetCell);
  if (typeof saveHadragTables === 'function') saveHadragTables();
  if (typeof saveShekemTables === 'function') saveShekemTables();
});

/* =========================================================
   גרירת "שכבות התנגשות" (stacked-conflict-overlay) - נפרד לגמרי ממנגנון הגרירה הרגיל של
   תאי הטבלה למעלה (draggedHadragData): ה-overlay מצורף ל-document.body, לא בתוך
   td.platoon-cell, כך ש-e.target.closest('td.platoon-cell') במנגנון הרגיל תמיד יחזיר null
   עבורו ולא יתנגש. פותר בקשה "מוערמת" (autoPlaceRequests) שהתנגשה עם תוכן קיים - המנהל
   גורר אותה למשבצת פנויה לבחירתו (בכל אחד מהמתקנים של אותו סוג).
========================================================= */
let draggedStackedConflict = null;
let draggedStackedOverlayEl = null;
let stackedDragPreviewElement = null;

function computeStackedDropTarget(e) {
  const cell = e.target.closest('td.platoon-cell');
  if (!cell || !draggedStackedConflict) return null;
  const tbody = cell.closest('tbody');
  if (!tbody || !_platoonTableIds(draggedStackedConflict.type).includes(tbody.id)) return null;

  const col = parseInt(cell.dataset.col, 10);
  const hoverRow = getRowIndexAtY(tbody, e.clientY);
  const baseRow = hoverRow !== -1 ? hoverRow : parseInt(cell.dataset.row, 10);
  const maxStartRow = tbody.rows.length - draggedStackedConflict.span;
  const startRow = Math.max(0, Math.min(baseRow, Math.max(0, maxStartRow)));
  const endRow = Math.min(tbody.rows.length - 1, startRow + draggedStackedConflict.span - 1);
  return { tbody, tableId: tbody.id, col, startRow, endRow };
}

document.addEventListener('dragstart', function(e) {
  const overlay = e.target.closest('.stacked-conflict-overlay');
  if (!overlay) return;
  draggedStackedConflict = {
    sourceTableId: overlay.dataset.tableId,
    type: overlay.dataset.type,
    reqId: overlay.dataset.reqId,
    span: parseInt(overlay.dataset.span, 10) || 1,
    unitClass: overlay.dataset.unitClass,
    unitName: overlay.dataset.unitName,
    text: overlay.dataset.text
  };
  draggedStackedOverlayEl = overlay;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'stacked-conflict');
  setTimeout(() => { overlay.style.opacity = '0.3'; }, 0);
});

document.addEventListener('dragover', function(e) {
  const target = computeStackedDropTarget(e);
  if (!target) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const startDom = target.tbody.querySelector(`td.platoon-cell[data-row="${target.startRow}"][data-col="${target.col}"]`);
  const endTr = target.tbody.rows[target.endRow];
  if (!startDom || !endTr) return;
  const startRect = startDom.getBoundingClientRect();
  const timeCellEnd = endTr.firstElementChild;
  if (!timeCellEnd) return;
  const endRect = timeCellEnd.getBoundingClientRect();

  if (!stackedDragPreviewElement) {
    stackedDragPreviewElement = document.createElement('div');
    stackedDragPreviewElement.style.cssText = 'position:absolute;border:2px dashed #dc2626;pointer-events:none;z-index:250;background:rgba(220,38,38,0.15);';
    document.body.appendChild(stackedDragPreviewElement);
  }
  stackedDragPreviewElement.style.top = (startRect.top + window.scrollY) + 'px';
  stackedDragPreviewElement.style.left = (startRect.left + window.scrollX) + 'px';
  stackedDragPreviewElement.style.width = startRect.width + 'px';
  stackedDragPreviewElement.style.height = (endRect.bottom - startRect.top) + 'px';
});

document.addEventListener('dragend', function(e) {
  if (draggedStackedOverlayEl) draggedStackedOverlayEl.style.opacity = '0.82';
  if (stackedDragPreviewElement) { stackedDragPreviewElement.remove(); stackedDragPreviewElement = null; }
  draggedStackedConflict = null;
  draggedStackedOverlayEl = null;
});

document.addEventListener('drop', async function(e) {
  const target = computeStackedDropTarget(e);
  if (!target || !draggedStackedConflict) return;
  e.preventDefault();
  if (stackedDragPreviewElement) { stackedDragPreviewElement.remove(); stackedDragPreviewElement = null; }

  const info = draggedStackedConflict;
  // שומרים הפניה מקומית לפני האיפוס - כדי שאם ההצבה תידחה (משבצת תפוסה, ראו למטה) עדיין
  // אפשר יהיה לשחזר את השקיפות המקורית של השכבה. אחרת ה-dragend שיורה מיד אחרי ה-drop הזה
  // (draggedStackedOverlayEl כבר null בשלב הזה) לא היה משחזר אותה, והשכבה הייתה נשארת תקועה
  // בשקיפות 0.3 (מצב "בגרירה") לצמיתות, גם אחרי שהגרירה בפועל נכשלה (אפיון QA).
  const overlayEl = draggedStackedOverlayEl;
  draggedStackedConflict = null;
  draggedStackedOverlayEl = null;

  // קולטים את השבוע/שנה פעם אחת כאן, לפני כל await - ראו הערה מפורטת ב-autoPlaceRequests על
  // אותו באג בדיוק (ניווט שבוע באמצע פונקציה אסינכרונית שממשיכה לקרוא את currentWeek/
  // currentYear הגלובליים מחדש בכל שלב, גורם לערבוב בין שבועות).
  const reqWeek = currentWeek, reqYear = currentYear;

  const { tableId, col, startRow, endRow } = target;
  const dataPrefix = _platoonDataKeyPrefix(info.type);
  const dataKey = `${dataPrefix}_${tableId}_week${reqWeek}_year${reqYear}`;
  const tableData = (await DataService.getItem(dataKey)) || {};

  if (_platoonRangeOccupied(tableData, col, startRow, endRow)) {
    if (overlayEl) overlayEl.style.opacity = '0.82';
    alert('⛔ המשבצת הזו תפוסה - יש לבחור מיקום פנוי אחר.');
    return;
  }

  for (let r = startRow; r <= endRow; r++) {
    tableData[`${r}_${col}`] = (r === startRow)
      ? { val: info.text, span: (endRow - startRow + 1), disp: '', classes: [info.unitClass, 'imported'], reqId: info.reqId }
      : { val: '', span: 1, disp: 'none', classes: [], reqId: null };
  }
  await DataService.setItem(dataKey, tableData);

  const stackedKey = `${_platoonStackedKeyPrefix(info.type)}_${info.sourceTableId}_week${reqWeek}_year${reqYear}`;
  const stackedArr = (await DataService.getItem(stackedKey)) || [];
  await DataService.setItem(stackedKey, stackedArr.filter(s => s.reqId !== info.reqId));

  const loadRequests = info.type === 'hadrag' ? loadHadragRequests : loadShekemRequests;
  const saveRequests = info.type === 'hadrag' ? saveHadragRequests : saveShekemRequests;
  const allRequests = await loadRequests(reqWeek, reqYear);
  const req = allRequests.find(r => r.id === info.reqId);
  if (req) { req.status = 'approved'; await saveRequests(allRequests, reqWeek, reqYear); }

  if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();

  if (info.type === 'hadrag') { await loadHadragTables(currentWeek, currentYear); await renderStackedConflicts('hadrag'); }
  else { await loadShekemTables(currentWeek, currentYear); await renderStackedConflicts('shekem'); }
});

/** מחיקת בקשה ישירות מתוך שכבת ההתנגשות (✕ קטן בפינת ה-overlay) - בלי צורך לגרור אותה קודם. */
document.addEventListener('click', async function(e) {
  const delBtn = e.target.closest('.stacked-conflict-del');
  if (!delBtn) return;
  const overlay = delBtn.closest('.stacked-conflict-overlay');
  if (!overlay) return;
  if (!confirm('למחוק את הבקשה הזו?')) return;
  const type = overlay.dataset.type;
  const reqId = overlay.dataset.reqId;
  if (type === 'hadrag') await deleteHadragRequest(reqId);
  else await deleteShekemRequest(reqId);
});

/* =========================================================
   Excel-like Selection and Resizing Handle
========================================================= */
let activeSelectedCell = null;
let isResizing = false;
let resizeStartCell = null;
let resizeCurrentRow = -1;
let _resizePreviewCells = [];

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
  if (isReadOnlyMode()) return;
  e.preventDefault();
  e.stopPropagation();

  if (!activeSelectedCell) return;

  isResizing = true;
  resizeStartCell = activeSelectedCell;

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

/**
 * מציגה תצוגה מקדימה של טווח שינוי-הגודל, ע"י סימון (outline) על תאי הטבלה האמיתיים
 * בטווח - במקום אלמנט ריחוף (position:absolute) שממוקם ידנית לפי getBoundingClientRect().
 * הגישה הקודמת חישבה מיקום/גודל פעם אחת בכל mousemove ע"פ קואורדינטות מסך, וכשהקונטיינר
 * המכיל את הטבלאות זז (גלילה אופקית פנימית + zoom:70% יחד) המיקום המחושב לא תמיד הספיק
 * להתעדכן בזמן, מה שגרם ל"תיבת תצוגה מקדימה רפאים" שנראתה כאילו שורה/עמודה נוספת נוצרה
 * בטבלה סמוכה (דיווח משתמש + סרטון מסך). סימון ישיר על התאים האמיתיים דרך outline (לא
 * border, כדי לא לשנות את מידות התא/הטבלה) חסין לחלוטין לבעיה הזו - אין חישוב מיקום ידני,
 * רק CSS class על אלמנטים שכבר ממוקמים נכון ע"י מנוע הטבלה של הדפדפן.
 */
function updateResizePreview(e) {
  if (!resizeStartCell) return;

  _resizePreviewCells.forEach(c => c.classList.remove('resize-preview-cell'));
  _resizePreviewCells = [];

  const startRow = parseInt(resizeStartCell.dataset.row);
  let endRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (endRow < startRow) endRow = startRow;

  const tbody = resizeStartCell.closest('tbody');
  const col = parseInt(resizeStartCell.dataset.col);

  for (let r = startRow; r <= endRow; r++) {
    const cell = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
    if (!cell) continue;
    cell.classList.add('resize-preview-cell');
    _resizePreviewCells.push(cell);
  }
}

function clearResizePreview() {
  _resizePreviewCells.forEach(c => c.classList.remove('resize-preview-cell'));
  _resizePreviewCells = [];
}

document.addEventListener('mouseup', function(e) {
  if (!isResizing || !resizeStartCell) return;

  clearResizePreview();

  isResizing = false;

  const startRow = parseInt(resizeStartCell.dataset.row);
  let newEndRow = resizeCurrentRow !== -1 ? resizeCurrentRow : (startRow + resizeStartCell.rowSpan - 1);
  if (newEndRow < startRow) newEndRow = startRow;
  
  const oldSpan = resizeStartCell.rowSpan || 1;
  const newSpan = newEndRow - startRow + 1;
  
  if (newSpan !== oldSpan) {
    const tbody = resizeStartCell.closest('tbody');
    const col = parseInt(resizeStartCell.dataset.col);

    // בהגדלת הבלוק (לא בהקטנה) - יש לבדוק שהשורות הנוספות פנויות, אחרת שינוי הגודל
    // עלול לדרוס בשקט שיבוץ קיים של יחידה אחרת (בשונה מהעברה בגרירה, שכבר בודקת זאת).
    let hasConflict = false;
    if (newSpan > oldSpan) {
      for (let r = startRow + oldSpan; r <= newEndRow; r++) {
        const c = tbody.querySelector(`td.platoon-cell[data-row="${r}"][data-col="${col}"]`);
        if (!c) continue;
        if (c.style.display === 'none') { hasConflict = true; break; }
        const taCheck = c.querySelector('textarea');
        if (taCheck && taCheck.value.trim() !== '') { hasConflict = true; break; }
        if (typeof PERSISTABLE_CELL_CLASSES !== 'undefined' && PERSISTABLE_CELL_CLASSES.some(cls => c.classList.contains(cls))) { hasConflict = true; break; }
      }
    }

    if (hasConflict) {
      alert('לא ניתן לשנות גודל: השטח חופף לשיבוץ קיים. נא לפנות את השעות תחילה.');
    } else {
      const ta = resizeStartCell.querySelector('textarea');
      const dataObj = {
        text: ta ? ta.value : '',
        rowSpan: newSpan,
        cellClass: Array.from(resizeStartCell.classList).filter(c => c !== 'platoon-cell' && c !== 'selected-cell' && c !== 'dragging' && c !== 'conflict-overlap')
      };

      const resizedReqId = clearHadragCellData(resizeStartCell);

      const targetCell = tbody.querySelector(`td.platoon-cell[data-row="${startRow}"][data-col="${col}"]`);
      if (targetCell) {
        pasteOrMoveBlock(targetCell, dataObj);
        selectCell(targetCell);
        if (resizedReqId && typeof relinkGridRequestToCell === 'function') relinkGridRequestToCell(resizedReqId, targetCell);

        if (typeof saveHadragTables === 'function') saveHadragTables();
        if (typeof saveShekemTables === 'function') saveShekemTables();
      }
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
        <div class="ctx-color-dot bg-blocked" data-color="bg-blocked" title="חסום - יחידות לא יוכלו לשבץ כאן"></div>
      </div>
      <div class="ctx-divider"></div>
      <button id="ctx-btn-delete">מחק שיבוץ</button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', menuHTML);
  
  const ctxMenu = document.getElementById('custom-context-menu');
  let currentCtxCell = null;
  
  document.addEventListener('contextmenu', function(e) {
    if (isReadOnlyMode()) return;
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
        cellClass: Array.from(currentCtxCell.classList).filter(c => c !== 'selected-cell' && c !== 'resize-handle' && c !== 'dragging' && c !== 'conflict-overlap')
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
  
  document.getElementById('ctx-btn-delete')?.addEventListener('click', async function(e) {
    e.stopPropagation();
    if (currentCtxCell) {
      const tbodyForDelete = currentCtxCell.closest('tbody');
      const deletedReqId = clearHadragCellData(currentCtxCell);
      clearSelection();
      if (typeof saveHadragTables === 'function') saveHadragTables();
      if (typeof saveShekemTables === 'function') saveShekemTables();
      if (deletedReqId && typeof removeGridRequestLink === 'function') await removeGridRequestLink(deletedReqId, tbodyForDelete);
      if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
    }
    ctxMenu.style.display = 'none';
  });
  
  document.querySelectorAll('.ctx-color-dot').forEach(dot => {
    dot.addEventListener('click', function(e) {
      e.stopPropagation();
      if (currentCtxCell) {
        const colors = ['bg-esuk', 'bg-hirg', 'bg-pikud', 'bg-tazam', 'bg-maphat', 'bg-blocked', 'imported', 'conflict-overlap'];
        colors.forEach(c => currentCtxCell.classList.remove(c));
        currentCtxCell.classList.add(this.dataset.color);
        
        clearSelection();

        if (typeof saveHadragTables === 'function') saveHadragTables();
        if (typeof saveShekemTables === 'function') saveShekemTables();
        if (typeof _recordUndoChangeImmediate === 'function') _recordUndoChangeImmediate();
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
      // בטבלאות המשולבות (קשר/אופטיקה) הקלדה ישירה של המנהל לא אמורה לסמן/לבטל סימון כתום על
      // תא ספציפי - הסימון שם נקבע אך ורק ע"י פעולת ייבוא מתת-טבלת יחידה (importFromSubTable),
      // כדי שהכתום ישקף "יש דרישה מיובאת שטרם הופצה" ולא "המנהל הקליד משהו" (אפיון QA).
      // כן מעדכנים את סטטוס כפתור "הפץ שינויים" (אדום/ירוק) - זהו סממן גלובלי ל"האם יש בכלל
      // משהו שלא הופץ", וצריך לשקף גם עריכה ישירה של המנהל, לא רק ייבוא (אפיון QA).
      if (MASTER_COMBINED_TABLES.includes(tableId)) {
        if (typeof updateGlobalExportButtonStatus === 'function') await updateGlobalExportButtonStatus();
        return;
      }
      if (MANAGER_TRACKED_TABLES.includes(tableId)) {
        const td = e.target.closest('td');
        if (!td) return;

        // מפתח האחסון של השדה (זהה למנגנון readTableData/הפרסום): בטבלאות עם מבנה עמודות דינמי -
        // המפתח הייחודי של השדה; בשאר - אינדקס לפי סדר המסמך בתוך .cell-input (ולא חישוב
        // שורה*עמודה, שמתפספס בטבלאות עם תא נוסף שאינו קלט, כמו עמודת סה"כ).
        const inputDesc = _coDesc(tableId);
        const rowEl = e.target.closest('tr');
        const globalIndex = inputDesc && rowEl
          ? _coKeyFor(inputDesc, e.target, rowEl.sectionRowIndex)
          : Array.from(table.querySelectorAll('.cell-input')).indexOf(e.target);
        if (globalIndex === undefined || globalIndex === null || globalIndex < 0 || Number.isNaN(globalIndex)) return;

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
