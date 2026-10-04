const HOUR = 60 * 60 * 1000;

export interface CappedDelivery {
  id: number;
  mode: string;
  userId: number;
}

export const splitByHourlyEmailCap = ({
  cap,
  deliveries,
  now,
  sentInLastHour,
}: {
  cap: number;
  deliveries: CappedDelivery[];
  now: Date;
  sentInLastHour: Map<number, Date[]>;
}): { allowed: number[]; deferred: Map<number, Date> } => {
  const allowed: number[] = [];
  const deferred = new Map<number, Date>();
  const used = new Map<number, Date[]>();

  for (const delivery of deliveries) {
    if (cap === 0 || delivery.mode !== "immediate") {
      allowed.push(delivery.id);
      continue;
    }

    const window = used.get(delivery.userId) ?? [
      ...(sentInLastHour.get(delivery.userId) ?? []),
    ];
    used.set(delivery.userId, window);

    if (window.length < cap) {
      window.push(now);
      allowed.push(delivery.id);
      continue;
    }

    const oldest = window.reduce((min, date) => (date < min ? date : min), now);
    deferred.set(delivery.id, new Date(oldest.getTime() + HOUR));
  }

  return { allowed, deferred };
};
