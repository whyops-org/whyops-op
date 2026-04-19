export interface WhyOpsContext {
  readonly traceId?: string;
  readonly externalUserId?: string;
}

export function resolveTraceId(context?: WhyOpsContext): string {
  if (typeof context?.traceId === 'string' && context.traceId.length > 0) {
    return context.traceId;
  }
  return crypto.randomUUID();
}

export function withWhyOpsContext<T extends object>(
  options: T,
  context?: WhyOpsContext,
): T & { externalUserId?: string } {
  if (!context?.externalUserId) {
    return options as T & { externalUserId?: string };
  }

  return {
    ...options,
    externalUserId: context.externalUserId,
  };
}
