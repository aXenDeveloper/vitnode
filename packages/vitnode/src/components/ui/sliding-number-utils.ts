const PLAIN_NUMBER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
  useGrouping: false,
});

export const digitFaceOffset = (face: number, rolled: number) => {
  const current = ((rolled % 10) + 10) % 10;
  const offset = (10 + face - current) % 10;

  return offset > 5 ? offset - 10 : offset;
};

export const numberPlaces = (value: number) => {
  const [integer = "0", fraction = ""] = PLAIN_NUMBER.format(
    Math.abs(value),
  ).split(".");

  return {
    exponents: Array.from(
      { length: integer.length + fraction.length },
      (_, index) => integer.length - index - 1,
    ),
    fractionDigits: fraction.length,
    scaled: Number(integer + fraction),
  };
};

export type NumberSegment =
  | { exponent: number; kind: "digit" }
  | { key: string; kind: "text"; text: string };

const ASCII_DIGITS = /^\d*$/;

export const formattedPlaces = (
  formatter: Intl.NumberFormat,
  value: number,
): {
  fractionDigits: number;
  scaled: number;
  segments: NumberSegment[];
} => {
  const parts = formatter.formatToParts(value);
  const digitsOf = (type: "fraction" | "integer") =>
    parts
      .filter(part => part.type === type)
      .map(part => part.value)
      .join("");
  const integer = digitsOf("integer");
  const fraction = digitsOf("fraction");

  if (!ASCII_DIGITS.test(integer + fraction)) {
    return {
      fractionDigits: 0,
      scaled: 0,
      segments: [{ key: "value", kind: "text", text: formatter.format(value) }],
    };
  }

  let exponent = integer.length - 1;
  const seen = new Map<string, number>();
  const keyOf = (type: string) => {
    const count = seen.get(type) ?? 0;
    seen.set(type, count + 1);

    return `${type}-${count}`;
  };

  return {
    fractionDigits: fraction.length,
    scaled: Number(integer + fraction) || 0,
    segments: parts.flatMap((part): NumberSegment[] =>
      part.type === "integer" || part.type === "fraction"
        ? [...part.value].map(() => ({ exponent: exponent--, kind: "digit" }))
        : [{ key: keyOf(part.type), kind: "text", text: part.value }],
    ),
  };
};
