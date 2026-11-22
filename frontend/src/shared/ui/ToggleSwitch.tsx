interface ToggleSwitchProps {
  checked: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
  compact?: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ checked, label, description, disabled = false, compact = false, onChange }: ToggleSwitchProps) {
  return (
    <label className={`toggle-switch${compact ? ' toggle-switch--compact' : ''}${disabled ? ' toggle-switch--disabled' : ''}`}>
      <span className="toggle-switch__copy">
        <span className="toggle-switch__label">{label}</span>
        {description && <span className="toggle-switch__description">{description}</span>}
      </span>
      <input
        className="toggle-switch__input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
      <span className="toggle-switch__track" aria-hidden="true"><span className="toggle-switch__thumb" /></span>
    </label>
  );
}
