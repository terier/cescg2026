import * as simulation from "./simulation";

export async function loadShader(path: string): Promise<string> {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) {
    throw new Error(`Failed to load shader: ${path}`);
  }
  return response.text();
}

export function createUniformBuffer(
  device: GPUDevice,
  size: number,
): GPUBuffer {
  return device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function updateUniformBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  data: ArrayBuffer,
): void {
  device.queue.writeBuffer(buffer, 0, data);
}

export function updateParticleBuffer(
  device: GPUDevice,
  buffer: GPUBuffer,
  state: simulation.State,
): { buffer: GPUBuffer; recreated: boolean } {
  let recreated = false;
  if (state.particles.length * 16 > buffer.size) {
    // Create new buffer
    buffer.destroy();
    buffer = device.createBuffer({
      size: state.particles.length * 16,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.VERTEX |
        GPUBufferUsage.COPY_DST,
    });
    recreated = true;
  }
  const packed = new Float32Array(state.particles.length * 4);
  for (let i = 0; i < state.particles.length; i += 1) {
    const ball = state.particles[i];
    const offset = i * 4;

    packed[offset + 0] = ball.position.x;
    packed[offset + 1] = ball.position.y;
    packed[offset + 2] = ball.velocity.x;
    packed[offset + 3] = ball.velocity.y;
  }
  device.queue.writeBuffer(buffer, 0, packed);
  return { buffer, recreated };
}

export async function createRenderer(
  device: GPUDevice,
  format: GPUTextureFormat,
  worldWidth: number,
  worldHeight: number,
  radius: number,
  shader: string,
): Promise<{ pipeline: GPURenderPipeline; renderParamBuffer: GPUBuffer }> {
  const code = await fetch(shader).then((response) => response.text());
  const shaderModule = device.createShaderModule({ code: code });

  const renderParamBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const renderParams = new Float32Array([worldWidth, worldHeight, radius, 0]);

  device.queue.writeBuffer(renderParamBuffer, 0, renderParams);

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vertex",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  return { pipeline, renderParamBuffer };
}

export function createRenderBindGroup(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  particleBuffer: GPUBuffer,
  renderParamBuffer: GPUBuffer,
): GPUBindGroup {
  return device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: renderParamBuffer } },
    ],
  });
}

export function updateRenderParams(
  device: GPUDevice,
  buffer: GPUBuffer,
  worldWidth: number,
  worldHeight: number,
  radius: number,
): void {
  const renderParams = new Float32Array([worldWidth, worldHeight, radius, 0]);
  device.queue.writeBuffer(buffer, 0, renderParams);
}

export function render(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  bindGroup: GPUBindGroup,
  view: GPUTextureView,
  count: number,
) {
  const encoder = device.createCommandEncoder();

  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6, count, 0, 0);
  pass.end();

  device.queue.submit([encoder.finish()]);
}
