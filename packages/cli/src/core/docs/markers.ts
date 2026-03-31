export const AUTO_START = "<!-- AUTO-GENERATED START -->";
export const AUTO_END = "<!-- AUTO-GENERATED END -->";

export function replaceAutoSection(original: string, generated: string) {
  const start = original.indexOf(AUTO_START);
  const end = original.indexOf(AUTO_END);
  if (start === -1 || end === -1 || end < start) {
    return `${original.trimEnd()}\n\n${AUTO_START}\n${generated.trimEnd()}\n${AUTO_END}\n`;
  }
  const before = original.slice(0, start);
  const after = original.slice(end + AUTO_END.length);
  return `${before}${AUTO_START}\n${generated.trimEnd()}\n${AUTO_END}${after}`;
}

