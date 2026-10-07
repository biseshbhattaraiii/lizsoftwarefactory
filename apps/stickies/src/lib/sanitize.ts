import DOMPurify from "dompurify";

/** Notes come from other people, so only plain formatting tags survive: no attributes, links, or styles. */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "s", "strike", "del", "br", "div", "p", "ul", "ol", "li", "span"],
    ALLOWED_ATTR: [],
  });
}
