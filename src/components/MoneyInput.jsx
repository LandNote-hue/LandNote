import { fmtInputNum } from '../utils/formatMoney.js';

/**
 * 금액(만원 등) 입력 — 숫자만 허용, 천 단위 콤마 표시
 * @param {{ decimal?: boolean, value?: string|number, onChange?: (e: { target: { value: string } }) => void, className?: string, style?: object }} props
 */
export function MoneyInput({
  className = 'inp',
  value,
  onChange,
  decimal = false,
  style,
  ...rest
}) {
  const display = fmtInputNum(value ?? '', { decimal });
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      className={className}
      style={style}
      value={display}
      onChange={(e) => {
        const next = fmtInputNum(e.target.value, { decimal });
        onChange?.({
          ...e,
          target: { ...e.target, value: next },
        });
      }}
    />
  );
}
