import { useNavigate } from 'react-router-dom';
import { MapView } from '../../features/map/MapView.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { M } from './mobileUi.jsx';

/** MapView가 기대하는 최소 Btn 컨트랙트 — 필터 적용/초기화 버튼용 (조회 보조 액션만) */
function MobileMapBtn({ ch, on, ic, sx, role, disabled }) {
  const primary = role === 'toolbar-primary';
  return (
    <button
      type="button"
      onClick={on}
      disabled={disabled}
      style={{
        height: 38, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
        border: `1.5px solid ${primary ? M.brand : M.bdr}`,
        background: primary ? M.brand : '#fff',
        color: primary ? '#fff' : M.txS, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        opacity: disabled ? 0.5 : 1,
        ...sx,
      }}
    >
      {ic && <i className={ic} aria-hidden="true" />}
      {ch}
    </button>
  );
}

export function MobileMapView() {
  const navigate = useNavigate();
  const onOpen = (type, data) => {
    if (type === 'pd' && data?.id != null) navigate(`/properties/${data.id}`);
  };
  return <MapView onOpen={onOpen} Btn={MobileMapBtn} PH={PageHeader} />;
}
