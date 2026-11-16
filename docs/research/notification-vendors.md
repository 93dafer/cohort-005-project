# Third-party in-app notification services for Cadence

Research for issue #2 (child of map #1). Comparison only, not a recommendation to build. In-app channel only. Facts checked against vendor docs and pricing pages on 2026-11-16; items marked **UNVERIFIED** could not be confirmed from a primary source.

## Cadence context

- React Router v7 (framework mode, server loaders/actions), React 19, SQLite via Drizzle (`package.json`).
- Session is a cookie holding a numeric `userId` (`app/lib/session.ts`). A root loader can read it server-side, so a server-signed vendor token can be handed to the client.
- Four recipient roles: Student, Instructor, Team Admin, Platform Admin (`GLOSSARY.md`).
- Scale is tiny, so free tiers matter most. Three vendors (Knock, Novu, Courier) include 10,000 messages or runs a month free; SuprSend also offers 10,000 notifications free; MagicBell's free tier is 1,000 deliveries.

## Summary table

| | Knock | Novu | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| React inbox component | Yes: `NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed` in `@knocklabs/react` | Yes: `<Inbox />` in `@novu/react` (bell + popover by default) | Yes: `<CourierInbox />` in `@trycourier/courier-react` v9 | Yes: `Inbox`, `FloatingInbox` in `@magicbell/react` | Yes: drop-in components in `@suprsend/react` |
| Headless | Yes: React hooks, plus `@knocklabs/client` | Yes: `NovuProvider`, `useNotifications`, `useCounts`, `useNovu` | Theme and custom views over low-level APIs; docs do not use the term "headless" | Not documented on the page checked | Yes: documented headless option (hook API not read) |
| Free tier | 10,000 messages/mo; unlimited feed retention; Knock branding | 10,000 workflow runs/mo; 5 workflows; 3 team members; 24h activity feed retention | 10,000 sends/mo (Developer plan) | 1,000 deliveries/mo; unlimited users; 1 project | 10,000 notifications/mo; 30-day logs; SuprSend branding on feed |
| First paid tier | Starter $250/mo (50k msgs, then $0.005); removes branding | Pro from $30/mo (30k+ runs, then $1.20 per 1k) | Business, $0.005/send, every send billed (no free allowance inside it) | Startup $249/mo (50k, then $0.0025) | Essentials $100/mo (50k, then $0.002); no branding |
| Hosted / self-host | Hosted only (as far as docs show) | Hosted, or self-host (open core, MIT + commercial `enterprise` folder) | Hosted | Hosted | Hosted; self-host and BYOC only on Enterprise |
| Client auth | Public key + signed user JWT (RS256, `sub` = user id) in enhanced-security mode | `subscriberId` + `applicationIdentifier`; HMAC `subscriberHash` for production | Server issues JWT via `POST /auth/issue-token` with scopes | User JWT generated on your backend | Signed JWT user token |
| Cadence user mapping | Your user id string is the recipient id; identify inline on trigger | Your user id is the `subscriberId`; subscriber data inline in `to` | Your user id is `user_id`; no pre-registration needed | Your identifier (external_id or email) per user | `distinct_id` (**UNVERIFIED** from docs read) |

## Vendor notes

### Knock
- Components: `@knocklabs/react` ships `NotificationIconButton` (bell with unseen/unread count), `NotificationFeedPopover`, `NotificationFeed`, plus hooks for a custom UI. This matches the map's starting look (bell + dropdown). Source: https://docs.knock.app/in-app-ui/react/overview
- Free: 10,000 messages/mo, feed retention unlimited (configurable), log retention 30 days, stored profiles unlimited. A message is one delivery to one user on one channel; bounced or failed are not counted; if preferences block everything nothing is charged. Starter is $250/mo (50k messages, then $0.005 each) and is needed to remove Knock branding. Source: https://knock.app/pricing
- Server trigger: workflow trigger API takes `recipients` as user-id strings or inline objects (`id`, collection, optional data), which identifies users before the workflow runs. `Idempotency-Key` header is honoured for 24h. Up to 1000 recipients per trigger. The Node SDK method names were **not** visible on the docs page read; confirm in the `@knocklabs/node` reference. Source: https://docs.knock.app/send-notifications/triggering-workflows/api
- Auth: the public key alone can act as any user, so it is dev-only. Production needs enhanced security: backend signs an RS256 JWT with `sub` = user id, passes it to the client as `userToken`. Grants can restrict scope; tokens should be refreshed (`onUserTokenExpiring`). Source: https://docs.knock.app/in-app-ui/security-and-authentication
- Privacy: SOC 2 Type 2, GDPR certified, encrypted at rest. EU data residency is not yet available (expected by end of 2026 per their page). Server logs kept up to one year. Source: https://docs.knock.app/developer-tools/security
- Fit with RR7: the loader reads `userId`, signs the token server-side and returns it; client renders the bell in the header. Triggers go in actions after the DB write.

### Novu
- Components: `<Inbox />` from `@novu/react` (React 18+; docs say no SSR support, so render it client-only). Props: `applicationIdentifier`, `subscriberId` (or `subscriber` object), `subscriberHash`, `routerPush` (example uses react-router `navigate`), `appearance`, EU `backendUrl`/`socketUrl`. Headless: `NovuProvider`, `useNotifications`, `useCounts`, `useNovu` (read, archive, event listeners). Sources: https://docs.novu.co/platform/inbox/react/get-started , https://docs.novu.co/platform/inbox/headless/get-started
- Free: 10,000 workflow runs/mo, 5 workflows, 2 environments, 3 team members, unlimited subscribers, 24h activity feed retention. Pro from $30/mo (30k+ runs, 20 workflows, 7 days feed), Team from $250/mo. The pricing page does not clearly confirm Inbox is on Free (**UNVERIFIED**), though the docs offer a keyless demo mode (temporary data, 24h). Source: https://novu.co/pricing
- Server: `@novu/api`, `novu.trigger({ workflowId, to: { subscriberId, ... }, payload })`; subscriber details can go inline in `to`. Idempotency (`transactionId`) was not confirmed on the page read. Source: https://docs.novu.co/platform/sdks/server/typescript
- Self-host: open core, MIT with a commercial `enterprise` folder (https://github.com/novuhq/novu). The community docs list the Inbox component as available self-hosted, but that matrix and the Docker guide are about 3 years old, so verify before relying on them. Needs MongoDB, Redis, object storage and four services (API, Worker, WebSocket, Dashboard). Source: https://docs.novu.co/community/self-hosting-novu/overview , search result for https://docs.novu.co/community/self-hosted-and-novu-cloud
- Privacy: control of data if self-hosted. Cloud has an EU endpoint (`eu.api.novu.co`). Compliance certifications were not verified.

### Courier
- Components: `@trycourier/courier-react` v9 (React 18+), `<CourierInbox />`, themable via `CourierInboxTheme`, custom views or low-level APIs. Older `@trycourier/react-inbox` is deprecated. Source: https://www.courier.com/docs/platform/inbox/inbox-overview
- Free: Developer plan, 10,000 sends/mo, no per-seat fees. Business is $0.005 per send with every send billed (50,000 sends = $250). The pricing page does not say which plans include Inbox or the retention period (**UNVERIFIED**). Source: https://www.courier.com/pricing
- Server: `POST /send` with `message.to.user_id`, `template` or inline `content`, routing channel `inbox`; `Idempotency-Key` header (default 25h). Node: `client.send.message({ message: { to: { user_id }, ... } })` from `@trycourier/courier`. Source: https://www.courier.com/docs/reference/send/message
- Auth: server calls `POST /auth/issue-token` (Node `client.auth.issueToken({ scope, expires_in })`) with scope `user_id:<id> inbox:read:messages inbox:write:events`; client calls `signIn({ userId, jwt })`. The `user_id` is your own id and need not exist beforehand; a mismatch gives an empty inbox. EU endpoint exists (`api.eu.courier.com`). Source: https://www.courier.com/docs/platform/inbox/authentication
- Privacy: compliance and retention pages could not be fetched (**UNVERIFIED**).

### MagicBell
- Components: `@magicbell/react` with `Inbox`, `FloatingInbox`, `ContextProvider` (`token` prop = user JWT), `ToastContainer`, `UserPreferences`. No headless hooks documented on the pages read. Source: https://www.magicbell.com/docs/libraries/magicbell-react
- Free: Builder tier, unlimited users, 1,000 deliveries/mo, 1 project. Startup $249/mo (50k deliveries, then $0.0025). Retention is not stated. Source: https://www.magicbell.com/pricing
- Server: `POST /broadcasts` with a Project JWT, up to 1000 recipients, addressed by `external_id` or `email`; title required. No idempotency documented. Source: https://www.magicbell.com/docs/api/reference
- Auth: Project JWT (dashboard) vs per-user User JWT generated on your backend. Source: https://www.magicbell.com/docs/api/authentication
- Privacy: says it is GDPR compliant and offers DPAs; no SOC 2, data region or retention information on the page. Source: https://www.magicbell.com/security

### SuprSend (also considered)
- Free 10,000 notifications/mo, 30-day logs, SuprSend branding on the feed; Essentials $100/mo (no branding, 90-day logs); Business $250/mo (preferences, batching); Enterprise adds self-host, HIPAA/BAA, multi-region. In-app does not need a third-party provider. Source: https://www.suprsend.com/pricing
- `@suprsend/react` offers drop-in and headless options; auth moved from HMAC to signed JWT user tokens; `@suprsend/react-inbox` is end of support. Source: https://docs.suprsend.com/docs/inbox-react
- Hook API, token details and distinct_id mapping were not read (**UNVERIFIED**).

### Not verified
- Engagespot and NotificationAPI: official pricing pages returned 404 or could not be located; only third-party listings with conflicting prices were found. Treat as candidates needing a first-party check, not as compared.
- A DIY in-app inbox (a `notifications` table in the existing SQLite/Drizzle DB) is the obvious no-vendor baseline but was out of scope for this survey.

## Observations for the map

- All five give a bell-plus-popover React component and a free tier far above Cadence's likely volume, so free-tier size does not separate them. Branding removal does: Knock ($250), Courier (unclear), SuprSend ($100), Novu (Pro $30), MagicBell (not stated).
- All map users by your own id string and need a server-signed token for production, so the RR7 pattern is the same everywhere: root loader signs a token from the session `userId`, actions call the vendor SDK after the DB write.
- Billing units differ: Knock and SuprSend bill per delivery per channel, Novu per workflow run, Courier per send, MagicBell per delivery. For one in-app channel these are roughly equivalent except that a single trigger fanning out to many recipients (e.g. a new lesson question to an Instructor's team) multiplies deliveries.
- Only Novu offers a self-hosted community edition (SuprSend self-host is Enterprise-only, Novu's is the one with a free path); relevant if data-privacy rules out sending student identifiers to a third party.
- Privacy: only Knock's SOC 2 Type 2/GDPR claim and EU-residency gap were verified from its own docs; others need a trust-page check before a decision.
