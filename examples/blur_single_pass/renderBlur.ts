type BlurData = {
    pipeline: GPURenderPipeline;
    configBindGroupX: GPUBindGroup;
    configBindGroupY: GPUBindGroup;
};


export async function prepareBlur(device: GPUDevice, context: GPUCanvasContext): Promise<BlurData> {
    const code = await fetch('shader_blur.wgsl').then(response => response.text());
    const module = device.createShaderModule({ code });
    const pipeline = device.createRenderPipeline({
        vertex: {
            module,
            buffers: []
        },
        fragment: {
            module,
            targets: [{ format: context.getCurrentTexture().format }]
        },
        layout: 'auto'
    });

    const configBufferX = device.createBuffer({
        size: 4 * 2,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const configBindGroupX = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: configBufferX }
        ]
    });
    const configBufferY = device.createBuffer({
        size: 4 * 2,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const configBindGroupY = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            { binding: 0, resource: configBufferY }
        ]
    });

    device.queue.writeBuffer(configBufferX, 0, new Float32Array([1, 0]));
    device.queue.writeBuffer(configBufferY, 0, new Float32Array([0, 1]));

    return {
        pipeline,
        configBindGroupX,
        configBindGroupY,
    }
}


export function renderBlurX(
    commandEncoder: GPUCommandEncoder,
    blurData: BlurData,
    inTextureBindGroup: GPUBindGroup,
    outTextureView: GPUTextureView
) {
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: outTextureView,
            loadOp: 'clear',
            clearValue: [0, 0, 0, 1],
            storeOp: 'store'
        }]
    });
    renderPass.setPipeline(blurData.pipeline);
    renderPass.setBindGroup(0, inTextureBindGroup);
    renderPass.setBindGroup(1, blurData.configBindGroupX);
    renderPass.draw(6);
    renderPass.end();
}


export function renderBlurY(
    commandEncoder: GPUCommandEncoder,
    blurData: BlurData,
    inTextureBindGroup: GPUBindGroup,
    outTextureView: GPUTextureView
) {
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: outTextureView,
            loadOp: 'clear',
            clearValue: [0, 0, 0, 1],
            storeOp: 'store'
        }]
    });
    renderPass.setPipeline(blurData.pipeline);
    renderPass.setBindGroup(0, inTextureBindGroup);
    renderPass.setBindGroup(1, blurData.configBindGroupY);
    renderPass.draw(6);
    renderPass.end();
}