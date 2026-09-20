# Sub-processors

| Provider | Purpose | Data | Notes |
|---|---|---|---|
| Supabase | Database, auth, file storage | All application data | Choose the region for the target market |
| Vercel | Hosting, edge network, analytics (consent only) | Requests, IPs | Analytics loads only after consent |
| Stripe | Card payments | Payment data, email | Cards handled by Stripe; SAQ-A |
| Resend | Email delivery | Email address, message body | Optional; `log` provider by default |
| Twilio | SMS delivery | Phone number, message body | Optional; `log` provider by default |
| Web Push services (browser vendors) | Push notifications | Push endpoint | User opt-in |
| AI provider (chat assistant) | Answer questions | Chat text | Do not send personal data; scrub before sending |
| n8n | Automation workflows | As configured | Self-hosted or vendor; confirm |

A signed data-processing agreement is required with each before launch. Update this list whenever a provider is added.
