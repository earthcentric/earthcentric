# Location and shipping configuration

The location picker uses Leaflet with OpenStreetMap tiles. Address lookup and road
routes are requested by the server; provider endpoint URLs are configuration, not
credentials:

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_OSM_TILE_URL` | Browser-visible OSM-compatible tile template | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `NOMINATIM_BASE_URL` | Server-side Nominatim-compatible geocoder base URL | `https://nominatim.openstreetmap.org` |
| `NOMINATIM_CONTACT_URL` | Contact URL included in the geocoder User-Agent | `https://earthcentric.in` |
| `OSRM_BASE_URL` | Server-side OSRM route endpoint, including `/route/v1/driving` | `https://router.project-osrm.org/route/v1/driving` |

Set these in the local environment when using alternate compatible providers.
The map is loaded only after the user opts in; address text or coordinates are
sent to the configured geocoder only when the user requests lookup or saves a
selected pin that needs verification. Avoid sending customer location data to a
provider without appropriate notice and consent.

The public OSM tile, Nominatim, and OSRM endpoints are for development and
low-volume evaluation only. Respect each provider's usage policy; public
Nominatim is not an autocomplete service. Use a provider you operate or a
production service with appropriate capacity, privacy terms, and service
guarantees before launch. The application has process-local caching and
Nominatim request spacing, not a distributed cache or global rate limiter.

Shipping rules, serviceable PIN zones, weights, optional dimensions, and active
seller warehouse locations are required for quotes. Routing uses road distance;
if routing is unavailable, checkout is allowed only when an applicable PIN-zone
fallback fee is explicitly configured. The Prisma migration under
`prisma/migrations/` is not applied automatically. Review and apply it only to
an explicitly selected non-production database after taking normal backup and
migration precautions. Never use a production connection for local validation.
