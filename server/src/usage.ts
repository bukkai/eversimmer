type Price = { input: number; output: number };
const PRICES: Record<string, Price> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
const WRITE_5M = 1.25;
const WRITE_1H = 2;
const READ = 0.1;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_1h_input_tokens: number; ephemeral_5m_input_tokens: number } | null;
};

let total = 0;

export function logUsage(what: string, model: string, usage: Usage) {
  const price = PRICES[model];
  const written = usage.cache_creation_input_tokens ?? 0;
  const written1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  const tokens =
    `in ${usage.input_tokens}, cache write ${written}, cache read ${read}, out ${usage.output_tokens}`;
  if (!price) return console.log(`cost: ${what} on ${model}, no price known (${tokens})`);
  const cost =
    (usage.input_tokens * price.input +
      written1h * price.input * WRITE_1H +
      (written - written1h) * price.input * WRITE_5M +
      read * price.input * READ +
      usage.output_tokens * price.output) /
    1e6;
  total += cost;
  console.log(`cost: ${what} on ${model} $${cost.toFixed(4)} (${tokens}), total $${total.toFixed(4)}`);
}
