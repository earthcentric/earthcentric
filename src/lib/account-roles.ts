const DEFAULT_SUPER_ADMIN_EMAILS = ["rkearthcentric@gmail.com"];
const DEFAULT_WORKER_EMAILS = ["bluegamer355@gmail.com"];

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const configuredEmails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((configuredEmail) => configuredEmail.trim().toLowerCase())
    .filter(Boolean);

  return [...DEFAULT_SUPER_ADMIN_EMAILS, ...configuredEmails].includes(normalizedEmail);
}

export function isConfiguredSellerEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const configuredEmails = (process.env.SELLER_EMAILS || "")
    .split(",")
    .map((configuredEmail) => configuredEmail.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(normalizedEmail);
}

export function isWorkerEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const configuredEmails = (process.env.WORKER_EMAILS || "")
    .split(",")
    .map((configuredEmail) => configuredEmail.trim().toLowerCase())
    .filter(Boolean);

  return [...DEFAULT_WORKER_EMAILS, ...configuredEmails].includes(normalizedEmail);
}
