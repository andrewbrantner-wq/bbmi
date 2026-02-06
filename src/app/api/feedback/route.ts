import { NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Rate limiting map (in-memory, resets on deploy)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 submissions per hour per IP

export async function POST(request: Request) {
  try {
    const { feedback, category } = await request.json();

    // Validate feedback
    if (!feedback || typeof feedback !== 'string') {
      return NextResponse.json(
        { error: 'Feedback is required' },
        { status: 400 }
      );
    }

    if (feedback.length > 5000) {
      return NextResponse.json(
        { error: 'Feedback too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Get IP for rate limiting (hash it for privacy)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);

    // Rate limiting check
    const now = Date.now();
    const userRequests = rateLimitMap.get(ipHash) || [];
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      );
    }

    // Update rate limit
    recentRequests.push(now);
    rateLimitMap.set(ipHash, recentRequests);

    // Create feedback entry
    const feedbackEntry = {
      id: crypto.randomUUID(),
      feedback: feedback.trim(),
      category: category || 'general',
      timestamp: new Date().toISOString(),
      ipHash, // Store hash only, not actual IP
    };

    // In production/Vercel, you'd want to use a database
    // For development, we'll use a JSON file
    const dataDir = path.join(process.cwd(), 'data', 'feedback');
    const filePath = path.join(dataDir, 'submissions.json');

    try {
      // Ensure directory exists
      await mkdir(dataDir, { recursive: true });

      // Read existing feedback
      let submissions = [];
      try {
        const fileContent = await readFile(filePath, 'utf-8');
        submissions = JSON.parse(fileContent);
      } catch (err) {
        // File doesn't exist yet, start with empty array
        submissions = [];
      }

      // Add new submission
      submissions.push(feedbackEntry);

      // Write back to file
      await writeFile(filePath, JSON.stringify(submissions, null, 2));

      return NextResponse.json({ success: true, id: feedbackEntry.id });
    } catch (fileError) {
      console.error('File system error:', fileError);
      // On Vercel, file system writes won't persist
      // This is where you'd use a database instead
      return NextResponse.json(
        { 
          success: true, 
          id: feedbackEntry.id,
          note: 'Feedback recorded (use database for persistence in production)'
        }
      );
    }

  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

// GET endpoint for admin (will need authentication)
export async function GET(request: Request) {
  // TODO: Add authentication check here
  const { searchParams } = new URL(request.url);
  const password = searchParams.get('password');

  // Simple password check (you should use proper auth in production)
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-in-production';
  
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const dataDir = path.join(process.cwd(), 'data', 'feedback');
    const filePath = path.join(dataDir, 'submissions.json');

    const fileContent = await readFile(filePath, 'utf-8');
    const submissions = JSON.parse(fileContent);

    return NextResponse.json({ submissions });
  } catch (error) {
    return NextResponse.json({ submissions: [] });
  }
}
