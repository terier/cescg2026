# Instancing

When we are dealing with a lot of objects that are using the same model data (vertex buffer, index buffer, ...), we can render them issuing just one render pass command instead of one for each object separately. This optimization is called instancing.

The way instancing works in WebGPU is that we treat each instance as a sort of "vertex" that holds data, unique for that instance. We say "vertex", because this data is provided in a special vertex buffer. The GPU traverses this vertex data and for each vertex draws the object. The vertex shader can take instance data in as a parameter (just as it would the ordinary vertex data). We can also use a built-in parameter `instance_index` in case we have specific index based rules or wish to index data from external storage buffers.

## 1. Getting started

We will work with the code from Task 15. We should have a rotating cube appearing in the browser.

## 2. The battle plan

We will create a few dozen identical rotating cubes, placed randomly in the scene. We will need to define positions of those cubes which we will store into an instance buffer. We will extend the shader to use these positions.

We would like to first rotate the cubes in place, then translate them to their designated position, and then apply view and projection transforms. Our shader currently does not support this, exposing only one matrix, so we will extend our uniform to three matrices: model, view, and projection.

## 3. The shader - Part 1

Let's handle the shader first. As mentioned above, we will change the uniform in binding 0 to contain three matrices.

```wgsl
struct Transforms {
    projection: mat4x4f,
    view: mat4x4f,
    model: mat4x4f
};
@group(0) @binding(0) var<uniform> transform: Transforms;
```

We will also update the vertex shader.

```wgsl
@vertex
fn vertex(@location(0) position: vec3f, @location(1) texcoords: vec2f) -> VertexOutput {
    var output: VertexOutput;

    let P = transform.projection;
    let V = transform.view;
    let M = transform.model;

    output.clipPosition = P * V * M * vec4f(instancePosition, 0.0);
    output.texcoords = texcoords;
    return output;
}
```

## 4. The uniform buffer

In our main code, we will update the size of our uniform buffer to be able to store three matrices:

```ts
const uniformBuffer = device.createBuffer({
    size: 4 * 4 * 4 * 3,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

Inside the render loop, we thus fill in the buffer with computed matrices:

```ts
const modelMatrix = mat.axisAngle([0, 1, 0], t / 1000);
const viewMatrix = mat.translation(0, 0, -5);
const projectionMatrix = mat.perspective(1, canvas.width / canvas.height, 0.1, 100);

device.queue.writeBuffer(uniformBuffer, 0, mat.toF32(projectionMatrix));
device.queue.writeBuffer(uniformBuffer, 16 * 4, mat.toF32(viewMatrix));
device.queue.writeBuffer(uniformBuffer, 16 * 8, mat.toF32(modelMatrix));
```

## First Checkpoint

We should see the rotating cube again.


## 5. Pipeline changes

The only thing we will discern our instances by, is their position. So our instance buffer will contain just those. Let's create the buffer layout, which is a type of vertex buffer layout.

What makes it different from the classic vertex buffer layout is the option `stepMode` which we set to `instance`. Other parameters are standard. We notify our pipeline that the buffer will contain just 3D vectors at location 2. We keep in mind this location, because we will use it as a parameter in vertex shader later on.

```ts
const instanceBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 12,
    stepMode: 'instance',
    attributes: [{
        format: 'float32x3',
        offset: 0,
        shaderLocation: 2
    }]
};
```

And update the pipeline so that our vertex shader is aware of the new instance buffer.

```ts
const pipeline = device.createRenderPipeline({
    vertex: { module, buffers: [vertexBufferLayout, instanceBufferLayout] },
    fragment: { module, targets: [{ format }] },
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
    },
    layout: 'auto',
});
```

## 6. Instance buffer

Let's create some instance positions. We can generate them randomly like so:

```ts
const instanceCount = 50;
const instancePositions = new Float32Array(instanceCount * 3);
for (let i = 0; i < instanceCount; i++) {
    let offset = i * 3;

    let x = (Math.random() - 0.5) * 30.0;
    let y = -Math.random() * 5;
    let z = (Math.random() - 1.0) * 30.0;

    instancePositions[offset] = x;
    instancePositions[offset + 1] = y;
    instancePositions[offset + 2] = z;
}
```

Afterwards, we create a buffer and write the positions into it. We treat this buffer as a vertex buffer.

```ts
const instanceBuffer = device.createBuffer({
    size: instancePositions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
device.queue.writeBuffer(instanceBuffer, 0, instancePositions);
```

## 7. Render pass

In the render pass, we bind the instance buffer and extend the `drawIndexed` method.

```ts
renderPass.setVertexBuffer(1, instanceBuffer);
...
renderPass.drawIndexed(indexArray.length, instanceCount);
```

We should now see a bunch of cubes spinning in the scene.