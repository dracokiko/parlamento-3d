import { useParlamento } from '../../context/ParlamentoContext';
import { getCorPartido, partidos } from '../../data/mockPartidos';
import { useIsMobile, useIsTabletPortrait, useIsTouch } from '../../hooks/useIsMobile';

const POSICAO = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-20%)',
  zIndex: 100,
  pointerEvents: 'none',
};

export const CoatOfArmsAR = () => {
  const { deputadoHover, deputadoSelecionado } = useParlamento();
  const isMobile = useIsMobile();

  // No desktop esconde quando há hover/seleção (o tooltip sobrepõe-se).
  // No mobile o tooltip aparece no centro e o brasão fica no topo — não se sobrepõem.
  if (!isMobile && (deputadoHover || deputadoSelecionado)) return null;

  const estilo = isMobile
    ? {
        position: 'fixed',
        top: '156px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }
    : {
        ...POSICAO,
        width: '340px',
        justifyContent: 'center',
        zIndex: 1,
        pointerEvents: 'none',
        display: 'flex',
      };

  return (
    <div style={estilo}>
      <img
        src="/Coat_of_arms_of_the_Assembly_of_the_Portuguese_Republic.svg.png"
        alt="Assembleia da República"
        style={{
          width: isMobile ? '115px' : '160px',
          height: 'auto',
          opacity: isMobile ? 0.72 : 0.85,
        }}
      />
    </div>
  );
};

export const TooltipDeputado = () => {
  const { deputadoHover, selecionarDeputado, setDeputadoHover } = useParlamento();
  const isTouch = useIsTouch();
  const isTabletPortrait = useIsTabletPortrait();

  if (!deputadoHover) return null;

  const corBase = getCorPartido(deputadoHover.partido);

  // ── Dispositivos touch (telemóvel + tablet qualquer orientação) ───────────
  if (isTouch) {
    const s = isTabletPortrait ? 1.65 : 1;
    const topPos = isTabletPortrait ? '40%' : '50%';

    const handleAbrirPerfil = () => {
      selecionarDeputado(deputadoHover);
      setDeputadoHover(null);
    };

    return (
      <div
        onClick={handleAbrirPerfil}
        style={{
          position: 'fixed',
          top: topPos,
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100,
          pointerEvents: 'auto',
          cursor: 'pointer',
          background: 'white',
          borderRadius: `${16 * s}px`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
          border: '1px solid #e5e7eb',
          padding: `${14 * s}px ${18 * s}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${7 * s}px`,
          width: `${180 * s}px`,
          color: '#111827',
        }}
      >
        {/* Fotografia */}
        <div style={{
          width: `${96 * s}px`,
          height: `${114 * s}px`,
          borderRadius: `${10 * s}px`,
          overflow: 'hidden',
          border: `${2 * s}px solid #e5e7eb`,
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
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: corBase, color: 'white',
              fontSize: `${28 * s}px`, fontWeight: 700,
            }}>
              {(deputadoHover.nomeAbrev ?? deputadoHover.nome ?? '?').charAt(0)}
            </div>
          )}
        </div>

        <div style={{
          fontWeight: 700, fontSize: `${12 * s}px`, textAlign: 'center', lineHeight: 1.2,
          width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {deputadoHover.nomeAbrev ?? deputadoHover.nome ?? '—'}
        </div>

        <div style={{
          fontSize: `${11 * s}px`, color: '#4b5563', textAlign: 'center',
          width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {partidos[deputadoHover.partido]?.nome ?? deputadoHover.partido ?? '—'}
        </div>

        <div style={{
          marginTop: `${4 * s}px`,
          fontSize: `${10 * s}px`,
          color: '#3b82f6',
          fontWeight: 600,
          letterSpacing: '0.03em',
        }}>
          Toque para ver perfil →
        </div>
      </div>
    );
  }

  // ── Desktop (hover) ───────────────────────────────────────────────────────
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