export const HonoJSLogo = () => {
  return (
    <>
      <svg
        aria-label="HonoJS logotype"
        className="grayscale"
        height={32}
        viewBox="0 0 76 98"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>HonoJS logotype</title>
        <path
          d="m11 25 7 9s9-18 22-34c17 20 36 48 36 64 0 20-19 34-37 34C17 98 0 81 0 61c0-6 3-24 11-36Z"
          fill="url(#a)"
        />
        <path d="M39 21c47 51 14 66 0 66-11 0-51-11 0-66Z" fill="#F95" />
        <defs>
          <linearGradient id="a" x2="0%" y2="100%">
            <stop stopColor="#F84" />
            <stop offset="100%" stopColor="#F30" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-xl font-bold">Hono</span>
    </>
  );
};
