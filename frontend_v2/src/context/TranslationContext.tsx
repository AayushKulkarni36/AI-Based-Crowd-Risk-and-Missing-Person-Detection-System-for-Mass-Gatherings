import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'mr' | 'hi';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.crowd': 'Crowd Analysis',
    'nav.missing': 'Missing Persons',
    'nav.alerts': 'Alerts',

    // Dashboard
    'dashboard.hero.title': 'Advanced AI Surveillance System',
    'dashboard.hero.subtitle': 'Real-time crowd monitoring and missing person detection powered by state-of-the-art computer vision.',
    'dashboard.videos': 'Videos Processed',
    'dashboard.active': 'Active Missing Persons',
    'dashboard.alerts': 'Critical Alerts Today',
    'dashboard.found': 'Persons Found',
    'dashboard.queue': 'Queue Status',
    'dashboard.matches': 'Face Matches',
    'dashboard.recent': 'Recent Alerts',

    // Crowd
    'crowd.title': 'Crowd Risk Analysis',
    'crowd.desc': 'Upload CCTV footage for real-time crowd density estimation, risk scoring, and anomaly detection.',

    // Missing Persons
    'missing.title': 'Missing Persons Database',
    'missing.desc': 'Register missing individuals and scan surveillance footage for matches.',
    'missing.add': 'Add Person',
    'missing.search': 'Search by name...',

    // Upload
    'upload.title': 'CCTV Input Source',
    'upload.drop': 'Drop video file here',
    'upload.browse': 'Browse Files',
    'upload.start': 'Start Analysis',

    // Safety
    'safety.normal': 'Normal monitoring. No immediate action required.',
    'safety.medium': 'Caution advised. Deploy additional staff to sector.',
    'safety.high': 'CRITICAL: Initiate crowd control protocol. Open emergency exits.',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.status.active': 'Active',
    'common.status.found': 'Found',
  },
  mr: {
    // Navigation
    'nav.dashboard': 'डॅशबोर्ड',
    'nav.crowd': 'गर्दी विश्लेषण',
    'nav.missing': 'हरवलेल्या व्यक्ती',
    'nav.alerts': 'सूचना',

    // Dashboard
    'dashboard.hero.title': 'प्रगत एआय पाळत ठेवणारी प्रणाली',
    'dashboard.hero.subtitle': 'अत्याधुनिक कॉम्प्युटर व्हिजनद्वारे रिअल-टाइम गर्दी निरीक्षण आणि हरवलेल्या व्यक्तीचा शोध.',
    'dashboard.videos': 'प्रक्रिया केलेले व्हिडिओ',
    'dashboard.active': 'सक्रिय हरवलेल्या व्यक्ती',
    'dashboard.alerts': 'आजचे गंभीर इशारे',
    'dashboard.found': 'सापडलेल्या व्यक्ती',
    'dashboard.queue': 'रांग स्थिती',
    'dashboard.matches': 'चेहरा जुळवणी',
    'dashboard.recent': 'अलीकडील सूचना',

    // Crowd
    'crowd.title': 'गर्दी जोखीम विश्लेषण',
    'crowd.desc': 'रिअल-टाइम गर्दी घनता अंदाज, जोखीम स्कोरिंग आणि विसंगती शोधासाठी सीसीटीव्ही फुटेज अपलोड करा.',

    // Missing Persons
    'missing.title': 'हरवलेल्या व्यक्तींचा डेटाबेस',
    'missing.desc': 'हरवलेल्या व्यक्तींची नोंदणी करा आणि पाळत ठेवणारे फुटेज स्कॅन करा.',
    'missing.add': 'व्यक्ती जोडा',
    'missing.search': 'नावाने शोधा...',

    // Upload
    'upload.title': 'सीसीटीव्ही इनपुट स्रोत',
    'upload.drop': 'व्हिडिओ फाईल येथे टाका',
    'upload.browse': 'फाईल्स शोधा',
    'upload.start': 'विश्लेषण सुरू करा',

    // Safety
    'safety.normal': 'सामान्य निरीक्षण. त्वरित कारवाईची आवश्यकता नाही.',
    'safety.medium': 'सावधगिरी बाळगा. सेक्टरमध्ये अतिरिक्त कर्मचारी तैनात करा.',
    'safety.high': 'गंभीर: गर्दी नियंत्रण प्रोटोकॉल सुरू करा. आपत्कालीन मार्ग उघडा.',

    // Common
    'common.loading': 'लोड होत आहे...',
    'common.error': 'काही तरी चुकले',
    'common.retry': 'पुन्हा प्रयत्न करा',
    'common.cancel': 'रद्द करा',
    'common.save': 'जतन करा',
    'common.delete': 'हटवा',
    'common.status.active': 'सक्रिय',
    'common.status.found': 'सापडले',
  },
  hi: {
    // Navigation
    'nav.dashboard': 'डैशबोर्ड',
    'nav.crowd': 'भीड़ विश्लेषण',
    'nav.missing': 'लापता व्यक्ति',
    'nav.alerts': 'अलर्ट',

    // Dashboard
    'dashboard.hero.title': 'उन्नत एआई निगरानी प्रणाली',
    'dashboard.hero.subtitle': 'आधुनिक कंप्यूटर विज़न द्वारा संचालित रियल-टाइम भीड़ निगरानी और लापता व्यक्ति पहचान।',
    'dashboard.videos': 'प्रसंस्कृत वीडियो',
    'dashboard.active': 'सक्रिय लापता व्यक्ति',
    'dashboard.alerts': 'आज के गंभीर अलर्ट',
    'dashboard.found': 'मिले व्यक्ति',
    'dashboard.queue': 'कतार स्थिति',
    'dashboard.matches': 'चेहरा मिलान',
    'dashboard.recent': 'हाल के अलर्ट',

    // Crowd
    'crowd.title': 'भीड़ जोखिम विश्लेषण',
    'crowd.desc': 'रियल-टाइम भीड़ घनत्व अनुमान और जोखिम स्कोरिंग के लिए CCTV फुटेज अपलोड करें।',

    // Missing Persons
    'missing.title': 'लापता व्यक्ति डेटाबेस',
    'missing.desc': 'लापता व्यक्तियों को पंजीकृत करें और निगरानी फुटेज स्कैन करें।',
    'missing.add': 'व्यक्ति जोड़ें',
    'missing.search': 'नाम से खोजें...',

    // Upload
    'upload.title': 'CCTV इनपुट स्रोत',
    'upload.drop': 'वीडियो फ़ाइल यहाँ छोड़ें',
    'upload.browse': 'फ़ाइल्स ब्राउज़ करें',
    'upload.start': 'विश्लेषण शुरू करें',

    // Safety
    'safety.normal': 'सामान्य निगरानी। कोई तत्काल कार्रवाई आवश्यक नहीं।',
    'safety.medium': 'सावधानी। अतिरिक्त कर्मचारी तैनात करें।',
    'safety.high': 'गंभीर: भीड़ नियंत्रण प्रोटोकॉल शुरू करें। आपातकालीन निकास खोलें।',

    // Common
    'common.loading': 'लोड हो रहा है...',
    'common.error': 'कुछ गलत हुआ',
    'common.retry': 'पुनः प्रयास करें',
    'common.cancel': 'रद्द करें',
    'common.save': 'सहेजें',
    'common.delete': 'हटाएं',
    'common.status.active': 'सक्रिय',
    'common.status.found': 'मिल गए',
  }
};

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const LANG_STORAGE_KEY = 'crowdsafe_language';

function getInitialLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && (stored === 'en' || stored === 'mr' || stored === 'hi')) {
      return stored as Language;
    }
  } catch {}
  return 'en';
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] ?? translations['en'][key] ?? key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
