export async function callExternalContracts() {
  await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
  });

  const auditWebhook =
    "https://hooks.partner-events.com/incoming?token=never-serialize";
  return auditWebhook;
}
