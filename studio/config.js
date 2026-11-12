// One file per client. Everything that differs between clients lives here; the code is the same for everyone.
window.STUDIO = {
  demo: true,                         // true = sample data in the browser, no server. false = the client's own Supabase project
  supabaseUrl: "",                    // filled in when the client's project exists
  supabaseKey: "",                    // the public (publishable) key only — never a secret key
  business: { name: "שירז אדריכלות", owner: "שירז", field: "אדריכלות ועיצוב פנים", city: "ראשון לציון", handle: "" },
  brand: { accent: "#b5532f", accent2: "#d9a05b", ink: "#1f1d1a", paper: "#f6f2ec" },
  stages: ["היכרות ופרוגרמה", "קונספט", "תכנון מוקדם", "היתר בנייה", "תכנון מפורט", "מכרז קבלנים", "ביצוע ופיקוח", "מסירה"],
  // the team that works for the client. key = id used in the data; job = what the agent does when asked
  agents: [
    { id: "pa",    name: "נועה", icon: "🎙️", role: "העוזרת האישית", job: "בריף יומי, משימות, יומן, מיילים — ומדברת איתך בקול" },
    { id: "pm",    name: "דן",   icon: "📐", role: "מנהל הפרויקטים", job: "מצב כל פרויקט, לוח זמנים, מה תקוע, ועדכון שבועי ללקוח" },
    { id: "boq",   name: "תמר",  icon: "🧮", role: "הכמאית", job: "כתב כמויות מתוכניות וממפרט, אומדן עלויות והשוואה לתקציב" },
    { id: "buy",   name: "יואב", icon: "🤝", role: "רכש וספקים", job: "פגישות ספקים, סיכומי פגישה, השוואת הצעות מחיר ומעקב הזמנות" },
    { id: "plans", name: "גל",   icon: "🗺️", role: "קוראת התוכניות", job: "קוראת תוכניות PDF: שטחים, חדרים, פתחים, הערות ואי-התאמות בין גיליונות" },
    { id: "leads", name: "עדי",  icon: "🧲", role: "לידים והצעות מחיר", job: "מענה לפניות חדשות, הצעת שכר טרחה, ומעקב עד חתימה" },
    { id: "content", name: "ליה", icon: "🎬", role: "תוכן ואינסטגרם", job: "סרטונים וקרוסלות מפרויקטים שהסתיימו, לפני ואחרי, טיפים ללקוחות" }
  ]
};
