const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const commandEncoder = device.createCommandEncoder();
const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture(),
        loadOp: 'clear',
        clearValue: [1, 1, 0, 1],
        storeOp: 'store',
    }]
});
renderPass.end();
device.queue.submit([commandEncoder.finish()]);
