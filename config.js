/* =========================================================
   CONFIG.JS - הגדרות תקשורת וענן עבור פקאדקס (PAKADEX)
   ========================================================= */

const CONFIG = {
  // סוג השרת לשמירת הנתונים:
  // 'sharepoint'   - שמירה בקבצי JSON ב-SharePoint Document Library בענן
  // 'military_net' - שמירה בשרת API צה"לי פנימי (למצב מבצעי/מסווג)
  // 'local'        - שמירה מקומית ב-localStorage של הדפדפן (לפיתוח/אופליין)
  DATA_SOURCE: 'sharepoint',

  // הגדרות SharePoint
  SHAREPOINT: {
    // אתר ה-SharePoint הייעודי של פקאדקס (הוקצה לירין, לא עוד תת-שימוש באתר "more_nevochim").
    SITE_URL: 'https://mazi.army.idf/sites/PAKADEX',
    // נתיב ספריית המסמכים לשמירת קבצי ה-.txt - אומת ישירות מפרמטר ה-id בכתובת תיקיית
    // data (id=%2Fsites%2FPAKADEX%2FShared%20Documents%2Fdata אחרי פענוח ה-URL). כאן
    // בניגוד לאתר הקודם, "Shared Documents" הוא גם שם התצוגה וגם הנתיב בפועל (לא נוצרה
    // ספריית מסמכים בשם מותאם אישית) - יש לכלול את הרווח, _encodeSpPath כבר מקודד אותו.
    FOLDER_PATH: '/sites/PAKADEX/Shared Documents/data',

    // התחברות אוטומטית דרך זהות ה-Windows/AD המאומתת (מפל"ז + Smart Card Logon + Windows
    // Integrated Authentication מול SharePoint) - במקום הזנת מספר אישי ידנית.
    // AUTO_LOGIN: true/false - האם לנסות זיהוי אוטומטי בעת טעינת מסך הכניסה.
    AUTO_LOGIN: true,
    // שם שדה הפרופיל (User Profile Property key) ב-SharePoint שמכיל את המספר האישי -
    // אומת ישירות מפלט GetMyProperties בפועל: <d:Key>UserName</d:Key><d:Value>s9385538</d:Value>
    // (הערך שם נקי - בלי קידומת דומיין כמו ב-AccountName/SPS-SavedAccountName, ובלי
    // סיומת @idf.il כמו ב-WorkEmail/SPS-UserPrincipalName).
    PN_PROFILE_KEY: 'UserName',

    // שם קבוצת ה-SharePoint שמעניקה הרשאת עריכה בפועל על האתר (Edit) - כשמנהל מוסיף
    // משתמש חדש במסך users.html, האפליקציה מנסה גם להוסיף אותו לקבוצה הזו אוטומטית
    // (ראו DataService.addUserToSharePointGroup), כדי שהוספה ב"אתר שלנו" תספיק ולא
    // תידרש הוספה ידנית נפרדת בהרשאות ה-SharePoint עצמן. הפעולה דורשת שהמשתמש
    // המחובר שמבצע אותה (המנהל) יהיה לו בעצמו הרשאת "ניהול הרשאות" באתר (Owner/Full
    // Control) - אחרת היא נכשלת בשקט (403) וצריך להוסיף ידנית כמו קודם.
    EDITOR_GROUP_NAME: 'PAKADEX חברי'
  },

  // הגדרות רשת צבאית (ליום המעבר לרשת המסווגת - משנים רק את ה-BASE_URL)
  MILITARY_NET: {
    BASE_URL: 'https://pakadex.army.mil/api',
    API_KEY: ''
  },

  // תדר סנכרון אוטומטי ברקע בזמן אמת (במילישניות) - 5000ms = 5 שניות
  SYNC_INTERVAL_MS: 5000,

  // זיהוי היחידה/הפלוגה העורכת כרגע (משמש לחלוקת קבצים למניעת התנגשויות)
  // ערכים אפשריים: 'esuk', 'hirg', 'pikud', 'tazam', 'bahalag', או 'master'
  CURRENT_UNIT: 'master'
};
