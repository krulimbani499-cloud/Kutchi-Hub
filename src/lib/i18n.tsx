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
  "nav.about": "About",
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
  "home.searchTagline": "Search Kutch Kadva Patidar Samaj Businesses near you",
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
  "home.ownBusinessDesc": "List on Kutchi Hub and reach local customers.",
  "home.addYourBusiness": "Add Your Business",
  "home.in": "in",
  "loc.all": "All locations",
  "home.business1": "business",
  "home.businessN": "businesses",
  "business.inReview.title": "Business in review",
  "business.inReview.text": "This business has been submitted and is being verified by the Kutchi Hub team. It will be live soon.",
  "business.inReview.ownerText": "Your business is under review. Our team will verify it shortly. You'll be able to see it live once approved.",
  "business.backHome": "Back to home",
  "welcome.skip": "Skip",
  "welcome.headline": "Kutch Kadva Patidar Samaj ni Business Directory",
  "welcome.createAccount": "Create account",
  "welcome.agreePrefix": "By continuing you agree to our",
  "welcome.agreeSuffix": ".",
  // footer
  "footer.about":
    "Kutchi Hub is Kutchi Patel Samaj's trusted business directory — restaurants, doctors, grocery, shops and services in one place. With verified listings, real reviews and direct contact, we connect Kutchi businesses to customers across India.",
  "footer.explore": "Explore",
  "footer.allCategories": "All Categories",
  "footer.events": "Events",
  "footer.account": "Account",
  "footer.follow": "Follow",
  "footer.comingSoon": "Coming soon",
  "footer.followInstagram": "Follow us on Instagram",
  "diwali.greeting": "Happy Diwali & Saal Mubarak from the Kutchi Hub family \ud83e\ude94",
  "diwali.blessing": "May this festival of lights bring you joy, health and prosperity.",
  "diwali.dismiss": "Close greeting",
  "diwali.offerTag": "\ud83e\ude94 Diwali Offer",
  "footer.contact": "Contact us",
  "footer.callUs": "Call",
  "footer.whatsappUs": "WhatsApp",
  "footer.emailUs": "Email",
  "footer.address": "Address",
  "footer.hours": "Hours",
  "help.title": "Need help? Talk to us",
  "help.text": "Questions about listing your business or using Kutchi Hub? Our team is happy to help.",
  "help.call": "Call us",
  "help.whatsapp": "WhatsApp us",
  "help.email": "Email us",
  "whatsapp.float": "Chat with Kutchi Hub on WhatsApp",
  "footer.rights": "All rights reserved.",
  "footer.privacy": "Privacy Policy",
  "footer.deleteAccount": "Delete Account",
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
  "nav.about": "અમારા વિશે",
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
  "home.searchTagline": "તમારી નજીકના કચ્છ કડવા પાટીદાર સમાજના વ્યવસાયો શોધો",
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
  "home.ownBusinessDesc": "કચ્છી હબ પર લિસ્ટ કરો અને સ્થાનિક ગ્રાહકો સુધી પહોંચો.",
  "home.addYourBusiness": "તમારો વ્યવસાય ઉમેરો",
  "home.in": "માં",
  "loc.all": "બધી જગ્યા",
  "home.business1": "વ્યવસાય",
  "home.businessN": "વ્યવસાયો",
  "business.inReview.title": "વ્યવસાય સમીક્ષા હેઠળ છે",
  "business.inReview.text": "આ વ્યવસાય સબમિટ કરવામાં આવ્યો છે અને કચ્છી હબ ટીમ દ્વારા તેની ચકાસણી થઈ રહી છે. તે ટૂંક સમયમાં લાઇવ થશે.",
  "business.inReview.ownerText": "તમારો વ્યવસાય સમીક્ષા હેઠળ છે. અમારી ટીમ ટૂંક સમયમાં તેની ચકાસણી કરશે. મંજૂરી મળ્યા પછી તમે તેને લાઇવ જોઈ શકશો.",
  "business.backHome": "હોમ પર પાછા જાઓ",
  "welcome.skip": "છોડો",
  "welcome.headline": "કચ્છ કડવા પાટીદાર સમાજની બિઝનેસ ડિરેક્ટરી",
  "welcome.createAccount": "એકાઉન્ટ બનાવો",
  "welcome.agreePrefix": "આગળ વધીને તમે અમારી",
  "welcome.agreeSuffix": " સાથે સંમત થાઓ છો.",
  "footer.about":
    "કચ્છી હબ એ કચ્છી પટેલ સમાજની વિશ્વસનીય બિઝનેસ ડિરેક્ટરી છે — રેસ્તોરાં, ડૉક્ટર, કરિયાણું, દુકાનો અને સેવાઓ એક જ જગ્યાએ. વેરિફાઇડ લિસ્ટિંગ અને સીધા સંપર્ક સાથે આખા ભારતમાં કચ્છી બિઝનેસને ગ્રાહકો સાથે જોડીએ છીએ.",
  "footer.explore": "એક્સપ્લોર",
  "footer.allCategories": "બધી શ્રેણીઓ",
  "footer.events": "ઇવેન્ટ્સ",
  "footer.account": "એકાઉન્ટ",
  "footer.follow": "ફોલો કરો",
  "footer.comingSoon": "ટૂંક સમયમાં",
  "footer.followInstagram": "ઇન્સ્ટાગ્રામ પર અમને ફોલો કરો",
  "diwali.greeting": "કચ્છી હબ પરિવાર તરફથી હેપ્પી દિવાળી અને સાલ મુબારક \ud83e\ude94",
  "diwali.blessing": "આ પ્રકાશ પર્વ તમારા જીવનમાં આનંદ, સ્વાસ્થ્ય અને સમૃદ્ધિ લાવે.",
  "diwali.dismiss": "શુભેચ્છા બંધ કરો",
  "diwali.offerTag": "\ud83e\ude94 દિવાળી ઓફર",
  "footer.contact": "સંપર્ક કરો",
  "footer.callUs": "કૉલ",
  "footer.whatsappUs": "વોટ્સએપ",
  "footer.emailUs": "ઇમેઇલ",
  "footer.address": "સરનામું",
  "footer.hours": "સમય",
  "help.title": "મદદ જોઈએ છે? અમારી સાથે વાત કરો",
  "help.text": "તમારો બિઝનેસ લિસ્ટ કરવા કે Kutchi Hub વાપરવા અંગે કોઈ પ્રશ્ન છે? અમારી ટીમ મદદ કરવા તૈયાર છે.",
  "help.call": "અમને કૉલ કરો",
  "help.whatsapp": "અમને વોટ્સએપ કરો",
  "help.email": "અમને ઇમેઇલ કરો",
  "whatsapp.float": "વોટ્સએપ પર Kutchi Hub સાથે ચેટ કરો",
  "footer.rights": "સર્વ હક્ક સુરક્ષિત.",
  "footer.privacy": "ગોપનીયતા નીતિ",
  "footer.deleteAccount": "એકાઉન્ટ ડિલીટ કરો",
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
  "nav.about": "हमारे बारे में",
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
  "home.searchTagline": "अपने आस-पास कच्छ कडवा पाटीदार समाज के व्यवसाय खोजें",
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
  "home.ownBusinessDesc": "कच्छी हब पर लिस्ट करें और लोकल ग्राहकों तक पहुँचें।",
  "home.addYourBusiness": "अपना व्यवसाय जोड़ें",
  "home.in": "में",
  "loc.all": "सभी जगह",
  "home.business1": "व्यवसाय",
  "home.businessN": "व्यवसाय",
  "business.inReview.title": "व्यवसाय की समीक्षा जारी है",
  "business.inReview.text": "यह व्यवसाय सबमिट किया गया है और कच्छी हब टीम द्वारा इसका सत्यापन किया जा रहा है। यह जल्द ही लाइव होगा।",
  "business.inReview.ownerText": "आपका व्यवसाय समीक्षा में है। हमारी टीम जल्द ही इसका सत्यापन करेगी। स्वीकृति मिलने के बाद आप इसे लाइव देख सकेंगे।",
  "business.backHome": "होम पर वापस जाएँ",
  "welcome.skip": "छोड़ें",
  "welcome.headline": "कच्छ कडवा पाटीदार समाज की बिज़नेस डायरेक्टरी",
  "welcome.createAccount": "अकाउंट बनाएँ",
  "welcome.agreePrefix": "जारी रखकर आप हमारी",
  "welcome.agreeSuffix": " से सहमत होते हैं।",
  "footer.about":
    "कच्छी हब, कच्छी पटेल समाज की विश्वसनीय बिजनेस डायरेक्टरी है — रेस्टोरेंट, डॉक्टर, किराना, दुकानें और सेवाएं एक ही जगह। वेरिफाइड लिस्टिंग और सीधे संपर्क के साथ पूरे भारत में कच्छी व्यवसायों को ग्राहकों से जोड़ते हैं।",
  "footer.explore": "एक्सप्लोर",
  "footer.allCategories": "सभी श्रेणियाँ",
  "footer.events": "इवेंट्स",
  "footer.account": "अकाउंट",
  "footer.follow": "फॉलो करें",
  "footer.comingSoon": "जल्द आ रहा है",
  "footer.followInstagram": "इंस्टाग्राम पर हमें फॉलो करें",
  "diwali.greeting": "कच्छी हब परिवार की ओर से हैप्पी दिवाली और साल मुबारक \ud83e\ude94",
  "diwali.blessing": "यह रोशनी का त्योहार आपके जीवन में खुशियाँ, सेहत और समृद्धि लाए।",
  "diwali.dismiss": "शुभकामना बंद करें",
  "diwali.offerTag": "\ud83e\ude94 दिवाली ऑफर",
  "footer.contact": "संपर्क करें",
  "footer.callUs": "कॉल",
  "footer.whatsappUs": "व्हाट्सऐप",
  "footer.emailUs": "ईमेल",
  "footer.address": "पता",
  "footer.hours": "समय",
  "help.title": "मदद चाहिए? हमसे बात करें",
  "help.text": "अपना बिज़नेस लिस्ट करने या Kutchi Hub इस्तेमाल करने के बारे में कोई सवाल है? हमारी टीम मदद के लिए तैयार है।",
  "help.call": "हमें कॉल करें",
  "help.whatsapp": "हमें व्हाट्सऐप करें",
  "help.email": "हमें ईमेल करें",
  "whatsapp.float": "व्हाट्सऐप पर Kutchi Hub से चैट करें",
  "footer.rights": "सर्वाधिकार सुरक्षित।",
  "footer.privacy": "गोपनीयता नीति",
  "footer.deleteAccount": "अकाउंट डिलीट करें",
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
