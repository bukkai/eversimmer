import { MAX_MESSAGE_LENGTH } from "../../../shared/protocol";

const PROFANITY = /\b(fuck\w*|shit\w*|cunt\w*|bitch\w*|asshole\w*|bastard\w*|dick(head)?s?|wank\w*|twat\w*|prick\w*)\b/gi;

export function cleanMessage(text: string) {
  const trimmed = text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, MAX_MESSAGE_LENGTH);
  return trimmed.replace(PROFANITY, (w) => w[0] + "*".repeat(w.length - 1));
}

export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private capacity = 5,
    private refillMs = 2000,
  ) {
    this.tokens = capacity;
  }

  take() {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.last) / this.refillMs);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
