import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Rate limiting map (in-memory, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 submissions per hour

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ipHash);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ipHash, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// POST - Submit feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, message } = body;

    // Validate input
    if (!category || !message) {
      return NextResponse.json(
        { error: 'Category and message are required' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Get IP and hash it
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const ipHash = hashIP(ip);

    // Check rate limit
    if (!checkRateLimit(ipHash)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    // Insert into database
    await sql`
      INSERT INTO feedback (category, message, ip_hash)
      VALUES (${category}, ${message}, ${ipHash})
    `;

    return NextResponse.json(
      { success: true, message: 'Feedback submitted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

// GET - Retrieve feedback (admin only)
export async function GET(request: NextRequest) {
  try {
    // Check admin password
    const password = request.headers.get('x-admin-password');
    
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Get all feedback, ordered by most recent
    const { rows } = await sql`
      SELECT id, category, message, created_at
      FROM feedback
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    return NextResponse.json(
      { feedback: rows },
      { status: 200 }
    );

  } catch (error) {
    console.error('Feedback retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feedback' },
      { status: 500 }
    );
  }
}
