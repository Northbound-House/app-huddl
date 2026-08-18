import { getItemDescription, getItemTitle } from '@/lib/itemModel';

/**
 * Search across the Items already loaded for a Huddl Board.
 *
 * Everything searched here is in memory already — Conversation comments are an array
 * field on the Item document, not a subcollection — so this needs no extra reads, no
 * Firestore index, and behaves identically on the Firestore and localStorage backends.
 */

/** Where a term was found, in the order surfaced to the user. */
export const SEARCH_FIELD = {
  title: 'title',
  description: 'details',
  conversation: 'Conversation',
  label: 'label',
};

/**
 * Strip Markdown/HTML so a query matches what the user actually reads.
 * Descriptions and comments are stored as Markdown; Trello imports may still be HTML.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toSearchableText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+/g, ' ')
    .replace(/[*_~#>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Split into terms; every term must appear somewhere in the Item, in any order.
 * A quoted "two words" run is kept together as one term.
 *
 * @param {string | null | undefined} query
 * @returns {string[]}
 */
export function parseSearchQuery(query) {
  const raw = String(query ?? '').toLowerCase();
  const terms = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const term = toSearchableText(m[1] ?? m[2]);
    if (term) terms.push(term);
  }
  return terms;
}

/**
 * @param {string | null | undefined} query
 * @returns {boolean}
 */
export function isSearchActive(query) {
  return parseSearchQuery(query).length > 0;
}

/**
 * Searchable text per field, so a hit can be attributed back to where it came from.
 *
 * @param {object} card
 * @param {Record<string, { name?: string }>} labelById
 * @returns {Array<{ field: string, text: string }>}
 */
function itemFieldTexts(card, labelById) {
  const fields = [
    { field: SEARCH_FIELD.title, text: toSearchableText(getItemTitle(card)) },
    { field: SEARCH_FIELD.description, text: toSearchableText(getItemDescription(card)) },
  ];

  const conversation = (card.comments || [])
    .map((c) => `${c.text ?? ''} ${c.author_name ?? ''}`)
    .join(' \n ');
  fields.push({ field: SEARCH_FIELD.conversation, text: toSearchableText(conversation) });

  const labels = (card.label_ids || [])
    .map((id) => labelById?.[id]?.name ?? '')
    .join(' ');
  fields.push({ field: SEARCH_FIELD.label, text: toSearchableText(labels) });

  return fields;
}

/**
 * Match one Item. Every term must appear in at least one field, but terms may land in
 * different fields — "login flaky" matches an Item titled "Login" with "flaky" only in
 * its Conversation.
 *
 * @param {object} card
 * @param {string[]} terms from {@link parseSearchQuery}
 * @param {Record<string, { name?: string }>} [labelById]
 * @returns {{ matches: boolean, fields: string[] }}
 */
export function matchItem(card, terms, labelById = {}) {
  if (terms.length === 0) return { matches: true, fields: [] };

  const fieldTexts = itemFieldTexts(card, labelById);
  const hitFields = new Set();

  for (const term of terms) {
    let found = false;
    for (const { field, text } of fieldTexts) {
      if (text && text.includes(term)) {
        hitFields.add(field);
        found = true;
      }
    }
    if (!found) return { matches: false, fields: [] };
  }

  const order = [SEARCH_FIELD.title, SEARCH_FIELD.description, SEARCH_FIELD.conversation, SEARCH_FIELD.label];
  return { matches: true, fields: order.filter((f) => hitFields.has(f)) };
}

/**
 * Filter a list of Items, keeping input order.
 *
 * @param {object[]} cards
 * @param {string | null | undefined} query
 * @param {Record<string, { name?: string }>} [labelById]
 * @returns {{ cards: object[], matchFieldsById: Record<string, string[]> }}
 */
export function filterItemsByQuery(cards, query, labelById = {}) {
  const terms = parseSearchQuery(query);
  if (terms.length === 0) return { cards, matchFieldsById: {} };

  const kept = [];
  const matchFieldsById = {};
  for (const card of cards) {
    const { matches, fields } = matchItem(card, terms, labelById);
    if (!matches) continue;
    kept.push(card);
    matchFieldsById[card.id] = fields;
  }
  return { cards: kept, matchFieldsById };
}
