export function toKebab(input: string) {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toCamel(input: string) {
  const kebab = toKebab(input);
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function toPascal(input: string) {
  const camel = toCamel(input);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function pluralize(name: string) {
  // v1 minimal heuristic; can be replaced with pluralize library later.
  if (name.endsWith("s")) return name;
  return `${name}s`;
}

