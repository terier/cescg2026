import { prepareBlur, renderBlurX, renderBlurY } from './renderBlur';
import { prepareScene, renderScene } from './renderScene';

// GPU Initialization

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('WebGPU not supported');
}
const device = await adapter.requestDevice();
const canvas = document.querySelector('canvas');
if (!canvas) {
    throw new Error('Canvas not found');
}
const context = canvas.getContext('webgpu');
if (!context) {
    throw new Error('WebGPU context not available');
}

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;


// Data Preparation

const sceneData = await prepareScene(device, context);
const blurData = await prepareBlur(device, context);


// Textures

const intermediateTexture1 = device.createTexture({
    label: 'Intermediate1',
    size: [context.canvas.width, context.canvas.height],
    format: context.getCurrentTexture().format,
    usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
});
const intermediateTexture2 = device.createTexture({
    label: 'Intermediate2',
    size: [context.canvas.width, context.canvas.height],
    format: context.getCurrentTexture().format,
    usage:
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
});
const intermediateTextureView1 = intermediateTexture1.createView();
const intermediateTextureView2 = intermediateTexture2.createView();

const samplerNoFilter = device.createSampler({
    minFilter: 'nearest',
    magFilter: 'nearest'
});

const intermediateTextureBindGroup1 = device.createBindGroup({
    layout: blurData.pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: intermediateTexture1 },
        { binding: 1, resource: samplerNoFilter }
    ]
});
const intermediateTextureBindGroup2 = device.createBindGroup({
    layout: blurData.pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: intermediateTexture2 },
        { binding: 1, resource: samplerNoFilter }
    ]
});


// Rendering

function frame(t: number) {
    if (!canvas || !context) {
        return;
    }

    const commandEncoder = device.createCommandEncoder();

    renderScene(device, commandEncoder, canvas, sceneData, intermediateTextureView1, t);
    renderBlurX(commandEncoder, blurData, intermediateTextureBindGroup1, intermediateTextureView2);
    renderBlurY(commandEncoder, blurData, intermediateTextureBindGroup2, context.getCurrentTexture().createView());

    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);