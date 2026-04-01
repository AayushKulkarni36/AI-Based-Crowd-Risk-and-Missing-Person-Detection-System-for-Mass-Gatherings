import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'mr' | 'hi';

interface TranslationContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
    en: {
        "dashboard.hero.title": "Advanced AI Surveillance System",
        "dashboard.hero.subtitle": "Real-time crowd monitoring and missing person detection powered by state-of-the-art computer vision models.",
        "crowd.title": "Crowd Risk Analysis",
        "crowd.desc": "Monitor risk levels, density estimation, and anomaly detection.",
        "missing.title": "Missing Person Search",
        "missing.desc": "Register missing individuals and scan surveillance footage.",
        "upload.title": "CCTV Input Source",
        "safety.normal": "Normal monitoring. No immediate action required.",
        "safety.medium": "Caution advised. Deploy additional staff to sector.",
        "safety.high": "CRITICAL: Initiate crowd control protocol. Open emergency exits.",
        "nav.dashboard": "Dashboard",
        "nav.crowd": "Crowd Analysis",
        "nav.missing": "Missing Persons",
    },
    mr: {
        "dashboard.hero.title": "प्रगत एआय पाळत ठेवणारी प्रणाली",
        "dashboard.hero.subtitle": "अत्याधुनिक कॉम्प्युटर व्हिजन मॉडेल्सद्वारे समर्थित रिअल-टाइम गर्दी निरीक्षण आणि हरवलेल्या व्यक्तीचा शोध.",
        "crowd.title": "गर्दी जोखीम विश्लेषण",
        "crowd.desc": "जोखीम पातळी, घनता अंदाज आणि विसंगती शोधाचे निरीक्षण करा.",
        "missing.title": "हरवलेली व्यक्ती शोध",
        "missing.desc": "हरवलेल्या व्यक्तींची नोंदणी करा आणि पाळत ठेवणारे फुटेज स्कॅन करा.",
        "upload.title": "सीसीटीव्ही इनपुट स्रोत",
        "safety.normal": "सामान्य निरीक्षण. त्वरित कारवाईची आवश्यकता नाही.",
        "safety.medium": "सावधगिरी बाळगा. सेक्टरमध्ये अतिरिक्त कर्मचारी तैनात करा.",
        "safety.high": "गंभीर: गर्दी नियंत्रण प्रोटोकॉल सुरू करा. आपत्कालीन मार्ग उघडा.",
        "nav.dashboard": "डॅशबोर्ड",
        "nav.crowd": "गर्दी विश्लेषण",
        "nav.missing": "हरवलेल्या व्यक्ती",
    },
    hi: {
        "dashboard.hero.title": "उन्नत एआई निगरानी प्रणाली",
        "dashboard.hero.subtitle": "वास्तविक समय में भीड़ की निगरानी और लापता व्यक्तियों की खोज।",
        "crowd.title": "भीड़ जोखिम विश्लेषण",
        "crowd.desc": "जोखिम के स्तर और विसंगतियों की निगरानी करें।",
        "missing.title": "लापता व्यक्ति खोज",
        "missing.desc": "व्यक्तियों को पंजीकृत करें और फुटेज स्कैन करें।",
        "upload.title": "सीसीटीवी इनपुट स्रोत",
        "safety.normal": "सामान्य निगरानी। कोई तत्काल कार्रवाई आवश्यक नहीं।",
        "safety.medium": "सावधानी। अतिरिक्त कर्मचारी तैनात करें।",
        "safety.high": "गंभीर: भीड़ नियंत्रण प्रोटोकॉल शुरू करें। आपातकालीन निकास खोलें।",
        "nav.dashboard": "डैशबोर्ड",
        "nav.crowd": "भीड़ विश्लेषण",
        "nav.missing": "लापता लोग",
    }
};

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<Language>('en');

    const t = (key: string) => {
        return translations[language][key] || key;
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
