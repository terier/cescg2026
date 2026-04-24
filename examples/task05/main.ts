const adapter = await navigator.gpu.requestAdapter();

if (!adapter) {
    console.error('WebGPU is not supported on this browser.');
    throw new Error('WebGPU not supported');
}

const device = await adapter.requestDevice();

const canvas = document.querySelector('canvas');

if (!canvas) {
    console.error('Canvas element not found.');
    throw new Error('Canvas element not found');
}

const context = canvas.getContext('webgpu');

if (!context) {
    console.error('WebGPU context not available.');
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
     0.0,  0.5,
]);
const vertexBuffer = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

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
renderPass.draw(3);
renderPass.end();
device.queue.submit([commandEncoder.finish()]);
