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

const pipeline = device.createRenderPipeline({
    vertex: { module },
    fragment: { module, targets: [{ format }] },
    layout: 'auto',
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
renderPass.draw(3);
renderPass.end();
device.queue.submit([commandEncoder.finish()]);
