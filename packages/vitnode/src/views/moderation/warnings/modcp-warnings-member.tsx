import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ArrowRightIcon,
  ExternalLinkIcon,
  RotateCwIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UserRoundXIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { UserOption } from "@/components/form/fields/input-users";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AsyncPicker } from "@/components/form/common/async-picker";
import {
  AutoFormUser,
  UserOptionRow,
} from "@/components/form/fields/input-users";
import { MotionFeatures } from "@/components/motion-features";
import { useDataTableUrl } from "@/components/table/navigation";
import { withTableFilter } from "@/components/table/url-state";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { userProfileHref } from "@/components/user-format";
import { REVEAL_EXIT_TRANSITION, REVEAL_TRANSITION } from "@/lib/motion";
import { WarnDialog } from "@/tanstack/moderation/warn-button";

import type { ReportPerson } from "../modcp/report-tone";
import type { ModcpMemberStanding } from "./warnings-api";

import { Person, PersonAvatar, PersonName } from "../modcp/report-tone";
import { LiftSanctionButton } from "./warning-list";
import { SanctionSummary } from "./warning-sanction";
import {
  memberSearchQueryOptions,
  memberStandingQueryOptions,
} from "./warnings-api";

export const useMemberFilter = () => {
  const { navigate, searchParams } = useDataTableUrl();
  const raw = Number(searchParams.get("user"));
  const userId = Number.isInteger(raw) && raw > 0 ? raw : null;
  const setUser = (id: null | number) => {
    navigate(
      withTableFilter(searchParams, {
        id: "user",
        values: id === null ? [] : [String(id)],
      }),
    );
  };

  return { setUser, userId };
};

const toUserOption = (person: ReportPerson): UserOption => ({
  avatarColor: person.avatarColor,
  id: person.id,
  name: person.name,
  nameCode: person.nameCode,
  role: { color: person.role.color, prefix: person.role.prefix },
});

const useMemberSearch = () => {
  const queryClient = useQueryClient();

  return React.useCallback(
    async (value: string): Promise<UserOption[]> => {
      if (!value.trim()) return [];
      const people = await queryClient.query(memberSearchQueryOptions(value));

      return people.map(toUserOption);
    },
    [queryClient],
  );
};

const useStanding = (userId: null | number) =>
  useQuery({
    ...memberStandingQueryOptions(userId ?? 0),
    enabled: userId !== null,
    placeholderData: keepPreviousData,
  });

export const MemberFilter = () => {
  const t = useTranslations("core.moderation.warn");
  const search = useMemberSearch();
  const { setUser, userId } = useMemberFilter();
  const standing = useStanding(userId);
  const selected = userId ? (standing.data?.user ?? null) : null;

  return (
    <AsyncPicker<UserOption>
      className="w-60"
      onSelect={option => {
        setUser(option.id);
      }}
      renderOption={option => <UserOptionRow user={option} />}
      search={search}
      searchPlaceholder={t("lookup.placeholder")}
      selectedIds={userId ? [userId] : []}
      trigger={
        selected ? (
          <span className="flex min-w-0 [&>*]:max-w-full">
            <Person person={selected} size={20} />
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-2 truncate">
            <UserRoundIcon aria-hidden="true" className="size-4 shrink-0" />
            {t("list.member")}
          </span>
        )
      }
    />
  );
};

const pickSchema = z.object({ userId: z.number() });

export const WarnMemberButton = () => {
  const t = useTranslations("core.moderation.warn");
  const tGlobal = useTranslations("core.global");
  const search = useMemberSearch();
  const [picking, setPicking] = React.useState(false);
  const [userId, setUserId] = React.useState<null | number>(null);

  const onSubmit: AutoFormOnSubmit<typeof pickSchema> = values => {
    setPicking(false);
    window.setTimeout(() => {
      setUserId(values.userId);
    }, 200);
  };

  return (
    <>
      <Button
        onClick={() => {
          setPicking(true);
        }}
        variant="destructive"
      >
        <TriangleAlertIcon aria-hidden="true" />
        {t("button_member")}
      </Button>
      <Dialog onOpenChange={setPicking} open={picking}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("button_member")}</DialogTitle>
            <DialogDescription>{t("pick.desc")}</DialogDescription>
          </DialogHeader>
          <AutoForm
            className="flex flex-col gap-4"
            fields={[
              {
                id: "userId",
                component: props => (
                  <AutoFormUser
                    {...props}
                    label={t("lookup.label")}
                    placeholder={t("lookup.placeholder")}
                    search={search}
                    searchPlaceholder={t("lookup.placeholder")}
                  />
                ),
              },
            ]}
            formSchema={pickSchema}
            layout={fields => (
              <>
                {fields.userId}
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="ghost">{tGlobal("cancel")}</Button>
                    }
                  />
                  <AutoFormSubmitButton>
                    <ArrowRightIcon aria-hidden="true" />
                    {t("pick.continue")}
                  </AutoFormSubmitButton>
                </DialogFooter>
              </>
            )}
            onSubmit={onSubmit}
          />
        </DialogContent>
      </Dialog>
      {userId === null ? null : (
        <WarnDialog
          onOpenChange={open => {
            if (!open) setUserId(null);
          }}
          open
          userId={userId}
        />
      )}
    </>
  );
};

const WarnThisMember = ({ standing }: { standing: ModcpMemberStanding }) => {
  const t = useTranslations("core.moderation.warn");
  const [open, setOpen] = React.useState(false);
  if (!standing.permissions.warn) return null;

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        variant="destructive"
      >
        <TriangleAlertIcon aria-hidden="true" />
        {t("button_member")}
      </Button>
      <WarnDialog
        onOpenChange={setOpen}
        open={open}
        userId={standing.user.id}
      />
    </>
  );
};

const ClearMemberButton = () => {
  const t = useTranslations("core.moderation.warn");
  const { setUser } = useMemberFilter();

  return (
    <Button
      aria-label={t("member.clear")}
      onClick={() => {
        setUser(null);
      }}
      size="icon-sm"
      variant="ghost"
    >
      <XIcon aria-hidden="true" />
    </Button>
  );
};

const Fact = ({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) => (
  <div className="flex items-baseline gap-1.5">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="text-foreground text-sm font-semibold tabular-nums">
      {children}
    </dd>
  </div>
);

const useCollapse = () => {
  const reduceMotion = useReducedMotion();
  const collapsed = reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 };

  return {
    animate: { height: "auto", opacity: 1 },
    exit: { ...collapsed, transition: REVEAL_EXIT_TRANSITION },
    initial: collapsed,
    transition: REVEAL_TRANSITION,
  };
};

const SuspensionNotice = ({ standing }: { standing: ModcpMemberStanding }) => {
  const t = useTranslations("core.moderation.warn");
  const collapse = useCollapse();
  const sanction =
    standing.sanctions?.find(candidate => candidate.active) ?? null;

  return (
    <AnimatePresence initial={false}>
      {sanction ? (
        <m.div className="overflow-hidden" key={sanction.id} {...collapse}>
          <div className="bg-destructive/5 border-destructive/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <p className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed text-pretty">
              <ShieldAlertIcon
                aria-hidden="true"
                className="text-destructive mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="text-foreground font-medium">
                  {sanction.endsAt
                    ? t("sanctions.temporary")
                    : t("sanctions.indefinite")}
                </span>
                {" · "}
                <SanctionSummary
                  sanction={{
                    durationMinutes: sanction.threshold?.durationMinutes,
                    endsAt: sanction.endsAt,
                  }}
                />
                {sanction.threshold
                  ? ` ${t("sanctions.from_threshold", { points: sanction.threshold.points })}.`
                  : null}
              </span>
            </p>
            {standing.permissions.manageSanctions ? (
              <LiftSanctionButton sanction={sanction} />
            ) : null}
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
};

const MemberBandBody = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.moderation.warn");
  const tGlobal = useTranslations("core.global");
  const reduceMotion = useReducedMotion();
  const standing = useStanding(userId);
  const data = standing.data;

  if (!data) {
    return standing.isError ? (
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"
        role="alert"
      >
        <p className="text-muted-foreground flex items-start gap-2 text-sm leading-relaxed">
          <UserRoundXIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span>
            <span className="text-foreground font-medium">
              {t("member.load_error.title")}
            </span>{" "}
            {t("member.load_error.desc")}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            isLoading={standing.isFetching}
            onClick={() => void standing.refetch()}
            size="sm"
            variant="outline"
          >
            <RotateCwIcon aria-hidden="true" />
            {tGlobal("errors.try_again")}
          </Button>
          <ClearMemberButton />
        </div>
      </div>
    ) : (
      <div
        aria-busy="true"
        className="flex items-center gap-3 px-4 py-4 sm:px-6"
      >
        <span className="sr-only" role="status">
          {t("member.loading")}
        </span>
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
    );
  }

  const activeWarnings = data.warnings.filter(
    warning => warning.status === "active",
  ).length;

  return (
    <div
      aria-busy={standing.isPlaceholderData}
      className={cn(
        "flex flex-col gap-3 px-4 py-4 motion-safe:transition-opacity sm:px-6",
        standing.isPlaceholderData && "opacity-60",
      )}
    >
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
        key={data.user.id}
        transition={REVEAL_TRANSITION.default}
      >
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar person={data.user} size={40} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-foreground flex min-w-0 text-base font-semibold [&>*]:max-w-full">
              <PersonName link person={data.user} />
            </h2>
            <dl className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <Fact label={t("member.active_points")}>
                <SlidingNumber value={data.activePoints} />
              </Fact>
              <Fact label={t("member.active_warnings")}>
                <SlidingNumber value={activeWarnings} />
                <span className="text-muted-foreground font-normal">
                  {" "}
                  / {data.warnings.length}
                </span>
              </Fact>
            </dl>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            to={userProfileHref(data.user.nameCode)}
          >
            <ExternalLinkIcon aria-hidden="true" />
            {t("member.profile")}
          </Link>
          <WarnThisMember standing={data} />
          <ClearMemberButton />
        </div>
      </m.div>
      <SuspensionNotice standing={data} />
      {data.hiddenWarnings > 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("member.hidden_warnings", { count: data.hiddenWarnings })}
        </p>
      ) : null}
    </div>
  );
};

const MEMBER_BAND_ID = "modcp-member-band";

export const revealMemberBand = () => {
  const band = document.getElementById(MEMBER_BAND_ID);
  if (!band) return;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  band.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
};

const useRevealOnPick = (userId: null | number) => {
  const reduceMotion = useReducedMotion();
  const bandRef = React.useRef<HTMLElement>(null);
  const shownUserIdRef = React.useRef(userId);
  const waitingForOpenRef = React.useRef(false);

  const reveal = React.useCallback(() => {
    waitingForOpenRef.current = false;
    const band = bandRef.current;
    if (!band) return;
    const { top } = band.getBoundingClientRect();
    if (window.scrollY === 0 && top < window.innerHeight / 2) return;
    band.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [reduceMotion]);

  React.useEffect(() => {
    const previous = shownUserIdRef.current;
    shownUserIdRef.current = userId;
    if (userId === null || userId === previous) return;
    if (previous !== null) {
      reveal();

      return;
    }
    waitingForOpenRef.current = true;
    const fallback = window.setTimeout(() => {
      if (waitingForOpenRef.current) reveal();
    }, 120);

    return () => {
      window.clearTimeout(fallback);
    };
  }, [reveal, userId]);

  const onAnimationStart = () => {
    if (waitingForOpenRef.current) {
      window.requestAnimationFrame(reveal);
    }
  };

  return { bandRef, onAnimationStart };
};

export const MemberBand = ({ userId }: { userId: null | number }) => {
  const t = useTranslations("core.moderation.warn");
  const collapse = useCollapse();
  const { bandRef, onAnimationStart } = useRevealOnPick(userId);

  return (
    <MotionFeatures>
      <AnimatePresence initial={false}>
        {userId === null ? null : (
          <m.section
            aria-label={t("list.member")}
            className="border-foreground/10 -mx-4 -mt-3 scroll-mt-24 overflow-hidden border-b sm:-mx-6"
            id={MEMBER_BAND_ID}
            key="member-band"
            onAnimationStart={onAnimationStart}
            ref={bandRef}
            {...collapse}
          >
            <MemberBandBody userId={userId} />
          </m.section>
        )}
      </AnimatePresence>
    </MotionFeatures>
  );
};
