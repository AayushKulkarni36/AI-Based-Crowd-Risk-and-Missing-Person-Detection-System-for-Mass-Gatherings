import { Globe } from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';

export default function LanguageSwitcher() {
    const { language, setLanguage } = useTranslation();

    return (
        <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-slate-400" />
            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-slate-300 text-sm focus:outline-none cursor-pointer hover:text-white"
            >
                <option value="en" className="bg-slate-900 text-white">English</option>
                <option value="mr" className="bg-slate-900 text-white">मराठी</option>
                <option value="hi" className="bg-slate-900 text-white">हिंदी</option>
            </select>
        </div>
    );
}
