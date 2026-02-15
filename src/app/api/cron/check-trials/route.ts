import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export async function GET(req: Request) {
  // Verify this is coming from Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    
    // Find all users with expired trials
    const usersRef = db.collection('users');
    const expiredTrials = await usersRef
      .where('type', '==', 'trial')
      .where('premium', '==', true)
      .get();

    let expiredCount = 0;

    for (const doc of expiredTrials.docs) {
      const userData = doc.data();
      
      // Check if trial has expired
      if (userData.expiresAt && userData.expiresAt < now) {
        await doc.ref.update({
          premium: false,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`❌ Trial expired for ${userData.email}`);
        expiredCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      expiredTrials: expiredCount,
      checkedAt: now 
    });
  } catch (error) {
    console.error('Error checking trials:', error);
    return NextResponse.json({ error: 'Failed to check trials' }, { status: 500 });
  }
}