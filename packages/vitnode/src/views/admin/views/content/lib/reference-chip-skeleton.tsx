import { Skeleton } from "@/components/ui/skeleton";

/**
 * A chip whose label has not arrived yet.
 *
 * A to-many field opens holding identifiers and nothing else - there is no
 * column on the row a name could have been joined onto - so the labels are a
 * second request. Until it lands the chip has a real value and no way to say it,
 * and printing the identifier is the worst of the three options: `1` and `6` look
 * like data rather than like loading, so the field reads as broken for as long as
 * the lookup takes and then silently becomes something else.
 *
 * Sized in place of the text rather than around the chip, so the row does not
 * reflow when the name replaces it. `bg-muted` is the chip's own background, so
 * the bar is drawn against it rather than in it.
 */
export const ContentReferenceChipSkeleton = ({
  avatar = false,
}: {
  /** Leaves room for the face a `user` chip draws beside the name. */
  avatar?: boolean;
}) => (
  <span aria-hidden className="flex items-center gap-2">
    {avatar ? (
      <Skeleton className="bg-muted-foreground/25 size-4 shrink-0 rounded-full" />
    ) : null}
    <Skeleton className="bg-muted-foreground/25 h-3 w-16 rounded-sm" />
  </span>
);
