/**
 * PasswordInput — text input with eye/eye-off toggle for password fields.
 *
 * Features:
 *  - Show/hide toggle button
 *  - Focus glow effect
 *  - Error state with message
 */
import { useState, forwardRef, useId } from "react";

function getPasswordStrength(value: string): { level: number; color: string; label: string } {
  let score = 0;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  if (score <= 1) return { level: 1, color: "#ff4757", label: "Weak" };
  if (score === 2) return { level: 2, color: "#ffa502", label: "Fair" };
  if (score === 3) return { level: 3, color: "#ffd700", label: "Good" };
  return { level: 4, color: "#00ff88", label: "Strong" };
}

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  showStrength?: boolean;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ error, label, showStrength, className = "", value, id: idProp, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = idProp || generatedId;
    const strength = showStrength && typeof value === "string" ? getPasswordStrength(value) : null;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-1.5" style={{ color: "var(--theme-text-muted)" }}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={`input-cyber pr-11 ${
              error
                ? "border-[var(--accent-red, #ff4757)] focus:border-[var(--accent-red, #ff4757)]"
                : ""
            } ${className}`}
            value={value}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors hover:bg-[var(--theme-overlay)]"
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {visible ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-[var(--accent-red, #ff4757)]" role="alert">
            {error}
          </p>
        )}
        {strength && (
          <div className="mt-1.5">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: i < strength.level
                      ? strength.color
                      : "var(--theme-border, rgba(255,255,255,0.08))",
                  }}
                />
              ))}
            </div>
            <p className="text-[10px] mt-1" style={{ color: strength.color }}>{strength.label}</p>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
