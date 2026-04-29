import * as mat from './mat';
import * as obj from './obj';
import * as gpu from './gpu';
import * as ren from './unlit-renderer';
import * as load from './load';

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('WebGPU is not supported by this browser.');
}

const device = await adapter.requestDevice()!

const canvas = document.querySelector('canvas')!;
if (!canvas) {
    throw new Error('Canvas element not found');
}

const context = canvas.getContext('webgpu')!;
if (!context) {
    throw new Error('WebGPU context not available');
}

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const renderer = await ren.createRenderer(device);
const depthTexture = gpu.createDepthTexture(device, [canvas.width, canvas.height]);

const mesh = obj.parse(await load.text('cube.obj'));
const meshGpu = gpu.createMesh(device, mesh);
const uniformBuffer = gpu.createUniformBuffer(device, 4 * 4 * 4);

const texture = gpu.createImageTexture(device, await load.image('brick.png'));
const sampler = device.createSampler();

const bindGroup = ren.createBindGroup(renderer, uniformBuffer, texture, sampler);
const model = { ...meshGpu, bindGroup };

function frame(t: number) {
    const modelMatrix = mat.axisAngle([0, 1, 0], t / 1000);
    const viewMatrix = mat.translation(0, 0, -5);
    const projectionMatrix = mat.perspective(1, canvas.width / canvas.height, 0.1, 10);
    const matrix = mat.multiply(projectionMatrix, viewMatrix, modelMatrix);
    device.queue.writeBuffer(uniformBuffer, 0, mat.toF32(matrix));

    const renderTarget = { colorTexture: context.getCurrentTexture(), depthTexture };
    ren.render(renderer, renderTarget, model);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
