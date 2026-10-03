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
