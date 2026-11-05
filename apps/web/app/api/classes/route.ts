import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api-handler';
import { getClassroomRepository } from '@/lib/classroom-repository';
import { assertAllowedOrigin, boundedString, enforceRateLimit, readJsonBody, RequestSecurityError } from '@/lib/request-security';
import { SECURITY_LIMITS } from '@/lib/security-config';

export const GET = createApiRoute(async ({ userId }) => {
  const classes = await (await getClassroomRepository()).list(userId);
  return NextResponse.json(classes, { headers: { 'Cache-Control': 'no-store' } });
}, { cache: 'noStore' });

export const POST = createApiRoute(async ({ req, userId }) => {
  assertAllowedOrigin(req);
  const rateLimit = await enforceRateLimit(req, 'class-create', userId, 10);
  if (rateLimit) return rateLimit;
  const body = await readJsonBody(req, SECURITY_LIMITS.jsonBodyBytes);
  const name = boundedString(body.name, 'name', 120, true)!;
  const description = boundedString(body.description, 'description', 2000) || null;
  const classroom = await (await getClassroomRepository()).create(name, description, userId);
  return NextResponse.json(classroom, { status: 201, headers: { 'Cache-Control': 'no-store' } });
});
