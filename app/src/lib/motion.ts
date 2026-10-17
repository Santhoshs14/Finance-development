// Shared spring presets so every Liquid Glass surface moves with the same physics.

/** Selection lens: quick with a small overshoot, like a droplet settling. */
export const LIQUID_SPRING = { stiffness: 480, damping: 30, mass: 0.85 } as const;

/** Chrome resizing (tab bar minimize, sidebar pill). */
export const SNAPPY_SPRING = { stiffness: 520, damping: 42, mass: 0.9 } as const;

/** Sheets and dialogs. */
export const SHEET_SPRING = { stiffness: 380, damping: 38, mass: 0.9 } as const;
