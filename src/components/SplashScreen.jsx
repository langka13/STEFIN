import { Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { AppLogo } from './AppLogo.jsx';

export function SplashScreen({ label }) {
  const { t } = useLanguage();
  return (
    <div className="grid min-h-screen place-items-center bg-white dark:bg-slate-900">
      <div className="flex flex-col items-center gap-6">
        <AppLogo className="w-20 h-20 drop-shadow-xl" />
        <div className="text-2xl font-outfit font-semibold text-slate-900 dark:text-slate-50">SteFin</div>
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label || t('loading_stefin')}
        </div>
      </div>
    </div>
  );
}
