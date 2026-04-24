const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('WebGPU is not supported by this browser.');
}

const device = await adapter.requestDevice();

const canvas = document.querySelector('canvas');
if (!canvas) {
    throw new Error('Canvas element not found');
}

const context = canvas.getContext('webgpu');
if (!context) {
    throw new Error('WebGPU context not available');
}

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });

const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0,
    }],
};

const pipeline = device.createRenderPipeline({
    vertex: { module, buffers: [vertexBufferLayout] },
    fragment: { module, targets: [{ format }] },
    layout: 'auto',
});

const vertexArray = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
    -0.5,  0.5,
     0.5,  0.5,
]);
const vertexBuffer = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

const indexArray = new Uint32Array([
    0, 1, 2,
    2, 1, 3,
]);
const indexBuffer = device.createBuffer({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(indexBuffer, 0, indexArray);

const matrix = new Float32Array([
    Math.cos(1), Math.sin(1), 0, 0,
    -Math.sin(1), Math.cos(1), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);
const uniformBuffer = device.createBuffer({
    size: matrix.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(uniformBuffer, 0, matrix);

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: uniformBuffer },
    ],
});

const commandEncoder = device.createCommandEncoder();
const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture(),
        loadOp: 'clear',
        clearValue: [1, 1, 0, 1],
        storeOp: 'store',
    }]
});
renderPass.setPipeline(pipeline);
renderPass.setVertexBuffer(0, vertexBuffer);
renderPass.setIndexBuffer(indexBuffer, 'uint32');
renderPass.setBindGroup(0, bindGroup);
renderPass.drawIndexed(indexArray.length);
renderPass.end();
device.queue.submit([commandEncoder.finish()]);
