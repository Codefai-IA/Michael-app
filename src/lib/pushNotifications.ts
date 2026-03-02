import { supabase } from './supabase';

// Replace with your generated VAPID public key
const VAPID_PUBLIC_KEY = 'BBP_3T-Twc_cEyDeSa8NnLQs11z03E_tMwZ5NttViqnh1w3zuUnl5y8KY7BLvcEejHHOBSwgoEOj7FryA43-_nc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Request notification permission and subscribe to push.
 * Fire-and-forget — errors are silently logged.
 */
export async function subscribeToPush(clientId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const subscriptionJson = subscription.toJSON();

    await supabase.from('push_subscriptions').upsert(
      {
        client_id: clientId,
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!,
      },
      { onConflict: 'client_id,endpoint' }
    );
  } catch (err) {
    console.error('Error subscribing to push:', err);
  }
}
