import OpenAI from "openai";
import Stripe from "stripe";

const ai = new OpenAI();
const stripe = new Stripe("fixture_key", { apiVersion: "2025-04-30" });

export async function createContracts() {
  await ai.responses.create({ model: "fixture-model", input: "hello" });
  await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: "https://example.test",
  });
  await fetch(
    "https://api.example-analytics.com/v1/events?token=never-serialize",
    {
      method: "POST",
    },
  );
}
