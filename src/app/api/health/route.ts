import { db } from '@/db';
import { users } from '@/db/schema';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Simple DB query to verify connectivity
    await db.select().from(users).limit(1);

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    return NextResponse.json({ status: 'error', message: 'Database unreachable' }, { status: 503 });
  }
}
