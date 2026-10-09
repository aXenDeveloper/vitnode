import { Pet, type PetState } from "@/components/pet/pet";

type ErrorCode = 400 | 403 | 404 | 409 | 429 | 500;

const PET_BY_CODE: Partial<Record<ErrorCode, PetState>> = {
  404: "oops",
  500: "dizzy",
};

const RISE_CSS = `
.vn-error-rise{animation:vn-error-rise 520ms cubic-bezier(.32,.72,0,1) both}
@keyframes vn-error-rise{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.vn-error-rise{animation:none}}
`;

const GLYPH_STAGGER_MS = 70;
const GLYPH_SLOTS = ["start", "middle", "end"] as const;

const Numerals = ({ code }: { code: ErrorCode }) => {
  const pet = PET_BY_CODE[code];

  return (
    <div
      aria-hidden
      className="flex items-center justify-center gap-1 sm:gap-3"
      data-slot="error-numerals"
    >
      {String(code)
        .split("")
        .map((digit, index) => {
          const slot = GLYPH_SLOTS[index];
          const delay = { animationDelay: `${index * GLYPH_STAGGER_MS}ms` };

          if (pet && slot === "middle") {
            return (
              <div className="vn-error-rise" key="pet" style={delay}>
                <Pet className="h-36 w-32 sm:h-52 sm:w-44" state={pet} />
              </div>
            );
          }

          return (
            <span
              className="vn-error-rise text-primary text-8xl leading-none font-black tracking-tighter tabular-nums sm:text-9xl"
              key={slot}
              style={delay}
            >
              {digit}
            </span>
          );
        })}
    </div>
  );
};

export const ErrorContent = ({
  actions,
  code,
  description,
  title,
}: {
  actions?: React.ReactNode;
  code: ErrorCode;
  description?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <div className="flex flex-col items-center gap-10 px-4 py-12 text-center sm:py-20">
    <style href="vitnode-error-rise" precedence="vitnode-error">
      {RISE_CSS}
    </style>
    <Numerals code={code} />

    <div
      className="vn-error-rise flex max-w-md flex-col gap-3"
      style={{ animationDelay: "240ms" }}
    >
      <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
        <span className="sr-only">{code}</span> {title}
      </h1>
      {description ? (
        <p className="text-muted-foreground leading-relaxed text-pretty">
          {description}
        </p>
      ) : null}
    </div>

    {actions ? (
      <div
        className="vn-error-rise flex flex-col items-center justify-center gap-3 sm:flex-row"
        style={{ animationDelay: "300ms" }}
      >
        {actions}
      </div>
    ) : null}
  </div>
);
