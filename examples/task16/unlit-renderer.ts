export async function createRenderer(device: GPUDevice) {
    const code = await fetch('shader.wgsl').then(response => response.text());
    const module = device.createShaderModule({ code });

    const vertexBufferLayout: GPUVertexBufferLayout = {
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

    const format = navigator.gpu.getPreferredCanvasFormat();
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

    const bindGroupLayout = pipeline.getBindGroupLayout(0);

    return { device, pipeline, bindGroupLayout };
}

export function createBindGroup({ device, bindGroupLayout }: { device: GPUDevice; bindGroupLayout: GPUBindGroupLayout }, uniformBuffer: GPUBuffer, texture: GPUTexture, sampler: GPUSampler) {
    return device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            { binding: 0, resource: uniformBuffer },
            { binding: 1, resource: texture },
            { binding: 2, resource: sampler },
        ],
    });
}

export function render({ device, pipeline }: { device: GPUDevice; pipeline: GPURenderPipeline }, { colorTexture, depthTexture }: { colorTexture: GPUTexture; depthTexture: GPUTexture }, model: any) {
    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: colorTexture,
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

    const { vertexBuffer, indexBuffer, indexCount, bindGroup } = model;
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(indexCount);

    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
}
