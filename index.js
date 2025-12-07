require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// health check
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'fieldkrow-terminal-api' });
});

// POST /terminal/connection-token
app.post('/terminal/connection-token', async (req, res) => {
  try {
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ secret: token.secret });
  } catch (err) {
    console.error('Error creating connection token:', err);
    res.status(500).json({ error: err.message || 'Failed to create connection token' });
  }
});
// POST /terminal/create-payment-intent
app.post('/terminal/create-payment-intent', async (req, res) => {
  try {
    const { amount, job_id, client_id, description } = req.body || {};

    if (!amount) {
      return res.status(400).json({ error: 'Missing amount' });
    }

    const amountCents = Math.round(Number(amount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',

      // ✅ REQUIRED for Stripe Terminal
      payment_method_types: ['card_present'],

      // ✅ matches your flow
      capture_method: 'manual',

      description: description || `Job ${job_id || ''}`,
      metadata: {
        job_id: job_id || '',
        client_id: client_id || ''
      }
    });

    res.json({
      payment_intent_id: paymentIntent.id,
      payment_intent_client_secret: paymentIntent.client_secret
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment intent' });
  }
});      

// POST /terminal/capture-payment
app.post('/terminal/capture-payment', async (req, res) => {
  try {
    const { payment_intent_id } = req.body || {};
    if (!payment_intent_id) {
      return res.status(400).json({ error: 'Missing payment_intent_id' });
    }

    const pi = await stripe.paymentIntents.capture(payment_intent_id);

    res.json({
      id: pi.id,
      status: pi.status,
      charges: pi.charges
    });
  } catch (err) {
    console.error('Error capturing payment intent:', err);
    res.status(500).json({ error: err.message || 'Failed to capture payment intent' });
  }
});

// start server (Render sets PORT env var)
const port = process.env.PORT || 4242;
app.listen(port, () => {
  console.log(`Stripe Terminal backend running on port ${port}`);
});
