import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  name?: string;
  id?: string;
  autoComplete?: string;
  showStrength?: boolean;
  disabled?: boolean;
}

const getStrength = (pwd: string) => {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
};

const strengthConfig: Record<number, { label: string; color: string; width: string }> = {
  0: { label: '', color: 'transparent', width: '0%' },
  1: { label: 'Weak', color: '#ff4757', width: '25%' },
  2: { label: 'Fair', color: '#ffa502', width: '50%' },
  3: { label: 'Good', color: 'var(--color-accent)', width: '75%' },
  4: { label: 'Strong', color: 'var(--color-accent-green)', width: '100%' }
};

export const PasswordInput = ({
  value,
  onChange,
  placeholder = "Enter password",
  label,
  error,
  name = "password",
  id = "password",
  autoComplete = "current-password",
  showStrength = false,
  disabled = false
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const strength = showStrength ? getStrength(value) : 0;
  const strengthInfo = strengthConfig[strength];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          {label}
        </label>
      )}

      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
      }}>
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '12px 48px 12px 16px',
            background: 'var(--color-bg-input)',
            color: 'var(--color-text-primary)',
            border: `1px solid ${
              error
                ? 'var(--color-error)'
                : isFocused
                  ? 'var(--color-accent)'
                  : 'var(--color-border)'
            }`,
            borderRadius: '8px',
            fontSize: '15px',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            borderRadius: '4px',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.color = 'var(--color-accent)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.color = 'var(--color-text-muted)';
          }}
        >
          {showPassword
            ? <EyeOff size={18} />
            : <Eye size={18} />
          }
        </button>
      </div>

      {error && (
        <span style={{
          color: 'var(--color-error)',
          fontSize: '12px',
          marginTop: '2px'
        }}>
          {error}
        </span>
      )}

      {showStrength && value.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div style={{
            height: '4px',
            background: 'var(--color-bg-input)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: strengthInfo.width,
              background: strengthInfo.color,
              borderRadius: '2px',
              transition: 'all 0.3s ease'
            }} />
          </div>
          {strength > 0 && (
            <span style={{
              fontSize: '11px',
              color: strengthInfo.color,
              marginTop: '2px',
              display: 'block'
            }}>
              {strengthInfo.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
