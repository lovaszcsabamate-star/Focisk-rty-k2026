/**
 * Pub banter. Lines are picked by event type and lightly weighted by who is
 * speaking, so the table has three recognisable voices.
 *
 * Art hook: each speaker resolves to assets/friends/<id>.png
 */

/** `{x}` placeholders are filled from the event context. */
export const SPEAKERS = {
  you:  { id: 'you',  name: 'You',    colour: '#e8c37a' },
  dermot: { id: 'dermot', name: 'Dermot', colour: '#8fbf6a',
            bio: 'Been going since the old stand. Believes nothing good happened after 1994.' },
  priya:  { id: 'priya',  name: 'Priya',  colour: '#6aa9bf',
            bio: 'Reads the xG column at breakfast. Will correct you.' },
  gaz:    { id: 'gaz',    name: 'Gaz',    colour: '#bf6a8f',
            bio: 'Has a mate who knows an agent. The mate does not know an agent.' },
};

const LINES = {
  gameStart: [
    ['dermot', "Right, deal them out. And no sulking when you lose this time."],
    ['priya',  "Ground rules: market value is a stat, not a personality."],
    ['gaz',    "I'm telling you now, I've got a system."],
    ['dermot', "Another round? Go on then. Cards first."],
  ],

  youChooseAttribute: {
    height:      [['gaz', "Height! The thinking man's stat."],
                  ['priya', "Ah yes, because football is basketball now."],
                  ['dermot', "Big lad wins it. Simple game, really."]],
    marketValue: [['priya', "Money doesn't defend a corner, but go on."],
                  ['dermot', "In my day you could buy a whole back four for that."],
                  ['gaz', "That's about what I spend on a weekend, that."]],
    redCards:    [['dermot', "Discipline! Finally, someone with values."],
                  ['gaz', "Boring. Where's the drama?"],
                  ['priya', "Low reds. A refreshingly honest metric."]],
    yellowCards: [['gaz', "Cards about cards. Very meta, mate."],
                  ['dermot', "Bookings tell you everything about a man."],
                  ['priya', "Or everything about the referee, arguably."]],
    caps:        [['priya', "International caps — now that's a proper measure."],
                  ['dermot', "Caps. Means someone somewhere trusted him."],
                  ['gaz', "I nearly got called up once. Long story."]],
    minutes:     [['priya', "Minutes played. Availability is a skill, people."],
                  ['dermot', "The lads who turn up every week. Respect."],
                  ['gaz', "Minutes? That's just being unbannable."]],
    assists:     [['gaz', "Assists! Now we're talking football."],
                  ['priya', "Finally, a stat that survives contact with reality."],
                  ['dermot', "Passing. Remember passing?"]],
  },

  aiChooseAttribute: [
    ['gaz',    "Oh he's picked {attr}. He's got something, look at his face."],
    ['priya',  "{attr}. Predictable. Play around it."],
    ['dermot', "{attr}, is it? Careful now."],
    ['gaz',    "He always picks {attr} when he's bluffing. Always."],
  ],

  youWin: [
    ['gaz',    "GET IN! Did you see that? Did you SEE it?"],
    ['priya',  "{card} was the correct card. Nicely read."],
    ['dermot', "That'll do. That'll do nicely."],
    ['gaz',    "He's rattled. Look at him. Rattled."],
    ['priya',  "{stat} was never close, to be fair."],
  ],

  youWinBig: [
    ['gaz',    "That's not a win, that's a public humiliation."],
    ['priya',  "{card} by that margin? Someone check the database."],
    ['dermot', "Hah! Put it on the wall."],
  ],

  youLose: [
    ['dermot', "Ohhh. Wrong card, son."],
    ['priya',  "{card} was your third-best option there. I did the maths."],
    ['gaz',    "Unlucky. Unlucky! ...That was terrible."],
    ['priya',  "You'll want that one back."],
    ['dermot', "Don't throw good cards after bad."],
  ],

  youLoseClose: [
    ['priya',  "Inches. Literally, in that case."],
    ['gaz',    "That's robbery. That's actual robbery."],
    ['dermot', "So close. Cruel game."],
  ],

  tie: [
    ['gaz',    "A draw?! In a card game?! What is this?"],
    ['dermot', "Both on the table then. Winner takes the lot."],
    ['priya',  "Identical values. The pot carries over — get it back."],
  ],

  potScooped: [
    ['gaz',    "AND he takes the pile! Absolute daylight robbery, and I love it."],
    ['dermot', "That's the pot gone. That's a swing, that is."],
  ],

  idle: [
    ['dermot', "You know who'd have loved this game? My old man. Terrible at cards."],
    ['gaz',    "My mate reckons there's a lad at Recife Coral going for ninety million."],
    ['priya',  "Ninety? He's on twenty-two assists, Gaz, he's going for more."],
    ['dermot', "Twenty-two assists and he still can't head a ball."],
    ['gaz',    "Same again? Same again. Don't touch my cards."],
    ['priya',  "The whole league's gone soft. Yellow cards are down forty percent."],
    ['dermot', "That's not soft, that's the referees hiding."],
    ['gaz',    "Anyone else's pint gone warm or is it just me?"],
    ['priya',  "It's the fixture congestion. Minutes played tells the whole story."],
    ['dermot', "Fixture congestion. We played Boxing Day AND the 27th."],
  ],

  gameOverWin: [
    ['gaz',    "CHAMPION! Drinks are on him, everyone!"],
    ['dermot', "Well played. Genuinely. Don't let it go to your head."],
    ['priya',  "Comfortable in the end. Your attribute selection improved."],
  ],

  gameOverLose: [
    ['dermot', "Ah well. There's always the second leg."],
    ['gaz',    "Rigged deck. I'm just saying it out loud."],
    ['priya',  "You over-committed on market value. Classic error."],
  ],

  gameOverTie: [
    ['dermot', "A draw. Nobody's happy, everybody's fine."],
    ['gaz',    "Replay! Extra time! Penalties!"],
  ],
};

const lastUsed = new Map();
let lastSpeaker = null;

/**
 * Pick a line, avoiding both an immediate repeat of the same text and — where
 * the pool allows it — the speaker who talked last, so the table doesn't turn
 * into one person monologuing.
 */
function pick(pool, key) {
  if (!pool || pool.length === 0) return null;

  const previousText = lastUsed.get(key);
  let candidates = pool.filter(l => l[1] !== previousText);
  if (candidates.length === 0) candidates = pool;

  const others = candidates.filter(l => l[0] !== lastSpeaker);
  if (others.length > 0) candidates = others;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastUsed.set(key, chosen[1]);
  lastSpeaker = chosen[0];
  return chosen;
}

function fill(text, context) {
  return text.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? `{${key}}`);
}

/**
 * @param {string} event  key into LINES
 * @param {object} context  values for {placeholders}, plus `attributeKey`
 * @returns {{speaker: object, text: string}|null}
 */
export function getLine(event, context = {}) {
  let pool = LINES[event];

  // Attribute-specific pools are nested one level deeper.
  if (pool && !Array.isArray(pool)) {
    pool = pool[context.attributeKey];
  }

  const line = pick(pool, event + (context.attributeKey ?? ''));
  if (!line) return null;

  const [speakerId, text] = line;
  return { speaker: SPEAKERS[speakerId], text: fill(text, context) };
}

/** Occasional unprompted football chat between rounds. */
export function getIdleChatter(chance = 0.45) {
  return Math.random() < chance ? getLine('idle') : null;
}
