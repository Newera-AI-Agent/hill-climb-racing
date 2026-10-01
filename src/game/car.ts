'use client';

import Matter from 'matter-js';
import type { Upgrades } from './storage';

export interface Car {
  chassis: Matter.Body;
  wheelF: Matter.Body;
  wheelR: Matter.Body;
  driver: Matter.Body;
  constraintF: Matter.Constraint;
  constraintR: Matter.Constraint;
  driverConstraint: Matter.Constraint;
  composite: Matter.Composite;
}

export interface CarConfig {
  gravityScale: number;
  upgrades: Upgrades;
}

export function buildCar(x: number, groundY: number, cfg: CarConfig): Car {
  const { gravityScale, upgrades } = cfg;

  const chassisW = 90;
  const chassisH = 22;
  const chassisY = groundY - 46;

  const chassis = Matter.Bodies.rectangle(x, chassisY, chassisW, chassisH, {
    density: 0.0018,
    friction: 0.3,
    chamfer: { radius: 8 },
    collisionFilter: { group: 0x1, category: 0x2, mask: 0x1 },
  });
  Matter.Body.setInertia(chassis, chassis.inertia * 1.6);

  const wheelR_ = 22;
  const wheelOpts: Matter.IBodyDefinition = {
    density: 0.0012,
    friction: 0.8 + upgrades.tires * 0.12,
    frictionAir: 0.015,
    restitution: 0.15,
    collisionFilter: { group: 0x1, category: 0x2, mask: 0x1 },
  };
  const wheelF = Matter.Bodies.circle(x + 34, groundY - wheelR_, wheelR_, wheelOpts);
  const wheelR = Matter.Bodies.circle(x - 34, groundY - wheelR_, wheelR_, wheelOpts);

  const driver = Matter.Bodies.circle(x - 4, chassisY - 26, 11, {
    density: 0.0009,
    friction: 0.2,
    collisionFilter: { group: 0x1, category: 0x4, mask: 0x1 },
  });

  const stiff = 0.24 + upgrades.suspension * 0.05;
  const damp = 0.06 + upgrades.suspension * 0.02;
  const constraintF = Matter.Constraint.create({
    bodyA: chassis, pointA: { x: 34, y: 6 },
    bodyB: wheelF, pointB: { x: 0, y: 0 },
    stiffness: stiff, damping: damp, length: 12,
  });
  const constraintR = Matter.Constraint.create({
    bodyA: chassis, pointA: { x: -34, y: 6 },
    bodyB: wheelR, pointB: { x: 0, y: 0 },
    stiffness: stiff, damping: damp, length: 12,
  });
  const driverConstraint = Matter.Constraint.create({
    bodyA: chassis, pointA: { x: -4, y: -10 },
    bodyB: driver, pointB: { x: 0, y: 0 },
    stiffness: 0.9, damping: 0.1, length: 16,
  });

  const composite = Matter.Composite.create({ label: 'car-g' });
  Matter.Composite.add(composite, [chassis, wheelF, wheelR, driver, constraintF, constraintR, driverConstraint]);
  Matter.Composite.allBodies(composite).forEach((b) => {
    b.gravityScale = gravityScale;
    b.frictionAir = (b.frictionAir ?? 0.01) + 0.002;
  });

  return { chassis, wheelF, wheelR, driver, constraintF, constraintR, driverConstraint, composite };
}
