/* =========================================================
   SHAREPOINTSERVICE.JS - שכבת ניהול הנתונים והסנכרון של PAKADEX
   ========================================================= */

const DataService = {
  // מטמון מקומי בזיכרון לגישה מהירה
  _cache: {},
  // חסימה זמנית (לא לצמיתות!) של ניסיונות SharePoint אחרי 401 - שומרת חותמת זמן שעד אליה
  // נופלים בשקט ל-localStorage, ולא דגל בוליאני קבוע. 401 יכול לקרות מסיבה חולפת (חידוש
  // טוקן, הפרעת רשת רגעית) - דגל קבוע היה משתיק את הסנכרון (גם קריאה וגם כתיבה!) לגמרי
  // עד רענון ידני של הדף, בלי שהמשתמש בהכרח שם לב שזה קרה (אפיון QA: "האתר יעבוד מושלם").
  _sharePointDisabledUntil: 0,
  SP_DISABLE_COOLDOWN_MS: 60000,
  _isSharePointDisabled() {
    return Date.now() < this._sharePointDisabledUntil;
  },
  _disableSharePointTemporarily() {
    this._sharePointDisabledUntil = Date.now() + this.SP_DISABLE_COOLDOWN_MS;
  },

  // --- מנגנון סנכרון היברידי (אפיון חלק 2) ---
  _syncQueue: {},                       // מפתח -> נתונים שממתינים לסנכרון לשרת
  _syncQueueKey: 'pakadex_sync_queue',  // התור נשמר גם ב-localStorage לשרידות רענון
  _lastSyncTs: null,
  _syncing: false,

  /** האם מוגדר שרת מרכזי (SharePoint / רשת צבאית) */
  _isRemote() {
    return CONFIG.DATA_SOURCE === 'sharepoint' || CONFIG.DATA_SOURCE === 'military_net';
  },

  /**
   * מקודדת נתיב שרת (server-relative URL) לשימוש בטוח בתוך פונקציית OData כמו
   * GetFileByServerRelativeUrl('...') - מקודדת כל מקטע בנפרד (לא את ה-'/' עצמו), כדי
   * שתווים מיוחדים בשם תיקייה/קובץ (עברית, רווחים, גרשיים) לא ישברו את התחביר של קריאת
   * ה-REST (במיוחד גרש בודד ' שהיה מסיים את המחרוזת המצוטטת של הפונקציה באמצע השם).
   */
  _encodeSpPath(path) {
    return String(path).split('/').map(seg => encodeURIComponent(seg)).join('/');
  },

  /** שמירה בפועל מול השרת המרכזי המתאים */
  async _remoteSave(key, data) {
    if (CONFIG.DATA_SOURCE === 'sharepoint') return await this._saveToSharePoint(key, data);
    if (CONFIG.DATA_SOURCE === 'military_net') return await this._saveToMilitaryNet(key, data);
    return true;
  },

  /**
   * טעינת נתונים לפי מפתח (Key)
   */
  async getItem(key) {
    if (CONFIG.DATA_SOURCE === 'sharepoint') {
      return await this._loadFromSharePoint(key);
    } else if (CONFIG.DATA_SOURCE === 'military_net') {
      return await this._loadFromMilitaryNet(key);
    } else {
      // ברירת מחדל: LocalStorage
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  },

  /**
   * שמירת נתונים לפי מפתח (Key) - מנגנון היברידי (אפיון חלק 2):
   * 1. שמירה מקומית מיידית ב-localStorage (גיבוי + מהירות תגובה).
   * 2. במצב שרת: ניסיון סנכרון אסינכרוני; כשל -> הכנסה לתור לניסיון חוזר.
   */
  async setItem(key, data) {
    // מעדכנים קודם כל במטמון וב-localStorage לגיבוי (סינכרוני, לפני כל await)
    this._cache[key] = data;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
      // מציגה אזהרה גלויה למשתמש (במקום לבלוע את הכשל בשקט) - ראו _handleStorageWriteFailure
      // ב-script.js. script.js נטען אחרי הקובץ הזה, אבל setItem תמיד נקראת בזמן ריצה
      // (בתגובה לפעולת משתמש), אז הפונקציה כבר מוגדרת גלובלית עד אז.
      if (typeof window !== 'undefined' && typeof window._handleStorageWriteFailure === 'function') {
        window._handleStorageWriteFailure(e);
      }
    }

    if (!this._isRemote()) return true;

    let ok = false;
    if (navigator.onLine) {
      ok = await this._remoteSave(key, data);
    }
    if (ok) {
      this._lastSyncTs = Date.now();
      this._dequeue(key);
    } else {
      this._enqueue(key, data);
    }
    this._notifyStatus();
    return ok;
  },

  /* ---------- תור סנכרון (Offline Queue) ---------- */
  _loadQueue() {
    try { return JSON.parse(localStorage.getItem(this._syncQueueKey) || '{}'); }
    catch (e) { return {}; }
  },
  _persistQueue() {
    try { localStorage.setItem(this._syncQueueKey, JSON.stringify(this._syncQueue)); } catch (e) {}
  },
  _enqueue(key, data) {
    this._syncQueue[key] = data;
    this._persistQueue();
  },
  _dequeue(key) {
    if (Object.prototype.hasOwnProperty.call(this._syncQueue, key)) {
      delete this._syncQueue[key];
      this._persistQueue();
    }
  },
  pendingCount() { return Object.keys(this._syncQueue).length; },

  /** מנסה לשלוח את כל הפריטים הממתינים בתור לשרת */
  async flushQueue() {
    if (this._syncing || !this._isRemote() || !navigator.onLine || this._isSharePointDisabled()) return;
    this._syncing = true;
    try {
      const keys = Object.keys(this._syncQueue);
      for (const key of keys) {
        const ok = await this._remoteSave(key, this._syncQueue[key]);
        if (ok) { this._dequeue(key); this._lastSyncTs = Date.now(); }
        else break; // כנראה מנותקים - נעצור וננסה שוב בסבב הבא
      }
    } finally {
      this._syncing = false;
      this._notifyStatus();
    }
  },

  /** מחזיר את מצב הסנכרון הנוכחי (לחיווי בממשק) */
  getSyncStatus() {
    return {
      remote: this._isRemote(),
      online: navigator.onLine,
      pending: this.pendingCount(),
      lastSync: this._lastSyncTs,
      disabled: this._isSharePointDisabled()
    };
  },

  _notifyStatus() {
    if (typeof window !== 'undefined' && typeof window.updateSyncIndicator === 'function') {
      try { window.updateSyncIndicator(); } catch (e) {}
    }
  },

  /**
   * טעינה מ-SharePoint REST API
   */
  async _loadFromSharePoint(key) {
    if (this._isSharePointDisabled()) {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }

    const fileName = `${key}.txt`;
    // רשימת נתיבי-גיבוי לדוגמה (placeholder) הוסרה - הנתיב האמיתי מוגדר עכשיו ב-
    // CONFIG.SHAREPOINT.FOLDER_PATH, ונתיבי הדוגמה הישנים ('PakadexData/PakadexData')
    // תמיד היו נכשלים בכל מקרה מול השרת האמיתי (404 מיותר בכל טעינה).
    const uniquePaths = [CONFIG.SHAREPOINT.FOLDER_PATH].filter(Boolean);

    for (const folderPath of uniquePaths) {
      const url = `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/GetFileByServerRelativeUrl('${this._encodeSpPath(folderPath + '/' + fileName)}')/$value`;

      try {
        const headers = { 'Accept': 'application/json;odata=verbose' };

        const response = await fetch(url, { 
          method: 'GET', 
          headers,
          credentials: 'same-origin'
        });

        if (response.ok) {
          const data = await response.json();
          this._cache[key] = data;
          // כותבים גם ל-localStorage (לא רק ל-_cache בזיכרון) - קוד רב באפליקציה קורא נתונים
          // דרך localStorage.getItem ישיר (לביצועים, למשל בזמן הקלדה) ולא דרך DataService/
          // fetchTableData בכל מקום; בלי הכתיבה הזו, שליפה מוצלחת מ-SharePoint הייתה נשארת
          // "תקועה" רק ב-_cache הזמני (נמחק ברענון עמוד) ואף פעם לא נראית לקוד שקורא ישירות
          // מ-localStorage - כלומר נתונים ששמור מכשיר אחר היו "נעלמים" עד לכתיבה מקומית מפורשת.
          try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
          return data;
        }

        if (response.status === 401) {
          if (!this._isSharePointDisabled()) {
            const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
            const msg = isLocal
              ? `[SharePoint] 401: הרצה מקומית ב-${location.hostname} (מעבר שקט ל-localStorage cache למשך דקה).`
              : `[SharePoint] 401 Unauthorized: שגיאת הרשאה מול SharePoint במיקום ${location.hostname} (מעבר שקט ל-localStorage cache למשך דקה).`;
            console.info(msg);
            this._disableSharePointTemporarily();
          }
          break;
        }
      } catch (error) {
        // ממשיכים לנתיב הבא
      }
    }

    // אם לא נמצא ב-SharePoint, חוזרים ל-cache ב-localStorage
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  },

  /**
   * משיכת FormDigestValue מ-SharePoint לאימות בקשות POST
   */
  async getFormDigest() {
    const elem = document.getElementById('__REQUESTDIGEST');
    if (elem && elem.value) return elem.value;
    try {
      const res = await fetch(`${CONFIG.SHAREPOINT.SITE_URL}/_api/contextinfo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json;odata=verbose' },
        credentials: 'same-origin'
      });
      if (res.ok) {
        const data = await res.json();
        return data.d?.GetContextWebInformation?.FormDigestValue || '';
      }
    } catch (e) {
      console.warn('[SharePoint] Could not fetch FormDigest:', e);
    }
    return '';
  },

  /**
   * מחפשת משתמש ב-SharePoint (People Picker - אותו מנגנון בדיוק שמפעילה תיבת "הוסף
   * חברים" הרגילה בממשק הרשאות האתר) לפי מספר אישי/שם, ומוסיפה אותו לקבוצת הרשאות
   * העריכה של האתר. נועדה לפתור בעיה חוזרת: הוספת משתמש ברשימה הפנימית של PAKADEX
   * (users.html) לא מעניקה בפועל גישה ל-SharePoint עצמו - אלה שתי מערכות הרשאה
   * נפרדות לחלוטין, וזה גרם כמה פעמים ל"Access Denied" אצל משתמשים שנוספו רק
   * ב"אתר שלנו". הפעולה דורשת שלמשתמש המחובר שמריץ אותה תהיה בעצמו הרשאת "ניהול
   * הרשאות" באתר (Owner/Full Control) - אחרת השרת מחזיר 403 והפונקציה נכשלת בשקט
   * (הקוראים לה צריכים להציג הודעה ולהנחות הוספה ידנית כגיבוי).
   * @param {string} query - מספר אישי או שם לחיפוש ב-SharePoint
   * @param {string} [groupName] - שם קבוצת ה-SharePoint; ברירת מחדל CONFIG.SHAREPOINT.EDITOR_GROUP_NAME
   * @returns {Promise<{ok:boolean, error?:string, matchedName?:string}>}
   */
  async addUserToSharePointGroup(query, groupName) {
    if (typeof CONFIG === 'undefined' || CONFIG.DATA_SOURCE !== 'sharepoint') {
      return { ok: false, error: 'not-sharepoint' };
    }
    const group = groupName || CONFIG.SHAREPOINT.EDITOR_GROUP_NAME;
    if (!group) return { ok: false, error: 'no-group-configured' };
    if (!query || !String(query).trim()) return { ok: false, error: 'empty-query' };

    const digest = await this.getFormDigest();
    if (!digest) return { ok: false, error: 'no-digest' };

    // שלב 1: פתירת המחרוזת לזהות Claims מלאה (למשל i:0#.w|domain\username) - בלי זה
    // אי אפשר לדעת את שם הדומיין/פורמט ה-claims של הפרמה הספציפית מבלי לתחזק אותו
    // בקונפיג בנפרד; ה-People Picker כבר עושה את זה נכון בכל פריסה.
    let resolvedKey, matchedName;
    try {
      const searchUrl = `${CONFIG.SHAREPOINT.SITE_URL}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`;
      const searchRes = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          queryParams: {
            __metadata: { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
            AllowEmailAddresses: true,
            AllowMultipleEntities: false,
            AllUrlZones: false,
            MaximumEntitySuggestions: 5,
            PrincipalSource: 15,
            PrincipalType: 1,
            QueryString: String(query).trim()
          }
        })
      });
      if (!searchRes.ok) return { ok: false, error: `people-picker-http-${searchRes.status}` };
      const searchData = await searchRes.json();
      const rawResults = searchData.d && searchData.d.ClientPeoplePickerSearchUser;
      const results = rawResults ? JSON.parse(rawResults) : [];
      if (!results.length) return { ok: false, error: 'user-not-found-in-sharepoint' };
      resolvedKey = results[0].Key;
      matchedName = results[0].DisplayText || results[0].Description || String(query);
    } catch (e) {
      return { ok: false, error: 'people-picker-failed' };
    }

    // שלב 2: הוספה בפועל לקבוצה עם הזהות שנפתרה - קריאה זו גם "מבטיחה" (ensures) את
    // המשתמש ברשימת המשתמשים של האתר וגם מוסיפה אותו לקבוצה, בקריאה אחת.
    // חשוב: פונים לקבוצה לפי מספר ה-ID שלה (sitegroups(ID)) ולא לפי getbyname('<שם
    // בעברית>') - שם קבוצה בעברית בתוך נתיב ה-URL עצמו (בניגוד לגוף הבקשה, ששם עברית
    // תמיד בטוחה) נכשל עם 500 באתר הצבאי המסווג הזה, ככל הנראה בגלל חסימת "high-bit
    // characters" ב-URL ברמת ה-IIS/WAF (אפיון QA בפועל). _resolveGroupId פותרת את השם
    // למספר פעם אחת (קריאת GET רגילה, בלי השם בתוך ה-URL) ושומרת אותו במטמון.
    try {
      const groupId = await this._resolveGroupId(group, digest);
      const addUrl = groupId !== null
        ? `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/sitegroups(${groupId})/users`
        : `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/sitegroups/getbyname('${encodeURIComponent(group)}')/users`;
      const addRes = await fetch(addUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': digest
        },
        credentials: 'same-origin',
        body: JSON.stringify({ __metadata: { type: 'SP.User' }, LoginName: resolvedKey })
      });
      if (!addRes.ok) {
        if (addRes.status === 403) return { ok: false, error: 'no-permission-to-manage-group' };
        return { ok: false, error: `add-http-${addRes.status}` };
      }
      return { ok: true, matchedName };
    } catch (e) {
      return { ok: false, error: 'add-failed' };
    }
  },

  _groupIdCache: {},

  /**
   * פותרת שם קבוצת SharePoint למספר ה-ID המספרי שלה, דרך רשימת כל קבוצות האתר
   * (_api/web/sitegroups - כתובת ASCII קבועה; השם בעברית מגיע רק בתוך גוף התשובה,
   * לא בתוך ה-URL של הבקשה) - כדי לאפשר קריאת sitegroups(ID) שאינה תלויה בכלל בשם
   * הקבוצה בתוך נתיב ה-URL. מוחזר null אם הקבוצה לא נמצאה או שהקריאה נכשלה, ואז
   * הקוד הקורא נופל בחזרה לנתיב getbyname הישן.
   * @returns {Promise<number|null>}
   */
  async _resolveGroupId(groupName, digest) {
    if (Object.prototype.hasOwnProperty.call(this._groupIdCache, groupName)) {
      return this._groupIdCache[groupName];
    }
    try {
      const res = await fetch(`${CONFIG.SHAREPOINT.SITE_URL}/_api/web/sitegroups`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json;odata=verbose',
          'X-RequestDigest': digest
        },
        credentials: 'same-origin'
      });
      if (!res.ok) { this._groupIdCache[groupName] = null; return null; }
      const data = await res.json();
      const list = (data.d && data.d.results) || [];
      const match = list.find(g => g.Title === groupName);
      const id = match ? match.Id : null;
      this._groupIdCache[groupName] = id;
      return id;
    } catch (e) {
      this._groupIdCache[groupName] = null;
      return null;
    }
  },

  /**
   * שמירה ל-SharePoint REST API (File Upload / Overwrite)
   */
  async _saveToSharePoint(key, data) {
    if (this._isSharePointDisabled()) {
      return false;
    }

    const fileName = `${key}.txt`;
    const uniquePaths = [CONFIG.SHAREPOINT.FOLDER_PATH].filter(Boolean);
    const digest = await this.getFormDigest();

    for (const folderPath of uniquePaths) {
      const url = `${CONFIG.SHAREPOINT.SITE_URL}/_api/web/GetFolderByServerRelativeUrl('${this._encodeSpPath(folderPath)}')/Files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;

      try {
        const headers = {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;charset=utf-8'
        };
        if (digest) {
          headers['X-RequestDigest'] = digest;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          credentials: 'same-origin',
          body: JSON.stringify(data)
        });

        if (response.ok) {
          return true;
        }

        if (response.status === 401) {
          if (!this._isSharePointDisabled()) {
            const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
            const msg = isLocal
              ? `[SharePoint] 401: הרצה מקומית ב-${location.hostname} (שמירה ב-localStorage למשך דקה).`
              : `[SharePoint] 401 Unauthorized: שגיאת הרשאה מול SharePoint במיקום ${location.hostname} (שמירה ב-localStorage למשך דקה).`;
            console.info(msg);
            this._disableSharePointTemporarily();
          }
          break;
        }
      } catch (error) {
        // ממשיכים לנתיב הבא
      }
    }

    console.error(`[SharePoint] Failed to save ${key} to SharePoint folders.`);
    return false;
  },

  /**
   * טעינה משרת API ברשת הצבאית
   */
  async _loadFromMilitaryNet(key) {
    const url = `${CONFIG.MILITARY_NET.BASE_URL}/data/${key}`;
    try {
      const headers = { 'Accept': 'application/json' };
      if (CONFIG.MILITARY_NET.API_KEY) {
        headers['X-API-Key'] = CONFIG.MILITARY_NET.API_KEY;
      }
      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) return null;
      const data = await response.json();
      this._cache[key] = data;
      // ראו הערה מקבילה ב-_loadFromSharePoint - חייבים לכתוב גם ל-localStorage, לא רק ל-_cache,
      // כדי שקוד שקורא ישירות מ-localStorage.getItem (בלי דרך DataService) יראה נתונים ששמורים
      // בשרת ברגע שמישהו כן שלף אותם, במקום להישאר תקוע על מטמון מקומי ריק/מיושן.
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
      return data;
    } catch (error) {
      console.error(`[MilitaryNet] GET error for ${key}:`, error);
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    }
  },

  /**
   * שמירה לשרת API ברשת הצבאית
   */
  async _saveToMilitaryNet(key, data) {
    const url = `${CONFIG.MILITARY_NET.BASE_URL}/data/${key}`;
    try {
      const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (CONFIG.MILITARY_NET.API_KEY) {
        headers['X-API-Key'] = CONFIG.MILITARY_NET.API_KEY;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      return response.ok;
    } catch (error) {
      console.error(`[MilitaryNet] POST error for ${key}:`, error);
      return false;
    }
  },

  /**
   * הפעלת סנכרון אוטומטי ברקע (Live Polling + Push Queue).
   * טוענת את התור השמור, מנסה לרוקן אותו בכל סבב וכאשר החיבור חוזר,
   * ומריצה את ה-callback לרענון הנתונים.
   */
  startAutoSync(callback) {
    // שחזור תור הסנכרון מרענון קודם
    this._syncQueue = this._loadQueue();

    if (this._isRemote() && typeof window !== 'undefined') {
      // כאשר החיבור חוזר - מנסים מיד לרוקן את התור
      window.addEventListener('online', () => { this.flushQueue(); this._notifyStatus(); });
      window.addEventListener('offline', () => { this._notifyStatus(); });
    }
    this._notifyStatus();

    if (!CONFIG.SYNC_INTERVAL_MS || CONFIG.SYNC_INTERVAL_MS <= 0) return;
    setInterval(async () => {
      await this.flushQueue();               // דחיפת שינויים ממתינים לשרת
      if (typeof callback === 'function') {
        await callback();                    // משיכה/רענון נתונים
      }
    }, CONFIG.SYNC_INTERVAL_MS);
  },

  /**
   * העברה חד-פעמית של כל הנתונים שכבר קיימים ב-localStorage של המכשיר/דפדפן הזה לשרת המרוחק
   * (SharePoint/רשת צבאית) שהוגדר כרגע ב-CONFIG.DATA_SOURCE.
   *
   * למה זה נחוץ: לפני שהמערכת עוברת ממצב 'local' לשרת מרכזי, כל הנתונים שנוצרו/נבדקו עד
   * כה קיימים רק ב-localStorage של הדפדפן הנוכחי - הם *לא* עולים לשרת אוטומטית רק בגלל
   * שינוי ההגדרה (DataService.setItem שולח לשרת רק בכתיבות *חדשות* שקורות מרגע המעבר
   * והלאה). מריצים את הפונקציה הזו *פעם אחת*, מאותו הדפדפן שמכיל את הנתונים, מיד אחרי
   * שמשנים את CONFIG.DATA_SOURCE ל-'sharepoint'/'military_net' ופורסים מחדש - למשל דרך
   * קונסולת הדפדפן: DataService.migrateLocalDataToServer()
   *
   * הערה: הפעולה כותבת (overwrite) על השרת רק את המפתחות שקיימים במכשיר הזה - היא לא
   * מוחקת שום דבר שכבר קיים בשרת תחת מפתחות אחרים. אם כמה דפדפנים/מכשירים שונים נוצלו
   * לאורך הבדיקות (לפני המעבר לשרת), יש להריץ את הפונקציה מכל אחד מהם בנפרד כדי שכל
   * הנתונים מכולם יעלו (לא רק מהמכשיר האחרון שהריץ אותה).
   * @returns {Promise<{total:number, ok:number, failed:string[]}>}
   */
  async migrateLocalDataToServer() {
    if (!this._isRemote()) {
      console.warn('[DataService] migrateLocalDataToServer: CONFIG.DATA_SOURCE אינו sharepoint/military_net - אין מה להעביר.');
      return { total: 0, ok: 0, failed: [] };
    }
    // מפתחות מקומיים-בלבד במובהק (העדפות תצוגה של המכשיר/הדפדפן הזה) - אין טעם/משמעות
    // להעלות אותם לשרת המשותף.
    const EXCLUDE_KEYS = new Set([this._syncQueueKey, 'sidebar_collapsed']);
    const keys = Object.keys(localStorage).filter(k => !EXCLUDE_KEYS.has(k));

    const failed = [];
    let ok = 0;
    for (const key of keys) {
      let data;
      try { data = JSON.parse(localStorage.getItem(key)); }
      catch (e) { data = localStorage.getItem(key); }
      const success = await this._remoteSave(key, data);
      if (success) ok++; else failed.push(key);
    }
    console.info(`[DataService] migrateLocalDataToServer: ${ok}/${keys.length} מפתחות הועלו בהצלחה.`, failed.length ? { failed } : '');
    return { total: keys.length, ok, failed };
  }
};
