export interface ParsedQuery {
  text: string
  extension?: string
}

const EXT_SHORTHAND = /(?:^|\s)(?:ext:|\.)([a-z0-9]+)(?=\s|$)/i

/** Extracts an `ext:pdf` or `.pdf` extension shorthand from a raw search query. */
export function parseQuery(raw: string): ParsedQuery {
  const match = raw.match(EXT_SHORTHAND)
  if (!match) {
    return { text: raw.trim(), extension: undefined }
  }
  const text = raw.replace(match[0], ' ').trim().replace(/\s+/g, ' ')
  return { text, extension: match[1].toLowerCase() }
}
