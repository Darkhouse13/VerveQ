/**
 * Weekend Fantasy — player display-name normalisation (FW-NAMES).
 *
 * API-Football hands us player names that have been through at least two lossy
 * stages before they reach this codebase, and `fantasyIngest.applyClubPlayers`
 * used to write them verbatim. Measured on prod (different-lynx-153) on
 * 2026-08-20, 32 of 4,706 active players carried a visibly broken name:
 *
 *   - HTML entity leakage (14):  "J. O&apos;Brien", "M&apos;Bala Nzola"
 *   - Mojibake (9):              "JoÃ£o Vasconcelos", "M. LjubiÄ<8D>iÄ<87>"
 *   - Whitespace damage (9):     "J.  McGinn", "N. Kovač <8D>"
 *
 * Every one of those is a deterministic, reversible encoding fault rather than
 * a genuine spelling disagreement, which is why this file is a pure function
 * and not an overrides table: the feed re-sends the same bytes on every squad
 * refresh, so a hand-edited database row would be overwritten by the next
 * ingest. The repair has to live on the write path.
 *
 * ── Why the repairs are safe to apply blind ──
 *
 * The mojibake pass only fires when the string contains a Latin-1 lead byte
 * followed by a UTF-8 continuation byte (`Ã` + U+0080..U+00BF). That pair is
 * unreachable in a real name: U+0080..U+009F are C1 control characters, so no
 * human ever typed one after an "Ã". A genuine "Á" (U+00C1) is never followed
 * by a control character, and the byte round-trip is run under a FATAL UTF-8
 * decoder — anything that is not valid UTF-8 is left exactly as it was found.
 *
 * Nothing here transliterates. "Højlund" keeps its ø and "Ljubičić" keeps both
 * carons; the pass restores the character the feed mangled, it does not
 * flatten accents. Flattening for SEARCH is a separate concern — see
 * `searchKeyForName` and `matchesNameSearch`, which the picker's filter uses so
 * that typing "ljubicic" still finds Ljubičić and "obrien" still finds
 * O'Brien.
 */

/**
 * The named entities the feed actually emits. API-Football HTML-escapes its
 * player names before serialising them as JSON, so apostrophes arrive as
 * `&apos;` — every Irish and Senegalese name in the universe is affected.
 * Numeric references are handled separately, below.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  eacute: "é",
  egrave: "è",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  ccedil: "ç",
  ntilde: "ñ",
  oslash: "ø",
  aring: "å",
};

/** One pass of entity decoding. Two passes handle `&amp;apos;` double-escapes. */
function decodeEntitiesOnce(input: string): string {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const isHex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      // Reject NaN, surrogates and out-of-range: a malformed reference stays
      // literal rather than becoming U+FFFD.
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;
      return String.fromCodePoint(code);
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

function decodeEntities(input: string): string {
  const once = decodeEntitiesOnce(input);
  return once === input ? once : decodeEntitiesOnce(once);
}

/**
 * A Latin-1 lead byte immediately followed by a UTF-8 continuation byte.
 *
 * Ã/Â cover the 2-byte range that produces Western European accents; Ä/Å cover
 * Latin Extended-A (the Croatian/Serbian/Turkish carons and cedillas this feed
 * mangles most); â/ð cover the 3- and 4-byte leads, which show up when an emoji
 * or a CJK character has been round-tripped. All of them are only treated as
 * mojibake when the NEXT character is a continuation byte.
 */
const MOJIBAKE_SIGNATURE = /[\u00C2-\u00C5\u00D0\u00E2\u00F0][\u0080-\u00BF]/;

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

/**
 * Undo one round of "UTF-8 bytes read as Latin-1".
 *
 * Returns the input unchanged unless the whole string is Latin-1-representable
 * (every code point <= 0xFF — a string that already contains a real "č" was
 * never mis-decoded as a whole and must not be re-interpreted), it carries the
 * signature above, and the byte sequence is valid UTF-8. The fatal decoder is
 * the guard: a false positive throws instead of silently emitting U+FFFD.
 */
function repairMojibakeOnce(input: string): string {
  if (!MOJIBAKE_SIGNATURE.test(input)) return input;

  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code > 0xff) return input;
    bytes[i] = code;
  }

  try {
    const decoded = utf8Decoder.decode(bytes);
    // A repair that produced a replacement character, or that made the string
    // no shorter, did not actually repair anything.
    if (decoded.includes("�") || decoded.length >= input.length) return input;
    return decoded;
  } catch {
    return input;
  }
}

/** Double-encoded names ("JoÃƒÂ£o") need two rounds; a third has never been seen. */
function repairMojibake(input: string): string {
  const once = repairMojibakeOnce(input);
  return once === input ? once : repairMojibakeOnce(once);
}

/**
 * Control characters, zero-width marks and the BOM.
 *
 * Stripped only AFTER the mojibake pass: U+008D is a C1 control on its own, but
 * it is also the second byte of "č" (0xC4 0x8D), and removing it first would
 * turn a repairable "LjubiÄ<8D>iÄ<87>" into an unrepairable "LjubiÄiÄ".
 */
// eslint-disable-next-line no-control-regex -- stripping control characters IS the job
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060\uFEFF]/g;

/**
 * Apostrophe and dash variants that mean the same thing.
 *
 * Normalised to ASCII on purpose. The feed is internally inconsistent — it
 * ships "M. O’Leary" with U+2019 and "M. O&apos;Leary" with an escaped ASCII
 * quote — and a picker search for "o'leary" must match both. Collapsing to one
 * form makes the stored name the single spelling the search box has to know.
 */
const APOSTROPHES = /[\u02BC\u02B9\u2018\u2019\u00B4\u0060]/g;
const HYPHENS = /[\u2010\u2011\u2012\u2013\u2043]/g;

/**
 * The one function the ingest path calls. Idempotent: normalising an already
 * normalised name returns it unchanged, which is what lets `applyClubPlayers`
 * compare stored-vs-incoming without churning a row on every sync.
 *
 * Never invents emptiness. If the repairs would erase a name that had visible
 * content (a row of nothing but zero-width marks), the trimmed raw input is
 * kept — a visibly odd name beats a nameless player in a squad slot. A name
 * that was only whitespace to begin with still comes back empty, and the
 * caller's own guard is what refuses it.
 */
export function normalizePlayerName(raw: string): string {
  const repaired = repairMojibake(decodeEntities(raw));

  const cleaned = repaired
    .replace(INVISIBLE, "")
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .replace(HYPHENS, "-")
    // Every whitespace class — including the U+00A0 that `&nbsp;` decodes to —
    // collapses to a single ASCII space.
    .replace(/\s+/g, " ")
    // A space before the initial's full stop is always damage ("J . McGinn"),
    // never a spelling. The space AFTER it is real and is left alone.
    .replace(/\s+\./g, ".")
    .trim();

  return cleaned === "" ? raw.trim() : cleaned;
}

/** True when the feed's name and the stored name differ only by this repair. */
export function needsNameRepair(raw: string): boolean {
  return normalizePlayerName(raw) !== raw;
}

const DIACRITIC_MARKS = /[\u0300-\u036F]/g;

/**
 * A fold-everything key for substring search.
 *
 * Separate from the display name by design: the display name keeps every
 * accent the player's own federation spells him with, and the search key
 * throws them all away so that "ljubicic", "hojlund" and "o leary" are typable
 * on a phone keyboard. Not stored — computed at filter time.
 */
export function searchKeyForName(name: string): string {
  return normalizePlayerName(name)
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, "")
    // Danish/Norwegian ø and the Polish ł have no decomposed form.
    .replace(/ø/g, "o")
    .replace(/Ø/g, "O")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "AE")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Substring match for the picker's search box.
 *
 * Compares on a key with EVERY non-alphanumeric removed rather than on
 * `searchKeyForName`'s space-separated form, because the two most natural ways
 * to type an Irish name disagree about the apostrophe: "obrien" and "o'brien"
 * both have to find "J. O'Brien", and a key that turns the apostrophe into a
 * separator matches the second and not the first. Squashing matches both, and
 * matches "o brien" as well.
 *
 * An empty query matches everything — the filter is off, not failing closed.
 */
export function matchesNameSearch(haystack: string, query: string): boolean {
  const needle = squash(query);
  return needle === "" || squash(haystack).includes(needle);
}

function squash(value: string): string {
  return searchKeyForName(value).replace(/[^a-z0-9]/g, "");
}
