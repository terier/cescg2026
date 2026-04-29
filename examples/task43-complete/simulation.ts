export interface SimulationParameters {
  width: number;
  height: number;
  radius: number;
  gravity: number;
}

export interface ParticleState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

export interface State {
  particles: ParticleState[];
  bounceCount: number;
}

export function createStartState(
  count: number,
  width: number,
  height: number,
  radius: number,
): State {
  const state: State = {
    particles: [],
    bounceCount: 0,
  };

  for (let i = 0; i < count; i += 1) {
    const x = radius + Math.random() * (width - radius * 2);
    const y = radius + Math.random() * (height * 0.35);
    const vx = (Math.random() - 0.5);
    const vy = -Math.random();

    state.particles.push({
      position: { x, y },
      velocity: { x: vx, y: vy },
    });
  }

  return state;
}