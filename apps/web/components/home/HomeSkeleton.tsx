import Skeleton from '@/components/ui/Skeleton';

const PLACEHOLDER_ITEMS = [0, 1, 2];

function SectionHeading({
  eyebrow = false,
  countWidth = 'w-24'
}: {
  eyebrow?: boolean;
  countWidth?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-2">
        {eyebrow && <Skeleton className="h-3 w-20 rounded-full bg-primary/10" />}
        <Skeleton className="h-6 w-28 rounded-lg" />
      </div>
      <Skeleton className={`h-6 ${countWidth} rounded-full`} />
    </div>
  );
}

function LibraryCardSkeleton({ subject = false }: { subject?: boolean }) {
  return (
    <div className="flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl border border-border/40 bg-card">
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {subject && <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />}
            <div className="space-y-2">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
        {!subject && <Skeleton className="h-8 w-4/5 rounded-lg" />}
      </div>
      <div className="flex items-center justify-between border-t border-border/40 px-5 py-3">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-xl" />
      </div>
    </div>
  );
}

function LibraryGrid({ subject = false }: { subject?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PLACEHOLDER_ITEMS.map((item) => (
        <LibraryCardSkeleton key={item} subject={subject} />
      ))}
    </div>
  );
}

export default function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading home" className="space-y-8 pb-20">
      <span className="sr-only">Loading your reviewers and subjects...</span>

      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-border/40 bg-card p-6 sm:p-8 md:flex-row md:items-center">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-6 w-56 rounded-full bg-primary/10" />
          <Skeleton className="h-9 w-full max-w-md rounded-xl" />
          <Skeleton className="h-4 w-full max-w-xl rounded-lg" />
          <Skeleton className="h-4 w-4/5 max-w-lg rounded-lg" />
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Skeleton className="h-11 w-36 rounded-2xl" />
          <Skeleton className="h-11 w-36 rounded-2xl" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-10 w-full rounded-2xl sm:w-96" />
        <Skeleton className="h-11 w-full rounded-2xl sm:w-40" />
      </div>

      <section className="space-y-4" aria-label="Loading subjects">
        <SectionHeading eyebrow countWidth="w-28" />
        <LibraryGrid subject />
      </section>

      <section className="space-y-4" aria-label="Loading reviewers">
        <SectionHeading countWidth="w-24" />
        <LibraryGrid />
      </section>
    </div>
  );
}
