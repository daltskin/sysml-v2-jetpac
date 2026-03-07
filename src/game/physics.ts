// ── Physics: gravity, collision, wraparound ──

export interface PhysicsBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
}

export const GRAVITY = 280; // pixels/s²
export const MAX_FALL_SPEED = 200;
export const WRAP_MARGIN = 8; // pixels before wrapping

export interface PlatformRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function applyGravity(body: PhysicsBody, dt: number) {
  body.vy += GRAVITY * dt;
  if (body.vy > MAX_FALL_SPEED) body.vy = MAX_FALL_SPEED;
}

export function applyVelocity(body: PhysicsBody, dt: number) {
  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

/** Horizontal wraparound — fly off one side, appear on the other */
export function applyWraparound(body: PhysicsBody, worldWidth: number) {
  if (body.x + body.width < -WRAP_MARGIN) {
    body.x = worldWidth + WRAP_MARGIN - body.width;
  } else if (body.x > worldWidth + WRAP_MARGIN) {
    body.x = -WRAP_MARGIN;
  }
}

/** Resolve collision with a platform (top surface only) */
export function collidePlatform(body: PhysicsBody, platform: PlatformRect): boolean {
  // Only collide when falling
  if (body.vy < 0) return false;

  const bodyBottom = body.y + body.height;
  const bodyPrevBottom = bodyBottom - body.vy * (1 / 60); // approximate previous position

  // Check horizontal overlap
  if (body.x + body.width <= platform.x || body.x >= platform.x + platform.width) {
    return false;
  }

  // Check if crossing the platform top
  if (bodyPrevBottom <= platform.y + 2 && bodyBottom >= platform.y) {
    body.y = platform.y - body.height;
    body.vy = 0;
    body.grounded = true;
    return true;
  }

  return false;
}

/** Floor collision */
export function collideFloor(body: PhysicsBody, floorY: number): boolean {
  if (body.y + body.height >= floorY) {
    body.y = floorY - body.height;
    body.vy = 0;
    body.grounded = true;
    return true;
  }
  return false;
}

/** Ceiling collision */
export function collideCeiling(body: PhysicsBody, ceilingY: number): boolean {
  if (body.y <= ceilingY) {
    body.y = ceilingY;
    body.vy = Math.max(body.vy, 0);
    return true;
  }
  return false;
}

/** AABB overlap test */
export function overlaps(a: PhysicsBody, b: PhysicsBody): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Point inside body */
export function containsPoint(body: PhysicsBody, px: number, py: number): boolean {
  return px >= body.x && px <= body.x + body.width && py >= body.y && py <= body.y + body.height;
}
