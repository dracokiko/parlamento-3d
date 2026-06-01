import { useParlamento } from '../../context/ParlamentoContext';
import { getCorPartido, partidos } from '../../data/mockPartidos';

export const TooltipDeputado = () => {
  const { deputadoHover } = useParlamento();

  if (!deputadoHover) return null;

  const corBase = getCorPartido(deputadoHover.partido);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-20%)',
      zIndex: 100,
      pointerEvents: 'none',
      background: 'white',
      borderRadius: '24px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      border: '1px solid #e5e7eb',
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      width: '340px',
      color: '#111827',
    }}>
      {/* Fotografia */}
      <div style={{
        width: '110px',
        height: '130px',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '3px solid #e5e7eb',
        background: '#f3f4f6',
        flexShrink: 0,
      }}>
        {deputadoHover.foto ? (
          <img
            src={deputadoHover.foto}
            alt={deputadoHover.nomeAbrev ?? deputadoHover.nome}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: corBase,
            color: 'white',
            fontSize: '48px',
            fontWeight: 700,
          }}>
            {(deputadoHover.nomeAbrev ?? deputadoHover.nome ?? '?').charAt(0)}
          </div>
        )}
      </div>

      {/* Nome curto */}
      <div style={{
        fontWeight: 700, fontSize: '20px', textAlign: 'center', lineHeight: 1.2,
        width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {deputadoHover.nomeAbrev ?? deputadoHover.nome ?? '—'}
      </div>

      {/* Partido */}
      <div style={{
        fontSize: '14px', color: '#4b5563', textAlign: 'center',
        width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {partidos[deputadoHover.partido]?.nome ?? deputadoHover.partido ?? '—'}
      </div>

      {/* Círculo eleitoral */}
      <div style={{
        fontSize: '14px', color: '#6b7280',
        display: 'flex', alignItems: 'center', gap: '6px',
        width: '100%', overflow: 'hidden',
      }}>
        <span style={{ fontSize: '13px', flexShrink: 0 }}>📍</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {deputadoHover.circulo ?? '—'}
        </span>
      </div>
    </div>
  );
};
