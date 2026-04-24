import * as mat from './mat.js';
import * as obj from './obj.js';
import * as gpu from './gpu.js';
import * as ren from './unlit-renderer.js';
import * as load from './load.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
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

function frame(t) {
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
