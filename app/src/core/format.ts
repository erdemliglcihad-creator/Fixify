// Formats strings that use the same placeholders as the iOS String Catalog:
// %@ / %lld in order, or positional %1$@ / %2$lld.

export function formatString(template: string, args: (string | number)[]): string {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?(@|lld|d)|%%/g, (match, pos: string | undefined) => {
    if (match === "%%") return "%";
    const index = pos ? Number(pos) - 1 : next++;
    return index < args.length ? String(args[index]) : match;
  });
}
