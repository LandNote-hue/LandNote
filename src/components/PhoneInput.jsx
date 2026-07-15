import { formatPhone } from '../utils/formatPhone.js';

/** 입력·표시 모두 하이픈 형식 — 숫자(및 서식용 하이픈)만 허용 */
export function PhoneInput({ className = 'inp', value, onChange, ...rest }) {
  const emit = (raw) => {
    const formatted = formatPhone(raw);
    onChange?.({
      target: { value: formatted },
    });
  };
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      className={className}
      value={formatPhone(value)}
      onChange={(e) => emit(e.target.value)}
      onPaste={(e) => {
        e.preventDefault();
        emit(e.clipboardData.getData('text'));
      }}
    />
  );
}
