/** Ports and credentials shared by playwright.config.ts and the E2E tests. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 8098);
export const PB_URL = `http://127.0.0.1:${E2E_PORT}`;
export const SUPERUSER = {
  email: process.env.E2E_SUPERUSER_EMAIL ?? 'e2e@example.test',
  password: process.env.E2E_SUPERUSER_PASSWORD ?? 'e2e-superuser-password',
};
