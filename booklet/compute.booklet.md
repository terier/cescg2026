# Compute Shaders

Until now, we have used the GPU mainly for rendering. Compute shaders let us use the same hardware for general-purpose work, similar to [CUDA](https://docs.nvidia.com/cuda/cuda-programming-guide/index.html) or [Numba-CUDA](https://nvidia.github.io/numba-cuda/index.html#) in Python.

Instead of drawing pixels, compute shaders queue many small shader invocations, i.e., threads, that run in parallel. Unlike CPU threads, GPU invocations are very lightweight and can be created in the millions (depending on your GPU capabilities, of course). Each invocation runs the same shader code, but similarly to vertices, it has a unique index, which allows it to process different data. This makes compute shaders ideal for data-parallel tasks, where the same operation is applied to many independent data elements.

In this task, we use that idea to move the particle simulation from the CPU to the GPU.

## Other learning resources

- [WebGPU specification - Compute pipeline](https://www.w3.org/TR/webgpu/#gpucomputepipeline) and [passes](https://www.w3.org/TR/webgpu/#compute-passes).
- [WGSL specification - Compute shaders](https://www.w3.org/TR/WGSL/#compute-shader-workgroups).
- [MDN Web Docs - Basic compute pipeline](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API#basic_compute_pipeline).
- [WebGPU Fundamentals - Compute shaders](https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html).

## Task 1 - Compute shader basics

The task starts with a complete CPU version. That version is useful for two reasons. First, it gives us a clear reference for the physics we want. Second, it lets us compare the CPU and GPU paths side by side while we build the compute version.

### What is already written

The starter code already sets up most of the application:

- `simulation.ts` defines the world parameters and creates the initial particle state.
- `cpu.ts` updates every particle on the CPU.
- `helpers.ts` contains the code for loading shaders, writing buffers, creating the renderer, and drawing the particles.
- `main.ts` creates the canvas, device, renderer, FPS counter, and the GUI for switching between the CPU and GPU modes.

The particle data is stored as four floats per particle: position `x` and `y`, then velocity `x` and `y`. The `ParticleState` interface in `simulation.ts` describes the data layout, and the `Particle` struct in the vertex shader matches that layout:

```TS
export interface ParticleState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}
```

```wgsl
struct Particle {
    position: vec2f,
    velocity: vec2f,
};

@group(0) @binding(0) var<storage, read> particles: array<Particle>;
```

### The CPU baseline

Before we write the compute shader, let's take a look at the existing CPU implementation. The `cpuStep` function in `cpu.ts` is very small: for each particle, it adds gravity to the vertical velocity, advances the position by `dt`, and then flips the velocity when a particle touches one of the four walls.

This is the exact behavior we want on the GPU as well. The only difference is that on the GPU every particle will be processed in parallel by a separate invocation of the compute shader.

### Writing the compute shader

Create a new file named `physics.wgsl`. Start by describing the data layout of the particle buffer and the simulation parameters:

```wgsl
struct Particle {
    position: vec2f,
    velocity: vec2f,
};

struct SimParams {
    world: vec4f,
    simulation: vec4f,
};
```

The `world` vector stores the width, height, radius, and gravity. The `simulation` vector stores the time step and the particle count. We pack both in a single `vec4f` to keep the uniform buffer simple, but you could also use separate buffers for gradual updates or a more complex data structure if you prefer.

Now add the two bindings that the shader will use:

```wgsl
@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> params: SimParams;
```

The particle buffer is a storage buffer because the compute shader needs to both read and write it. Additionally, we must specify the `read_write` access mode to allow both operations. The simulation parameters are stored in a uniform buffer because they are shared by every invocation.

The compute entry point is decorated with `@compute`. We also tell WebGPU that each workgroup will contain 4 invocations (we will discuss workgroups in more detail later, but for now think of them as batches of threads):

```wgsl
@compute @workgroup_size(4u)
fn main(@builtin(global_invocation_id) id: vec3u) {
```

The built-in `global_invocation_id` gives each invocation a unique index, similar to the vertex ID in a vertex shader. In this task, we only need the `x` component, since we are indexing a one-dimensional array. Similarly to fragment shaders, compute shader workgroups can be 1D, 2D, or 3D, and the invocation ID will have the corresponding number of components.

Since each workgroup contains 4 invocations, the compute shader will always be dispatched with a multiple of 4 threads. If the particle count is not a multiple of 4, then some threads will have an index that is out of bounds. To prevent out-of-bounds access, we have to discard those out-of-bounds threads at the beginning of the shader. Other than that, the code is almost the same as the CPU version:

```wgsl
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
```

Finally, we store the updated particle back into the buffer:

```wgsl
    particles[index] = particle;
```

At this point the shader is complete. It reads one particle, updates it, and writes it back.

### Creating the compute pipeline

The next step is to load the shader and create a compute pipeline in `main.ts`. If starting from the CPU version, you can add this code after the render pipeline is created, but before the definition of the `restartSimulation` function. The compute pipeline is created in a similar way to the render pipeline:

```ts
const computeShaderCode = await helpers.loadShader("./shaders/physics.wgsl");
const shaderModule = device.createShaderModule({ code: computeShaderCode });

const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: shaderModule,
    entryPoint: "main",
  },
});
```

Just like with render pipelines, we can let WebGPU infer the layout automatically.

We also need a uniform buffer for the simulation parameters. The buffer must be large enough to hold two `vec4f` values, so 32 bytes is enough:

```ts
const computeParameterBuffer = device.createBuffer({
  size: 32,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

To avoid duplicating code, we will update the parameter buffer and create the bind group in the `restartSimulation()` function, which is called whenever the simulation parameters change or when the user restarts the simulation. While not the most optimal way to approach things, this allows us to concentrate all the GPU state updates in one place, and it is good enough for this simple application. In a more complex application, you would want to update the parameter buffer only when necessary.

To prevent TypeScript from complaining, we first declare `gpuBindGroup` right after the compute pipeline, but we will initialize it later in the `restartSimulation()` function. With the `!` operator, we promise TypeScript that we will definitely assign a value to this variable before using it, even though it cannot verify that statically.

```ts
let gpuBindGroup!: GPUBindGroup;
```

Then in the `restartSimulation()` function, we create a `Float32Array` with the parameter values and write it to the GPU:

```ts
const computeParameters = new Float32Array([
  PARAMETERS.width,
  PARAMETERS.height,
  PARAMETERS.radius,
  PARAMETERS.gravity,
  0,
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
```

The particle buffer is bound at binding `0`, and the parameter buffer is bound at binding `1`. As with render pipelines, the layout must match the shader exactly.

### Dispatching the compute work

The final missing piece is the actual GPU step inside the animation loop. The render path stays unchanged, but when the user switches to GPU mode, we create a compute pass before rendering. To _dispatch_ the compute shader, we must specify how many workgroups to run. In the shader, we specified that each workgroup contains 4 invocations, so we need to divide the particle count by 4 to get the number of workgroups. Since the particle count may not be a multiple of 4, we round up to make sure we have enough threads to process all particles:

```ts
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(computePipeline);
pass.setBindGroup(0, gpuBindGroup);

const workgroups = Math.ceil(particleCount / 4);
pass.dispatchWorkgroups(workgroups);

pass.end();
device.queue.submit([encoder.finish()]);
```

After the compute pass finishes, the render pass can immediately draw from the same particle buffer. That is another benefit of using the GPU for simulation: the data is already on the GPU, so we can render it without additional copying or synchronization.

## Task 2 - Workgroups and limits

One thing we kind of glossed over in the first task was the workgroup size, in other words, how many threads we put in each batch. Conceptually workgroups are both an abstraction of how GPU executes threads, but they also provide us a way to share data between threads and synchronize them. In this task, we will focus on the first part: how workgroups are executed, and how to choose the "right" size for them, since our particle renderer doesn't have a particular need for thread synchronization or shared memory. If you wish to see a good example of using shared memory check the WebGPU Fundamentals lesson on [Image Histograms using a Compute Shader](https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders-histogram.html).

### Compute limits

All the way back in Task 1 we briefly looked at the WebGPU device limits, but we didn't really use them for anything. To see the consequences of our ignorance, let's try setting the number of particles to about 300,000 (assuming we left the default workgroup size of 4). The result should be this error:

```
Dispatch workgroup count X (75000) exceeds max compute workgroups per dimension (65535).
 - While encoding [ComputePassEncoder (unlabeled)].DispatchWorkgroups(75000, 1, 1).
 - While finishing [CommandEncoder (unlabeled)].
```

This error is telling us that we are trying to dispatch more workgroups than the GPU supports. As of the current [WebGPU specification](https://www.w3.org/TR/webgpu/#limits), the limit for `maxComputeWorkgroupsPerDimension` is 65535, which means that if we want to process more than 65535 \* 4 = 262140 particles, we need to increase the workgroup size. But let us first look at all the relevant limits set upon our device:

```TS
const limits = device.limits;
console.log(
  "Max storage buffer binding size:",
  limits.maxStorageBufferBindingSize,
);

console.log("Max workgroup size X:", limits.maxComputeWorkgroupSizeX);
console.log("Max workgroup size Y:", limits.maxComputeWorkgroupSizeY);
console.log("Max workgroup size Z:", limits.maxComputeWorkgroupSizeZ);
console.log(
  "Max total workgroup size:",
  limits.maxComputeInvocationsPerWorkgroup,
);

console.log(
  "Max workgroups per dimension:",
  limits.maxComputeWorkgroupsPerDimension,
);
```

The `maxStorageBufferBindingSize` limit tells us how large our storage buffer holding particle data can be. The `maxComputeWorkgroupSizeX/Y/Z` limits tell us how many threads we can have in each dimension of a workgroup, and the `maxComputeInvocationsPerWorkgroup` limit tells us the total number of threads (the product of the three dimensions) we can have in a single workgroup. Finally, the familiar `maxComputeWorkgroupsPerDimension` limit tells us how many workgroups we can dispatch in each dimension.

Now, for the sake of example, let's compute the maximum number of particles we can simulate:

```TS
const maxParticlesInStorageBuffer = limits.maxStorageBufferBindingSize / 16; // 16 bytes per particle (4 floats)
console.log(
  "Maximum particles in storage buffer:",
  maxParticlesInStorageBuffer,
);

const maxParticlesPerDispatch =
  limits.maxComputeWorkgroupSizeX * limits.maxComputeWorkgroupsPerDimension;
console.log("Maximum particles per dispatch:", maxParticlesPerDispatch);

for (let workgroupSize of [1, 2, 4, 8, 16, 32, 64]) {
  console.log(
    `Maximum particles with workgroup size ${workgroupSize}: ${limits.maxComputeWorkgroupsPerDimension * workgroupSize}`,
  );
}
```

### Workgroup size

From the above code, we can see that the maximum number of particles we can simulate is based on our chosen workgroup size. But how do we choose the workgroup size? The answer is: _it depends_.

The optimal workgroup size can depend on the specific GPU architecture and the problem we are solving. A common recommendation is to use a workgroup size that is a multiple of 32 or 64, as many GPUs execute threads in groups of 32 (called warps in NVIDIA terminology) or 64 (called wavefronts in AMD terminology). However, the best way to find the optimal workgroup size for your specific application and target hardware is to experiment with different sizes and profile their performance. Additionally, sometimes we just can't avoid using a larger workgroup size if we want to process a large amount of data with synchronization, so it is good to be familiar with the limits and how to work with them. Otherwise if our problem remains too big we can always split it into multiple dispatches.

So let us go about increasing the workgroup size in our shader. Open `physics.wgsl` and change the `@workgroup_size` to 64:

```wgsl
@workgroup_size(64u)
fn main() {
  // Shader code
}
```

We also have to change the dispatch call in `main.ts` to match the new workgroup size:

```TS
const workgroups = Math.ceil(particleCount / 64);
pass.dispatchWorkgroups(workgroups);
```

With this change, we can now simulate up to 4,194,240 particles (assuming the storage buffer limit is not lower).

But this sort of notation is not very flexible, since if we want to change the workgroup size again, we have to remember to change it in two places, and if we forget there will be no error to alert us. Luckily, WGSL allows us to define overridable constants that passed from the API call in our `main.ts`. We can define an overridable constant for the workgroup size at the top of `physics.wgsl`:

```wgsl
override WORKGROUP_SIZE = 4u;

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) id: vec3u) {
    // Shader code
}
```

Then we can define the same constant in `main.ts` and use it in the dispatch call:

```TS
// Somewhere at the top of main.ts
const WORKGROUP_SIZE = 64;

// In the declaration of compute pipeline
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: shaderModule,
    entryPoint: "main",
    constants: {
      WORKGROUP_SIZE: WORKGROUP_SIZE,
    },
  },
});

// In the dispatch call
const workgroups = Math.ceil(particleCount / WORKGROUP_SIZE);
pass.dispatchWorkgroups(workgroups);
```

### Maximizing our limits

As mentioned in Task 1, the limits we observed before aren't the maximum capabilities of our GPU (well they might be on lower end GPUs), but default limits as prescribed by the WebGPU specification. To maximize our GPU capabilities, we can request higher limits when requesting the device. To maximize the number of particles we can simulate, we want to increase the `maxStorageBufferBindingSize`, `maxComputeWorkgroupSizeX`, `maxComputeInvocationsPerWorkgroup`, and `maxComputeWorkgroupsPerDimension`. We can do that by passing a `requiredLimits` object to the `requestDevice()` call:

```TS
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
  throw new Error("Could not get a WebGPU adapter.");
}

const requiredLimits = {
  maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
  maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
  maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
  maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
};

const device = await adapter.requestDevice({
  requiredLimits: requiredLimits,
});
```

Alternatively we could also request the maximum limits directly without referencing the adapter's default limits, to ensure we get a specific limit our application needs.

```TS
const requiredLimits = {
  maxStorageBufferBindingSize: 1 << 30, // 1 GB
  maxComputeWorkgroupSizeX: 512,
  maxComputeInvocationsPerWorkgroup: 512,
  maxComputeWorkgroupsPerDimension: 65535,
};
```

As soon as we move away from the default limits, we should be aware however that not all devices may support the limits we request, and the `requestDevice()` call may fail. In a production environment, you would want to handle that case gracefully, for example by falling back to a lower workgroup size or showing an error message to the user.

## Task 3 - Atomic operations and buffer readback

As a final task, we will briefly touch on two important topics: atomic operations and buffer readback.

While admittedly a bit silly in the context of our simple simulation, lets say we wish to count how many times particles bounce off any of the boundaries. On the CPU this is trivial, we just increment the counter (for the sake of simplicity we will just add the counter to the state):

```TS
// simulation.ts
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
  // Rest of the function
}

// cpu.ts
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
```

Let's also quickly add a simple display for the bounce count on the html page and update it in the `main.ts`:

```html
<div><span id="bounces">0</span> bounces</div>
```

```TS
// Somewhere at the top of main.ts
const bounceDisplay = document.querySelector<HTMLSpanElement>("#bounces")!;

// At the end of the restartSimulation function
bounceDisplay.textContent = "0";

// In the frame loop
if (mode === "cpu") {
  cpu.cpuStep(state, PARAMETERS, dT);
  bounceDisplay.textContent = state.bounceCount.toString();
  helpers.updateParticleBuffer(device, stateBuffer, state);
}
```

On the GPU, we have to do a bit more of legwork. First we need some place to store the bounce count on the GPU. We can create a new storage buffer for that and add it to the bind group:

```TS
// After we create the compute parameter buffer
const bounceCounterBuffer = device.createBuffer({
  size: 4, // 4 bytes for a single uint32
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});

// In the restartSimulation function
device.queue.writeBuffer(bounceCounterBuffer, 0, new Uint32Array([0]));

gpuBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: stateBuffer } },
    { binding: 1, resource: { buffer: computeParameterBuffer } },
    { binding: 2, resource: { buffer: bounceCounterBuffer } },
  ],
});
```

Finally we have to update the shader to do the increments as well. If you are familiar with parallel programming, you might have already spotted a big problem here, but we will get on to that a bit later. For now, let's just naively increment the counter whenever a bounce happens:

```wgsl
@group(0) @binding(2) var<storage, read_write> bounceCounter: u32;

// In the main function
if particle.position.y + radius > height {
    particle.position.y = height - radius;
    particle.velocity.y = -particle.velocity.y;
    bounceCounter += 1u;
}

if particle.position.y - radius < 0.0 {
    particle.position.y = radius;
    particle.velocity.y = -particle.velocity.y;
    bounceCounter += 1u;
}

if particle.position.x - radius < 0.0 {
    particle.position.x = radius;
    particle.velocity.x = -particle.velocity.x;
    bounceCounter += 1u;
}

if particle.position.x + radius > width {
    particle.position.x = width - radius;
    particle.velocity.x = -particle.velocity.x;
    bounceCounter += 1u;
}
```

Now our issue is that our data is being incremented on the GPU, but we need it back on the CPU if we wish to display it. To read data back from the GPU, we will use the process of data mapping. To enable the mapping on a buffer have to create it with the `MAP_READ` usage flag:

```TS
const bounceCounterBuffer = device.createBuffer({
  size: 4, // 4 bytes for a single uint32
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});
```

However, once we do that and try to run our the GPU version, the WebGPU will accuse us of committing heresy by trying to read from a storage buffer that is also mapped for reading:

```
Buffer usages (BufferUsage::(MapRead|CopyDst|Storage)) is invalid. If a buffer usage contains BufferUsage::MapRead the only other allowed usage is BufferUsage::CopyDst.
 - While calling [Device].CreateBuffer([BufferDescriptor]).
```

To avoid this error, we have to create a separate buffer to copy the data to first, usually referred to as readback buffer, and read the data from it instead. The readback buffer is created with the `COPY_DST` and `MAP_READ` usage flags, but not `STORAGE`, since we won't be writing to it from the shader. Also we have to appent the `COPY_SRC` flag to the bounce counter buffer, since we will be copying data from it to the readback buffer:

```TS
const bounceCounterBuffer = device.createBuffer({
  size: 4,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
});

const bounceCounterReadbackBuffer = device.createBuffer({
  size: 4,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});
```

To copy the data from the storage buffer to the readback buffer, we can simply use a `copyBufferToBuffer` command in our existing command encoder after the compute pass finishes (although we could also create a separate command encoder for the copy if we wanted to):

```TS
pass.end();
encoder.copyBufferToBuffer(bounceCounterBuffer, 0, bounceCounterReadbackBuffer, 0, 4);
device.queue.submit([encoder.finish()]);
```

Finally, we can read the data from the readback buffer by mapping it and creating a typed array view on it. This process is asynchronous, since the GPU might still be writing to the buffer when we try to read it, so we have to wait for the mapping to complete before we can access the data. After we are done reading, we have to unmap the buffer to free up the resources.

```TS
// After submitting the command buffer in the frame loop
await bounceCounterReadbackBuffer.mapAsync(GPUMapMode.READ);
const bounceCountArray = new Uint32Array(bounceCounterReadbackBuffer.getMappedRange());
const bounceCount = bounceCountArray[0];
bounceDisplay.textContent = bounceCount.toString();
bounceCounterReadbackBuffer.unmap();
```

Now lets get back to the problem of incrementing the bounce counter. If you run the GPU version with the bounce counter, you will see that the count is much lower than it should be. This is because multiple threads are trying to increment the same counter at the same time, which leads to a race condition. To solve such problems on classic CPU multithreading, we would use various traffic related implements, but in WebGPU compute shaders we have a rather simpler solution. We can use atomic operations to ensure that the increments to the bounce counter are done safely, one at a time. In WGSL, we can declare the bounce counter as an atomic variable `atomic<u32>` and use the `atomicAdd` function to increment it:

```wgsl
@group(0) @binding(2) var<storage, read_write> bounceCounter: atomic<u32>;

// Replace all bounceCounter increments with atomicAdd
if particle.position.y + radius > height {
    particle.position.y = height - radius;
    particle.velocity.y = -particle.velocity.y;
    atomicAdd(&bounceCounter, 1u);
}
```

If you have followed all the steps correctly (and the writer of the document didn't make any mistakes), you should now see the correct bounce count in both CPU and GPU modes.

### Exercises

1. Try to implement dynamic particle coloring based on their velocity using a separate compute shader. You can create a separate storage buffer for colors and update it in the new compute shader. Then, in the vertex shader, you read the color from the buffer and pass it to the fragment shader for rendering.
2. Try splitting the simulation into multiple dispatches and buffers, in order to allow a much greater number of particles to be simulated simultaneously. Implementing this in a dynamic way is a nice software engineering challenge. You can also experiment with different workgroup sizes to see how it affects the performance.
