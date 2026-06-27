import { useState, useMemo } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  label: string;
  placeholder?: string;
  register?: any;
  error?: string;
  showStrength?: boolean;
  value?: string;
  onChange?: (e: any) => void;
  [key: string]: any;
}

export function PasswordInput({
  label,
  placeholder = 'Enter password',
  register,
  error,
  showStrength = false,
  value = '',
  onChange,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  // Calculate password strength
  const strength = useMemo(() => {
    if (!value || value.length < 8) return 'weak';
    if (value.length >= 12 && /[0-9]/.test(value) && /[a-zA-Z]/.test(value)) return 'strong';
    if (/[0-9]/.test(value) && /[a-zA-Z]/.test(value)) return 'fair';
    return 'weak';
  }, [value]);

  const strengthColors: Record<string, string> = {
    weak: 'bg-red-500',
    fair: 'bg-amber-500',
    strong: 'bg-emerald-500'
  };

  const strengthLabels: Record<string, string> = {
    weak: 'Weak',
    fair: 'Fair',
    strong: 'Strong'
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          {...(register || {})}
          className={`w-full px-4 py-3 pr-12 bg-slate-700 border-2 rounded-lg text-white placeholder-slate-400 transition-all ${error ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-sky-400'
            } focus:outline-none`}
          {...props}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <EyeOff size={20} />
          ) : (
            <Eye size={20} />
          )}
        </button>
      </div>

      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}

      {showStrength && (
        <div className="mt-3">
          <div className="flex gap-1 mb-2">
            {['weak', 'fair', 'strong'].map((level) => (
              <div
                key={level}
                className={`h-2 flex-1 rounded-full transition-colors ${['weak', 'fair', 'strong'].indexOf(strength) >= ['weak', 'fair', 'strong'].indexOf(level)
                    ? strengthColors[level]
                    : 'bg-slate-600'
                  }`}
              />
            ))}
          </div>
          <p className={`text-xs font-semibold ${strength === 'weak' ? 'text-red-400' :
              strength === 'fair' ? 'text-amber-400' :
                'text-emerald-400'
            }`}>
            {strengthLabels[strength]} password
          </p>
        </div>
      )}
    </div>
  );
}

export default PasswordInput;
