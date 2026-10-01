'use client';
import Matter from 'matter-js';
import type { StageId } from './storage';
import { STAGES } from './storage';

export interface TerrainPoint {
  x: number;
  y: number;
}

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Terrain {
  stage: StageId;
  rng: () => number;
  points: TerrainPoint[] = [];
  ground!: Matter.Body;
  pointSpacing = 60;
  baseY = 900;
  roughness = 0;
  coins: Matter.Body[] = [];
  fuelCans: Matter.Body[] = [];
  lastCoinX = 0;
  lastFuelX = 0;
  seed: number;

  constructor(stage: StageId) {
    this.stage = stage;
    this.seed = hashSeed(stage);
    this.rng = mulberry32(this.seed);
    this.generateInitial();
  }

  generateInitial() {
    // Start flat for spawn
    for (let i = 0; i < 30; i++) {
      this.points.push({ x: i * this.pointSpacing, y: this.baseY });
    }
    this.rebuildBody();
  }

  ensureLength(xTarget: number) {
    while (this.lastX() < xTarget) this.addSegment();
  }

  lastX(): number {
    return this.points.length ? this.points[this.points.length - 1].x : 0;
  }

  addSegment() {
    const i = this.points.length;
    const x = i * this.pointSpacing;
    const difficulty = Math.min(1, x / 80000); // 0..1 over distance
    const amplitude = 40 + difficulty * 160 + (this.stage === 'moon' ? 20 : 0);
    const wave =
      Math.sin(i * 0.075 + this.rng() * 0.35) * amplitude * 0.8 +
      Math.sin(i * 0.021 + 1.7) * amplitude * 0.6;
    const y = this.baseY - 200 * difficulty + wave;
    this.points.push({ x, y });
    if (i % 12 === 0 && i > 20) this.maybePlaceCoin();
    if (i % 25 === 0 && i > 30) this.maybePlaceFuel();
  }

  maybePlaceCoin() {
    const idx = this.points.length - 1;
    const p = this.points[idx];
    if (this.rng() < 0.5) return;
    this.coins.push({ x: p.x, y: p.y - 40, taken: false } as any);
  }

  maybePlaceFuel() {
    const idx = this.points.length - 1;
    const p = this.points[idx];
    if (this.rng() < 0.3) return;
    this.fuelCans.push({ x: p.x, y: p.y - 40, taken: false } as any);
  }

  rebuildBody() {
    const verts: { x: number; y: number }[] = [
      { x: this.points[0].x - 200, y: this.points[0].y + 800 },
      ...this.points.map((p) => ({ x: p.x, y: p.y })),
      { x: this.lastX() + 200, y: this.baseY + 800 },
    ];
    const body = Matter.Bodies.fromVertices(
      this.lastX() / 2,
      this.baseY + 100,
      [verts],
      { isStatic: true, friction: 0.9 }
    );
    this.ground = body;
  }

  heightAt(x: number): number {
    const i = Math.floor(x / this.pointSpacing);
    const f = (x % this.pointSpacing) / this.pointSpacing;
    const a = this.points[i] || this.points[this.points.length - 1];
    const b = this.points[i + 1] || a;
    const t = f;
    const y = a.y * (1 - t) + b.y * t;
    return y;
  }

  slopeAt(x: number): number {
    const i = Math.floor(x / this.pointSpacing);
    const a = this.points[i];
    const b = this.points[i + 1];
    if (!a || !b) return 0;
    return (b.y - a.y) / this.pointSpacing;
  }

  nearPickups(x: number, radius: number) {
    const out = { coins: 0, fuel: 0 };
    for (const c of this.coins) {
      if ((c as any).taken) continue;
      if (Math.abs(c.position.x - x) < radius) {
        (c as any).taken = true;
        out.coins++;
      }
    }
    for (const f of this.fuelCans) {
      if ((f as any).taken) continue;
      if (Math.abs(f.position.x - x) < radius) {
        (f as any).taken = true;
        out.fuel++;
      }
    }
    return out;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, scale = 1) {
    const w = ctx.canvas.width / scale;
    const h = ctx.canvas.height / scale;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    // ground fill
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y + 800);
    for (const p of this.points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(this.lastX(), this.lastX() + 800);
    ctx.closePath();
    ctx.fillStyle = this.stage === 'moon' ? '#080818' : '#2211';
    ctx.fill();

    // ground line
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (const p of this.points) ctx.lineTo(p.x, p.y + 1);
    ctx.strokeStyle = this.stage === 'moon' ? '#ffffff' : '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // grass/fill shading
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = this.stage === 'moon' ? '#444' : '#030';
    for (let i = 0; i < this.points.length - 1; i++) {
      const p = this.points[i];
      const q = this.points[i + 1];
      const grad = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
      grad.addColorStop(0, this.stage === 'moon' ? '#2a2a3a' : '#114422');
      grad.addColorStop(1, this.stage === 'moon' ? '#1a1a2a' : '#030011');
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.lineTo(q.x, q.y + 300);
      ctx.lineTo(p.x, p.y + 300);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // pickups
    for (const c of this.coins) {
      if ((c as any).taken) continue;
      if (Math.abs(c.position.x - (camX + w / 2)) > w / 2 + 100) continue;
      ctx.beginPath();
      ctx.arc(c.position.x, c.position.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc00';
      ctx.fill();
    }
    for (const f of this.fuelCans) {
      if ((f as any).taken) continue;
      if (Math.abs(f.position.x - (camX + w / 2)) > w / 2 + 100) continue;
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(f.position.x - 10, f.position.y - 15, 20, 30);
    }

    ctx.restore();
  }
}

export function buildTerrain(stage: StageId) {
  return new Terrain(stage);
}
