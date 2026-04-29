import * as simulation from "./simulation";

export function cpuStep(
  state: simulation.State,
  parameters: simulation.SimulationParameters,

  dt: number,
) {
  const { width, height, radius, gravity } = parameters;

  for (const particle of state.particles) {
    particle.velocity.y += gravity * dt;
    particle.position.x += particle.velocity.x * dt;
    particle.position.y += particle.velocity.y * dt;

    if (particle.position.y + radius > height) {
      particle.position.y = height - radius;
      particle.velocity.y = -particle.velocity.y;
      state.bounceCount += 1;
    }

    if (particle.position.y - radius < 0) {
      particle.position.y = radius;
      particle.velocity.y = -particle.velocity.y;
      state.bounceCount += 1;
    }

    if (particle.position.x - radius < 0) {
      particle.position.x = radius;
      particle.velocity.x = -particle.velocity.x;
      state.bounceCount += 1;
    }

    if (particle.position.x + radius > width) {
      particle.position.x = width - radius;
      particle.velocity.x = -particle.velocity.x;
      state.bounceCount += 1;
    }
  }
}
