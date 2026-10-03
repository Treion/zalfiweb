const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/** 6 → "six", 7 → "seven"; numerals past twelve. `cap` capitalises: "Six". */
export function countWord(n: number, cap = false) {
  const w = WORDS[n] ?? String(n);
  return cap ? w[0]!.toUpperCase() + w.slice(1) : w;
}

/** "Reva, Riven and Oudor" */
export function listNames(names: string[]) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
