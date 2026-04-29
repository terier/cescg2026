struct Particle {
    position: vec2f,
    velocity: vec2f,
};

struct SimParams {
    world: vec4f,  // width, height, radius, gravity
    simulation: vec4f, // dt, particleCount, unused, unused
};

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;

@compute @workgroup_size(4u)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let index = id.x;
    let count = u32(params.simulation.y);

    if index >= count {
        return;
    }

    let width = params.world.x;
    let height = params.world.y;
    let radius = params.world.z;
    let gravity = params.world.w;
    let dt = params.simulation.x;

    var particle = particles[index];
    particle.velocity.y = particle.velocity.y + gravity * dt;
    particle.position = particle.position + particle.velocity * dt;

    if particle.position.y + radius > height {
        particle.position.y = height - radius;
        particle.velocity.y = -particle.velocity.y;
    }

    if particle.position.y - radius < 0.0 {
        particle.position.y = radius;
        particle.velocity.y = -particle.velocity.y;
    }

    if particle.position.x - radius < 0.0 {
        particle.position.x = radius;
        particle.velocity.x = -particle.velocity.x;
    }

    if particle.position.x + radius > width {
        particle.position.x = width - radius;
        particle.velocity.x = -particle.velocity.x;
    }

    particles[index] = particle;
}
