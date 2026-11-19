import { forwardRef, type InputHTMLAttributes, type MouseEvent } from 'react';
import { Check } from 'lucide-react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  stopPropagation?: boolean;
  /** Alvo do tutorial interativo (data-tour no rotulo visivel; o input fica escondido). */
  tourTarget?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', checked, stopPropagation = false, tourTarget, onChange, ...props }, ref) => {
    const handleClick = (e: MouseEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (stopPropagation) {
        e.stopPropagation();
      }
      onChange?.(e);
    };

    return (
      <label className={`${styles.wrapper} ${className}`} onClick={handleClick} data-tour={tourTarget}>
        <input
          ref={ref}
          type="checkbox"
          className={styles.input}
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <span className={`${styles.checkbox} ${checked ? styles.checked : ''}`}>
          {checked && <Check size={16} strokeWidth={3} />}
        </span>
        {label && <span className={styles.label}>{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
