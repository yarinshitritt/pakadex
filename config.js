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
    // הקישור לאתר ה-SharePoint שלכם - לפי הצילום מסך: /sites/more_nevochim
    SITE_URL: 'https://portal.army.idf/sites/more_nevochim',
    // נתיב ספריית המסמכים לשמירת קבצי ה-.txt - לפי הצילום מסך: ספריית DocLib1, תיקיית
    // בהל"ג, תת-תיקיית data. *** ודא/י שהמרכאות בשם "בהל"ג" תואמות בדיוק למה שמופיע
    // בפועל ב-SharePoint (גרשיים עבריות ״ או גרש רגיל ") - אם ההעלאה נכשלת עם שגיאת
    // 404, זה המקום הראשון לבדוק. ***
    FOLDER_PATH: '/sites/more_nevochim/DocLib1/בהל"ג/data',

    // התחברות אוטומטית דרך זהות ה-Windows/AD המאומתת (מפל"ז + Smart Card Logon + Windows
    // Integrated Authentication מול SharePoint) - במקום הזנת מספר אישי ידנית.
    // AUTO_LOGIN: true/false - האם לנסות זיהוי אוטומטי בעת טעינת מסך הכניסה.
    AUTO_LOGIN: true,
    // שם שדה הפרופיל (User Profile Property key) ב-SharePoint שמכיל את המספר האישי,
    // כפי שמסונכרן מ-Active Directory דרך User Profile Sync.
    // *** יש לוודא מול מנהל ה-SharePoint/AD מהו שם המאפיין המדויק לפני הפעלת AUTO_LOGIN ***
    // (בד"כ מאפיין מותאם-אישית כמו 'employeeID' או 'CustomAttribute1' - תלוי כיצד הוגדר המיפוי מ-AD).
    PN_PROFILE_KEY: ''
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
