import { formatDayDate } from '../../src/lib/format';
import { apiAs, expect, seedWorkout, signIn, slots, test } from './fixtures';

// "Today" is the device's local date, never UTC. These run the browser in
// far-off time zones with the clock fixed just before and just after local
// midnight. Just after midnight at UTC+14 the UTC date is a day behind; just
// before midnight at UTC−11 it is a day ahead, so a UTC "today" fails both.

/** A calendar date near the real one (keeps sign-in tokens valid). */
const D = new Date().toISOString().slice(0, 10);

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const ZONES = [
  { zone: 'Pacific/Kiritimati', offset: '+14:00' },
  { zone: 'Pacific/Pago_Pago', offset: '-11:00' },
];
const TIMES = ['23:59:30', '00:00:30'];

for (const { zone, offset } of ZONES) {
  for (const time of TIMES) {
    test.describe(`${zone}, ${time} local`, () => {
      test.use({ timezoneId: zone });

      test.beforeEach(async ({ page }) => {
        // Local date D at this local time.
        await page.clock.setFixedTime(new Date(`${D}T${time}${offset}`));
      });

      test('the new-workout picker is for the local date, and no later', async ({ page, user }) => {
        const pb = await apiAs(user);
        await pb.collection('exercises').create({ user: user.id, name: 'Squat' });
        await signIn(page, user);
        await expect(page.locator('#choose-title')).toHaveText(formatDayDate(D, D));
        await expect(page.locator('input[type="date"]')).toHaveAttribute('max', D);
      });

      test("Log opens the local date's workout, not the day before or after", async ({ page, user }) => {
        const pb = await apiAs(user);
        const ex = async (name: string) => (await pb.collection('exercises').create({ user: user.id, name })).id;
        for (const [date, name] of [
          [addDays(D, -1), 'Yesterday Lift'],
          [D, 'Today Lift'],
          [addDays(D, 1), 'Tomorrow Lift'],
        ] as const) {
          await seedWorkout(pb, user, date, 'draft', [[await ex(name), slots()]]);
        }
        await signIn(page, user);
        await expect(page.getByRole('tab')).toHaveText(['Today Lift']);
        await expect(page.locator('#workout-title')).toHaveText(formatDayDate(D, D));

        // Change date stops at the local date too.
        await page.getByRole('button', { name: 'Workout options' }).click();
        await page.getByRole('button', { name: 'Change date' }).click();
        await expect(page.getByRole('dialog', { name: 'Change date' }).getByLabel('Date')).toHaveAttribute('max', D);
      });
    });
  }
}
