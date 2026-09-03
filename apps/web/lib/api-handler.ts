import { NextRequest, NextResponse } from 'next/server';
import { getAnonymousUserId } from '@/lib/anonymous';
import { cachedJson, CacheProfile } from './api-response';

export interface HandlerContext<TParams = Record<string, never>> {
  req: NextRequest;
  userId: string;
  params: TParams;
}

export interface RouteOptions {
  cache?: CacheProfile;
  skipAuth?: boolean;
}

type ApiRouteContext<TParams> = {
  params: Promise<TParams>;
};

type ApiRouteHandler<TParams> = {
  (req: NextRequest): Promise<Response>;
  (req: NextRequest, context: ApiRouteContext<TParams>): Promise<Response>;
};

export function createApiRoute<
  TParams extends Record<string, any> = Record<string, never>,
  TResult = any
>(
  handler: (ctx: HandlerContext<TParams>) => Promise<TResult>,
  options?: RouteOptions
): ApiRouteHandler<TParams> {
  return async (req: NextRequest, context?: ApiRouteContext<TParams>): Promise<Response> => {
    try {
      const params = context?.params ? await context.params : ({} as TParams);
      const userId = options?.skipAuth ? '' : await getAnonymousUserId(req);

      const result = await handler({ req, userId, params });

      if (result instanceof Response) {
        return result;
      }

      if (options?.cache) {
        return cachedJson(result, options.cache);
      }

      return NextResponse.json(result);
    } catch (err: any) {
      const isNotFound = typeof err?.message === 'string' && err.message.toLowerCase().includes('not found');
      const status = typeof err?.status === 'number' ? err.status : isNotFound ? 404 : 500;
      return NextResponse.json({ error: err?.message || 'Internal server error' }, { status });
    }
  };
}
