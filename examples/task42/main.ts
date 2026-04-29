import * as helpers from "./helpers";
import * as simulation from "./simulation";
import * as cpu from "./cpu";

const PARAMETERS: simulation.SimulationParameters = {
  // Physical height of the simulation world,
  // we will scale the width based on the canvas aspect ratio
  height: 50,
  width: 50,
  radius: 1,
  gravity: 9.81,
};

type Mode = "cpu" | "gpu";
let mode: Mode = "gpu";
let particleCount = 100;
const dT = 1 / 60;

let averageFrameMs = 0;
let frameCount = 0;
let previousFrameTime = performance.now();
const fpsDisplay = document.querySelector<HTMLSpanElement>("#fps")!;

// WebGPU Initialization
if (!navigator.gpu) {
  throw new Error("WebGPU is not supported in this browser.");
}

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("Could not get a WebGPU adapter.");
}

const device = await adapter.requestDevice();

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const context = canvas.getContext("webgpu")!;
if (!context) {
  throw new Error("Could not get a WebGPU canvas context.");
}

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format,
  alphaMode: "opaque",
});
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
PARAMETERS.width =
  PARAMETERS.height * (canvas.clientWidth / canvas.clientHeight);
//

// Simulation Setup
let state!: simulation.State;
let stateBuffer = device.createBuffer({
  size: particleCount * 16, // 4 floats per particle, 4 bytes per float
  usage:
    GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
//

// Renderer setup
const renderer = await helpers.createRenderer(
  device,
  format,
  PARAMETERS.width,
  PARAMETERS.height,
  PARAMETERS.radius,
  "./shaders/render.wgsl",
);
let renderBindGroup!: GPUBindGroup;
//

// GPU Simulator setup
const computeShaderCode = await helpers.loadShader("./shaders/physics.wgsl");
const shaderModule = device.createShaderModule({ code: computeShaderCode });

const computeParameterBuffer = device.createBuffer({
  size: 32,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: shaderModule,
    entryPoint: "main",
  },
});
//

let gpuBindGroup!: GPUBindGroup;

function restartSimulation(): void {
  // Create a new simulation state, refresh GPU data, and rebuild bind groups.
  // Separate function so we can easily reset the simulation when parameters change.

  state = simulation.createStartState(
    particleCount,
    PARAMETERS.width,
    PARAMETERS.height,
    PARAMETERS.radius,
  );

  // Particle buffer update
  const particleUpdate = helpers.updateParticleBuffer(
    device,
    stateBuffer,
    state,
  );
  stateBuffer = particleUpdate.buffer;

  // Render parameters update
  helpers.updateRenderParams(
    device,
    renderer.renderParamBuffer,
    PARAMETERS.width,
    PARAMETERS.height,
    PARAMETERS.radius,
  );

  // Recreate render bind group with updated buffers
  renderBindGroup = helpers.createRenderBindGroup(
    device,
    renderer.pipeline,
    stateBuffer,
    renderer.renderParamBuffer,
  );

  // Update compute shader parameters
  const computeParameters = new Float32Array([
    PARAMETERS.width,
    PARAMETERS.height,
    PARAMETERS.radius,
    PARAMETERS.gravity,
    dT,
    particleCount,
    0,
    0,
  ]);

  device.queue.writeBuffer(computeParameterBuffer, 0, computeParameters);

  gpuBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: stateBuffer } },
      { binding: 1, resource: { buffer: computeParameterBuffer } },
    ],
  });

  // Reset performance tracking
  averageFrameMs = 0;
  frameCount = 0;
  previousFrameTime = performance.now();
  fpsDisplay.textContent = "0.00";
}

restartSimulation();

async function frame(t: number): Promise<void> {
  const frameMs = t - previousFrameTime;
  previousFrameTime = t;

  if (mode === "cpu") {
    cpu.cpuStep(state, PARAMETERS, dT);
    helpers.updateParticleBuffer(device, stateBuffer, state);
  } else {
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(computePipeline);
    pass.setBindGroup(0, gpuBindGroup);

    const workgroups = Math.ceil(particleCount / 4);
    pass.dispatchWorkgroups(workgroups);

    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  averageFrameMs = (frameMs + frameCount * averageFrameMs) / (frameCount + 1);
  frameCount += 1;
  fpsDisplay.textContent = (1000 / averageFrameMs).toFixed(2);

  helpers.render(
    device,
    renderer.pipeline,
    renderBindGroup,
    context.getCurrentTexture().createView(),
    particleCount,
  );

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// GUI Setup
const modeSelect = document.querySelector<HTMLSelectElement>("#mode")!;
modeSelect.value = mode;

const particlesInput = document.querySelector<HTMLInputElement>("#particles")!;
particlesInput.value = particleCount.toString();

const physicalHeightInput =
  document.querySelector<HTMLInputElement>("#height")!;
physicalHeightInput.value = PARAMETERS.height.toString();

const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;

resetButton.addEventListener("click", () => {
  restartSimulation();
});

modeSelect.addEventListener("change", () => {
  mode = modeSelect.value as Mode;
  restartSimulation();
});

particlesInput.addEventListener("change", () => {
  const value = parseInt(particlesInput.value, 10);
  if (!isNaN(value) && value > 0) {
    particleCount = value;
    restartSimulation();
  }
});
physicalHeightInput.addEventListener("change", () => {
  const value = parseInt(physicalHeightInput.value, 10);
  if (!isNaN(value) && value > 0) {
    PARAMETERS.height = value;
    PARAMETERS.width = value * (canvas.clientWidth / canvas.clientHeight);
    restartSimulation();
  }
});
//
