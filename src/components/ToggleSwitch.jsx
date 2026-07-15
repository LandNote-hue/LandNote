const C = {
  bdr: '#E8EAED',
  brand: '#C8102E',
  txM: '#6B7280',
};

/** @param {{ checked: boolean, onChange: (next: boolean) => void, disabled?: boolean, label?: string, busy?: boolean }} props */
export function ToggleSwitch({ checked, onChange, disabled = false, label, busy = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => !disabled && !busy && onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: `1px solid ${checked ? C.brand : C.bdr}`,
        background: checked ? C.brand : '#E5E7EB',
        position: 'relative',
        cursor: disabled || busy ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background .15s, border-color .15s',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.15)',
          transition: 'left .15s',
        }}
      />
    </button>
  );
}
