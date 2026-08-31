/* =========================================================
   AUTH.JS - התחברות, משתמשים והרשאות (אפיון חלק 3)
   -----------------------------------------------------------
   כניסה למערכת מבוססת מספר אישי (מותאם לקורא כרטיסים המדמה מקלדת).
   מודל ההרשאות לפי האפיון:
     admin    - מנהל: צפייה ועריכה בכל הטבלאות + מסך ניהול הרשאות
     editor   - צפייה ועריכה: כמו מנהל, אך חסום ממסך ניהול ההרשאות
     readonly - צפייה בלבד: ללא עריכה, שמירה או שינוי
     unit     - פלוגתי: עורך אך ורק את עמוד היחידה שלו,
                וצופה בטבלאות המרכזיות בקריאה בלבד
   רשימת המשתמשים נשמרת דרך DataService (localStorage + סנכרון לשרת).
========================================================= */

/**
 * שולפת את פרופיל המשתמש המחובר מ-SharePoint דרך ה-CSOM JS (SP.js/SP.UserProfiles.js) -
 * זהות ה-Windows/AD המאומתת של המשתמש (Smart Card Logon + Windows Integrated Authentication
 * מול SharePoint), בלי הזנת סיסמה נוספת בדפדפן. משמשת את AUTH.tryAutoLoginFromSharePoint()
 * לחילוץ המספר האישי משדה הפרופיל המוגדר ב-CONFIG.SHAREPOINT.PN_PROFILE_KEY.
 * דורשת שהספריות SP.js/SP.Runtime.js/SP.UserProfiles.js/MicrosoftAjax.js (של SharePoint
 * עצמו, נטענות מ-/_layouts/15/) כבר נטענו בעמוד לפני הקריאה - ראו תגי ה-script ב-login.html.
 * @returns {Promise<Object>} מילון תכונות הפרופיל (get_userProfileProperties())
 */
function getCurrUser() {
  return new Promise((resolve, reject) => {
    let clientContext = new SP.ClientContext.get_current();
    let peopleManager = new SP.UserProfiles.PeopleManager(clientContext);
    let userProfileProperties = peopleManager.getMyProperties();
    clientContext.load(userProfileProperties);

    clientContext.executeQueryAsync(
      function (sender, args) {
        // הצלחה
        let employee = userProfileProperties.get_userProfileProperties();
        resolve(employee);
      },
      function (sender, args) {
        // כשל
        reject(args.get_message());
      }
    );
  });
}

/**
 * טוענת סקריפט אחד ומחזירה Promise שנפתר כשהוא נטען (או נכשל).
 */
function loadScriptOnce(src) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

/**
 * טוענת את ספריות ה-CSOM של SharePoint (SP.js וכו', מוגשות תמיד מ-/_layouts/15/ באתר
 * SharePoint עצמו) - ברצף, כי כל ספרייה תלויה בקודמת. נטענות רק כש-AUTO_LOGIN פעיל, כדי
 * לא לגרום ל-404 מיותר בקונסולה בהרצה מקומית/פיתוח (DATA_SOURCE שאינו 'sharepoint').
 * הועברה לכאן (מתוך login.html הישן) - נדרשת כעת בכל עמוד מוגן, לא רק במסך כניסה נפרד.
 */
async function loadSpCsomIfNeeded() {
  const needsSpCsom = typeof CONFIG !== 'undefined'
    && CONFIG.DATA_SOURCE === 'sharepoint'
    && CONFIG.SHAREPOINT.AUTO_LOGIN;
  if (!needsSpCsom) return;
  const urls = [
    '/_layouts/15/init.js',
    '/_layouts/15/MicrosoftAjax.js',
    '/_layouts/15/sp.runtime.js',
    '/_layouts/15/sp.js',
    '/_layouts/15/sp.userprofiles.js'
  ];
  for (const url of urls) {
    await loadScriptOnce(url);
  }
}

const AUTH = {
  USERS_KEY: 'pakadex_users',
  SESSION_KEY: 'pakadex_session',

  /** שמות התפקידים לתצוגה */
  ROLES: {
    admin:    'מנהל',
    editor:   'צפייה ועריכה',
    readonly: 'צפייה בלבד',
    unit:     'פלוגתי / יחידתי'
  },

  /** היחידות במערכת (למשתמש פלוגתי) */
  UNITS: {
    esuk:    'בא"ח איסו"ק',
    hirg:    'בא"ח חיר"ג',
    pikud:   'גדוד הפיקוד',
    tazam:   'ענף תצ"מ',
    bahalag: 'מפח"ט'
  },

  /** מיפוי עמוד יחידה -> מזהה יחידה */
  PAGE_UNIT: {
    'esuk.html':    'esuk',
    'hirg.html':    'hirg',
    'pikud.html':   'pikud',
    'tazam.html':   'tazam',
    'bahalag.html': 'bahalag'
  },

  /* =========================================================
     מאגר המשתמשים
  ========================================================= */

  /** מנהל-על קבוע - חייב להתקיים תמיד במערכת בתור מנהל, גם אם רשימת המשתמשים מתאפסת/נמחקת
      בטעות או בטרם הסתיים סנכרון ראשוני. ראו _ensurePermanentAdmin. */
  PERMANENT_ADMIN: { pn: 's9385538', name: 'ירין שטרית', jobTitle: 'מנהל מערכת', role: 'admin', unit: '' },

  /**
   * מוודאת שמנהל-העל הקבוע (PERMANENT_ADMIN) קיים ברשימה, בתפקיד מנהל ועם השם הנכון - ומתקנת
   * זאת אם צריך (מוסיפה אם חסר, מתקנת תפקיד/שם אם שונו בטעות). לא כותבת בעצמה ל-localStorage/
   * לשרת - זו אחריות הקורא, כדי שלא תתבצע שמירה "מפתיעה" מתוך פונקציית קריאה גרידא.
   * @returns {{list: Array, changed: boolean}}
   */
  _ensurePermanentAdmin(list) {
    const arr = Array.isArray(list) ? list.slice() : [];
    const target = this.PERMANENT_ADMIN;
    const idx = arr.findIndex(u => this.normalizePn(u.pn) === target.pn);
    if (idx === -1) {
      arr.push({ ...target });
      return { list: arr, changed: true };
    }
    if (arr[idx].role !== 'admin' || arr[idx].name !== target.name) {
      arr[idx] = { ...arr[idx], pn: target.pn, role: 'admin', name: target.name };
      return { list: arr, changed: true };
    }
    return { list: arr, changed: false };
  },

  /** קריאה מיידית (סינכרונית) מהמטמון המקומי - תמיד כוללת את מנהל-העל הקבוע (ראו
      _ensurePermanentAdmin), גם אם הוא עדיין לא הגיע למטמון המקומי מהשרת. */
  loadUsers() {
    try {
      const raw = localStorage.getItem(this.USERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return this._ensurePermanentAdmin(Array.isArray(list) ? list : []).list;
    } catch (e) {
      return this._ensurePermanentAdmin([]).list;
    }
  },

  /** שמירה דרך שכבת הסנכרון (מקומי + שרת) */
  saveUsers(list) {
    if (typeof DataService !== 'undefined') {
      DataService.setItem(this.USERS_KEY, list);
    } else {
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(list)); } catch (e) {
        if (typeof window !== 'undefined' && typeof window._handleStorageWriteFailure === 'function') window._handleStorageWriteFailure(e);
      }
    }
  },

  /** רענון רשימת המשתמשים מהשרת (אם מוגדר) - ומוודאת שמנהל-העל הקבוע קיים בה. אם הרשימה
      התקבלה בפועל מהשרת (remote מאומת) והייתה חסרה/שגויה - התיקון גם נכתב חזרה (מקומית +
      לשרת) כדי שיתפשט לכל המכשירים. אם הנפילה היא למטמון המקומי בלבד (השרת לא זמין כרגע) -
      loadUsers() כבר מבטיחה את הרשימה בזיכרון, בלי לכתוב לשרת - כדי לא לדרוס בטעות רשימה
      שלמה יותר שקיימת שם בפועל. */
  async refreshUsers() {
    if (typeof DataService === 'undefined') return this.loadUsers();
    const remote = await DataService.getItem(this.USERS_KEY);
    if (Array.isArray(remote)) {
      const { list: ensured, changed } = this._ensurePermanentAdmin(remote);
      try { localStorage.setItem(this.USERS_KEY, JSON.stringify(ensured)); } catch (e) {
        if (typeof window !== 'undefined' && typeof window._handleStorageWriteFailure === 'function') window._handleStorageWriteFailure(e);
      }
      if (changed) DataService.setItem(this.USERS_KEY, ensured);
      return ensured;
    }
    return this.loadUsers();
  },

  /** נרמול מספר אישי - מתחיל תמיד באות s ואחריה ספרות (למשל s9385538). קורא הכרטיסים/הזנה
      ידנית עשויים לספק רק ספרות (או s גדולה/קטנה) - האות מתווספת/מתוקנת אוטומטית כדי
      שההשוואה תמיד עקבית בין מה שהוזן/נסרק לבין מה ששמור. */
  normalizePn(pn) {
    const digits = String(pn == null ? '' : pn).replace(/\D/g, '');
    return digits ? 's' + digits : '';
  },

  findUser(pn) {
    const clean = this.normalizePn(pn);
    if (!clean) return null;
    return this.loadUsers().find(u => this.normalizePn(u.pn) === clean) || null;
  },

  /**
   * הוספה או עדכון של משתמש.
   * @returns {{ok:boolean, error?:string}}
   */
  saveUser(user) {
    const pn = this.normalizePn(user.pn);
    if (!pn) return { ok: false, error: 'מספר אישי חייב להכיל ספרות.' };
    if (!this.ROLES[user.role]) return { ok: false, error: 'הרשאה לא חוקית.' };
    // תפקיד בפועל של האדם (למשל "מ"פ", "רס"פ", "קצין קשר") - נפרד לגמרי מהרשאת הגישה
    // (role) לאפליקציה - בקשת המפקדים: לדעת מי כל אחד מהאנשים ברשימה, לא רק איזו הרשאה יש לו.
    const jobTitle = (user.jobTitle || '').trim();
    if (!jobTitle) return { ok: false, error: 'יש למלא תפקיד עבור המשתמש.' };

    // תמיכה בהרשאה לכמה יחידות בו-זמנית (למשל גם מפח"ט וגם גדוד הפיקוד).
    const units = Array.isArray(user.unit) ? user.unit : (user.unit ? [user.unit] : []);
    const validUnits = units.filter(u => this.UNITS[u]);
    if (user.role === 'unit' && validUnits.length === 0) {
      return { ok: false, error: 'למשתמש פלוגתי יש לבחור לפחות יחידה אחת.' };
    }

    const record = {
      pn,
      name: (user.name || '').trim(),
      jobTitle,
      role: user.role,
      unit: user.role === 'unit' ? validUnits : []
    };

    const list = this.loadUsers();
    const idx = list.findIndex(u => this.normalizePn(u.pn) === pn);
    if (idx >= 0) list[idx] = record; else list.push(record);
    this.saveUsers(list);
    return { ok: true, user: record };
  },

  /**
   * הסרת משתמש. לא ניתן להסיר את מנהל-העל הקבוע (PERMANENT_ADMIN), וגם לא את המנהל האחרון
   * הנותר במערכת (כדי לא לנעול אותה).
   */
  removeUser(pn) {
    const clean = this.normalizePn(pn);
    if (clean === this.PERMANENT_ADMIN.pn) {
      return { ok: false, error: 'לא ניתן להסיר את מנהל-העל הקבוע של המערכת.' };
    }
    const list = this.loadUsers();
    const target = list.find(u => this.normalizePn(u.pn) === clean);
    if (!target) return { ok: false, error: 'משתמש לא נמצא.' };

    if (target.role === 'admin' && list.filter(u => u.role === 'admin').length <= 1) {
      return { ok: false, error: 'לא ניתן להסיר את המנהל האחרון במערכת.' };
    }

    this.saveUsers(list.filter(u => this.normalizePn(u.pn) !== clean));
    return { ok: true };
  },

  /* =========================================================
     סשן
  ========================================================= */

  getSession() {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setSession(user) {
    try { sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user)); } catch (e) {}
  },

  clearSession() {
    try { sessionStorage.removeItem(this.SESSION_KEY); } catch (e) {}
  },

  /**
   * התחברות לפי מספר אישי.
   * אתחול ראשוני: אם מאגר המשתמשים ריק, המשתמש הראשון שנכנס מוגדר כמנהל.
   *
   * חשוב (מצב שרת מרוחק - SharePoint/רשת צבאית): הפונקציה תמיד מרעננת קודם את רשימת
   * המשתמשים מהשרת (await refreshUsers) לפני שהיא מחליטה אם המאגר "ריק". בלי זה, במכשיר
   * חדש שעדיין לא הספיק לסנכרן (למשל אם המשתמש מקליד/מעביר כרטיס מהר מאוד עם טעינת העמוד),
   * loadUsers() המקומי-בלבד היה רואה מאגר ריק ו"מאתחל" את המכשיר הזה כמנהל חדש - מה שדורס
   * בפועל את כל רשימת המשתמשים האמיתית על השרת (saveUsers עושה overwrite מלא). הפונקציה
   * הפכה לאסינכרונית בגלל זה - כל קריאה ל-AUTH.login() חייבת עכשיו await.
   * @returns {Promise<{ok:boolean, error?:string, user?:object, bootstrapped?:boolean}>}
   */
  async login(pn) {
    const clean = this.normalizePn(pn);
    if (!clean) return { ok: false, error: 'יש להזין מספר אישי.' };

    const users = await this.refreshUsers();

    if (users.length === 0) {
      const admin = { pn: clean, name: 'מנהל ראשי', jobTitle: 'מנהל מערכת', role: 'admin', unit: '' };
      this.saveUsers([admin]);
      this.setSession(admin);
      return { ok: true, user: admin, bootstrapped: true };
    }

    const user = this.findUser(clean);
    if (!user) {
      return { ok: false, error: 'המספר האישי אינו מורשה לגישה. יש לפנות למנהל המערכת.' };
    }

    this.setSession(user);
    return { ok: true, user };
  },

  /** אין יותר עמוד כניסה נפרד - חוזרים ל-index.html, ומסך הזיהוי (_renderAuthGate) יעלה
      שם אוטומטית כי אין סשן פעיל (ראו requireAuth). */
  logout() {
    this.clearSession();
    window.location.href = 'index.html';
  },

  /**
   * ניסיון התחברות אוטומטית לפי זהות ה-Windows/AD המאומתת של המשתמש דרך SharePoint
   * (מפל"ז מבצע Smart Card Logon ל-Windows; SharePoint מאמת את הסשן אוטומטית מולו
   * דרך Windows Integrated Authentication - אין צורך בהזנת סיסמה נוספת בדפדפן).
   * פועל רק כאשר CONFIG.DATA_SOURCE === 'sharepoint' וכן CONFIG.SHAREPOINT.AUTO_LOGIN === true.
   * בכל מקרה כשל (לא בתוך SharePoint, שדה לא מוגדר, המספר לא נמצא ברשימת המשתמשים וכו')
   * מחזירה {ok:false} כדי לאפשר נפילה חזרה להזנה ידנית/קורא כרטיסים - לעולם לא "מנחשת" משתמש.
   * @returns {Promise<{ok:boolean, user?:object, error?:string}>}
   */
  async tryAutoLoginFromSharePoint() {
    if (typeof CONFIG === 'undefined' || CONFIG.DATA_SOURCE !== 'sharepoint') {
      return { ok: false, error: 'not-sharepoint' };
    }
    if (!CONFIG.SHAREPOINT.AUTO_LOGIN) {
      return { ok: false, error: 'auto-login-disabled' };
    }
    const propKey = CONFIG.SHAREPOINT.PN_PROFILE_KEY;
    if (!propKey) {
      console.warn('[AUTH] AUTO_LOGIN מופעל אך CONFIG.SHAREPOINT.PN_PROFILE_KEY אינו מוגדר.');
      return { ok: false, error: 'no-profile-key-configured' };
    }

    if (typeof SP === 'undefined' || typeof SP.UserProfiles === 'undefined') {
      console.warn('[AUTH] ספריות ה-CSOM של SharePoint (SP.js/SP.UserProfiles.js) לא נטענו בעמוד.');
      return { ok: false, error: 'sp-csom-not-loaded' };
    }

    try {
      // get_userProfileProperties() מחזירה מילון {שם-שדה: ערך} - לא מערך {Key,Value} כמו ב-REST
      // API; שומרים תמיכה גם במערך למקרה שהצורה תשתנה בגרסת CSOM אחרת.
      const employee = await getCurrUser();
      let rawValue = '';
      if (Array.isArray(employee)) {
        const entry = employee.find(p => p.Key === propKey);
        rawValue = entry ? entry.Value : '';
      } else if (employee && typeof employee === 'object') {
        rawValue = employee[propKey] || '';
      }
      const pn = this.normalizePn(rawValue);
      if (!pn) {
        return { ok: false, error: 'pn-not-found-in-profile' };
      }

      // login() בודק מול רשימת המשתמשים המורשית - אם המספר לא רשום, מוחזר ok:false כרגיל
      // (ולא נוצר "מנהל" חדש אוטומטית - bootstrap הראשוני חל רק בזרימת הכניסה הידנית).
      const user = this.findUser(pn);
      if (!user) {
        return { ok: false, error: 'pn-not-authorized' };
      }
      this.setSession(user);
      return { ok: true, user };
    } catch (e) {
      console.error('[AUTH] getCurrUser (SharePoint CSOM) נכשלה:', e);
      return { ok: false, error: 'csom-error' };
    }
  },

  /* =========================================================
     בדיקות הרשאה
  ========================================================= */

  currentPage() {
    const raw = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    return raw.split('?')[0].split('#')[0] || 'index.html';
  },

  role() {
    const s = this.getSession();
    return s ? s.role : null;
  },

  isAdmin() { return this.role() === 'admin'; },

  /** גישה למסך ניהול ההרשאות - מנהל בלבד */
  canManageUsers() { return this.isAdmin(); },

  /**
   * האם למשתמש המחובר יש הרשאת עריכה בעמוד הנתון.
   * @param {string} [page] - שם קובץ העמוד; ברירת מחדל: העמוד הנוכחי
   */
  canEditPage(page) {
    const s = this.getSession();
    if (!s) return false;
    const p = (page || this.currentPage()).toLowerCase();

    if (s.role === 'admin' || s.role === 'editor') return true;
    if (s.role === 'readonly') return false;

    if (s.role === 'unit') {
      // פלוגה עורכת אך ורק את עמודי היחידות שהוקצו לה (ייתכן יותר מיחידה אחת)
      const units = Array.isArray(s.unit) ? s.unit : (s.unit ? [s.unit] : []);
      return units.includes(this.PAGE_UNIT[p]);
    }
    return false;
  },

  /**
   * האם למשתמש המחובר מותר בכלל *לצפות* בעמוד יחידה נתון (esuk.html וכו').
   * בשונה מ-canEditPage (שרק קובעת אם שדות הקלט נעולים), הבדיקה הזו חוסמת גישה מוחלטת -
   * חשוב כי לינק ישיר ל-URL של עמוד יחידה אחרת (לא רק כפתור מוסתר בתפריט) לא היה חסום כלל,
   * ומשתמש פלוגתי יכול היה לצפות בנתונים הפרטיים של יחידה שאינה שלו (פרצת הרשאות).
   * @param {string} [page] - שם קובץ העמוד; ברירת מחדל: העמוד הנוכחי
   */
  canViewUnitPage(page) {
    const s = this.getSession();
    if (!s) return false;
    const p = (page || this.currentPage()).toLowerCase();
    const unitKey = this.PAGE_UNIT[p];
    if (!unitKey) return true; // לא עמוד יחידה בכלל - הבדיקה הזו לא רלוונטית
    if (s.role !== 'unit') return true; // מנהל/עורך/צפייה-בלבד רואים הכל
    const units = Array.isArray(s.unit) ? s.unit : (s.unit ? [s.unit] : []);
    return units.includes(unitKey);
  },

  /** תיאור התפקיד לתצוגה (כולל שמות היחידות לפלוגתי) */
  roleLabel(user) {
    const u = user || this.getSession();
    if (!u) return '';
    if (u.role === 'unit') {
      const units = Array.isArray(u.unit) ? u.unit : (u.unit ? [u.unit] : []);
      const names = units.map(x => this.UNITS[x]).filter(Boolean).join(', ');
      return `${this.ROLES.unit} – ${names}`;
    }
    return this.ROLES[u.role] || '';
  },

  /**
   * שומר כניסה: אם אין סשן פעיל, מציגה את מסך הזיהוי *מעל העמוד הנוכחי* (ראו
   * _renderAuthGate) במקום לנווט לעמוד כניסה נפרד - כדי שזיהוי (כרטיס חוגר בקורא/SSO)
   * יקרה אוטומטית ברקע בלי שום פעולה של המשתמש, בלי תלות בעמוד ספציפי שנטען קודם.
   * @returns {object|null} המשתמש המחובר, או null אם מסך הזיהוי מוצג
   */
  requireAuth() {
    const s = this.getSession();
    if (!s) {
      this._renderAuthGate();
      return null;
    }
    return s;
  },

  /**
   * מציגה שכבה מלאה מעל העמוד הנוכחי (במקום עמוד login.html נפרד שהוסר) שמזהה את המשתמש
   * בשתי דרכים, שתיהן רצות אוטומטית בלי שום קליק:
   *   1. SSO/CSOM - זהות ה-Windows המאומתת (ראו tryAutoLoginFromSharePoint).
   *   2. קורא כרטיסי חוגר - מכשיר שמדמה מקלדת; מספיק ששדה הקלט יהיה ממוקד (autofocus,
   *      וממוקד-מחדש בכל קליק) כדי שהתווים שהוא "מקליד" בזמן שהכרטיס מוכנס יתקבלו וישלחו
   *      אוטומטית ב-Enter - בלי שהמשתמש צריך ללחוץ על כלום בעצמו.
   * שדה הקלט *לא* ננעל בזמן ניסיון ה-SSO (בניגוד למימוש הקודם) - כדי שקריאת כרטיס/הקלדה
   * שמגיעה בול באותו הרגע לא תיבלע בשקט.
   * @param {Function} [onSuccess] - נקראת אחרי כניסה מוצלחת; ברירת מחדל: רענון העמוד
   */
  _renderAuthGate(onSuccess) {
    if (document.getElementById('pakadexAuthGate')) return; // כבר מוצג - לא כופלים

    const style = document.createElement('style');
    style.id = 'pakadexAuthGateStyle';
    style.textContent = `
      #pakadexAuthGate { position:fixed; inset:0; z-index:99999; display:flex; align-items:center; justify-content:center;
        background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }
      #pakadexAuthGate .login-card { width:380px; max-width:92vw; background:#ffffff; border-radius:16px;
        box-shadow:0 25px 50px rgba(0,0,0,0.35); padding:34px 30px 28px; text-align:center; }
      #pakadexAuthGate .login-logo { font-family:'Montserrat', sans-serif; font-weight:800; font-size:36px; color:#0f172a; letter-spacing:1px; }
      #pakadexAuthGate .login-sub { color:#64748b; font-weight:600; margin:2px 0 24px; font-size:14px; }
      #pakadexAuthGate .login-label { display:block; text-align:right; font-weight:700; margin-bottom:6px; color:#0f172a; font-size:14px; }
      #pakadexAuthGate .login-input { width:100%; height:52px; font-size:24px; font-weight:800; text-align:center;
        border:2px solid #e2e8f0; border-radius:10px; outline:none; letter-spacing:3px; font-family:inherit;
        transition:border-color 0.15s; box-sizing:border-box; }
      #pakadexAuthGate .login-input:focus { border-color:#0284c7; box-shadow:0 0 0 3px rgba(2,132,199,0.15); }
      #pakadexAuthGate .login-btn { width:100%; height:48px; margin-top:16px; border:none; border-radius:10px;
        background:linear-gradient(135deg, #0284c7, #0369a1); color:#fff; font-size:17px; font-weight:800;
        font-family:inherit; cursor:pointer; transition:all 0.2s; }
      #pakadexAuthGate .login-btn:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(2,132,199,0.35); }
      #pakadexAuthGate .login-error { color:#b91c1c; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px;
        font-weight:700; font-size:13.5px; margin-top:14px; padding:9px 12px; display:none; }
      #pakadexAuthGate .login-hint { color:#92400e; background:#fef3c7; border:1px solid #fcd34d; border-radius:8px;
        font-size:12.5px; font-weight:700; margin-top:16px; padding:9px 12px; display:none; }
      #pakadexAuthGate .card-note { color:#94a3b8; font-size:12px; margin-top:18px; }
    `;
    document.head.appendChild(style);

    const gate = document.createElement('div');
    gate.id = 'pakadexAuthGate';
    gate.setAttribute('dir', 'rtl');
    gate.innerHTML = `
      <div class="login-card">
        <div class="login-logo">PAKADEX</div>
        <div class="login-sub">מערכת ניהול משאבים ותיאומים</div>
        <label class="login-label" for="pakadexGatePnInput">מספר אישי</label>
        <input type="text" id="pakadexGatePnInput" class="login-input" inputmode="numeric" autocomplete="off"
               placeholder="הזן מספר אישי" autofocus>
        <button type="button" class="login-btn" id="pakadexGateBtn">כניסה למערכת ➔</button>
        <div id="pakadexGateError" class="login-error"></div>
        <div id="pakadexGateHint" class="login-hint"></div>
        <div class="card-note">💳 ניתן להעביר כרטיס חוגר בקורא — הקריאה תתבצע אוטומטית</div>
      </div>
    `;
    document.body.appendChild(gate);

    const pnInput = document.getElementById('pakadexGatePnInput');
    const errEl = document.getElementById('pakadexGateError');
    const hintEl = document.getElementById('pakadexGateHint');

    const finish = () => {
      gate.remove();
      style.remove();
      if (typeof onSuccess === 'function') onSuccess(); else window.location.reload();
    };

    const showError = (msg) => {
      errEl.textContent = msg;
      errEl.style.display = 'block';
      pnInput.select();
    };

    const refreshHint = () => {
      if (this.loadUsers().length === 0) {
        hintEl.textContent = 'התחברות ראשונה: המספר האישי הראשון שיוזן יוגדר אוטומטית כמנהל המערכת.';
        hintEl.style.display = 'block';
      } else {
        hintEl.style.display = 'none';
      }
    };

    let loginInFlight = false;
    const attemptLogin = async () => {
      if (loginInFlight) return;
      errEl.style.display = 'none';
      loginInFlight = true;
      pnInput.disabled = true;
      try {
        const res = await this.login(pnInput.value);
        if (res.ok) { finish(); return; }
        showError(res.error || 'שגיאת התחברות.');
      } finally {
        loginInFlight = false;
        pnInput.disabled = false;
        pnInput.focus();
      }
    };

    pnInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); attemptLogin(); }
    });
    document.getElementById('pakadexGateBtn').addEventListener('click', attemptLogin);
    // ניקוי תווים שאינם ספרות (קורא הכרטיסים עלול לשלוח תווי בקרה)
    pnInput.addEventListener('input', () => {
      const clean = pnInput.value.replace(/\D/g, '');
      if (clean !== pnInput.value) pnInput.value = clean;
    });
    // שמירה על הפוקוס בשדה כדי שקריאת כרטיס תיקלט תמיד
    gate.addEventListener('click', () => pnInput.focus());
    pnInput.focus();
    refreshHint();

    // ניסיון SSO ברקע - לא חוסם/נועל את השדה, כדי שקריאת כרטיס במקביל לא תיבלע
    (async () => {
      if (typeof this.tryAutoLoginFromSharePoint !== 'function') return;
      try { if (typeof DataService !== 'undefined') await this.refreshUsers(); } catch (e) {}
      await loadSpCsomIfNeeded();
      const res = await this.tryAutoLoginFromSharePoint();
      if (res.ok) finish();
    })();
  }
};
