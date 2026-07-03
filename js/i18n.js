// Internationalization: English (canonical) + Portuguese (pt-PT).
//
// Case data stays canonical English on disk; Portuguese is a presentation
// layer resolved at render time. Portuguese needs grammatical gender, so room
// and object entries carry the article forms they appear with in clue prose.

const LS_KEY = 'murdoku.v1.lang';

export function getLang() {
  try { return localStorage.getItem(LS_KEY) === 'pt' ? 'pt' : 'en'; } catch { return 'en'; }
}

export function setLang(lang) {
  try { localStorage.setItem(LS_KEY, lang === 'pt' ? 'pt' : 'en'); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// UI strings
// ---------------------------------------------------------------------------
const UI = {
  en: {
    tagline: 'Every square tells a story.\nOne of them is a lie.',
    heroSub: 'Place every suspect on the crime-scene map — one per row, one per column — so that every clue holds. The last free square reveals the victim… and whoever is alone with them is the murderer.',
    daily: 'Today’s Case', random: 'Random Case', learn: 'Learn to Play',
    dailyBusy: 'Building today’s scene…', randomBusy: 'Shuffling suspects…',
    howToPlay: 'How to play', caseFiles: 'Case Files', cases: '← Cases', brief: 'Brief',
    suspectsVictim: 'Suspects & Victim', selectThenTap: 'select, then tap the map',
    placing: (name) => `placing ${name} — tap a square (Esc cancels)`,
    mark: 'Mark', undo: 'Undo', redo: 'Redo', checkBtn: 'Check', hint: 'Hint',
    reset: 'Reset', accuse: 'Accuse',
    liveCheck: 'Live error check', autoX: 'Auto-✕ rows & columns',
    caseFileNo: (n) => `CASE FILE №${n}`, openInvestigation: 'OPEN INVESTIGATION',
    solved: '✓ solved', inProgress: '⏳ in progress',
    difficulty: { easy: 'gentle', medium: 'tricky', hard: 'devious' },
    whoDidIt: 'Who did it?',
    accuseSub: 'The murderer was alone with the victim in the same room.',
    notYet: 'Not yet',
    caseClosed: 'Case closed!', juryNotConvinced: 'The jury is not convinced',
    wrongAccusation: (name) => `${name} produces an alibi and walks free. Someone in this room is smiling. Re-examine who was truly alone with the victim.`,
    replay: 'Replay', moreCases: 'More cases', keepInvestigating: 'Keep investigating',
    backToCases: 'Back to cases',
    deduction: '🔍 A deduction', keepToMyself: 'Keep it to myself',
    showOnMap: 'Show me on the map', showMisplaced: 'Show me the misplaced person',
    beginInvestigation: 'Begin the investigation',
    gotIt: 'Got it', cancel: 'Cancel',
    startOver: 'Start over?',
    startOverText: 'This clears every placement and ✕ on the board. The case stays the same.',
    clearBoard: 'Clear the board',
    freshStart: 'A fresh start. The truth is still in there.',
    resumed: 'Investigation resumed where you left off.',
    blockedSpot: 'Nobody can stand there — the spot is blocked.',
    victimLocked: 'The victim is evidence — the body is revealed by your deductions.',
    squareTaken: 'That square is taken.',
    removeFirst: 'Remove the person first to cross that square out.',
    selectFirst: 'Select a suspect card first, or use ✕ to cross squares out.',
    allChecksOut: 'Everything checks out. Time to point a finger…',
    noContradictions: (a, b) => `No contradictions so far — ${a}/${b} placed.`,
    notQuite: 'Not quite:', rowColConflict: 'two people share a row or column',
    cluesBroken: (n) => n > 1 ? `${n} clues are broken` : '1 clue is broken',
    boardFull: 'The board is full — press Check or make your accusation.',
    placeEveryoneFirst: (a, b) => `Place every suspect first — ${a}/${b} on the map.`,
    fixFirst: 'Fix the conflicts and broken clues first — the jury wants a flawless map.',
    victimNoRoom: 'No free square is left for the victim — one of your placements must be wrong.',
    victimRevealed: (name, room) => `The body of ${name} is found — in the ${room}!`,
    accuseReadyTitle: 'Name the murderer',
    accuseGatedTitle: 'Place every suspect with no conflicts and no broken clues first',
    statHints: (n) => `💡 ${n} hint${n === 1 ? '' : 's'}`,
    statMistakes: (n) => `✗ ${n} mistake${n === 1 ? '' : 's'}`,
    deadSecrets: 'The dead keep their secrets.',
    victimRevealHint: 'The last free square — one row, one column — will reveal where the body lies.',
    noStatement: 'No statement given.',
    stmtHolds: 'statement holds: ', stmtBroken: 'statement broken: ',
    helpTitle: 'How to play Murdoku',
    helpSteps: [
      ['The map is the crime scene.', ' It is divided into colored rooms. Squares with furniture are blocked — nobody can stand there.'],
      ['Place every suspect', ' on empty squares so that each row and each column contains exactly one person.'],
      ['Clues are rules, not hints.', ' Every statement on every card must be true in your final layout. “Beside” means directly adjacent horizontally or vertically and in the same room — never diagonally, and never across a wall. “South of” means strictly lower on the map.'],
      ['Mark impossibilities.', ' Use the ✕ tool (or right-click / long-press) to cross out squares a person can’t occupy. Good detectives eliminate first.'],
      ['The last square reveals the victim.', ' With every suspect placed, exactly one row and one column remain free — their crossing is where the body lies. The murderer is the suspect alone with the victim in that room. Make your accusation!'],
    ],
    helpNote: 'Every case has exactly one solution, and none of them ever requires guessing — there is always a next deduction to find.',
    helpKbd: 'Keyboard: arrows move around the map · 1–9 select a suspect · Enter place · X cross out · M mark tool · H hint · Ctrl+Z/Y undo/redo · Esc cancel.',
    langName: 'PT', langLabel: 'Mudar para português',
    themeLabel: 'Toggle dark or light theme',
    hintFocus: (name, clues) => clues
      ? `Focus on ${name}: ${clues}. Combined with the one-per-row-and-column rule, only one square works.`
      : `Focus on ${name}: after everyone else’s clues and the one-per-row-and-column rule, only one square remains.`,
    hintMistake: (name) => `${name} is misplaced — re-check the clues on that card.`,
    genTitle: { daily: 'Today’s Case', random: 'Cold Case' },
    deathAt: (place) => `Death at the ${place}`,
    couldNotBuild: 'Could not build today’s case — try a random one.',
    genEmpty: 'The generator came up empty — try again.',
    pickedUp: (name) => `${name} picked up. Choose a new square.`,
    placedAt: (name, r, c) => `${name} placed at row ${r}, column ${c}.`,
    selectedChoose: (name) => `${name} selected. Choose a square.`,
    selectionCleared: 'Selection cleared.',
    cancelledBack: 'Selection cancelled — returned to their square.',
    crossedOut: 'Square crossed out.', crossRemoved: 'Cross removed.',
    undone: 'Undone.', redone: 'Redone.',
    victimAnnounce: (name, room) => `The victim ${name} is revealed in the ${room}.`,
  },

  pt: {
    tagline: 'Cada casa conta uma história.\nUma delas é mentira.',
    heroSub: 'Coloca todos os suspeitos no mapa da cena do crime — um por linha, um por coluna — de modo a que todas as pistas sejam verdadeiras. A última casa livre revela a vítima… e quem estiver sozinho com ela é o assassino.',
    daily: 'Caso do Dia', random: 'Caso Aleatório', learn: 'Aprender a Jogar',
    dailyBusy: 'A montar a cena de hoje…', randomBusy: 'A baralhar os suspeitos…',
    howToPlay: 'Como jogar', caseFiles: 'Processos', cases: '← Casos', brief: 'Dossier',
    suspectsVictim: 'Suspeitos & Vítima', selectThenTap: 'escolhe e toca no mapa',
    placing: (name) => `a colocar ${name} — toca numa casa (Esc cancela)`,
    mark: 'Marcar', undo: 'Anular', redo: 'Refazer', checkBtn: 'Verificar', hint: 'Dica',
    reset: 'Reiniciar', accuse: 'Acusar',
    liveCheck: 'Verificação de erros ao vivo', autoX: 'Auto-✕ em linhas e colunas',
    caseFileNo: (n) => `PROCESSO Nº${n}`, openInvestigation: 'INVESTIGAÇÃO ABERTA',
    solved: '✓ resolvido', inProgress: '⏳ em curso',
    difficulty: { easy: 'suave', medium: 'astuto', hard: 'diabólico' },
    whoDidIt: 'Quem foi?',
    accuseSub: 'O assassino esteve sozinho com a vítima na mesma divisão.',
    notYet: 'Ainda não',
    caseClosed: 'Caso encerrado!', juryNotConvinced: 'O júri não está convencido',
    wrongAccusation: (name) => `${name} apresenta um álibi e sai em liberdade. Alguém nesta sala está a sorrir. Reexamina quem esteve realmente sozinho com a vítima.`,
    replay: 'Jogar de novo', moreCases: 'Mais casos', keepInvestigating: 'Continuar a investigar',
    backToCases: 'Voltar aos casos',
    deduction: '🔍 Uma dedução', keepToMyself: 'Deixa-me pensar',
    showOnMap: 'Mostra-me no mapa', showMisplaced: 'Mostra-me quem está mal colocado',
    beginInvestigation: 'Começar a investigação',
    gotIt: 'Entendido', cancel: 'Cancelar',
    startOver: 'Recomeçar?',
    startOverText: 'Isto limpa todas as colocações e ✕ do tabuleiro. O caso mantém-se igual.',
    clearBoard: 'Limpar o tabuleiro',
    freshStart: 'Um recomeço. A verdade continua lá dentro.',
    resumed: 'Investigação retomada onde a deixaste.',
    blockedSpot: 'Ninguém pode ficar aí — a casa está bloqueada.',
    victimLocked: 'A vítima é a prova — o corpo revela-se com as tuas deduções.',
    squareTaken: 'Essa casa está ocupada.',
    removeFirst: 'Retira primeiro a pessoa para poderes riscar essa casa.',
    selectFirst: 'Escolhe primeiro um cartão de suspeito, ou usa o ✕ para riscar casas.',
    allChecksOut: 'Está tudo certo. Hora de apontar o dedo…',
    noContradictions: (a, b) => `Sem contradições até agora — ${a}/${b} colocados.`,
    notQuite: 'Ainda não:', rowColConflict: 'duas pessoas partilham uma linha ou coluna',
    cluesBroken: (n) => n > 1 ? `${n} pistas estão violadas` : '1 pista está violada',
    boardFull: 'O tabuleiro está completo — carrega em Verificar ou faz a tua acusação.',
    placeEveryoneFirst: (a, b) => `Coloca primeiro todos os suspeitos — ${a}/${b} no mapa.`,
    fixFirst: 'Resolve primeiro os conflitos e as pistas violadas — o júri exige um mapa impecável.',
    victimNoRoom: 'Não sobra nenhuma casa livre para a vítima — alguma colocação está errada.',
    victimRevealed: (name, room) => `O corpo de ${name} é encontrado — ${room}!`,
    accuseReadyTitle: 'Aponta o assassino',
    accuseGatedTitle: 'Coloca primeiro todos os suspeitos, sem conflitos nem pistas violadas',
    statHints: (n) => `💡 ${n} dica${n === 1 ? '' : 's'}`,
    statMistakes: (n) => `✗ ${n} erro${n === 1 ? '' : 's'}`,
    deadSecrets: 'Os mortos guardam os seus segredos.',
    victimRevealHint: 'A última casa livre — uma linha, uma coluna — revelará onde jaz o corpo.',
    noStatement: 'Sem declaração.',
    stmtHolds: 'declaração verdadeira: ', stmtBroken: 'declaração violada: ',
    helpTitle: 'Como jogar Murdoku',
    helpSteps: [
      ['O mapa é a cena do crime.', ' Está dividido em divisões coloridas. As casas com mobília estão bloqueadas — ninguém pode ficar lá.'],
      ['Coloca todos os suspeitos', ' em casas vazias, de modo a que cada linha e cada coluna contenham exatamente uma pessoa.'],
      ['As pistas são regras, não sugestões.', ' Todas as declarações de todos os cartões têm de ser verdadeiras no teu esquema final. “Ao lado de” significa diretamente adjacente na horizontal ou vertical e na mesma divisão — nunca na diagonal, nunca através de uma parede. “A sul de” significa estritamente mais abaixo no mapa.'],
      ['Risca as impossibilidades.', ' Usa a ferramenta ✕ (ou clique direito / toque longo) para riscar casas onde alguém não pode estar. Os bons detetives eliminam primeiro.'],
      ['A última casa revela a vítima.', ' Com todos os suspeitos colocados, sobra exatamente uma linha e uma coluna livres — no seu cruzamento jaz o corpo. O assassino é o suspeito sozinho com a vítima nessa divisão. Faz a tua acusação!'],
    ],
    helpNote: 'Todos os casos têm exatamente uma solução, e nenhum exige adivinhar — há sempre uma próxima dedução para encontrar.',
    helpKbd: 'Teclado: setas movem no mapa · 1–9 escolhem um suspeito · Enter coloca · X risca · M ferramenta de marcar · H dica · Ctrl+Z/Y anular/refazer · Esc cancela.',
    langName: 'EN', langLabel: 'Switch to English',
    themeLabel: 'Alternar tema claro ou escuro',
    hintFocus: (name, clues) => clues
      ? `Concentra-te em ${name}: ${clues}. Combinado com a regra de um por linha e coluna, só uma casa serve.`
      : `Concentra-te em ${name}: depois das pistas dos outros e da regra de um por linha e coluna, só resta uma casa.`,
    hintMistake: (name) => `${name} está mal colocado — revê as pistas desse cartão.`,
    genTitle: { daily: 'Caso do Dia', random: 'Caso Arquivado' },
    deathAt: (place) => `Morte ${place}`,
    couldNotBuild: 'Não foi possível montar o caso de hoje — tenta um aleatório.',
    genEmpty: 'O gerador não conseguiu — tenta outra vez.',
    pickedUp: (name) => `${name} levantado. Escolhe uma nova casa.`,
    placedAt: (name, r, c) => `${name} colocado na linha ${r}, coluna ${c}.`,
    selectedChoose: (name) => `${name} selecionado. Escolhe uma casa.`,
    selectionCleared: 'Seleção limpa.',
    cancelledBack: 'Seleção cancelada — voltou à sua casa.',
    crossedOut: 'Casa riscada.', crossRemoved: 'Risco removido.',
    undone: 'Anulado.', redone: 'Refeito.',
    victimAnnounce: (name, room) => `A vítima ${name} é revelada ${room}.`,
  },
};

export function t(key, ...args) {
  const val = UI[getLang()][key] ?? UI.en[key];
  return typeof val === 'function' ? val(...args) : val;
}

// ---------------------------------------------------------------------------
// Rooms: canonical EN name -> PT label + locative phrase ("na Biblioteca").
// ---------------------------------------------------------------------------
const ROOMS_PT = {
  Library: { label: 'Biblioteca', loc: 'na Biblioteca' },
  Parlor: { label: 'Salão', loc: 'no Salão' },
  Conservatory: { label: 'Estufa', loc: 'na Estufa' },
  Kitchen: { label: 'Cozinha', loc: 'na Cozinha' },
  Gallery: { label: 'Galeria', loc: 'na Galeria' },
  Cellar: { label: 'Cave', loc: 'na Cave' },
  Storefront: { label: 'Loja', loc: 'na Loja' },
  Bakehouse: { label: 'Sala do Forno', loc: 'na Sala do Forno' },
  Pantry: { label: 'Despensa', loc: 'na Despensa' },
  Courtyard: { label: 'Pátio', loc: 'no Pátio' },
  'Cold Room': { label: 'Câmara Fria', loc: 'na Câmara Fria' },
  Dome: { label: 'Cúpula', loc: 'na Cúpula' },
  'Chart Room': { label: 'Sala das Cartas', loc: 'na Sala das Cartas' },
  Workshop: { label: 'Oficina', loc: 'na Oficina' },
  Stairwell: { label: 'Escadaria', loc: 'na Escadaria' },
  Archive: { label: 'Arquivo', loc: 'no Arquivo' },
  'Gaming Floor': { label: 'Sala de Jogo', loc: 'na Sala de Jogo' },
  'Cashier Cage': { label: 'Caixa', loc: 'na Caixa' },
  Lounge: { label: 'Bar', loc: 'no Bar' },
  'Back Office': { label: 'Escritório', loc: 'no Escritório' },
  Terrace: { label: 'Terraço', loc: 'no Terraço' },
  Stage: { label: 'Palco', loc: 'no Palco' },
  'Orchestra Pit': { label: 'Fosso da Orquestra', loc: 'no Fosso da Orquestra' },
  'Dressing Room': { label: 'Camarim', loc: 'no Camarim' },
  Foyer: { label: 'Foyer', loc: 'no Foyer' },
  'Fly Tower': { label: 'Urdimento', loc: 'no Urdimento' },
  Bridge: { label: 'Ponte', loc: 'na Ponte' },
  Salon: { label: 'Salão Nobre', loc: 'no Salão Nobre' },
  'Cargo Hold': { label: 'Porão', loc: 'no Porão' },
  Promenade: { label: 'Convés', loc: 'no Convés' },
  'Engine Room': { label: 'Casa das Máquinas', loc: 'na Casa das Máquinas' },
  'Rose Maze': { label: 'Labirinto de Rosas', loc: 'no Labirinto de Rosas' },
  Greenhouse: { label: 'Estufa', loc: 'na Estufa' },
  Orchard: { label: 'Pomar', loc: 'no Pomar' },
  Apiary: { label: 'Apiário', loc: 'no Apiário' },
  Gazebo: { label: 'Coreto', loc: 'no Coreto' },
  'Grand Hall': { label: 'Grande Átrio', loc: 'no Grande Átrio' },
  'Egyptian Wing': { label: 'Ala Egípcia', loc: 'na Ala Egípcia' },
  Vault: { label: 'Cofre', loc: 'no Cofre' },
  Rotunda: { label: 'Rotunda', loc: 'na Rotunda' },
  'Curator Office': { label: 'Gabinete do Curador', loc: 'no Gabinete do Curador' },
};

export function roomLabel(name) {
  if (getLang() === 'pt') return ROOMS_PT[name]?.label ?? name;
  return name;
}

// "in the Library" / "na Biblioteca"
export function roomLoc(name) {
  if (getLang() === 'pt') return ROOMS_PT[name]?.loc ?? `em ${name}`;
  return `in the ${name}`;
}

// ---------------------------------------------------------------------------
// Objects: EN label/plural live in roster OBJECT_NAMES; PT here with gender.
// ---------------------------------------------------------------------------
const OBJECTS_PT = {
  bookshelf: { s: 'estante', p: 'estantes', g: 'f' },
  plant: { s: 'planta', p: 'plantas', g: 'f' },
  candelabrum: { s: 'candelabro', p: 'candelabros', g: 'm' },
  armchair: { s: 'poltrona', p: 'poltronas', g: 'f' },
  clock: { s: 'relógio de pé', p: 'relógios de pé', g: 'm' },
  piano: { s: 'piano', p: 'pianos', g: 'm' },
  oven: { s: 'forno', p: 'fornos', g: 'm' },
  sack: { s: 'saco de farinha', p: 'sacos de farinha', g: 'm' },
  cake: { s: 'bolo de noiva', p: 'bolos de noiva', g: 'm' },
  telescope: { s: 'telescópio', p: 'telescópios', g: 'm' },
  globe: { s: 'globo celeste', p: 'globos celestes', g: 'm' },
  desk: { s: 'escrivaninha', p: 'escrivaninhas', g: 'f' },
  slot: { s: 'slot machine', p: 'slot machines', g: 'f' },
  cards: { s: 'mesa de cartas', p: 'mesas de cartas', g: 'f' },
  vault: { s: 'porta do cofre', p: 'portas do cofre', g: 'f' },
  harp: { s: 'harpa', p: 'harpas', g: 'f' },
  curtain: { s: 'cortina de veludo', p: 'cortinas de veludo', g: 'f' },
  chandelier: { s: 'lustre caído', p: 'lustres caídos', g: 'm' },
  crate: { s: 'caixote de carga', p: 'caixotes de carga', g: 'm' },
  lantern: { s: 'lanterna', p: 'lanternas', g: 'f' },
  wheel: { s: 'leme', p: 'lemes', g: 'm' },
  fern: { s: 'feto gigante', p: 'fetos gigantes', g: 'm' },
  fountain: { s: 'fonte de pedra', p: 'fontes de pedra', g: 'f' },
  beehive: { s: 'colmeia', p: 'colmeias', g: 'f' },
  statue: { s: 'estátua de mármore', p: 'estátuas de mármore', g: 'f' },
  sarcophagus: { s: 'sarcófago', p: 'sarcófagos', g: 'm' },
  display: { s: 'vitrine', p: 'vitrines', g: 'f' },
};

// grammar helpers for PT clue prose
const ptObj = (type) => OBJECTS_PT[type] ?? { s: type, p: `${type}s`, g: 'm' };
const um = (o) => (o.g === 'f' ? `uma ${o.s}` : `um ${o.s}`);
const nenhum = (o) => (o.g === 'f' ? `nenhuma ${o.s}` : `nenhum ${o.s}`);
const doDa = (o) => (o.g === 'f' ? `da ${o.s}` : `do ${o.s}`);
const todos = (o) => (o.g === 'f' ? `todas as ${o.p}` : `todos os ${o.p}`);

// ---------------------------------------------------------------------------
// Clue prose per language. `ctx` provides names and counts.
// ---------------------------------------------------------------------------
const DIR = {
  en: { north: 'north', south: 'south', east: 'east', west: 'west' },
  pt: { north: 'norte', south: 'sul', east: 'este', west: 'oeste' },
};

export function clueProse(clue, ctx) {
  // ctx: {roomName(r), personName(pid), objEn(type)->{label,plural}, objCount(type), ownerGender}
  const lang = getLang();
  const d = DIR[lang][clue.dir];

  if (lang === 'pt') {
    const o = clue.objType ? ptObj(clue.objType) : null;
    switch (clue.kind) {
      case 'in_room': return `estava ${roomLoc(ctx.roomName(clue.room))}`;
      case 'not_in_room': return `não estava ${roomLoc(ctx.roomName(clue.room))}`;
      case 'beside_object': return `estava ao lado de ${um(o)}`;
      case 'not_beside_object': return `não estava ao lado de ${nenhum(o)}`;
      case 'same_row_object': return `estava na mesma linha que ${um(o)}`;
      case 'same_col_object': return `estava na mesma coluna que ${um(o)}`;
      case 'dir_of_object':
        return ctx.objCount(clue.objType) > 1
          ? `estava a ${d} de ${todos(o)}`
          : `estava a ${d} ${doDa(o)}`;
      case 'dir_of_person': return `estava a ${d} de ${ctx.personName(clue.other)}`;
      case 'beside_person': return `estava ao lado de ${ctx.personName(clue.other)}`;
      case 'not_beside_person': return `não estava ao lado de ${ctx.personName(clue.other)}`;
      case 'same_room_person': return `estava na mesma divisão que ${ctx.personName(clue.other)}`;
      case 'not_same_room_person': return `não estava na mesma divisão que ${ctx.personName(clue.other)}`;
      case 'alone': return ctx.ownerGender === 'f' ? 'estava sozinha numa divisão' : 'estava sozinho numa divisão';
      case 'edge': return `estava junto à parede ${d}`;
      default: return JSON.stringify(clue);
    }
  }

  const obj = clue.objType ? ctx.objEn(clue.objType) : null;
  switch (clue.kind) {
    case 'in_room': return `was in the ${ctx.roomName(clue.room)}`;
    case 'not_in_room': return `was not in the ${ctx.roomName(clue.room)}`;
    case 'beside_object': return `was beside a ${obj.label}`;
    case 'not_beside_object': return `was not beside any ${obj.label}`;
    case 'same_row_object': return `was in the same row as a ${obj.label}`;
    case 'same_col_object': return `was in the same column as a ${obj.label}`;
    case 'dir_of_object':
      return ctx.objCount(clue.objType) > 1
        ? `was ${d} of every ${obj.label}`
        : `was ${d} of the ${obj.label}`;
    case 'dir_of_person': return `was ${d} of ${ctx.personName(clue.other)}`;
    case 'beside_person': return `was beside ${ctx.personName(clue.other)}`;
    case 'not_beside_person': return `was not beside ${ctx.personName(clue.other)}`;
    case 'same_room_person': return `was in the same room as ${ctx.personName(clue.other)}`;
    case 'not_same_room_person': return `was not in the same room as ${ctx.personName(clue.other)}`;
    case 'alone': return 'was alone in a room';
    case 'edge': return `was against the ${d} wall`;
    default: return JSON.stringify(clue);
  }
}

// ---------------------------------------------------------------------------
// People roles
// ---------------------------------------------------------------------------
const ROLES_PT = {
  'the veiled widow': 'a viúva do véu',
  'the retired colonel': 'o coronel na reserva',
  'the village physician': 'o médico da vila',
  'the jewel heiress': 'a herdeira das joias',
  'the temperamental chef': 'o chef temperamental',
  'the storm-worn captain': 'o capitão dos temporais',
  'the absent-minded professor': 'o professor distraído',
  'the cabaret singer': 'a cantora de cabaré',
  'the millionaire host': 'o anfitrião milionário',
  'the master baker': 'o mestre padeiro',
  'the royal astronomer': 'a astrónoma real',
  'the pit boss': 'o chefe de mesa',
  'the tyrant conductor': 'o maestro tirano',
  'the retiring diplomat': 'a diplomata em despedida',
  'the prize horticulturist': 'o horticultor premiado',
  'the museum curator': 'o curador do museu',
  'the untouchable mayor': 'o presidente da câmara intocável',
  'the exiled duchess': 'a grã-duquesa exilada',
  'the pawnbroker': 'o penhorista',
  'the night nurse': 'a enfermeira da noite',
  'the bookmaker': 'o corretor de apostas',
  'the fortune teller': 'a vidente',
  victim: 'vítima', guest: 'convidado',
};

export function roleLabel(role) {
  if (getLang() === 'pt') return ROLES_PT[role] ?? role;
  return role;
}

// ---------------------------------------------------------------------------
// Case stories (campaign, by id). Original writing in both languages.
// ---------------------------------------------------------------------------
const STORIES_PT = {
  c01: {
    title: 'O Caso do Solar Gilt',
    intro: 'O milionário Barnaby Gilt convidou três pessoas para brandy e gabarolice. À meia-noite, só a gabarolice tinha parado — permanentemente. Reconstrói onde estava cada um quando as luzes se apagaram.',
    reveal: 'Encurralado pelo teu mapa impecável do solar, {murderer} confessou: o testamento ia ser reescrito de madrugada, e {murdererShort} preferia a aritmética antiga.',
  },
  c02: {
    title: 'A Morte Levedou de Madrugada',
    intro: 'O mestre padeiro Otto Crumb foi encontrado frio ao lado da massa a levedar — que, ao contrário dele, cresceu. Três visitantes madrugadores estavam na padaria. A farinha no chão lembra-se de cada passo.',
    reveal: 'A farinha nunca mente. {murderer} tinha vendido a massa-mãe secreta da casa a um rival — e o Otto encontrou o recibo.',
  },
  c03: {
    title: 'O Cometa Que Nunca Chegou',
    intro: 'A Dra. Celeste Starr prometeu à vila um cometa às 23h07. Às 23h08 estava morta debaixo da própria cúpula. Quatro colegas estavam lá dentro quando os taipais encravaram.',
    reveal: 'O teu mapa do observatório não deixou sombra onde alguém se escondesse. {murderer} tinha falsificado os dados do cometa para garantir financiamento — e a Celeste ia publicar a verdade.',
  },
  c04: {
    title: 'Olhos de Cobra no Silver Slipper',
    intro: 'O chefe de mesa Sonny Marlow dizia sempre que a casa nunca perde. Esta noite a casa perdeu-o a ele. Quatro clientes ainda estavam na sala quando as fichas pararam de tilintar.',
    reveal: 'As probabilidades acabaram por cobrar. {murderer} devia ao Silver Slipper mais do que dinheiro — e o Sonny tinha começado a cobrar em segredos.',
  },
  c05: {
    title: 'Ária para um Maestro Morto',
    intro: 'O maestro Rex Fontaine cortou o solo da soprano uma vez a mais. Durante o apagão do segundo ato, alguém cortou o dele. Cinco membros da companhia nunca saíram do teatro.',
    reveal: 'Bravo! Com o palco mapeado ao centímetro, {murderer} desabou nos bastidores: o Fontaine tinha ameaçado acabar com uma carreira esta noite — em vez disso, alguém acabou com o encore dele.',
  },
  c06: {
    title: 'A Última Viagem do SS Meridian',
    intro: 'A embaixadora Iris Pemberly embarcou no SS Meridian com uma pasta que nunca largava. Algures entre o nevoeiro e a sereia do navio, largou-a. Cinco passageiros sabem exatamente onde estavam.',
    reveal: 'A pasta continha nomes — um deles era o de {murderer}. As memórias da embaixadora serão agora publicadas a título póstumo, com um capítulo escrito por ti.',
  },
  c07: {
    title: 'A Festa no Jardim dos Espinhos',
    intro: 'Sir Digby Thorn revelou a sua rosa negra a seis convidados na festa de verão. À hora do chá, a rosa tinha desaparecido — e Sir Digby também. As sebes viram tudo. Tu também.',
    reveal: 'Podado, finalmente. {murderer} tinha criado a rosa negra a partir de um enxerto roubado — o discurso de Sir Digby ia denunciar o ladrão.',
  },
  c08: {
    title: 'Meia-Noite no Museu Meridian',
    intro: 'O curador Maximilian Locke ficou até tarde a autenticar um escaravelho de ouro. O escaravelho era verdadeiro; os álibis não. Seis visitantes fora de horas ficaram trancados com ele.',
    reveal: 'Caso encerrado, exposição aberta. {murderer} vendia falsificações pela loja do museu há anos — o livro de autenticações do Locke era o fio solto que acabaste de puxar.',
  },
};

// Generated (daily/random) case texts, addressed by index.
const GEN = {
  en: {
    intros: [
      'The invitation said “an evening to die for”. Somebody took it literally. Reconstruct where every guest stood when the scream rang out.',
      'The doors were locked from the inside and the clock had stopped. Everyone remembers exactly where they were — and they are all telling the truth. That is the problem.',
      'One flash of lightning, one thud, one body. The witnesses agree on everything except who to blame. The map remembers what people forget.',
      'By the time the constable arrived, everyone had a story and nobody had moved. Match every statement to a square and the room itself will point a finger.',
    ],
    reveals: [
      'Confronted with your map, {murderer} stopped smiling. The layout allowed no other truth: only {murderer} was alone with the victim when it happened.',
      'A hush, then a confession. {murderer} had counted on the confusion of the crowd — but rows and columns do not get confused.',
      'The constable tips his hat. Every statement true, every square accounted for, and just one person alone with the victim: {murderer}.',
    ],
    themePlace: {
      manor: 'Manor', bakery: 'Bakery', observatory: 'Observatory', casino: 'Casino',
      opera: 'Opera', steamer: 'Steamer', garden: 'Garden', museum: 'Museum',
    },
  },
  pt: {
    intros: [
      'O convite prometia “uma noite de morte”. Alguém levou-o à letra. Reconstrói onde estava cada convidado quando o grito ecoou.',
      'As portas estavam trancadas por dentro e o relógio tinha parado. Todos se lembram exatamente de onde estavam — e todos dizem a verdade. É esse o problema.',
      'Um relâmpago, um baque, um corpo. As testemunhas concordam em tudo menos em quem culpar. O mapa lembra-se do que as pessoas esquecem.',
      'Quando o guarda chegou, todos tinham uma história e ninguém se tinha mexido. Liga cada declaração a uma casa e a própria sala apontará o dedo.',
    ],
    reveals: [
      'Confrontado com o teu mapa, {murderer} deixou de sorrir. O esquema não permitia outra verdade: só {murderer} esteve sozinho com a vítima quando aconteceu.',
      'Um silêncio, depois uma confissão. {murderer} contava com a confusão da multidão — mas linhas e colunas não se confundem.',
      'O guarda tira o chapéu. Todas as declarações verdadeiras, todas as casas justificadas, e só uma pessoa sozinha com a vítima: {murderer}.',
    ],
    themePlace: {
      manor: 'no Solar', bakery: 'na Padaria', observatory: 'no Observatório', casino: 'no Casino',
      opera: 'na Ópera', steamer: 'no Vapor', garden: 'no Jardim', museum: 'no Museu',
    },
  },
};

export function genIntro(i) { return GEN[getLang()].intros[i % GEN[getLang()].intros.length]; }
export function genReveal(i) { return GEN[getLang()].reveals[i % GEN[getLang()].reveals.length]; }
export function genCaseTitle(kind, themeKey) {
  const lang = getLang();
  const place = GEN[lang].themePlace[themeKey] ?? themeKey;
  if (lang === 'pt') return `${t('genTitle')[kind]}: Morte ${place}`;
  return `${t('genTitle')[kind]}: Death at the ${place}`;
}

// Resolve the displayed story for any case (campaign or generated).
export function caseTitle(cse) {
  if (cse.meta?.kind) return genCaseTitle(cse.meta.kind, cse.meta.themeKey);
  if (getLang() === 'pt' && STORIES_PT[cse.id]) return STORIES_PT[cse.id].title;
  return cse.title;
}

export function caseIntro(cse) {
  if (cse.meta?.kind) return genIntro(cse.meta.introIdx ?? 0);
  if (getLang() === 'pt' && STORIES_PT[cse.id]) return STORIES_PT[cse.id].intro;
  return cse.story?.intro ?? '';
}

export function caseReveal(cse) {
  if (cse.meta?.kind) return genReveal(cse.meta.revealIdx ?? 0);
  if (getLang() === 'pt' && STORIES_PT[cse.id]) return STORIES_PT[cse.id].reveal;
  return cse.story?.reveal ?? '{murderer}.';
}
