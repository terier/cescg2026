export function createMesh(device: GPUDevice, { vertices, indices }: { vertices: any[]; indices: number[] }) {
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

    return { vertexBuffer, indexBuffer, indexCount: indices.length };
}

export function createDepthTexture(device: GPUDevice, size: GPUExtent3D) {
    return device.createTexture({
        size,
        format: 'depth24plus',
        usage:
            GPUTextureUsage.RENDER_ATTACHMENT |
            GPUTextureUsage.TRANSIENT_ATTACHMENT,
    });
}

export function createImageTexture(device: GPUDevice, image: ImageBitmap) {
    const texture = device.createTexture({
        size: [image.width, image.height],
        format: 'rgba8unorm',
        usage:
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
        { source: image },
        { texture: texture },
        [image.width, image.height]);
    return texture;
}

export function createUniformBuffer(device: GPUDevice, size: number) {
    return device.createBuffer({
        size,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
