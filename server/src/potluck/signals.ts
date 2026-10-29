const POSITIVE = new Set(
  `love loved lovely like liked nice good great awesome amazing beautiful wonderful happy glad
  joy fun funny yay cool sweet perfect best brilliant fantastic excellent enjoy enjoying
  thanks thank thx grateful cozy cosy calm peaceful warm sunny bright hope hopeful excited
  welcome yes delicious tasty gorgeous pretty fine kind gentle chill relaxing relaxed smile laugh
  win winning wow congrats congratulations proud cute dance dancing sunshine omg
  lekker fijn fijne mooi mooie gezellig leuk leuke prima top gaaf gave vet heerlijk blij
  genieten geniet bedankt dank dankjewel super prachtig zalig rustig rustige
  zonnig zon warme liefde lief lieve hoera jaaa knap trots ontspannen`.split(/\s+/),
);

const NEGATIVE = new Set(
  `hate hated bad awful terrible horrible sad unhappy angry mad annoyed annoying boring bored
  tired exhausted sick ill hurt pain lonely alone miss missing cry crying worried worry scared
  afraid anxious stress stressed ugh meh sucks broken lost lose losing fail failed wrong worst
  gross dark cold rain rainy grey gray gloomy depressed upset sorry no never nothing ugly mess
  dead dying fear tense nervous stuck
  regen regenachtig regenachtige grijs grauw koud kou donker moe saai verdrietig balen jammer
  eenzaam stom stomme rot zucht pfff ziek pijn bang boos chagrijnig somber gestrest
  maandag mis niks niets helaas vervelend lelijk slecht slechte`.split(/\s+/),
);

const NEGATIONS = new Set([
  "not", "no", "never", "dont", "don't", "isnt", "isn't", "wasnt", "wasn't", "cant", "can't", "aint", "ain't",
  "niet", "geen", "nooit",
]);

const POSITIVE_EMOJI = /[😀😃😄😁😆😂🤣😊🙂😍🥰😘😎🤩🥳❤💖💕✨🎉🔥🌞☀🌈👍🙌👏💃🕺🍀]/gu;
const LAUGHTER = /\b(ha){2,}h?\b|\b(he){2,}\b|\blo+l\b/gi;
const NEGATIVE_EMOJI = /[😢😭😞😔😟😠😡🤬💔😩😫😱😨🌧⛈👎]/gu;
const ANY_EMOJI = /\p{Extended_Pictographic}/gu;

export type Reading = {
  sentiment: number;
  intensity: number;
};

export function readMessage(text: string): Reading {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  let score = 0;
  let hits = 0;
  words.forEach((word, i) => {
    const polarity = POSITIVE.has(word) ? 1 : NEGATIVE.has(word) && !NEGATIONS.has(word) ? -1 : 0;
    if (!polarity) return;
    const negated = i > 0 && NEGATIONS.has(words[i - 1]);
    score += negated ? -polarity : polarity;
    hits++;
  });
  const happyEmoji = text.match(POSITIVE_EMOJI)?.length ?? 0;
  const sadEmoji = text.match(NEGATIVE_EMOJI)?.length ?? 0;
  const laughs = text.match(LAUGHTER)?.length ?? 0;
  score += happyEmoji + laughs - sadEmoji;
  hits += happyEmoji + laughs + sadEmoji;
  const sentiment = hits ? Math.tanh(score / Math.sqrt(hits + 1)) : 0;

  const letters = text.match(/[a-z]/gi) ?? [];
  const capsRatio = letters.length >= 4 ? letters.filter((c) => c === c.toUpperCase()).length / letters.length : 0;
  const bangs = Math.min(5, text.match(/!/g)?.length ?? 0);
  const emoji = Math.min(5, text.match(ANY_EMOJI)?.length ?? 0);
  const stretched = /([a-z])\1{2,}/i.test(text) ? 1 : 0;
  const length = Math.min(1, text.length / 200);
  const intensity = Math.min(
    1,
    0.15 + 0.4 * capsRatio + 0.08 * bangs + 0.05 * emoji + 0.1 * stretched + 0.1 * length,
  );
  return { sentiment, intensity };
}
