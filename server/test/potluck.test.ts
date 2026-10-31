import type Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { Person } from "../../shared/identity";
import { MAX_MESSAGE_LENGTH, type ServerMessage } from "../../shared/protocol";
import { RESTING_BROTH } from "../../shared/types";
import { Potluck } from "../src/potluck";
import { Extractor, type Reading } from "../src/potluck/extraction";
import { cleanMessage, RateLimiter } from "../src/potluck/filter";
import { Strikes } from "../src/potluck/moderation";
import { RoomMood } from "../src/potluck/mood";
import { readMessage } from "../src/potluck/signals";
import type { SourceContext } from "../src/source";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("a message is trimmed, capped, rid of control characters and its swearing masked", () => {
  assert.equal(cleanMessage("  hello\u0007 pot  "), "hello pot");
  assert.equal(cleanMessage("x".repeat(MAX_MESSAGE_LENGTH + 50)).length, MAX_MESSAGE_LENGTH);
  assert.equal(cleanMessage("oh shit, Fucking rain"), "oh s***, F****** rain");
  assert.equal(cleanMessage("a scunthorpe dickens novel"), "a scunthorpe dickens novel");
});

test("the rate limit lets a burst through, then one message every two seconds", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const limiter = new RateLimiter();
  for (let i = 0; i < 5; i++) assert.ok(limiter.take(), `message ${i + 1} of the burst`);
  assert.equal(limiter.take(), false);
  t.mock.timers.tick(2000);
  assert.ok(limiter.take());
  assert.equal(limiter.take(), false);
});

test("two flagged messages within a day mute a name for an hour, whatever its case", () => {
  let now = 0;
  const strikes = new Strikes(() => now);
  assert.equal(strikes.strike("Anna"), false);
  now += 25 * HOUR;
  assert.equal(strikes.strike("anna"), false);
  now += HOUR;
  assert.equal(strikes.strike("ANNA"), true);
  assert.ok(strikes.isMuted("Anna"));
  assert.equal(strikes.strike("Anna"), false, "a strike while muted doesn't mute again");
  now += HOUR + 1;
  assert.equal(strikes.isMuted("anna"), false);
});

test("the instant reading hears how a message feels and how loud it is, in English and Dutch", () => {
  assert.ok(readMessage("what a lovely sunny afternoon").sentiment > 0.3);
  assert.ok(readMessage("wat een gezellige middag, heerlijk").sentiment > 0.3);
  assert.ok(readMessage("grey and cold, I'm so tired").sentiment < -0.3);
  assert.ok(readMessage("balen, het regent weer").sentiment < 0);
  assert.ok(readMessage("this is not good").sentiment < 0, "a negation turns a word around");
  assert.equal(readMessage("the meeting is at three").sentiment, 0);
  const plain = readMessage("let's dance");
  const loud = readMessage("LET'S DANCE!!! 🎉🎉");
  assert.ok(loud.intensity > plain.intensity + 0.3);
  for (const text of ["", "!!!!!!!!!!", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".repeat(10)]) {
    const { sentiment, intensity } = readMessage(text);
    assert.ok(sentiment >= -1 && sentiment <= 1 && intensity >= 0 && intensity <= 1, text);
  }
});

const happy = { sentiment: 0.9, intensity: 0.6 };

function room(people: number) {
  const mood = new RoomMood();
  for (let i = 0; i < people; i++) mood.hear(`m${i}`, `person ${i}`, happy, 0);
  return mood;
}

test("the mood is an average: a crowd in one mood pulls no further than thirty, one remark less", () => {
  const [one, three, thirty, crowd] = [room(1), room(3), room(30), room(300)].map((m) => m.targets(0));
  assert.ok(one.valence > RESTING_BROTH.valence && one.valence < three.valence, "a single remark stays close to rest");
  assert.ok(three.valence < thirty.valence);
  assert.ok(crowd.valence - thirty.valence < 0.05, `${thirty.valence} against ${crowd.valence}`);
  assert.ok(crowd.density > thirty.density && thirty.density > three.density, "a busier room is denser");
  for (const t of [one, three, thirty, crowd])
    for (const [dim, value] of Object.entries(t)) assert.ok(value >= (dim === "valence" ? -1 : 0) && value <= 1, dim);
});

test("one person repeating themself counts for less than as many people saying it once", () => {
  const alone = new RoomMood();
  for (let i = 0; i < 10; i++) alone.hear(`m${i}`, "Loud", happy, 0);
  const together = room(10);
  for (const mood of [alone, together]) for (let i = 0; i < 10; i++) mood.hear(`n${i}`, `quiet ${i}`, { sentiment: 0, intensity: 0.2 }, 0);
  assert.ok(alone.targets(0).valence < together.targets(0).valence);
});

test("a room that falls silent settles back to rest, and a hidden message stops counting", () => {
  const mood = room(5);
  assert.ok(mood.targets(30 * MINUTE).valence - RESTING_BROTH.valence < 0.01);
  const hidden = room(1);
  hidden.forget(["m0"]);
  assert.equal(hidden.targets(0).valence, RESTING_BROTH.valence);
});

test("a batch reading counts for the people whose messages it covers, and only them", () => {
  const mood = room(2);
  const before = mood.targets(0).tension;
  const tense = { valence: 0, energy: 0, tension: 1, warmth: 0, texture: 0, strangeness: 0 };
  mood.hearBatch([{ name: "Nobody here", mood: tense }], ["m0", "m1"], 0);
  assert.equal(mood.targets(0).tension, before);
  mood.hearBatch([{ name: "PERSON 0", mood: tense }], ["m0", "m1"], 0);
  assert.ok(mood.targets(0).tension > before);
});

const lines = [
  { id: "a", name: "Anna", text: "rain again, I'll make tea" },
  { id: "b", name: "Bo", text: "tea sounds lovely" },
];
const neutral = { valence: 0, energy: 0, tension: 0, warmth: 0, texture: 0, strangeness: 0 };

test("the model's answer is checked: clamped, trimmed and tied to the people and messages of the batch", async () => {
  const readings: Reading[] = [];
  const extractor = new Extractor(
    async () => ({
      moods: [
        { name: "anna", ...neutral, valence: 7, energy: Number.NaN },
        { name: "Anna", ...neutral, valence: -1 },
        { name: "Mallory", ...neutral },
      ],
      ingredients: [
        { name: "  Fresh TEA\u0000 ", weight: 2, addedBy: ["ANNA", "Mallory"], musicalHint: "steam" },
        { name: "nothing", weight: 0, addedBy: [], musicalHint: "" },
        ...["a", "b", "c", "d", "e", "f"].map((n) => ({ name: n, weight: 0.3, addedBy: [], musicalHint: "" })),
      ],
      flags: [
        { message: 2, reason: "x".repeat(200) },
        { message: 0, reason: "out of range" },
        { message: 3, reason: "out of range" },
        { message: 1.5, reason: "not a message number" },
      ],
    }),
    () => [],
    (reading) => readings.push(reading),
  );
  for (const line of lines) extractor.add(line);
  await extractor.run();
  extractor.close();

  const [reading] = readings;
  assert.deepEqual(reading.moods, [{ name: "Anna", mood: { ...neutral, valence: 1, energy: 0 } }]);
  assert.deepEqual(reading.ingredients[0], { name: "fresh tea", weight: 1, addedBy: ["Anna"], musicalHint: "steam" });
  assert.equal(reading.ingredients.length, 5);
  assert.ok(!reading.ingredients.some((i) => i.name === "nothing"));
  assert.deepEqual(reading.flags.map((f) => [f.id, f.name, f.reason.length]), [["b", "Bo", 80]]);
});

test("a failed call keeps its messages for the next batch, and a quiet minute costs nothing", async () => {
  const { APIError } = (await import("@anthropic-ai/sdk")).default;
  const batches: number[] = [];
  let fail = true;
  const extractor = new Extractor(
    async (batch) => {
      batches.push(batch.length);
      if (fail) throw new APIError(529, undefined, "overloaded", new Headers());
      return { moods: [], ingredients: [], flags: [] };
    },
    () => [],
    () => {},
  );
  await extractor.run();
  assert.deepEqual(batches, [], "nothing said, nothing asked");
  extractor.add(lines[0]);
  await extractor.run();
  fail = false;
  extractor.add(lines[1]);
  extractor.drop(["b"]);
  await extractor.run();
  extractor.close();
  assert.deepEqual(batches, [1, 1]);
});

function potluck(answer: (texts: string[]) => object) {
  mock.timers.enable({ apis: ["setInterval", "Date"], now: 0 });
  const sent: ServerMessage[] = [];
  const told: [string, string][] = [];
  const table: SourceContext = { broadcast: (msg) => sent.push(msg), tell: (name, text) => told.push([name, text]), now: () => Date.now() };
  const client = {
    messages: {
      parse: async ({ messages }: { messages: { content: string }[] }) => {
        const asked = JSON.parse(messages[0].content.split("as JSON:\n")[1]) as { text: string }[];
        return { model: "stand-in", usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: "end_turn", parsed_output: answer(asked.map((m) => m.text)) };
      },
    },
  } as unknown as Anthropic;
  const pot = new Potluck(table, client);
  const replies: string[] = [];
  const people = new Map<string, Person>();
  const say = (name: string, text: string) => {
    if (!people.has(name)) people.set(name, { id: name, name, color: "" });
    pot.receive(people.get(name)!, { t: "say", text }, (r) => replies.push(r));
  };
  const minute = async () => {
    mock.timers.tick(MINUTE);
    await flush();
  };
  return { pot, sent, told, replies, say, minute, done: () => (pot.close(), mock.timers.reset()) };
}

test("a flagged message is hidden everywhere, and a second one mutes its writer", async () => {
  const flagNasty = (texts: string[]) => ({
    moods: [],
    ingredients: [],
    flags: texts.flatMap((text, i) => (text.includes("nasty") ? [{ message: i + 1, reason: "harassment" }] : [])),
  });
  const p = potluck(flagNasty);
  try {
    p.say("Troll", "something nasty");
    p.say("Anna", "hello everyone");
    await p.minute();
    assert.deepEqual(p.pot.history().map((l) => l.text), ["hello everyone"]);
    const hidden = p.sent.find((m) => m.t === "hide");
    assert.ok(hidden && hidden.t === "hide" && hidden.ids.length === 1);
    assert.equal(p.told.length, 0);

    p.say("troll", "more nasty stuff");
    await p.minute();
    assert.deepEqual(p.told.map(([name]) => name), ["troll"]);
    p.say("Troll", "let me back in");
    assert.deepEqual(p.replies, ["You're muted for a while."]);
    assert.deepEqual(p.pot.history().map((l) => l.text), ["hello everyone"]);
  } finally {
    p.done();
  }
});

test("what the room carries lands in the pot and is announced, and a chatterbox is slowed down", async () => {
  const p = potluck(() => ({
    moods: [],
    ingredients: [{ name: "rain", weight: 0.7, addedBy: ["Anna"], musicalHint: "soft pattering" }],
    flags: [],
  }));
  try {
    for (let i = 0; i < 6; i++) p.say("Anna", `it keeps raining ${i}`);
    assert.deepEqual(p.replies, ["Easy now, let the pot simmer a moment."]);
    await p.minute();
    assert.deepEqual(p.pot.ingredients.map((i) => i.name), ["rain"]);
    assert.ok(p.sent.some((m) => m.t === "ingredients"));
    assert.ok(p.pot.history().some((l) => !l.person && l.text.includes("rain")), "the pot says what went in");
    assert.match(p.pot.digest(), /it keeps raining 4/);
  } finally {
    p.done();
  }
});
