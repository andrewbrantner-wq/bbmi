import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Build the grant payload based on session type
function buildGrantPayload(session: Stripe.Checkout.Session): Record<string, any> | null {
  const isTrial = session.mode === 'payment';
  const isSubscription = session.mode === 'subscription';

  if (isTrial) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return {
      premium: true,
      type: 'trial',
      expiresAt: expiresAt.toISOString(),
      stripeCustomerId: session.customer,
      updatedAt: new Date().toISOString(),
    };
  } else if (isSubscription) {
    return {
      premium: true,
      type: 'subscription',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerEmail = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();

      if (!customerEmail) {
        console.error('❌ No email found in checkout session');
        break;
      }

      const grantPayload = buildGrantPayload(session);
      if (!grantPayload) {
        console.error(`❌ Unknown session mode: ${session.mode}`);
        break;
      }

      try {
        // Look up user by email
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('email', '==', customerEmail).get();

        if (!querySnapshot.empty) {
          // Happy path: user doc exists, update directly
          const userDoc = querySnapshot.docs[0];
          await userDoc.ref.update(grantPayload);
          console.log(`✅ Premium granted to ${customerEmail} (${grantPayload.type})`);
        } else {
          // No Firestore doc yet — save to pending_grants so it applies on next login
          console.warn(`⚠️ No Firestore user found for ${customerEmail} — saving to pending_grants`);
          await db.collection('pending_grants').doc(customerEmail).set({
            ...grantPayload,
            email: customerEmail,
            createdAt: new Date().toISOString(),
          });
          console.log(`📋 Pending grant saved for ${customerEmail}`);
        }
      } catch (error) {
        console.error('❌ Error processing checkout.session.completed:', error);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      try {
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          await userDoc.ref.update({
            premium: false,
            updatedAt: new Date().toISOString(),
          });
          console.log(`❌ Subscription cancelled for customer ${customerId}`);
        } else {
          console.warn(`⚠️ No user found for Stripe customer ${customerId} on subscription deletion`);
        }
      } catch (error) {
        console.error('❌ Error revoking access:', error);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`⚠️ Payment failed for ${invoice.customer_email}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
