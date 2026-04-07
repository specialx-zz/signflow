const prisma = require('../utils/prisma');
const crypto = require('crypto');

class WebhookService {
  // Dispatch event to all matching webhooks for a tenant
  static async dispatch(tenantId, event, data) {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: {
          tenantId,
          isActive: true,
        },
      });

      const matching = webhooks.filter(w => {
        const events = w.events.split(',').map(e => e.trim());
        return events.includes(event) || events.includes('*');
      });

      for (const webhook of matching) {
        // Fire and forget - don't await
        this.send(webhook, event, data).catch(err => {
          console.error(`Webhook ${webhook.id} failed:`, err.message);
        });
      }
    } catch (error) {
      console.error('Webhook dispatch error:', error.message);
    }
  }

  static async send(webhook, event, data) {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-SignFlow-Event': event,
      'X-SignFlow-Delivery': crypto.randomUUID(),
    };

    // Add HMAC signature if secret is set
    if (webhook.secret) {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(payload)
        .digest('hex');
      headers['X-SignFlow-Signature'] = `sha256=${signature}`;
    }

    let statusCode = null;
    let response = null;
    let success = false;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      statusCode = res.status;
      response = await res.text().catch(() => '');
      success = res.ok;
    } catch (error) {
      response = error.message;
    }

    // Log the attempt
    await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: payload.substring(0, 2000), // Limit stored payload
        statusCode,
        response: (response || '').substring(0, 1000),
        success,
      },
    }).catch(err => console.error('Webhook log error:', err.message));

    return { success, statusCode };
  }
}

module.exports = WebhookService;
