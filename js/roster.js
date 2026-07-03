// Original characters, scene themes and case briefs. All writing here is
// original to this project.

export const OBJECT_NAMES = {
  bookshelf: { label: 'bookshelf', plural: 'bookshelves', emoji: '📚' },
  plant: { label: 'potted plant', plural: 'potted plants', emoji: '🪴' },
  candelabrum: { label: 'candelabrum', plural: 'candelabra', emoji: '🕯️' },
  armchair: { label: 'armchair', plural: 'armchairs', emoji: '🛋️' },
  clock: { label: 'grandfather clock', plural: 'grandfather clocks', emoji: '🕰️' },
  piano: { label: 'piano', plural: 'pianos', emoji: '🎹' },
  oven: { label: 'oven', plural: 'ovens', emoji: '🔥' },
  sack: { label: 'flour sack', plural: 'flour sacks', emoji: '🌾' },
  cake: { label: 'wedding cake', plural: 'wedding cakes', emoji: '🎂' },
  telescope: { label: 'telescope', plural: 'telescopes', emoji: '🔭' },
  globe: { label: 'star globe', plural: 'star globes', emoji: '🌐' },
  desk: { label: 'writing desk', plural: 'writing desks', emoji: '🪑' },
  slot: { label: 'slot machine', plural: 'slot machines', emoji: '🎰' },
  cards: { label: 'card table', plural: 'card tables', emoji: '🃏' },
  vault: { label: 'vault door', plural: 'vault doors', emoji: '🔒' },
  harp: { label: 'harp', plural: 'harps', emoji: '🎻' },
  curtain: { label: 'velvet curtain', plural: 'velvet curtains', emoji: '🎭' },
  chandelier: { label: 'fallen chandelier', plural: 'fallen chandeliers', emoji: '💎' },
  crate: { label: 'cargo crate', plural: 'cargo crates', emoji: '📦' },
  lantern: { label: 'storm lantern', plural: 'storm lanterns', emoji: '🏮' },
  wheel: { label: "ship's wheel", plural: "ship's wheels", emoji: '☸️' },
  fern: { label: 'giant fern', plural: 'giant ferns', emoji: '🌿' },
  fountain: { label: 'stone fountain', plural: 'stone fountains', emoji: '⛲' },
  beehive: { label: 'beehive', plural: 'beehives', emoji: '🐝' },
  statue: { label: 'marble statue', plural: 'marble statues', emoji: '🗿' },
  sarcophagus: { label: 'sarcophagus', plural: 'sarcophagi', emoji: '⚱️' },
  display: { label: 'display case', plural: 'display cases', emoji: '🏺' },
};

// The recurring troupe of suspects (original characters).
export const TROUPE = [
  { id: 'vera', name: 'Vera Vantablack', role: 'the veiled widow', emoji: '🕷️', color: '#8b5cf6', g: 'f', mono: 'VV' },
  { id: 'ash', name: 'Colonel Ash Redwood', role: 'the retired colonel', emoji: '🎖️', color: '#ef4444', g: 'm', mono: 'AR' },
  { id: 'felix', name: 'Dr. Felix Grimm', role: 'the village physician', emoji: '🩺', color: '#10b981', g: 'm', mono: 'FG' },
  { id: 'prudence', name: 'Lady Prudence Opaline', role: 'the jewel heiress', emoji: '💍', color: '#f59e0b', g: 'f', mono: 'PO' },
  { id: 'basil', name: 'Chef Aurelio Basil', role: 'the temperamental chef', emoji: '🍳', color: '#f97316', g: 'm', mono: 'AB' },
  { id: 'indigo', name: 'Captain Indigo Marsh', role: 'the storm-worn captain', emoji: '⚓', color: '#3b82f6', g: 'm', mono: 'IM' },
  { id: 'wren', name: 'Professor Thaddeus Wren', role: 'the absent-minded professor', emoji: '🦉', color: '#14b8a6', g: 'm', mono: 'TW' },
  { id: 'coco', name: 'Mademoiselle Coco Lark', role: 'the cabaret singer', emoji: '🎤', color: '#ec4899', g: 'f', mono: 'CL' },
];

// Monogram for any person (fallback when `mono` is absent, e.g. victims).
export function monogramOf(person) {
  if (person.mono) return person.mono;
  const words = person.name.replace(/^(Dr|Sir|Lady|Chef|Captain|Professor|Colonel|Madame|Maestro|Miss|Mademoiselle|Ambassador|Curator|Mayor|Nurse|Grand Duchess)\.?\s+/i, '')
    .split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export const pickTroupe = (ids) => ids.map((id) => ({ ...TROUPE.find((t) => t.id === id) }));

export const THEMES = {
  manor: {
    roomNames: ['Library', 'Parlor', 'Conservatory', 'Kitchen', 'Gallery', 'Cellar'],
    objTypes: ['bookshelf', 'plant', 'candelabrum', 'armchair', 'clock'],
    objectNames: OBJECT_NAMES,
  },
  bakery: {
    roomNames: ['Storefront', 'Bakehouse', 'Pantry', 'Courtyard', 'Cold Room'],
    objTypes: ['oven', 'sack', 'cake', 'plant', 'clock'],
    objectNames: OBJECT_NAMES,
  },
  observatory: {
    roomNames: ['Dome', 'Chart Room', 'Workshop', 'Stairwell', 'Archive'],
    objTypes: ['telescope', 'globe', 'desk', 'bookshelf', 'lantern'],
    objectNames: OBJECT_NAMES,
  },
  casino: {
    roomNames: ['Gaming Floor', 'Cashier Cage', 'Lounge', 'Back Office', 'Terrace'],
    objTypes: ['slot', 'cards', 'vault', 'plant', 'chandelier'],
    objectNames: OBJECT_NAMES,
  },
  opera: {
    roomNames: ['Stage', 'Orchestra Pit', 'Dressing Room', 'Foyer', 'Fly Tower'],
    objTypes: ['harp', 'curtain', 'piano', 'candelabrum', 'chandelier'],
    objectNames: OBJECT_NAMES,
  },
  steamer: {
    roomNames: ['Bridge', 'Salon', 'Cargo Hold', 'Promenade', 'Engine Room'],
    objTypes: ['crate', 'lantern', 'wheel', 'armchair', 'clock'],
    objectNames: OBJECT_NAMES,
  },
  garden: {
    roomNames: ['Rose Maze', 'Greenhouse', 'Orchard', 'Apiary', 'Gazebo'],
    objTypes: ['fern', 'fountain', 'beehive', 'statue', 'plant'],
    objectNames: OBJECT_NAMES,
  },
  museum: {
    roomNames: ['Grand Hall', 'Egyptian Wing', 'Vault', 'Rotunda', 'Curator Office'],
    objTypes: ['sarcophagus', 'display', 'statue', 'bookshelf', 'candelabrum'],
    objectNames: OBJECT_NAMES,
  },
};

// Campaign briefs: victim + story per case (original writing).
export const CAMPAIGN_BRIEFS = [
  {
    id: 'c01', size: 4, theme: 'manor', difficulty: 'easy', seed: 'murdoku-c01',
    suspects: ['vera', 'ash', 'felix'],
    victim: { id: 'v_gilt', g: 'm', name: 'Barnaby Gilt', role: 'the millionaire host', emoji: '🎩', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'The Gilt Manor Affair',
      intro: 'Millionaire Barnaby Gilt invited three guests for brandy and bragging. By midnight, only the bragging had stopped — permanently. Reconstruct where everyone stood when the lights went out.',
      reveal: 'Cornered by your flawless map of the manor, {murderer} confessed: the will was to be rewritten at dawn, and {murdererShort} preferred the old arithmetic.',
    },
  },
  {
    id: 'c02', size: 4, theme: 'bakery', difficulty: 'easy', seed: 'murdoku-c02',
    suspects: ['basil', 'prudence', 'coco'],
    victim: { id: 'v_crumb', g: 'm', name: 'Otto Crumb', role: 'the master baker', emoji: '🥖', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'Death Rises at Dawn',
      intro: 'Master baker Otto Crumb was found cold beside his proofing dough — which, unlike him, had risen. Three early visitors were in the bakery. The flour on the floor remembers every step.',
      reveal: 'The flour never lies. {murderer} had traded the shop’s secret starter to a rival — and Otto had found the receipt.',
    },
  },
  {
    id: 'c03', size: 5, theme: 'observatory', difficulty: 'easy', seed: 'murdoku-c03',
    suspects: ['wren', 'vera', 'indigo', 'felix'],
    victim: { id: 'v_starr', g: 'f', name: 'Dr. Celeste Starr', role: 'the royal astronomer', emoji: '🌠', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'The Comet That Never Came',
      intro: 'Dr. Celeste Starr promised the town a comet at 11:07. At 11:08 she was dead under her own dome. Four colleagues were inside when the shutters jammed.',
      reveal: 'Your chart of the observatory left no shadow to hide in. {murderer} had faked the comet data for funding — and Celeste was about to publish the truth.',
    },
  },
  {
    id: 'c04', size: 5, theme: 'casino', difficulty: 'medium', seed: 'murdoku-c04',
    suspects: ['prudence', 'ash', 'coco', 'basil'],
    victim: { id: 'v_marlow', g: 'm', name: 'Sonny Marlow', role: 'the pit boss', emoji: '🎲', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'Snake Eyes at the Silver Slipper',
      intro: 'Pit boss Sonny Marlow always said the house never loses. Tonight the house lost him. Four patrons were still on the floor when the chips stopped clicking.',
      reveal: 'The odds finally caught up. {murderer} owed the Silver Slipper more than money — and Sonny had started collecting in secrets.',
    },
  },
  {
    id: 'c05', size: 6, theme: 'opera', difficulty: 'medium', seed: 'murdoku-c05',
    suspects: ['coco', 'vera', 'wren', 'prudence', 'indigo'],
    victim: { id: 'v_fontaine', g: 'm', name: 'Maestro Rex Fontaine', role: 'the tyrant conductor', emoji: '🎼', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'Aria for a Dead Maestro',
      intro: 'Maestro Rex Fontaine cut the soprano’s solo one time too many. During the blackout of Act II, someone cut his. Five members of the company never left the house.',
      reveal: 'Bravo! With the stage mapped to the inch, {murderer} broke down in the wings: Fontaine had threatened to end a career tonight — instead, someone ended his encore.',
    },
  },
  {
    id: 'c06', size: 6, theme: 'steamer', difficulty: 'medium', seed: 'murdoku-c06',
    suspects: ['indigo', 'felix', 'ash', 'coco', 'basil'],
    victim: { id: 'v_pemberly', g: 'f', name: 'Ambassador Iris Pemberly', role: 'the retiring diplomat', emoji: '🕊️', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'Last Voyage of the SS Meridian',
      intro: 'Ambassador Iris Pemberly boarded the SS Meridian with a briefcase she never let go. Somewhere between the fog and the foghorn, she let go. Five passengers know exactly where they stood.',
      reveal: 'The briefcase held names — one of them {murderer}’s. The ambassador’s memoirs will now be published posthumously, with one chapter written by you.',
    },
  },
  {
    id: 'c07', size: 7, theme: 'garden', difficulty: 'hard', seed: 'murdoku-c07',
    suspects: ['vera', 'prudence', 'wren', 'basil', 'felix', 'indigo'],
    victim: { id: 'v_thorn', g: 'm', name: 'Sir Digby Thorn', role: 'the prize horticulturist', emoji: '🌹', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'The Thorn Garden Party',
      intro: 'Sir Digby Thorn unveiled his black rose to six guests at the summer party. By teatime the rose was gone and so was Sir Digby. The hedges saw everything. So did you.',
      reveal: 'Pruned at last. {murderer} had crossbred the black rose from a stolen cutting — Sir Digby’s unveiling speech was about to name the thief.',
    },
  },
  {
    id: 'c08', size: 7, theme: 'museum', difficulty: 'hard', seed: 'murdoku-c08-v0-v2',
    suspects: ['wren', 'vera', 'ash', 'prudence', 'coco', 'felix'],
    victim: { id: 'v_locke', g: 'm', name: 'Curator Maximilian Locke', role: 'the museum curator', emoji: '🗝️', isVictim: true, color: '#94a3b8' },
    story: {
      title: 'Midnight at the Meridian Museum',
      intro: 'Curator Maximilian Locke stayed late to authenticate a golden scarab. The scarab was real; the alibis were not. Six after-hours guests were locked in with him.',
      reveal: 'Case closed, exhibit opened. {murderer} had been selling forgeries through the gift shop for years — Locke’s authentication ledger was the loose thread you just pulled.',
    },
  },
];
