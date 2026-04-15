/**
 * Source-level regression guard for signflow/player/src/components/PlaylistPlayer.tsx
 *
 * Bug background:
 *   On a single-item playlist, ContentRenderer's `onEnded` fires advanceToNext.
 *   Earlier code path called setStableKey((prev) => prev + 1) inside that branch,
 *   which mutated the React `key` (`stable-{contentId}-{stableKey}`) and forced
 *   a full unmount/remount of the renderer. Visible result: a hard 10s flicker.
 *
 *   Fix: short-circuit advanceToNext when sortedItems.length <= 1 BEFORE any
 *   state mutation that would affect the key.
 *
 *   See V5.5 review notes / scenarios.md S13.
 *
 * Why a source-level guard?
 *   The player package has no unit-test runner configured. Until vitest+RTL is
 *   wired in, this lightweight static check belongs to the backend Jest suite
 *   purely as a CI-runnable safeguard. It pins three properties:
 *     1. The early-return guard for sortedItems.length <= 1 still exists.
 *     2. `setStableKey` is NEVER invoked anywhere in advanceToNext — re-adding
 *        a key bump there reintroduces the regression.
 *     3. The ContentRenderer key still references `stableKey` (so future
 *        refactors that drop the key suffix entirely also surface here).
 *
 *   Replace with a real component test once the player has its own runner.
 */

const fs = require('fs');
const path = require('path');

const PLAYER_FILE = path.resolve(
  __dirname,
  '../../../player/src/components/PlaylistPlayer.tsx'
);

describe('PlaylistPlayer single-item flicker regression guard', () => {
  let source;

  beforeAll(() => {
    expect(fs.existsSync(PLAYER_FILE)).toBe(true);
    source = fs.readFileSync(PLAYER_FILE, 'utf8');
  });

  it('still defines an advanceToNext callback', () => {
    expect(source).toMatch(/const\s+advanceToNext\s*=\s*useCallback/);
  });

  it('contains an early-return guard for single-item playlists in advanceToNext', () => {
    // Extract the advanceToNext body up to its closing })
    const match = source.match(
      /const\s+advanceToNext\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},\s*\[/
    );
    expect(match).not.toBeNull();
    const body = match[1];

    // The guard MUST be present — it prevents a key bump that would remount
    // ContentRenderer for a single-item playlist (10s flicker bug).
    expect(body).toMatch(/sortedItems\.length\s*<=\s*1/);
    // And it must early-return (no fall-through).
    expect(body).toMatch(/sortedItems\.length\s*<=\s*1[\s\S]{0,200}return/);
  });

  it('never calls setStableKey inside advanceToNext (key bump = remount = flicker)', () => {
    const match = source.match(
      /const\s+advanceToNext\s*=\s*useCallback\(\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\},\s*\[/
    );
    expect(match).not.toBeNull();
    const body = match[1];

    // Critical: setStableKey must NOT appear in advanceToNext. Re-introducing
    // any setStableKey(...) call here is exactly the regression we are guarding.
    expect(body).not.toMatch(/setStableKey\s*\(/);
  });

  it('keeps the stableKey suffix in ContentRenderer key (so the guard remains meaningful)', () => {
    // If someone removes ${stableKey} from the key entirely, our setStableKey
    // assertion above becomes vacuous. Pin the key shape.
    expect(source).toMatch(/key=\{`stable-\$\{stableItem\.content\.id\}-\$\{stableKey\}`\}/);
  });
});
