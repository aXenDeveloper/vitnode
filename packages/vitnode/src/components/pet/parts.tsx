import React from "react";

const BODY_PATH =
  "M180.601 65.195C192.605 58.268 207.395 58.268 219.399 65.195L348.601 139.745C360.605 146.671 368 159.472 368 173.325V322.425C368 336.278 360.605 349.079 348.601 356.005L219.399 430.555C207.395 437.482 192.605 437.482 180.601 430.555L51.399 356.005C39.395 349.079 32 336.278 32 322.425V173.325C32 159.472 39.395 146.671 51.399 139.745L180.601 65.195Z";

export const MARK_PATH =
  "M109.649 106.082L187.5 61.1613L265.351 106.082L187.5 241.071L109.649 106.082ZM77.6969 148.394V251.232L166.585 302.521L77.6969 148.394ZM208.415 302.521L297.303 251.232V148.394L208.415 302.521Z";

export const HEART_PATH =
  "M0 7C-11 -1 -13 -9 -7 -13C-3 -15 0 -12 0 -9C0 -12 3 -15 7 -13C13 -9 11 -1 0 7Z";

export const DROP_PATH = "M0 -10C6 -2 8 2 8 6A8 8 0 0 1 -8 6C-8 2 -6 -2 0 -10Z";

export const BLUE = "#3261BF";
export const INDIGO = "#363795";
export const NAVY = "#1B2140";
export const WHITE = "#FDFEFF";
export const AMBER = "#F5B544";
export const PINK = "#F59AB0";

export const RAISED_TAIL =
  "M334 384C392 384 404 330 404 236C404 186 404 160 424 150";
export const LIMP_TAIL = "M330 400C370 424 402 432 424 424";
const CURLED_TAIL = "M330 384C390 384 392 300 360 288";

const useGradientId = () =>
  `vn-pet-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

export const Feet = () => (
  <>
    <ellipse cx="136" cy="404" fill={INDIGO} rx="34" ry="20" />
    <ellipse cx="264" cy="404" fill={INDIGO} rx="34" ry="20" />
  </>
);

export const ShinyEye = ({ cx, cy }: { cx: number; cy: number }) => (
  <g className="vn-pet-blink">
    <ellipse cx={cx} cy={cy} fill={NAVY} rx="18" ry="24" />
    <circle cx={cx + 7} cy={cy - 10} fill={WHITE} r="6.5" />
    <circle cx={cx - 5} cy={cy + 10} fill={WHITE} r="3" />
  </g>
);

export const OpenEyes = () => (
  <>
    <ShinyEye cx={158} cy={206} />
    <ShinyEye cx={242} cy={206} />
  </>
);

export const HappyEyes = () => (
  <path
    d="M138 210Q158 186 178 210M222 210Q242 186 262 210"
    stroke={NAVY}
    strokeLinecap="round"
    strokeWidth="7"
  />
);

export const LookUpEyes = () => (
  <g className="vn-pet-blink">
    <ellipse cx="164" cy="198" fill={NAVY} rx="16" ry="22" />
    <ellipse cx="248" cy="198" fill={NAVY} rx="16" ry="22" />
    <circle cx="170" cy="188" fill={WHITE} r="6" />
    <circle cx="254" cy="188" fill={WHITE} r="6" />
  </g>
);

export const CatMouth = () => (
  <path
    d="M184 242Q192 252 200 244Q208 252 216 242"
    stroke={NAVY}
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="5"
  />
);

export const OpenMouth = () => (
  <path d="M184 242H216Q216 262 200 262Q184 262 184 242Z" fill={NAVY} />
);

export const FlatMouth = () => (
  <path
    d="M190 250Q200 246 210 250"
    stroke={NAVY}
    strokeLinecap="round"
    strokeWidth="5"
  />
);

const LeftEar = () => (
  <>
    <path
      d="M74 160L82 52L166 104Z"
      fill={BLUE}
      stroke={BLUE}
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M96 130L100 80L138 104Z"
      fill={PINK}
      opacity="0.8"
      stroke={PINK}
      strokeLinejoin="round"
      strokeWidth="6"
    />
  </>
);

const RightEar = () => (
  <>
    <path
      d="M326 160L318 52L234 104Z"
      fill={BLUE}
      stroke={BLUE}
      strokeLinejoin="round"
      strokeWidth="16"
    />
    <path
      d="M304 130L300 80L262 104Z"
      fill={PINK}
      opacity="0.8"
      stroke={PINK}
      strokeLinejoin="round"
      strokeWidth="6"
    />
  </>
);

export const Ears = ({ twitch = true }: { twitch?: boolean }) => (
  <>
    <g
      className={twitch ? "vn-pet-ear" : undefined}
      style={{ transformOrigin: "120px 130px" }}
    >
      <LeftEar />
    </g>
    <RightEar />
  </>
);

export const DroopyEars = () => (
  <>
    <g transform="rotate(-26 120 132)">
      <LeftEar />
    </g>
    <g transform="rotate(26 280 132)">
      <RightEar />
    </g>
  </>
);

export const Paw = ({
  cx,
  cy,
  r = 15,
}: {
  cx: number;
  cy: number;
  r?: number;
}) => (
  <circle cx={cx} cy={cy} fill={WHITE} r={r} stroke={INDIGO} strokeWidth="5" />
);

export const LeftArm = () => (
  <ellipse
    cx="34"
    cy="262"
    fill={INDIGO}
    rx="22"
    ry="36"
    transform="rotate(18 34 262)"
  />
);

export const RightArm = () => (
  <ellipse
    cx="366"
    cy="262"
    fill={INDIGO}
    rx="22"
    ry="36"
    transform="rotate(-18 366 262)"
  />
);

const ArmsDown = () => (
  <>
    <LeftArm />
    <RightArm />
  </>
);

export const StripedTail = ({ d }: { d: string }) => (
  <>
    <path d={d} stroke={INDIGO} strokeLinecap="round" strokeWidth="24" />
    <path
      d={d}
      opacity="0.35"
      stroke={WHITE}
      strokeDasharray="8 18"
      strokeWidth="24"
    />
  </>
);

export const TabbyTail = ({
  d = CURLED_TAIL,
  duration,
  origin = "330px 384px",
}: {
  d?: string;
  duration?: string;
  origin?: string;
}) => (
  <g
    className="vn-pet-sway"
    style={{ animationDuration: duration, transformOrigin: origin }}
  >
    <StripedTail d={d} />
  </g>
);

export const Tabby = ({
  arms = <ArmsDown />,
  back,
  belly = true,
  ears = <Ears />,
  eyes = <OpenEyes />,
  feet = <Feet />,
  front,
  motion,
  mouth = <CatMouth />,
  tail = <TabbyTail />,
}: {
  arms?: React.ReactNode;
  back?: React.ReactNode;
  belly?: boolean;
  ears?: React.ReactNode;
  eyes?: React.ReactNode;
  feet?: React.ReactNode;
  front?: React.ReactNode;
  motion?: string;
  mouth?: React.ReactNode;
  tail?: React.ReactNode;
}) => {
  const gradientId = useGradientId();

  return (
    <>
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={gradientId}
          x1="200"
          x2="200"
          y1="60"
          y2="436"
        >
          <stop stopColor={BLUE} />
          <stop offset="1" stopColor={INDIGO} />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="446" fill={NAVY} opacity="0.12" rx="118" ry="10" />
      <g className={motion}>
        {back}
        {tail}
        {ears}
        {arms}
        {feet}
        <path d={BODY_PATH} fill={`url(#${gradientId})`} />
        <path
          d="M62 170C62 160 68 154 76 149L150 106"
          opacity="0.28"
          stroke={WHITE}
          strokeLinecap="round"
          strokeWidth="8"
        />
        <path
          d="M184 94L188 122M200 90V120M216 94L212 122M42 206L66 212M42 228L64 230M358 206L334 212M358 228L336 230"
          opacity="0.35"
          stroke={WHITE}
          strokeLinecap="round"
          strokeWidth="7"
        />
        <rect fill={WHITE} height="146" rx="70" width="224" x="88" y="138" />
        {eyes}
        <ellipse cx="124" cy="238" fill={PINK} opacity="0.7" rx="15" ry="9" />
        <ellipse cx="276" cy="238" fill={PINK} opacity="0.7" rx="15" ry="9" />
        <path
          d="M192 224H208L200 233Z"
          fill={PINK}
          stroke={PINK}
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {mouth}
        <path
          d="M98 222L128 228M98 244L128 240M302 222L272 228M302 244L272 240"
          opacity="0.45"
          stroke={NAVY}
          strokeLinecap="round"
          strokeWidth="3.5"
        />
        {belly ? (
          <path
            d={MARK_PATH}
            fill={WHITE}
            fillRule="evenodd"
            opacity="0.92"
            transform="translate(147.5 300) scale(0.28)"
          />
        ) : null}
        {front}
      </g>
    </>
  );
};
