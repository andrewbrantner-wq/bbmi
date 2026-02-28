import { db } from './firebase-config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

export default async function logPageView(user: User, page: string) {
  try {
    await addDoc(collection(db, 'pageViews'), {
      userId: user.uid,
      email: user.email,
      page,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to log page view:', err);
  }
}