const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
console.log([...navigator.gpu.wgslLanguageFeatures]);
console.log(adapter.info);
console.log(adapter.limits, device.limits);
console.log([...adapter.features], [...device.features]);
