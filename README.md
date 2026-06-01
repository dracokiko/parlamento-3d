# Parlamento 3D — Assembleia da República Portuguesa

Visualização 3D interativa do hemiciclo da Assembleia da República, permitindo explorar deputados, partidos e intervenções parlamentares com resumos gerados por IA.

## Funcionalidades

- **Hemiciclo 3D interativo** com 230 assentos posicionados em arcos concêntricos, replicando a disposição real do plenário
- **Câmara orbital** com rotação 360°, zoom e pan via OrbitControls
- **Hover/Click nos assentos** — tooltip 3D com nome do deputado + abertura de painel detalhado
- **Destaque por partido** — clicar na legenda foca a câmara nesse grupo parlamentar e esbate os restantes
- **Perfil do deputado** com estatísticas (presença, intervenções), círculo eleitoral e comissões
- **Lista de reuniões plenárias** onde o deputado interveio
- **Resumos gerados por IA** com contexto, pontos principais, posição (a favor/contra/neutra), tom e tags
- **Transcrição oficial** integral em modal com opções de cópia, download e link para a fonte (parlamento.pt)

## Stack tecnológica

- **React 18** com Hooks modernos
- **React Three Fiber** + **@react-three/drei** para a cena 3D (wrapper React sobre Three.js)
- **Tailwind CSS** para styling utility-first
- **Vite** como build tool
- **Lucide React** para ícones
- **Context API** para estado global (sem Redux — projeto pequeno o suficiente)

## Instalação

Pré-requisitos: Node.js 18+ e npm/yarn/pnpm.

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd parlamento-3d

# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm run preview   # Pré-visualização local do build
```

## Estrutura do projeto

```
parlamento-3d/
├── public/                          # Assets estáticos
├── src/
│   ├── components/
│   │   ├── Hemiciclo/              # Cena 3D
│   │   │   ├── CenaHemiciclo.jsx   # Canvas principal + iluminação + câmara
│   │   │   ├── Assento.jsx         # Mesh individual de cada assento
│   │   │   ├── EstruturaHemiciclo.jsx # Chão, degraus, tribuna
│   │   │   ├── LegendaPartidos.jsx # Overlay 2D com legenda clicável
│   │   │   └── ControlosCamara.jsx # Botões de reset/ajuda
│   │   ├── PainelDeputado/         # Nível 2: perfil do deputado
│   │   │   ├── PainelDeputado.jsx  # Drawer lateral
│   │   │   └── ListaIntervencoes.jsx
│   │   ├── IntervencaoView/        # Nível 3: detalhe da intervenção
│   │   │   ├── DetalheIntervencao.jsx
│   │   │   ├── ResumoIA.jsx        # Card destacado com resumo IA
│   │   │   └── ModalTranscricao.jsx # Modal com texto integral
│   │   └── UI/
│   │       ├── Header.jsx
│   │       └── LoadingScene.jsx
│   ├── context/
│   │   └── ParlamentoContext.jsx   # Estado global (deputado, intervenção, etc.)
│   ├── data/
│   │   ├── mockPartidos.js         # 8 partidos com cores oficiais
│   │   ├── mockDeputados.js        # 230 deputados procedural
│   │   └── mockIntervencoes.js     # Reuniões + gerador de intervenções
│   ├── utils/
│   │   ├── posicoes3D.js           # Cálculo das posições no hemiciclo
│   │   └── formatters.js           # Formatação de datas, percentagens
│   ├── App.jsx                     # Componente raiz
│   ├── main.jsx                    # Entry point React
│   └── index.css                   # Estilos globais + Tailwind
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.js
```

## Arquitetura — separação de responsabilidades

A aplicação segue uma separação clara entre três camadas:

**1. Dados (`src/data/`)** — Dados mock estáticos ou gerados proceduralmente. Em produção, estes módulos seriam substituídos por chamadas à API oficial da AR (DAR — Diário da Assembleia da República).

**2. Lógica (`src/context/`, `src/utils/`)** — Estado global de navegação e cálculos geométricos para o posicionamento 3D. Independente da camada visual.

**3. UI (`src/components/`)** — Componentes React puros que consomem dados e contexto. Cada componente tem uma responsabilidade única e está num ficheiro próprio.

## Como navegar (UX)

| Ação | Resultado |
|---|---|
| Arrastar com botão esquerdo | Rodar a câmara em torno do hemiciclo |
| Roda do rato | Zoom in/out |
| Arrastar com botão direito | Mover a câmara (pan) |
| Hover sobre um assento | Tooltip com nome + partido + taxa de presença |
| Clicar num assento | Abre painel do deputado |
| Clicar num partido (legenda) | Destaca esse grupo e foca a câmara |
| Clicar numa reunião (painel) | Abre detalhe da intervenção com resumo IA |
| "Ver transcrição oficial" | Abre modal com texto integral |

## Performance

- Cada `<Assento>` é envolvido em `React.memo` para evitar re-renders quando o estado global muda mas o assento específico não é afetado
- As posições 3D são pré-calculadas uma vez ao iniciar (`mapaPosicoes3D`) e reutilizadas em todos os renders
- As intervenções de cada deputado só são geradas quando o utilizador abre o painel (lazy, via `useMemo`)
- O canvas usa `dpr={[1, 2]}` para limitar a densidade de pixels em ecrãs Retina

## Acessibilidade

- ARIA labels em todos os elementos 3D clicáveis e botões
- Estrutura de `role="dialog"` nos painéis e modais
- Navegação por teclado nos overlays UI (Tab + Enter)
- Contraste cumprindo WCAG AA nos painéis (texto escuro sobre branco)
- Estados focus-visible para utilizadores de teclado

## Próximos passos (integração com APIs reais)

Esta versão usa dados mock. Para uma versão de produção, recomenda-se:

1. **API da Assembleia da República** — A AR disponibiliza dados abertos em [parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx](https://www.parlamento.pt/Cidadania/Paginas/DadosAbertos.aspx). Endpoints relevantes:
   - Lista de deputados da legislatura
   - Reuniões plenárias e ordem do dia
   - Diário da Assembleia da República (DAR) com transcrições

2. **Resumos por IA** — Pipeline server-side que, para cada nova intervenção transcrita no DAR, chame um modelo (ex: Claude) para gerar o JSON com contexto, pontos principais, posição e tags. Cache em base de dados.

3. **Fotos oficiais** — A AR publica fotografias oficiais dos deputados em `parlamento.pt/DeputadoGP/Paginas/Biografia.aspx?BID={id}`. Convém solicitar autorização e fazer cache local.

4. **Persistência e pesquisa** — Adicionar PostgreSQL ou similar para queries do tipo "todas as intervenções do PS sobre saúde no último mês".

5. **Otimização 3D adicional** — Para integrar todos os ~230 deputados com modelos mais detalhados, considerar `<InstancedMesh>` (uma única geometria reutilizada em GPU) em vez de 230 `<mesh>` individuais.

## Limitações conhecidas

- Os dados são mock — nomes, fotos, intervenções e transcrições são gerados, não reais
- Os assentos são cilindros simples — para produção poderia desenhar-se um modelo `.glb` mais fiel
- Não há autenticação nem persistência de favoritos
- Mobile: o 3D funciona mas o painel lateral ocupa o ecrã todo (poderia ser convertido em bottom-sheet)

## Licença

Projeto demonstrativo. Use livremente como base para projetos cívicos / educacionais.
