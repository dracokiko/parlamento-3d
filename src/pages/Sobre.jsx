import { Link } from 'react-router-dom';
import { Building2, Scale, Database, AlertCircle, Mail, User } from 'lucide-react';

function Secao({ titulo, icone: Icone, children }) {
  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-3">
        {Icone && <Icone size={16} className="text-blue-400 shrink-0" />}
        {titulo}
      </h2>
      <div className="text-sm text-gray-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function FonteItem({ nome, url, descricao }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-white/5 last:border-0">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
      >
        {nome}
      </a>
      <span className="text-xs text-gray-500">{descricao}</span>
    </div>
  );
}

export function Sobre() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100 flex flex-col">
      {/* ── Top nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-[#16213e] border-b border-white/10 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <Building2 size={16} />
          <span>Parlamento 3D</span>
        </Link>
        <span className="text-white/20">›</span>
        <span className="text-sm font-semibold text-white">Sobre</span>
        <div className="flex-1" />
        <Link to="/diretivas-eu" className="text-xs text-gray-400 hover:text-white transition-colors">Diretivas UE</Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">

        {/* ── Cabeçalho ────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Parlamento 3D</h1>
          <p className="text-gray-400 text-sm">
            Uma plataforma independente de monitorização da atividade parlamentar portuguesa.
          </p>
        </div>

        {/* ── Aviso de independência ─────────────────── */}
        <div className="rounded-xl border border-blue-700/40 bg-blue-900/10 px-5 py-4 mb-8 flex gap-3">
          <AlertCircle size={16} className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200 leading-relaxed">
            Este projeto é <strong>totalmente independente</strong> e não tem qualquer afiliação com a
            Assembleia da República, o Governo, partidos políticos ou quaisquer entidades públicas ou
            privadas. Não recebe financiamento público nem privado.
          </p>
        </div>

        <Secao titulo="O que é" icone={Building2}>
          <p>
            O Parlamento 3D é uma ferramenta de cidadania que apresenta de forma visual e acessível a
            composição e a atividade da Assembleia da República portuguesa (XVII Legislatura).
          </p>
          <p>
            Através de uma representação 3D do hemiciclo, é possível identificar cada deputado,
            consultar intervenções em plenário, iniciativas legislativas e debates parlamentares.
          </p>
          <p>
            A secção de Diretivas UE mostra o estado de transposição de diretivas europeias para o
            direito português — um processo que, quando em atraso, pode originar processos de
            infração e coimas à República Portuguesa.
          </p>
        </Secao>

        <Secao titulo="Imparcialidade" icone={Scale}>
          <p>
            Este projeto não tem agenda política nem favorece qualquer partido, grupo parlamentar ou
            posição ideológica. Os dados são apresentados tal como estão disponíveis publicamente.
          </p>
          <p>
            Os resumos gerados por inteligência artificial são meramente descritivos e não constituem
            julgamentos de valor sobre as posições políticas dos deputados.
          </p>
          <p>
            A metodologia de apresentação (ordenação, destaque, etc.) é baseada exclusivamente em
            critérios objetivos como o número de deputados por partido ou a data das intervenções.
          </p>
        </Secao>

        <Secao titulo="Fontes de dados" icone={Database}>
          <FonteItem
            nome="Dados Abertos da Assembleia da República"
            url="https://www.parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx"
            descricao="Deputados, iniciativas legislativas, debates e votações — XVII Legislatura"
          />
          <FonteItem
            nome="EUR-Lex CELLAR (SPARQL)"
            url="https://publications.europa.eu/webapi/rdf/sparql"
            descricao="Diretivas da UE, prazos de transposição e medidas nacionais de implementação"
          />
          <FonteItem
            nome="Diário da Assembleia da República (DAR)"
            url="https://www.parlamento.pt/DAR/Paginas/DAR.aspx"
            descricao="Transcrições das sessões plenárias"
          />
        </Secao>


        <Secao titulo="Draco's Company" icone={User}>
          <p>
            O Parlamento 3D é um projeto da <strong>Draco's Company</strong>, uma iniciativa individual
            criada por um jovem português com o objetivo de tornar a informação parlamentar mais
            acessível e transparente para todos os cidadãos.
          </p>
        </Secao>

        <Secao titulo="Sugestões e contacto" icone={Mail}>
          <p>
            Sugestões, correções ou ideias para melhorar esta plataforma são muito bem-vindas.
            Podes enviá-las para{' '}
            <a
              href="mailto:dracoscompany@gmail.com"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              dracoscompany@gmail.com
            </a>
            .
          </p>
        </Secao>

        <div className="mt-10 border-t border-white/5 pt-6 space-y-2 text-center">
          <p className="text-xs text-amber-600/70">
            As informações disponibilizadas neste website podem estar incompletas, desatualizadas ou
            conter imprecisões. Consulte sempre as fontes oficiais para decisões que dependam destes dados.
          </p>
          <p className="text-xs text-gray-600">
            Parlamento 3D · Projeto independente · Dados públicos da AR e EUR-Lex
          </p>
        </div>
      </main>
    </div>
  );
}