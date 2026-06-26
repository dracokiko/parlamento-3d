export const GLOSSARIO = {
  // Tipos de iniciativa
  'Projeto de Resolução':
    'Proposta apresentada por deputados ou partidos para que a Assembleia recomende ao Governo uma determinada ação. Não cria lei.',
  'Proposta de Resolução':
    'Proposta apresentada pelo Governo para ratificar tratados internacionais ou para outros atos formais da Assembleia.',
  'Projeto de Lei':
    'Proposta apresentada por deputados ou partidos para criar uma nova lei ou alterar uma lei já existente.',
  'Proposta de Lei':
    'Proposta apresentada pelo Governo para criar uma nova lei ou alterar uma lei já existente.',
  'Resolução':
    'Decisão formal aprovada pela Assembleia, por exemplo em resposta a uma petição ou para ratificar um acordo.',
  'Decreto':
    'Texto legislativo aprovado pela Assembleia, geralmente para rever ou consolidar legislação existente.',
  'Petição':
    'Pedido formal de cidadãos dirigido à Assembleia, que pode levar à criação de legislação.',

  // Fases de votação
  'Votação na generalidade':
    'Primeira votação sobre a proposta: aprova-se (ou rejeita-se) a ideia geral, sem entrar nos detalhes. Se aprovada, avança para votação na especialidade.',
  'Votação na especialidade':
    'Votação artigo a artigo sobre o texto da proposta, após aprovação na generalidade. É aqui que se fazem alterações concretas.',
  'Votação final global':
    'Votação final sobre o texto completo já com todas as alterações aprovadas. Determina se a proposta segue para promulgação.',
  'Votação global':
    'Votação única sobre todo o texto da proposta, sem passar por votação na especialidade.',
  'Votação Deliberação':
    'Votação sobre uma recomendação ou tomada de posição da Assembleia, sem criar lei.',

  // Fases do processo legislativo
  'Entrada':
    'A proposta é formalmente apresentada na Assembleia e registada.',
  'Admissão':
    'O Presidente da Assembleia verifica se a proposta cumpre os requisitos formais para prosseguir.',
  'Anúncio':
    'A proposta é anunciada em plenário e os deputados ficam a saber da sua existência.',
  'Publicação':
    'O texto da proposta é publicado no Diário da Assembleia da República e fica acessível ao público.',
  'Baixa à comissão':
    'A proposta é enviada para uma comissão parlamentar especializada que a vai estudar e debater em detalhe.',
  'Discussão generalidade':
    'Debate em plenário sobre os princípios gerais da proposta, antes da votação.',
  'Discussão e votação na especialidade':
    'A comissão debate e vota artigo a artigo. Podem ser propostas alterações ao texto.',
  'Redação final':
    'Após a votação, o texto é revisto para incorporar as alterações aprovadas.',
  'Aprovação final global':
    'Votação final em plenário sobre o texto completo da proposta já com todas as alterações.',
  'Envio ao Presidente da República':
    'O texto aprovado é enviado ao Presidente da República para promulgação ou veto.',
  'Promulgação':
    'O Presidente da República assina a lei, tornando-a válida.',
  'Publicação em Diário da República':
    'A lei é publicada oficialmente e entra em vigor.',

  // Votações
  'Voto Procedimental':
    'Não é uma votação sobre o conteúdo da proposta. É uma decisão sobre o processo — por exemplo, enviá-la a uma comissão, adiar a votação, ou contestar uma decisão do Presidente. O "Aprovado" refere-se a esta moção, não à proposta em si.',

  // Outros termos
  'Reunião plenária':
    'Sessão em que todos os deputados se reúnem no hemiciclo para debater e votar propostas.',
  'Interjeições':
    'Apartes, exclamações ou reações curtas (menos de 40 palavras) ditas durante o discurso de outro deputado. Estão ocultas por defeito para facilitar a leitura.',
};

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

export const InfoTooltip = ({ termo }) => {
  const texto = GLOSSARIO[termo];
  const [rect, setRect] = useState(null);
  const ref = useRef(null);
  if (!texto) return null;

  const show = () => setRect(ref.current?.getBoundingClientRect() ?? null);
  const hide = () => setRect(null);

  return (
    <span
      ref={ref}
      className="inline-flex items-center ml-1 align-middle cursor-default"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="w-3.5 h-3.5 rounded-full border border-current inline-flex items-center justify-center text-[9px] italic font-serif opacity-50 hover:opacity-100 transition-opacity select-none">
        i
      </span>
      {rect && createPortal(
        (() => {
          const showBelow = rect.top < 150;
          const rawLeft = rect.left + rect.width / 2;
          const clampedLeft = Math.max(120, Math.min(rawLeft, window.innerWidth - 120));
          return (
            <div
              className="fixed w-56 bg-gray-900 text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-2xl pointer-events-none z-[9999]"
              style={showBelow ? {
                top:  rect.bottom + 8,
                left: clampedLeft,
                transform: 'translateX(-50%)',
              } : {
                bottom: window.innerHeight - rect.top + 8,
                left:   clampedLeft,
                transform: 'translateX(-50%)',
              }}
            >
              {texto}
              {showBelow
                ? <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                : <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              }
            </div>
          );
        })(),
        document.body
      )}
    </span>
  );
};
