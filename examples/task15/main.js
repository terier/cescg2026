import * as mat from './mat.js';
import * as obj from './obj.js';

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const canvas = document.querySelector('canvas');
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

const code = await fetch('shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });

const vertexBufferLayout = {
    arrayStride: 20,
    attributes: [{
        format: 'float32x3',
        offset: 0,
        shaderLocation: 0,
    }, {
        format: 'float32x2',
        offset: 12,
        shaderLocation: 1,
    }],
};

const pipeline = device.createRenderPipeline({
    vertex: { module, buffers: [vertexBufferLayout] },
    fragment: { module, targets: [{ format }] },
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
    },
    layout: 'auto',
});

const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TRANSIENT_ATTACHMENT,
});

const { vertices, indices } = obj.parse(await fetch('cube.obj').then(response => response.text()));
const vertexArray = new Float32Array(vertices.length * 5);
for (let i = 0; i < vertices.length; i++) {
    const { position, texcoords } = vertices[i];
    vertexArray.set(position, i * 5);
    vertexArray.set(texcoords, i * 5 + 3);
}
const vertexBuffer = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexArray);

const indexArray = new Uint32Array(indices);
const indexBuffer = device.createBuffer({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(indexBuffer, 0, indexArray);

const uniformBuffer = device.createBuffer({
    size: 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const bitmap = await fetch('brick.png')
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob));
const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
});
device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: texture },
    [bitmap.width, bitmap.height]);

const sampler = device.createSampler();

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: uniformBuffer },
        { binding: 1, resource: texture },
        { binding: 2, resource: sampler },
    ],
});

function frame(t) {
    const modelMatrix = mat.axisAngle([0, 1, 0], t / 1000);
    const viewMatrix = mat.translation(0, 0, -5);
    const projectionMatrix = mat.perspective(1, canvas.width / canvas.height, 0.1, 10);
    const matrix = mat.multiply(projectionMatrix, viewMatrix, modelMatrix);
    device.queue.writeBuffer(uniformBuffer, 0, mat.toF32(matrix));

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture(),
            loadOp: 'clear',
            clearValue: [1, 1, 0, 1],
            storeOp: 'store',
        }],
        depthStencilAttachment: {
            view: depthTexture,
            depthLoadOp: 'clear',
            depthClearValue: 1,
            depthStoreOp: 'discard',
        },
    });
    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(indexArray.length);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
