// File: src/app/api/stripe-webhook/route.ts

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/app/firebase-config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle different event types
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get customer email from session
      const customerEmail = session.customer_email || session.customer_details?.email;
      
      if (!customerEmail) {
        console.error('No email found in checkout session');
        break;
      }

      // Check if this is trial or monthly subscription
      const isTrial = session.mode === 'payment'; // One-time payment
      const isSubscription = session.mode === 'subscription'; // Recurring

      try {
        // Find user in Firestore by email
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', customerEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          console.error(`No user found with email: ${customerEmail}`);
          console.log('User needs to create an account first with this email');
          break;
        }

        // Update the user's premium status
        const userDoc = querySnapshot.docs[0];
        
        if (isTrial) {
          // 7-day trial
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          
          await updateDoc(userDoc.ref, {
            premium: true,
            type: 'trial',
            expiresAt: expiresAt.toISOString(),
            stripeCustomerId: session.customer,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`✅ 7-day trial granted to ${customerEmail}`);
        } else if (isSubscription) {
          // Monthly subscription
          await updateDoc(userDoc.ref, {
            premium: true,
            type: 'subscription',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`✅ Monthly subscription granted to ${customerEmail}`);
        }
      } catch (error) {
        console.error('Error updating Firestore:', error);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      // Subscription cancelled or expired
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      try {
        // Find user by Stripe customer ID
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('stripeCustomerId', '==', customerId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await updateDoc(userDoc.ref, {
            premium: false,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`❌ Subscription cancelled for customer ${customerId}`);
        }
      } catch (error) {
        console.error('Error revoking access:', error);
      }
      break;
    }

    case 'invoice.payment_failed': {
      // Payment failed - could send email or grace period
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`⚠️ Payment failed for ${invoice.customer_email}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}