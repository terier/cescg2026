const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
    throw new Error('WebGPU is not supported by this browser.');
}

const device = await adapter.requestDevice();

console.log([...navigator.gpu.wgslLanguageFeatures]);
console.log(adapter.info);
console.log(adapter.limits, device.limits);
console.log([...adapter.features], [...device.features]);
