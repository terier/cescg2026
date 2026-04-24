import * as obj from './obj';
import * as mat from './mat';


type SceneData = {
    uniformBuffer: GPUBuffer;
    depthTexture: GPUTexture;
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
    vertexBuffer: GPUBuffer;
    indexBuffer: GPUBuffer;
    indexArray: Uint32Array<ArrayBuffer>;
};


export async function prepareScene(device: GPUDevice, context: GPUCanvasContext): Promise<SceneData> {
    const sceneCode = await fetch('shader_scene.wgsl').then(response => response.text());
    const sceneModule = device.createShaderModule({ code: sceneCode });
    
    const sceneVertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: 20,
        attributes: [
            {
                format: 'float32x3',
                offset: 0,
                shaderLocation: 0,
            },
            {
                format: 'float32x2',
                offset: 12,
                shaderLocation: 1
            }
        ]
    };
    
    const pipeline = device.createRenderPipeline({
        vertex: { module: sceneModule, buffers: [sceneVertexBufferLayout] },
        fragment: { module: sceneModule, targets: [{ format: context.getCurrentTexture().format }] },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        },
        layout: 'auto'
    });
    
    const depthTexture = device.createTexture({
        size: [context.canvas.width, context.canvas.height],
        format: 'depth24plus',
        usage:
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.TRANSIENT_ATTACHMENT
    });
    
    const objFileString = await fetch('../../task15/cube.obj').then(response => response.text());
    const { vertices, indices } = obj.parse(objFileString);
    
    const vertexArray = new Float32Array(vertices.length * 5);
    for (let i = 0; i < vertices.length; i++) {
        const { position, texcoords } = vertices[i];
        vertexArray.set(position, i * 5);
        vertexArray.set(texcoords, i * 5 + 3);
    }
    const vertexBuffer = device.createBuffer({
        size: vertexArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexArray);
    
    const indexArray = new Uint32Array(indices);
    const indexBuffer = device.createBuffer({
        size: indexArray.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(indexBuffer, 0, indexArray);
    
    const uniformBuffer = device.createBuffer({
        size: 4 * 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    const bitmap = await fetch('../../task15/brick.png')
        .then(response => response.blob())
        .then(blob => createImageBitmap(blob));
    const texture = device.createTexture({
        size: [bitmap.width, bitmap.height],
        format: 'rgba8unorm',
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    });
    device.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: texture },
        [bitmap.width, bitmap.height]
    );
    
    const sampler = device.createSampler();
    
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: uniformBuffer },
            { binding: 1, resource: texture },
            { binding: 2, resource: sampler }
        ]
    });

    return {
        uniformBuffer,
        depthTexture,
        pipeline,
        bindGroup,
        vertexBuffer,
        indexBuffer,
        indexArray,
    }
}


export function renderScene(
    device: GPUDevice,
    commandEncoder: GPUCommandEncoder,
    canvas: HTMLCanvasElement,
    sceneData: SceneData,
    outTextureView: GPUTextureView,
    t: number,
) {
    const modelMatrix = mat.axisAngle([0, 1, 0], t / 1000);
    const viewMatrix = mat.translation(0, 0, -5);
    const projectionMatrix = mat.perspective(1, canvas.width / canvas.height, 0.1, 10);
    const matrix = mat.multiply(projectionMatrix, viewMatrix, modelMatrix);
    device.queue.writeBuffer(sceneData.uniformBuffer, 0, mat.toF32(matrix));

    const renderPassScene = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: outTextureView,
            loadOp: 'clear',
            clearValue: [1, 1, 0, 1],
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: sceneData.depthTexture,
            depthLoadOp: 'clear',
            depthClearValue: 1,
            depthStoreOp: 'discard'
        }
    });
    renderPassScene.setPipeline(sceneData.pipeline);
    renderPassScene.setVertexBuffer(0, sceneData.vertexBuffer);
    renderPassScene.setIndexBuffer(sceneData.indexBuffer, 'uint32');
    renderPassScene.setBindGroup(0, sceneData.bindGroup);
    renderPassScene.drawIndexed(sceneData.indexArray.length);
    renderPassScene.end();
}