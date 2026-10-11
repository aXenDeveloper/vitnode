import type { Context, MiddlewareHandler } from "hono";

import { and, eq, lte } from "drizzle-orm";
import { camelCase, uniqueIndex } from "drizzle-orm/pg-core";
import { createTranslator } from "use-intl";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { PaymentsConfig } from "@/payments/config";
import type { PaymentOffer } from "@/payments/offer";
import type {
  PaymentProvider,
  ProviderCheckout,
  ProviderCheckoutInput,
  ProviderInvoice,
  ProviderPayment,
  ProviderSubscription,
  ProviderWebhookEvent,
} from "@/payments/provider";

import { QueueModel } from "@/api/models/queue";
import {
  fulfillPaymentTask,
  processPaymentEventTask,
} from "@/api/modules/payments/tasks/payments.tasks";
import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";
import { core_cron } from "@/database/cron";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import * as paymentTables from "@/database/payments";
import { core_queue } from "@/database/queue";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import { createPaymentsRegistry } from "@/payments/config";
import { definePaymentOffer } from "@/payments/offer";
import {
  PaymentProviderError,
  PaymentWebhookSignatureError,
} from "@/payments/provider";

import { createTestCache } from "./cache";
import { createTestDatabase, type TestDatabaseHandle } from "./postgres";

/**
 * A plugin's own access table, shaped like the example plugin's: one row per
 * user and offer, unique, so a duplicate grant is a constraint violation
 * rather than a silent second row.
 */
export const test_payments_access = camelCase.table(
  "test_payments_access",
  t => ({
    id: t.serial().primaryKey(),
    userId: t.integer().notNull(),
    offerId: t.varchar({ length: 64 }).notNull(),
    purchaseId: t.varchar({ length: 64 }).notNull(),
    accessUntil: t.timestamp(),
    revokedAt: t.timestamp(),
  }),
  t => [uniqueIndex("test_payments_access_unique").on(t.userId, t.offerId)],
);

const PLUGIN_ID = "@acme/test";

/** The value, or a test failure naming what was missing. */
export const must = <T>(value: null | T | undefined, what = "value"): T => {
  if (value === null || value === undefined) {
    throw new Error(`Expected a ${what}.`);
  }

  return value;
};

/** A deterministic stand-in for a hosted-checkout provider. Nothing leaves the process. */
export const createFakeProvider = (id = "fake") => {
  let seq = 0;
  const next = (prefix: string) => `${prefix}_${++seq}`;

  const checkouts = new Map<
    string,
    ProviderCheckout & { input: ProviderCheckoutInput }
  >();
  const byIdempotencyKey = new Map<string, string>();
  const subscriptions = new Map<string, ProviderSubscription>();
  const invoices = new Map<string, ProviderInvoice>();
  const payments = new Map<string, ProviderPayment>();
  const createCalls: {
    idempotencyKey: string;
    input: ProviderCheckoutInput;
  }[] = [];
  const customerCalls: { idempotencyKey: string; userId: number }[] = [];
  const failures: { error: Error; operation: string }[] = [];
  let webhookQueue: null | ProviderWebhookEvent = null;

  const failIfAsked = (operation: string) => {
    const index = failures.findIndex(
      failure => failure.operation === operation,
    );
    if (index === -1) return;
    const [failure] = failures.splice(index, 1);
    throw failure.error;
  };

  const provider: PaymentProvider = {
    checkAmount: ({ amount }) => (amount > 99_999_999 ? "Too large." : null),
    checkout: {
      create: async (input, { idempotencyKey }) => {
        createCalls.push({ idempotencyKey, input });
        const replay = byIdempotencyKey.get(idempotencyKey);

        // The request reached the provider and then the answer was lost.
        const lost = failures.findIndex(
          failure => failure.operation === "create:lost",
        );
        if (lost !== -1 && !replay) {
          const [failure] = failures.splice(lost, 1);
          const checkoutId = next("cs");
          byIdempotencyKey.set(idempotencyKey, checkoutId);
          checkouts.set(checkoutId, {
            amountTotal: input.item.amount,
            currency: input.item.currency,
            customerId: input.customerId,
            expiresAt: input.expiresAt,
            id: checkoutId,
            input,
            paymentId: null,
            paymentStatus: "unpaid",
            reference: input.reference,
            status: "open",
            subscriptionId: null,
            url: `https://pay.example/${checkoutId}`,
          });
          throw failure.error;
        }

        failIfAsked("create");

        if (replay) {
          const { input: _input, ...existing } = must(checkouts.get(replay));

          return await Promise.resolve(existing);
        }

        const checkoutId = next("cs");
        byIdempotencyKey.set(idempotencyKey, checkoutId);
        const checkout = {
          amountTotal: input.item.amount,
          currency: input.item.currency,
          customerId: input.customerId,
          expiresAt: input.expiresAt,
          id: checkoutId,
          input,
          paymentId: null,
          paymentStatus: "unpaid" as const,
          reference: input.reference,
          status: "open" as const,
          subscriptionId: null,
          url: `https://pay.example/${checkoutId}`,
        };
        checkouts.set(checkoutId, checkout);
        const { input: _ignored, ...result } = checkout;

        return await Promise.resolve(result);
      },
      expire: async checkoutId => {
        failIfAsked("expire");
        const checkout = must(checkouts.get(checkoutId));
        if (checkout.status === "complete") {
          throw new PaymentProviderError(
            "rejected",
            "Checkout is already complete.",
          );
        }
        checkout.status = "expired";
        checkout.url = null;
        const { input: _input, ...result } = checkout;

        return await Promise.resolve(result);
      },
      retrieve: async checkoutId => {
        failIfAsked("retrieve");
        const found = checkouts.get(checkoutId);
        if (!found)
          throw new PaymentProviderError("not_found", "No such checkout.");
        const { input: _input, ...result } = found;

        return await Promise.resolve(result);
      },
    },
    currencies: ["PLN", "USD", "EUR", "JPY"],
    customers: {
      create: async ({ userId }, { idempotencyKey }) => {
        customerCalls.push({ idempotencyKey, userId });
        failIfAsked("customer");

        return await Promise.resolve({ customerId: `cus_${userId}` });
      },
    },
    id,
    name: "Fake",
    payments: {
      retrieve: async paymentId => {
        failIfAsked("payment");
        const payment = payments.get(paymentId);
        if (!payment)
          throw new PaymentProviderError("not_found", "No such payment.");

        return await Promise.resolve(structuredClone(payment));
      },
    },
    portal: {
      createSession: async ({ customerId, returnUrl }) =>
        await Promise.resolve({
          url: `https://portal.example/${customerId}?return=${encodeURIComponent(returnUrl)}`,
        }),
    },
    scope: "test",
    subscriptions: {
      retrieve: async subscriptionId => {
        failIfAsked("subscription");
        const subscription = subscriptions.get(subscriptionId);
        if (!subscription)
          throw new PaymentProviderError("not_found", "No such subscription.");

        return await Promise.resolve(structuredClone(subscription));
      },
      retrieveInvoice: async invoiceId => {
        failIfAsked("invoice");
        const invoice = invoices.get(invoiceId);
        if (!invoice)
          throw new PaymentProviderError("not_found", "No such invoice.");

        return await Promise.resolve(structuredClone(invoice));
      },
    },
    webhooks: {
      verify: async ({ headers }) => {
        if (headers.get("x-fake-signature") !== "valid") {
          throw new PaymentWebhookSignatureError("Bad signature.");
        }
        const event = webhookQueue;
        webhookQueue = null;

        return await Promise.resolve(must(event));
      },
    },
  };

  const DAY = 24 * 60 * 60 * 1000;

  return {
    checkouts,
    createCalls,
    customerCalls,
    /** Make the next call to `operation` throw `error`. */
    failNext: (operation: string, error: Error) => {
      failures.push({ error, operation });
    },
    invoices,
    nextWebhook: (event: ProviderWebhookEvent) => {
      webhookQueue = event;
    },
    payments,
    provider,
    subscriptions,

    /** The buyer completes the hosted page. */
    complete: (
      checkoutId: string,
      outcome: "failed" | "paid" | "unpaid" = "paid",
      { now = new Date() }: { now?: Date } = {},
    ) => {
      const checkout = must(checkouts.get(checkoutId));
      checkout.status = "complete";
      checkout.paymentStatus = outcome;
      checkout.url = null;

      if (checkout.input.mode === "one_time") {
        checkout.paymentId = `pi_${checkoutId}`;
        payments.set(checkout.paymentId, {
          amount: checkout.input.item.amount,
          amountRefunded: 0,
          currency: checkout.input.item.currency,
          disputes: [],
          id: checkout.paymentId,
          refunds: [],
        });

        return { checkout };
      }

      const subscriptionId = `sub_${checkoutId}`;
      const invoiceId = `in_${checkoutId}_1`;
      const periodEnd = new Date(
        now.getTime() +
          (checkout.input.item.interval === "year" ? 365 : 30) * DAY,
      );
      checkout.subscriptionId = subscriptionId;
      subscriptions.set(subscriptionId, {
        amount: checkout.input.item.amount,
        cancelAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        currency: checkout.input.item.currency,
        currentPeriodEnd: periodEnd,
        customerId: checkout.input.customerId,
        endedAt: null,
        id: subscriptionId,
        interval: checkout.input.item.interval ?? "month",
        latestInvoiceId: invoiceId,
        priceId: `price_${checkoutId}`,
        providerStatus: outcome === "paid" ? "active" : "incomplete",
        reference: checkout.input.reference,
        status: outcome === "paid" ? "active" : "incomplete",
      });
      invoices.set(invoiceId, {
        amountDue: checkout.input.item.amount,
        amountPaid: outcome === "paid" ? checkout.input.item.amount : 0,
        billingReason: "subscription_create",
        currency: checkout.input.item.currency,
        id: invoiceId,
        paidAt: outcome === "paid" ? now : null,
        paymentId: outcome === "paid" ? `pi_${invoiceId}` : null,
        periodEnd,
        periodStart: now,
        providerStatus: outcome === "paid" ? "paid" : "open",
        status: outcome === "paid" ? "paid" : "open",
        subscriptionId,
      });

      return { checkout, invoiceId, subscriptionId };
    },

    expireCheckout: (checkoutId: string) => {
      const checkout = must(checkouts.get(checkoutId));
      checkout.status = "expired";
      checkout.url = null;
    },

    /** The provider bills the next period. */
    renew: (
      subscriptionId: string,
      outcome: "action_required" | "failed" | "paid",
    ): string => {
      const subscription = must(subscriptions.get(subscriptionId));
      const start = must(subscription.currentPeriodEnd);
      const end = new Date(
        start.getTime() + (subscription.interval === "year" ? 365 : 30) * DAY,
      );
      const invoiceId = `in_${subscriptionId}_${start.getTime()}`;
      invoices.set(invoiceId, {
        amountDue: subscription.amount ?? 0,
        amountPaid: outcome === "paid" ? (subscription.amount ?? 0) : 0,
        billingReason: "subscription_cycle",
        currency: subscription.currency ?? "PLN",
        id: invoiceId,
        paidAt: outcome === "paid" ? start : null,
        paymentId: outcome === "paid" ? `pi_${invoiceId}` : null,
        periodEnd: end,
        periodStart: start,
        providerStatus: outcome === "paid" ? "paid" : "open",
        status: outcome === "paid" ? "paid" : "open",
        subscriptionId,
      });
      subscription.latestInvoiceId = invoiceId;
      subscription.currentPeriodEnd = end;
      subscription.status = outcome === "paid" ? "active" : "past_due";
      subscription.providerStatus = subscription.status;

      return invoiceId;
    },

    refund: (
      paymentId: string,
      amount: number,
      status: "pending" | "succeeded" = "succeeded",
    ) => {
      const payment = must(payments.get(paymentId));
      const refundId = `re_${payment.refunds.length + 1}_${paymentId}`;
      payment.refunds.push({ amount, id: refundId, status });
      payment.amountRefunded = payment.refunds
        .filter(refund => refund.status === "succeeded")
        .reduce((sum, refund) => sum + refund.amount, 0);

      return refundId;
    },
  };
};

export type FakeProvider = ReturnType<typeof createFakeProvider>;

export interface PaymentsHarness {
  access: (
    userId: number,
  ) => Promise<(typeof test_payments_access.$inferSelect)[]>;
  c: Context<EnvVitNode>;
  createUser: () => Promise<{
    email: string;
    id: number;
    language: string;
    name: string;
  }>;
  database: TestDatabaseHandle;
  drainQueue: (now?: Date) => Promise<number>;
  emitted: { name: string; payload: unknown }[];
  fake: FakeProvider;
  forkContext: () => Context<EnvVitNode>;
  handlerCalls: { kind: string; purchaseId: string }[];
  /**
   * Puts the harness services on a real request, as `globalMiddleware` would.
   * `user` decides who is signed in for each request.
   */
  middleware: (options?: {
    admin?: () => null | { id: number };
    queue?: () => unknown;
    user?: () => null | { id: number; language?: string; name?: string };
  }) => MiddlewareHandler;
  setHandlerFailure: (error: Error | null) => void;
}

export const createPaymentsHarness = async ({
  config,
  offers: extraOffers = [],
  payments = true,
}: {
  config?: Partial<PaymentsConfig>;
  offers?: PaymentOffer[];
  payments?: boolean;
} = {}): Promise<PaymentsHarness> => {
  const database = await createTestDatabase({
    core_cron,
    core_files,
    core_languages,
    core_queue,
    core_roles,
    core_users,
    ...paymentTables,
    test_payments_access,
  });
  await database.db
    .insert(core_languages)
    .values({ code: "en", name: "English", timezone: "UTC" });
  await database.db.insert(core_roles).values({ id: 1 });

  const fake = createFakeProvider();
  const emitted: PaymentsHarness["emitted"] = [];
  const handlerCalls: PaymentsHarness["handlerCalls"] = [];
  let handlerFailure: Error | null = null;

  const failIfAsked = () => {
    if (handlerFailure) throw handlerFailure;
  };

  const lifetime = definePaymentOffer({
    id: "lifetime",
    isEligible: async ({ tx, userId }) => {
      const [owned] = await tx
        .select({ id: test_payments_access.id })
        .from(test_payments_access)
        .where(
          and(
            eq(test_payments_access.userId, userId),
            eq(test_payments_access.offerId, "lifetime"),
          ),
        );

      return owned
        ? { eligible: false, reason: "You already own it." }
        : { eligible: true };
    },
    mode: "one_time",
    name: "Lifetime supporter",
    onPaid: async ({ purchase, tx }) => {
      handlerCalls.push({ kind: "paid", purchaseId: purchase.id });
      // The write happens before the failure, so a rollback is observable.
      await tx.insert(test_payments_access).values({
        offerId: purchase.offerId,
        purchaseId: purchase.id,
        userId: must(purchase.userId),
      });
      failIfAsked();
    },
    onRefunded: async ({ purchase, tx }) => {
      handlerCalls.push({ kind: "refunded", purchaseId: purchase.id });
      if (purchase.refundStatus !== "full") return;
      await tx
        .delete(test_payments_access)
        .where(eq(test_payments_access.purchaseId, purchase.id));
    },
    prices: { EUR: 450, PLN: 1900, USD: 500 },
    returnPath: "/example/payments",
  });

  const plan = definePaymentOffer({
    id: "plan",
    intervals: {
      month: { PLN: 1900, USD: 500 },
      year: { PLN: 19000, USD: 5000 },
    },
    mode: "subscription",
    name: "Supporter plan",
    onSubscriptionChanged: async ({ subscription, tx }) => {
      handlerCalls.push({
        kind: "subscription",
        purchaseId: subscription.purchaseId,
      });
      failIfAsked();
      const accessUntil =
        subscription.endedAt &&
        subscription.paidThrough &&
        subscription.endedAt < subscription.paidThrough
          ? subscription.endedAt
          : subscription.paidThrough;
      if (!accessUntil) return;
      await tx
        .insert(test_payments_access)
        .values({
          accessUntil,
          offerId: subscription.offerId,
          purchaseId: subscription.purchaseId,
          userId: must(subscription.userId),
        })
        .onConflictDoUpdate({
          set: { accessUntil, purchaseId: subscription.purchaseId },
          target: [test_payments_access.userId, test_payments_access.offerId],
        });
    },
    returnPath: "/example/payments",
  });

  const registry = createPaymentsRegistry({
    config: payments
      ? {
          currencies: { EUR: {}, PLN: { currencyDisplay: "code" }, USD: {} },
          defaultCurrency: "PLN",
          providers: [fake.provider],
          ...config,
        }
      : undefined,
    offers: [lifetime, plan, ...extraOffers].map(offer => ({
      offer,
      pluginId: PLUGIN_ID,
    })),
  });

  const queueTasks = [processPaymentEventTask, fulfillPaymentTask].map(
    task => ({
      ...task,
      module: "payments",
      pluginId: "@vitnode/core",
    }),
  );
  const translator = createTranslator({ locale: "en", messages: {} });

  const makeContext = (db: TestDatabaseHandle["db"]): Context<EnvVitNode> => {
    const vars = new Map<string, unknown>();
    const c = {
      get: (key: string) => vars.get(key),
      set: (key: string, value: unknown) => vars.set(key, value),
    } as unknown as Context<EnvVitNode>;

    vars.set("db", db);
    vars.set("cache", createTestCache());
    vars.set("user", null);
    vars.set("admin", null);
    vars.set("core", {
      hasCronAdapter: false,
      payments: registry,
      queue: queueTasks,
    });
    vars.set("i18n", {
      getTranslator: async () => await Promise.resolve(translator),
    });
    vars.set("log", {
      debug: async () => {},
      error: async () => {},
      info: async () => {},
      warn: async () => {},
    });
    vars.set("events", {
      emit: async (name: string, payload: unknown) => {
        emitted.push({ name, payload });

        return await Promise.resolve({
          delivered: 0,
          failures: [],
          status: "delivered",
        });
      },
    });
    vars.set("queue", new QueueModel(c));

    return c;
  };

  const c = makeContext(database.db);
  let userSeq = 0;

  const middleware: PaymentsHarness["middleware"] =
    ({ admin, queue, user } = {}) =>
    async (target, next) => {
      for (const key of [
        "db",
        "cache",
        "admin",
        "core",
        "i18n",
        "log",
        "events",
      ]) {
        target.set(key as never, c.get(key as never));
      }
      target.set("user" as never, (user?.() ?? null) as never);
      const adminUser = admin?.() ?? null;
      target.set(
        "admin" as never,
        (adminUser ? { user: adminUser } : null) as never,
      );
      target.set(
        "queue" as never,
        (queue?.() ?? new QueueModel(target)) as never,
      );
      await next();
    };

  return {
    middleware,
    access: async userId =>
      await database.db
        .select()
        .from(test_payments_access)
        .where(eq(test_payments_access.userId, userId)),
    c,
    createUser: async () => {
      userSeq += 1;
      const [row] = await database.db
        .insert(core_users)
        .values({
          avatarColor: "000000",
          email: `buyer${userSeq}@example.com`,
          ipAddress: "127.0.0.1",
          language: "en",
          name: `Buyer ${userSeq}`,
          nameCode: `buyer-${userSeq}`,
          roleId: 1,
        })
        .returning();

      return {
        email: row.email,
        id: row.id,
        language: row.language,
        name: row.name,
      };
    },
    database,
    drainQueue: async (now = new Date()) => {
      let runs = 0;
      for (let round = 0; round < 50; round++) {
        const due = await database.db
          .select({ id: core_queue.id })
          .from(core_queue)
          .where(
            and(
              eq(core_queue.status, "pending"),
              lte(core_queue.availableAt, now),
            ),
          );
        if (due.length === 0) break;
        runs += due.length;
        await processQueueTasksByIds(
          c,
          due.map(row => row.id),
        );
      }

      return runs;
    },
    emitted,
    fake,
    forkContext: () => makeContext(database.connect()),
    handlerCalls,
    setHandlerFailure: error => {
      handlerFailure = error;
    },
  };
};

export const TEST_PLUGIN_ID = PLUGIN_ID;
