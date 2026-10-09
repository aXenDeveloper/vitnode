import {
  AMBER,
  BLUE,
  CatMouth,
  DroopyEars,
  DROP_PATH,
  Ears,
  FlatMouth,
  HappyEyes,
  HEART_PATH,
  INDIGO,
  LeftArm,
  LIMP_TAIL,
  LookUpEyes,
  MARK_PATH,
  NAVY,
  OpenEyes,
  OpenMouth,
  Paw,
  PINK,
  RAISED_TAIL,
  RightArm,
  ShinyEye,
  StripedTail,
  Tabby,
  TabbyTail,
  WHITE,
} from "./parts";

const Idle = () => <Tabby />;

const Hello = () => (
  <Tabby
    arms={
      <>
        <g className="vn-pet-wave" style={{ transformOrigin: "52px 152px" }}>
          <ellipse
            cx="36"
            cy="170"
            fill={BLUE}
            rx="22"
            ry="36"
            transform="rotate(38 36 170)"
          />
        </g>
        <RightArm />
      </>
    }
    mouth={<OpenMouth />}
    tail={<TabbyTail d={RAISED_TAIL} duration="1s" origin="334px 384px" />}
  />
);

const Coding = () => (
  <Tabby
    arms={null}
    back={
      <>
        <rect
          fill={WHITE}
          height="40"
          rx="14"
          stroke={BLUE}
          strokeWidth="4"
          width="76"
          x="320"
          y="0"
        />
        <text
          fill={BLUE}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fontSize="22"
          fontWeight="700"
          textAnchor="middle"
          x="358"
          y="28"
        >
          {"</>"}
        </text>
      </>
    }
    belly={false}
    eyes={
      <>
        <ShinyEye cx={158} cy={212} />
        <ShinyEye cx={242} cy={212} />
      </>
    }
    feet={null}
    front={
      <>
        <rect fill={NAVY} height="128" rx="16" width="232" x="84" y="288" />
        <path
          d={MARK_PATH}
          fill={WHITE}
          fillRule="evenodd"
          opacity="0.92"
          transform="translate(145.6 299.3) scale(0.29)"
        />
        <rect fill={BLUE} height="18" rx="9" width="292" x="54" y="410" />
        <g className="vn-pet-type">
          <ellipse cx="150" cy="290" fill={BLUE} rx="24" ry="15" />
        </g>
        <g className="vn-pet-type" style={{ animationDelay: "0.18s" }}>
          <ellipse cx="250" cy="290" fill={BLUE} rx="24" ry="15" />
        </g>
      </>
    }
  />
);

const Coffee = () => (
  <Tabby
    arms={null}
    belly={false}
    eyes={<HappyEyes />}
    front={
      <>
        {[186, 200, 214].map((x, index) => (
          <path
            className="vn-pet-steam"
            d={`M${x} 294q-5 -8 0 -15q5 -8 0 -15`}
            key={x}
            stroke={BLUE}
            strokeLinecap="round"
            strokeWidth="4"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}
        <path
          d="M232 314C258 314 258 352 232 352"
          stroke={INDIGO}
          strokeLinecap="round"
          strokeWidth="9"
        />
        <rect
          fill={WHITE}
          height="72"
          rx="12"
          stroke={INDIGO}
          strokeWidth="5"
          width="68"
          x="166"
          y="298"
        />
        <path
          d={MARK_PATH}
          fill={BLUE}
          fillRule="evenodd"
          transform="translate(178.4 313.1) scale(0.115)"
        />
        <Paw cx={164} cy={340} />
        <Paw cx={252} cy={334} />
      </>
    }
  />
);

const Love = () => (
  <Tabby
    arms={null}
    belly={false}
    eyes={<HappyEyes />}
    front={
      <>
        <g transform="translate(200 334) scale(4)">
          <path className="vn-pet-pulse" d={HEART_PATH} fill={PINK} />
        </g>
        <Paw cx={152} cy={322} />
        <Paw cx={248} cy={322} />
        {[
          { delay: "0s", x: 110, y: 84 },
          { delay: "0.9s", x: 296, y: 74 },
          { delay: "1.8s", x: 70, y: 150 },
        ].map(heart => (
          <g
            key={heart.delay}
            transform={`translate(${heart.x} ${heart.y}) scale(1.5)`}
          >
            <path
              className="vn-pet-heart"
              d={HEART_PATH}
              fill={PINK}
              style={{ animationDelay: heart.delay }}
            />
          </g>
        ))}
      </>
    }
  />
);

const Music = () => (
  <Tabby
    eyes={<HappyEyes />}
    front={
      <>
        <path
          d="M68 214C68 84 332 84 332 214"
          stroke={NAVY}
          strokeLinecap="round"
          strokeWidth="12"
        />
        <rect fill={NAVY} height="68" rx="16" width="36" x="50" y="184" />
        <rect fill={NAVY} height="68" rx="16" width="36" x="314" y="184" />
        <rect fill={AMBER} height="40" rx="6" width="12" x="56" y="198" />
        <rect fill={AMBER} height="40" rx="6" width="12" x="332" y="198" />
        <g
          fill={BLUE}
          fontFamily="system-ui, sans-serif"
          fontSize="44"
          fontWeight="700"
        >
          <text className="vn-pet-rise-note" x="340" y="112">
            ♪
          </text>
          <text
            className="vn-pet-rise-note"
            style={{ animationDelay: "0.8s" }}
            x="26"
            y="96"
          >
            ♫
          </text>
          <text
            className="vn-pet-rise-note"
            style={{ animationDelay: "1.6s" }}
            x="362"
            y="60"
          >
            ♪
          </text>
        </g>
      </>
    }
    motion="vn-pet-groove"
    mouth={
      <path d="M186 242H214Q214 258 200 258Q186 258 186 242Z" fill={NAVY} />
    }
    tail={<TabbyTail duration="0.5s" />}
  />
);

const Sleeping = () => (
  <Tabby
    arms={null}
    ears={<Ears twitch={false} />}
    eyes={
      <path
        d="M138 206Q158 224 178 206M222 206Q242 224 262 206"
        stroke={NAVY}
        strokeLinecap="round"
        strokeWidth="7"
      />
    }
    feet={null}
    front={
      <>
        <ellipse cx="152" cy="404" fill={WHITE} rx="24" ry="14" />
        <ellipse cx="248" cy="404" fill={WHITE} rx="24" ry="14" />
        <StripedTail d="M352 352C372 410 300 432 226 420" />
        <circle
          className="vn-pet-snore"
          cx="222"
          cy="232"
          fill={BLUE}
          fillOpacity="0.15"
          r="13"
          stroke={BLUE}
          strokeWidth="3"
        />
        <g
          fill={BLUE}
          fontFamily="ui-rounded, system-ui, sans-serif"
          fontWeight="800"
        >
          <text className="vn-pet-rise-note" fontSize="52" x="326" y="116">
            z
          </text>
          <text
            className="vn-pet-rise-note"
            fontSize="40"
            style={{ animationDelay: "0.8s" }}
            x="356"
            y="74"
          >
            z
          </text>
          <text
            className="vn-pet-rise-note"
            fontSize="30"
            style={{ animationDelay: "1.6s" }}
            x="378"
            y="38"
          >
            z
          </text>
        </g>
      </>
    }
    motion="vn-pet-breathe"
    tail={null}
  />
);

const Thinking = () => (
  <Tabby
    arms={<LeftArm />}
    back={
      <>
        <circle
          cx="340"
          cy="88"
          fill={WHITE}
          r="6"
          stroke={BLUE}
          strokeWidth="4"
        />
        <circle
          cx="350"
          cy="62"
          fill={WHITE}
          r="9"
          stroke={BLUE}
          strokeWidth="4"
        />
        <ellipse
          cx="364"
          cy="22"
          fill={WHITE}
          rx="40"
          ry="24"
          stroke={BLUE}
          strokeWidth="4"
        />
        {[346, 364, 382].map((cx, index) => (
          <circle
            className="vn-pet-dot"
            cx={cx}
            cy="22"
            fill={BLUE}
            key={cx}
            r="5"
            style={{ animationDelay: `${index * 0.15}s` }}
          />
        ))}
      </>
    }
    eyes={<LookUpEyes />}
    front={
      <>
        <ellipse
          cx="270"
          cy="306"
          fill={BLUE}
          rx="20"
          ry="38"
          stroke={INDIGO}
          strokeWidth="5"
          transform="rotate(-40 270 306)"
        />
        <Paw cx={244} cy={280} />
      </>
    }
    mouth={<FlatMouth />}
  />
);

const CONFETTI = [
  { color: AMBER, delay: "0s", x: 60, y: 30 },
  { color: PINK, delay: "0.3s", x: 120, y: -10 },
  { color: BLUE, delay: "0.6s", x: 176, y: 10 },
  { color: AMBER, delay: "0.9s", x: 236, y: -6 },
  { color: PINK, delay: "1.2s", x: 292, y: 20 },
  { color: BLUE, delay: "1.5s", x: 344, y: 0 },
  { color: AMBER, delay: "0.45s", x: 30, y: 90 },
  { color: PINK, delay: "1.05s", x: 376, y: 70 },
];

const Celebrate = () => (
  <Tabby
    arms={
      <>
        <g className="vn-pet-cheer" style={{ transformOrigin: "54px 150px" }}>
          <ellipse
            cx="38"
            cy="170"
            fill={BLUE}
            rx="22"
            ry="36"
            transform="rotate(38 38 170)"
          />
        </g>
        <g
          className="vn-pet-cheer"
          style={{ animationDelay: "0.4s", transformOrigin: "346px 150px" }}
        >
          <ellipse
            cx="362"
            cy="170"
            fill={BLUE}
            rx="22"
            ry="36"
            transform="rotate(-38 362 170)"
          />
        </g>
      </>
    }
    eyes={<HappyEyes />}
    front={CONFETTI.map(piece => (
      <g
        key={`${piece.x}-${piece.y}`}
        transform={`translate(${piece.x} ${piece.y})`}
      >
        <rect
          className="vn-pet-confetti"
          fill={piece.color}
          height="16"
          rx="2"
          style={{ animationDelay: piece.delay }}
          width="10"
          x="-5"
          y="-8"
        />
      </g>
    ))}
    mouth={
      <>
        <path d="M178 240H222Q222 270 200 270Q178 270 178 240Z" fill={NAVY} />
        <ellipse cx="206" cy="262" fill={PINK} rx="9" ry="5" />
      </>
    }
    tail={<TabbyTail d={RAISED_TAIL} duration="0.5s" origin="334px 384px" />}
  />
);

const Searching = () => (
  <Tabby
    arms={<LeftArm />}
    eyes={<ShinyEye cx={158} cy={206} />}
    front={
      <g className="vn-pet-scan">
        <ellipse
          cx="336"
          cy="318"
          fill={BLUE}
          rx="18"
          ry="30"
          stroke={INDIGO}
          strokeWidth="5"
          transform="rotate(-35 336 318)"
        />
        <circle cx="242" cy="206" fill={WHITE} r="42" />
        <g className="vn-pet-blink">
          <ellipse cx="242" cy="208" fill={NAVY} rx="26" ry="34" />
          <circle cx="252" cy="194" fill={WHITE} r="9" />
          <circle cx="234" cy="222" fill={WHITE} r="4" />
        </g>
        <circle
          cx="242"
          cy="206"
          fill={BLUE}
          fillOpacity="0.08"
          r="42"
          stroke={NAVY}
          strokeWidth="10"
        />
        <path
          d="M274 238L318 286"
          stroke={NAVY}
          strokeLinecap="round"
          strokeWidth="14"
        />
        <Paw cx={318} cy={290} r={16} />
      </g>
    }
  />
);

const WIFI_ARCS = [
  "M-12 0Q0 -12 12 0",
  "M-24 -12Q0 -34 24 -12",
  "M-36 -24Q0 -56 36 -24",
];

const Offline = () => (
  <Tabby
    eyes={
      <>
        <path
          d="M140 174Q156 162 174 170"
          stroke={NAVY}
          strokeLinecap="round"
          strokeWidth="5"
        />
        <OpenEyes />
      </>
    }
    front={
      <>
        <g transform="translate(364 70)">
          <circle cx="0" cy="12" fill={BLUE} r="6" />
          {WIFI_ARCS.map((d, index) => (
            <path
              className="vn-pet-signal"
              d={d}
              key={d}
              stroke={BLUE}
              strokeLinecap="round"
              strokeWidth="7"
              style={{ animationDelay: `${index * 0.25}s` }}
            />
          ))}
          <path
            d="M-34 -50L34 22"
            stroke={WHITE}
            strokeLinecap="round"
            strokeWidth="15"
          />
          <path
            d="M-34 -50L34 22"
            stroke={NAVY}
            strokeLinecap="round"
            strokeWidth="7"
          />
        </g>
        <g transform="translate(318 152)">
          <path className="vn-pet-drip" d={DROP_PATH} fill={WHITE} />
        </g>
      </>
    }
    mouth={<FlatMouth />}
    tail={<TabbyTail d={LIMP_TAIL} duration="3s" origin="330px 400px" />}
  />
);

const Oops = () => (
  <Tabby
    ears={<DroopyEars />}
    eyes={
      <>
        <path
          d="M140 182L172 172M260 182L228 172"
          stroke={NAVY}
          strokeLinecap="round"
          strokeWidth="5"
        />
        <OpenEyes />
        <g transform="translate(146 238)">
          <path className="vn-pet-drip" d={DROP_PATH} fill={BLUE} />
        </g>
      </>
    }
    mouth={
      <path
        d="M184 254Q192 246 200 252Q208 246 216 254"
        stroke={NAVY}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
    }
    tail={<TabbyTail d={LIMP_TAIL} duration="3s" origin="330px 400px" />}
  />
);

const STAR_PATH = "M0 -12L3.5 -4L12 -4L5 2L8 11L0 6L-8 11L-5 2L-12 -4L-3.5 -4Z";

const Dizzy = () => (
  <Tabby
    eyes={[158, 242].map(cx => (
      <path
        className="vn-pet-spin"
        d={`M${cx - 2} 206a2 2 0 1 1 4 0a6 6 0 1 1 -12 0a10 10 0 1 1 20 0a14 14 0 1 1 -28 0`}
        key={cx}
        stroke={NAVY}
        strokeLinecap="round"
        strokeWidth="4.5"
      />
    ))}
    front={
      <g transform="translate(200 66)">
        {["0s", "-0.8s", "-1.6s"].map(delay => (
          <path
            className="vn-pet-orbit"
            d={STAR_PATH}
            fill={AMBER}
            key={delay}
            style={{ animationDelay: delay }}
          />
        ))}
      </g>
    }
    motion="vn-pet-woozy"
    mouth={
      <>
        <path
          d="M182 250Q188 242 194 250Q200 258 206 250Q212 242 218 250"
          stroke={NAVY}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
        />
        <ellipse cx="208" cy="258" fill={PINK} rx="6" ry="7" />
      </>
    }
  />
);

const Building = () => (
  <Tabby
    arms={<LeftArm />}
    front={
      <>
        <path d="M116 124C116 30 284 30 284 124Z" fill={AMBER} />
        <path
          d="M200 60V118"
          stroke={WHITE}
          strokeLinecap="round"
          strokeOpacity="0.5"
          strokeWidth="10"
        />
        <rect fill={AMBER} height="16" rx="8" width="200" x="100" y="116" />
        <ellipse
          cx="354"
          cy="276"
          fill={BLUE}
          rx="18"
          ry="34"
          stroke={INDIGO}
          strokeWidth="5"
          transform="rotate(-24 354 276)"
        />
        <g className="vn-pet-hammer" style={{ transformOrigin: "340px 240px" }}>
          <path
            d="M340 240V172"
            stroke={WHITE}
            strokeLinecap="round"
            strokeWidth="18"
          />
          <path
            d="M340 240V172"
            stroke={NAVY}
            strokeLinecap="round"
            strokeWidth="10"
          />
          <rect
            fill={NAVY}
            height="22"
            rx="4"
            stroke={WHITE}
            strokeWidth="4"
            width="50"
            x="315"
            y="152"
          />
          <Paw cx={340} cy={240} r={16} />
        </g>
      </>
    }
    mouth={
      <>
        <CatMouth />
        <ellipse cx="214" cy="252" fill={PINK} rx="5" ry="6" />
      </>
    }
  />
);

export const PET_STATES = {
  idle: Idle,
  hello: Hello,
  coding: Coding,
  coffee: Coffee,
  love: Love,
  music: Music,
  sleeping: Sleeping,
  thinking: Thinking,
  celebrate: Celebrate,
  searching: Searching,
  offline: Offline,
  oops: Oops,
  dizzy: Dizzy,
  building: Building,
};

export type PetState = keyof typeof PET_STATES;
