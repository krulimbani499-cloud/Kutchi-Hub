import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "gu" | "hi";

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "gu", label: "ગુજરાતી", short: "GU" },
  { code: "hi", label: "हिन्दी", short: "HI" },
];

const STORAGE_KEY = "kh:lang";

type Dict = Record<string, string>;

const en: Dict = {
  // header / nav
  "nav.search": "Search businesses...",
  "nav.categories": "Categories",
  "nav.searchShort": "Search",
  "nav.pricing": "Pricing",
  "nav.admin": "Admin",
  "nav.favorites": "Favorites",
  "nav.listings": "Listings",
  "nav.myListings": "My Listings",
  "nav.listBusiness": "List Your Business",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.home": "Home",
  "nav.saved": "Saved",
  "nav.account": "Account",
  "nav.language": "Language",
  // home
  "home.searchTagline": "Search Kutchi Businesses near you",
  "home.downloadApp": "Download App",
  "home.searchPlaceholder": "Search for restaurants, doctors, grocery...",
  "home.featured": "Featured",
  "home.listYourBusiness": "List Your Business",
  "home.listYourBusinessDesc": "Get discovered by thousands of Kutchi customers every day.",
  "home.getStarted": "Get Started",
  "home.popularCategories": "Popular Categories",
  "home.viewAll": "View all",
  "home.featuredBusinesses": "Featured Businesses",
  "home.browseAll": "Browse all",
  "home.noFeatured": "No featured listings yet. Add your business today!",
  "home.addBusiness": "Add a business",
  "home.platinumSpotlight": "Platinum Spotlight",
  "home.premiumPartners": "Premium partners",
  "home.topOffers": "Top Offers",
  "home.upcomingEvents": "Upcoming Events",
  "home.ownBusiness": "Own a business?",
  "home.ownBusinessDesc": "List free on Kutchi Hub and reach local customers.",
  "home.addYourBusiness": "Add Your Business",
  "home.in": "in",
  // footer
  "footer.about":
    "Kutchi Hub is Kutch's own local business directory — restaurants, doctors, grocery, shops and services in one place. With trusted listings, real reviews and direct contact we connect local businesses to customers and digitally empower the Kutchi community.",
  "footer.explore": "Explore",
  "footer.allCategories": "All Categories",
  "footer.events": "Events",
  "footer.account": "Account",
  "footer.follow": "Follow",
  "footer.comingSoon": "Coming soon",
  "footer.rights": "All rights reserved.",
  "cat.restaurants": "Restaurants",
  "cat.hospitals": "Hospitals",
  "cat.doctors": "Doctors",
  "cat.grocery": "Grocery",
  "cat.hotels": "Hotels",
  "tile.b2b": "B2B",
  "tile.b2bSub": "Quick Quotes",
  "tile.repairs": "Repairs & Services",
  "tile.repairsSub": "Get Nearest Vendor",
  "tile.realEstate": "Real Estate",
  "tile.realEstateSub": "Finest Agents",
  "tile.doctors": "Doctors",
  "tile.doctorsSub": "Book Now",
};

const gu: Dict = {
  "nav.search": "વ્યવસાય શોધો...",
  "nav.categories": "શ્રેણીઓ",
  "nav.searchShort": "શોધો",
  "nav.pricing": "કિંમત",
  "nav.admin": "એડમિન",
  "nav.favorites": "પસંદ",
  "nav.listings": "લિસ્ટિંગ",
  "nav.myListings": "મારી લિસ્ટિંગ",
  "nav.listBusiness": "તમારો વ્યવસાય ઉમેરો",
  "nav.signIn": "સાઇન ઇન",
  "nav.signOut": "સાઇન આઉટ",
  "nav.home": "હોમ",
  "nav.saved": "સેવ્ડ",
  "nav.account": "એકાઉન્ટ",
  "nav.language": "ભાષા",
  "home.searchTagline": "તમારી નજીકના કચ્છી વ્યવસાયો શોધો",
  "home.downloadApp": "એપ ડાઉનલોડ કરો",
  "home.searchPlaceholder": "રેસ્ટોરન્ટ, ડોક્ટર, કરિયાણું શોધો...",
  "home.featured": "ફીચર્ડ",
  "home.listYourBusiness": "તમારો વ્યવસાય ઉમેરો",
  "home.listYourBusinessDesc": "દરરોજ હજારો કચ્છી ગ્રાહકો સુધી પહોંચો.",
  "home.getStarted": "શરૂ કરો",
  "home.popularCategories": "લોકપ્રિય શ્રેણીઓ",
  "home.viewAll": "બધું જુઓ",
  "home.featuredBusinesses": "ફીચર્ડ વ્યવસાયો",
  "home.browseAll": "બધા જુઓ",
  "home.noFeatured": "હજી કોઈ ફીચર્ડ લિસ્ટિંગ નથી. આજે જ તમારો વ્યવસાય ઉમેરો!",
  "home.addBusiness": "વ્યવસાય ઉમેરો",
  "home.platinumSpotlight": "પ્લેટિનમ સ્પોટલાઇટ",
  "home.premiumPartners": "પ્રીમિયમ પાર્ટનર્સ",
  "home.topOffers": "શ્રેષ્ઠ ઓફર્સ",
  "home.upcomingEvents": "આગામી ઇવેન્ટ્સ",
  "home.ownBusiness": "વ્યવસાય ધરાવો છો?",
  "home.ownBusinessDesc": "કચ્છી હબ પર મફત લિસ્ટ કરો અને સ્થાનિક ગ્રાહકો સુધી પહોંચો.",
  "home.addYourBusiness": "તમારો વ્યવસાય ઉમેરો",
  "home.in": "માં",
  "footer.about":
    "કચ્છી હબ એ કચ્છનું પોતાનું લોકલ બિઝનેસ ડિરેક્ટરી છે — રેસ્ટોરન્ટ, ડોક્ટર, કરિયાણું, દુકાનો અને સેવાઓ એક જ જગ્યાએ. વિશ્વસનીય લિસ્ટિંગ, સાચા રિવ્યુ અને સીધા સંપર્ક સાથે અમે સ્થાનિક વ્યવસાયોને ગ્રાહકો સાથે જોડીએ છીએ.",
  "footer.explore": "એક્સપ્લોર",
  "footer.allCategories": "બધી શ્રેણીઓ",
  "footer.events": "ઇવેન્ટ્સ",
  "footer.account": "એકાઉન્ટ",
  "footer.follow": "ફોલો કરો",
  "footer.comingSoon": "ટૂંક સમયમાં",
  "footer.rights": "સર્વ હક્ક સુરક્ષિત.",
  "cat.restaurants": "રેસ્ટોરન્ટ",
  "cat.hospitals": "હોસ્પિટલ",
  "cat.doctors": "ડોક્ટર",
  "cat.grocery": "કરિયાણું",
  "cat.hotels": "હોટેલ",
  "tile.b2b": "બી2બી",
  "tile.b2bSub": "ઝડપી ભાવ",
  "tile.repairs": "રિપેર અને સેવાઓ",
  "tile.repairsSub": "નજીકના વેન્ડર",
  "tile.realEstate": "રિયલ એસ્ટેટ",
  "tile.realEstateSub": "શ્રેષ્ઠ એજન્ટ",
  "tile.doctors": "ડોક્ટર",
  "tile.doctorsSub": "હમણાં બુક કરો",
};

const hi: Dict = {
  "nav.search": "व्यवसाय खोजें...",
  "nav.categories": "श्रेणियाँ",
  "nav.searchShort": "खोजें",
  "nav.pricing": "प्राइसिंग",
  "nav.admin": "एडमिन",
  "nav.favorites": "पसंदीदा",
  "nav.listings": "लिस्टिंग",
  "nav.myListings": "मेरी लिस्टिंग",
  "nav.listBusiness": "अपना व्यवसाय जोड़ें",
  "nav.signIn": "साइन इन",
  "nav.signOut": "साइन आउट",
  "nav.home": "होम",
  "nav.saved": "सेव्ड",
  "nav.account": "अकाउंट",
  "nav.language": "भाषा",
  "home.searchTagline": "अपने आस-पास कच्छी व्यवसाय खोजें",
  "home.downloadApp": "ऐप डाउनलोड करें",
  "home.searchPlaceholder": "रेस्टोरेंट, डॉक्टर, किराना खोजें...",
  "home.featured": "फीचर्ड",
  "home.listYourBusiness": "अपना व्यवसाय जोड़ें",
  "home.listYourBusinessDesc": "हर दिन हजारों कच्छी ग्राहकों तक पहुँचें।",
  "home.getStarted": "शुरू करें",
  "home.popularCategories": "लोकप्रिय श्रेणियाँ",
  "home.viewAll": "सभी देखें",
  "home.featuredBusinesses": "फीचर्ड व्यवसाय",
  "home.browseAll": "सभी देखें",
  "home.noFeatured": "अभी कोई फीचर्ड लिस्टिंग नहीं है। आज ही अपना व्यवसाय जोड़ें!",
  "home.addBusiness": "व्यवसाय जोड़ें",
  "home.platinumSpotlight": "प्लेटिनम स्पॉटलाइट",
  "home.premiumPartners": "प्रीमियम पार्टनर",
  "home.topOffers": "टॉप ऑफर",
  "home.upcomingEvents": "आने वाले इवेंट्स",
  "home.ownBusiness": "व्यवसाय के मालिक हैं?",
  "home.ownBusinessDesc": "कच्छी हब पर मुफ्त लिस्ट करें और लोकल ग्राहकों तक पहुँचें।",
  "home.addYourBusiness": "अपना व्यवसाय जोड़ें",
  "home.in": "में",
  "footer.about":
    "कच्छी हब कच्छ की अपनी लोकल बिजनेस डायरेक्टरी है — रेस्टोरेंट, डॉक्टर, किराना, दुकानें और सेवाएँ एक ही जगह। भरोसेमंद लिस्टिंग, असली रिव्यू और सीधे संपर्क के साथ हम लोकल व्यवसायों को ग्राहकों से जोड़ते हैं।",
  "footer.explore": "एक्सप्लोर",
  "footer.allCategories": "सभी श्रेणियाँ",
  "footer.events": "इवेंट्स",
  "footer.account": "अकाउंट",
  "footer.follow": "फॉलो करें",
  "footer.comingSoon": "जल्द आ रहा है",
  "footer.rights": "सर्वाधिकार सुरक्षित।",
  "cat.restaurants": "रेस्टोरेंट",
  "cat.hospitals": "अस्पताल",
  "cat.doctors": "डॉक्टर",
  "cat.grocery": "किराना",
  "cat.hotels": "होटल",
  "tile.b2b": "बी2बी",
  "tile.b2bSub": "तुरंत कोटेशन",
  "tile.repairs": "रिपेयर और सेवाएँ",
  "tile.repairsSub": "नजदीकी वेंडर",
  "tile.realEstate": "रियल एस्टेट",
  "tile.realEstateSub": "बेहतरीन एजेंट",
  "tile.doctors": "डॉक्टर",
  "tile.doctorsSub": "अभी बुक करें",
};

const DICTS: Record<Lang, Dict> = { en, gu, hi };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => en[k] ?? k,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Read the saved choice after hydration so SSR markup stays stable.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && saved in DICTS) setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string) => DICTS[lang][key] ?? en[key] ?? key,
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}
