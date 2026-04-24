# Introduction to WebGPU

WebGPU is a web API for accessing graphics hardware. As the successor to WebGL, it is more modern, powerful, includes more functionality, and allows for writing more readable code without the various pitfalls that are present in WebGL. WebGPU is designed similarly to modern graphics interfaces used for developing desktop applications, such as Vulkan, DirectX 12, and Metal. Compared to WebGL, it adapts much better to the architecture of modern graphics cards, making its performance faster and more predictable. In addition to rendering, WebGPU also supports general-purpose computing via compute shaders, which is especially useful in applications that rely on fast execution of parallelizable code, e.g. neural networks.

## Part 1 - Hello, WebGPU

### Environment setup

You will need:
- **A modern web browser.** Currently, Chromium and its derivatives (Chrome, Opera, Edge) offer the best support for WebGPU. WebGPU is also available on Firefox and Safari. If you are using Windows, you will probably have no problems in any of the major browsers. On Linux, you might run into some issues on Chrome and Firefox, but most can be avoided by using a correct combination of flags. More detailed info is available [here](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status).
- **A code editor.** We recommend Sublime Text or Visual Studio Code, but you can use any text editor. If you want syntax highlighting for shaders, both Sublime Text and Visual Studio Code supply appropriate plugins.
- **An HTTP server.** If you have python installed, the simplest option is to run `python -m http.server` in the terminal to serve static files in the processes working directory. If you are using Visual Studio Code, you may want to look into the Live Server extension. Any server will work, as long as it supports statically serving files.

### Project directory and files

We will start with creating a directory for our project and a basic web page to run a script that will initialize WebGPU.

Create a directory for the project and create an `index.html` file with the following content:

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <script type="module" src="main.js"></script>
    </head>
    <body>
    </body>
</html>
```

We will leave the `<body>` empty for now. We also have to create an empty `main.js` file. Note that we have included `main.js` as a module script, which will later allow us to import parts of JavaScript code from other modules. Browsers refuse to load module scripts directly from disk, which is why you will see an error in the browser's console if you open `index.html` by double-clicking on it.

To properly serve the project, start the HTTP server and configure it to serve the contents of your project's directory. If you are using `python`, you can execute the following commands in the terminal:

```bash
cd path/to/your/project
python -m http.server 3000
```

This command will start an HTTP server on `localhost` (i.e., `127.0.0.1`) on port 3000, serving the contents of the directory from which the command was run.

Now you can point your web browser to the address `localhost:3000`, and an empty web page should be displayed. Open the developer tools (in most major browsers, the keyboard shortcut is F12), where you should see a console without errors.

### WebGPU initialization

The main entry point of the WebGPU API is `navigator.gpu`. You can determine if WebGPU is available in your browser by checking that the object `navigator.gpu` exists:

```js
if (!navigator.gpu) {
    throw Error('Aw snap, WebGPU is not supported :(');
}
```

#### Adapter

First, you will need an **adapter**, which roughly corresponds to the physical device:

```js
const adapter = await navigator.gpu.requestAdapter();
```

Note that the function is asynchronous, because the browser can spend some time enumerating all adapters, so we wait for the operation to finish with the `await` operator.

In practical applications, you should check that you received an adapter, since `requestAdapter` returns null if there isn't one available:

```js
if (!adapter) {
    throw new Error('Sorry, no WebGPU adapters available.');
}
```

When selecting an adapter, you can prioritize either lower power consumption or faster performance, which is especially useful if you have multiple graphics cards available (e.g., integrated and discrete). To request a `low-power` or a `high-performance` adapter, you set it as a `powerPreference`:

```js
const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'low-power'
});
```

In the first example, no argument was passed to the function, leaving the choice to the browser.

Some browsers provide a fallback adapter, which is typically a low-performance software implementation for wider compatibility. You can check whether the adapter that was returned is a fallback adapter by reading `adapter.isFallbackAdapter`. Fallback adapters can be useful for debugging.

Different adapters have different capabilities, which are exposed to WebGPU through *features* and *limits*. **Features** are sets of optional functionality that is not supported on all implementations, typically due to hardware constraints. Examples include compressed texture formats and filterable floating-point textures. **Limits**, on the other hand, are numerical limits on the usage of WebGPU, such as maximum texture size, maximum number of interpolated variables, and minimum memory alignment. You can examine the features and limits of the selected adapter by inspecting `adapter.features` and `adapter.limits`:

```js
console.log([...adapter.features], adapter.limits);
```

In certain cases, e.g. when there is a bug on a specific GPU architecture, you may want your application to behave differently than usual. In such cases, you can read `adapter.info`, which may expose information such as the vendor, architecture, and device model:

```js
console.log(adapter.info);
```

#### Device

After selecting the adapter, we will request access to the **device**, which provides access to most of WebGPU's operations:

```js
const device = await adapter.requestDevice();
```

The device is responsible for creating and managing resources and dispatching work on the GPU. In this example, we did not pass any parameters to `requestDevice`, so we will be using default features and limits, which will be supported by all WebGPU implementations. However, you can request additional features and higher limits if they are supported by the adapter, but doing so will reduce the number of devices on which your application will work (mobile devices are typically the first to be excluded).

For example, you can enable `texture-compression-bc` and a higher `maxBufferSize` like this:

```js
const device = await adapter.requestDevice({
    requiredFeatures: ['texture-compression-bc'],
    requiredLimits: { maxBufferSize: 128 * 1024 * 1024 },
});
```

Keep in mind that even though the adapter may support certain features and higher limits, you must explicitly enable them when requesting the device, otherwise the device will behave as if they don't exist. Also, make sure that the adapter actually supports the requested features and limits, or the operation will fail.

Selecting the device with `requestDevice` is also a potentially time-consuming operation, so it is asynchronous, just like `requestAdapter`.

After initializing the device, you can inspect its features and limits just like with the adapter:

```js
console.log([...adapter.features], adapter.limits);
```

### Exercises

- Inspect the features and limits supported by the adapter. How different are they from the default features and limits of the device?
- Provide a power preference when requesting the adapter and check which adapter is selected by the browser. Is it different from the default one?

## Part 2 - Canvas

### A properly sized canvas

To display anything on the screen, we will need a drawing surface. In a browser, this is the job of a `<canvas>`. WebGPU can also be used without a canvas if you only need its computational capabilities. For example, you can run WebGPU in Deno from the terminal.

In the `index.html` file, add a `<canvas>` element with a fixed size of 512 × 512 pixels:

```html
<canvas width="512" height="512"></canvas>
```

Note that the size that you set is different from the actual size of the canvas on the screen, as the canvas can be stretched with CSS. You can see this in action if you stretch the canvas to cover the whole screen. Add a `style.css` file with the following rules:

```css
body {
    margin: 0;
    overflow: hidden;
}

canvas {
    width: 100dvw;
    height: 100dvh;
}
```

Don't forget to link the stylesheet in `index.html`:

```html
<link rel="stylesheet" href="style.css">
```

To compensate for the size change, set the canvas in `main.js`:

```js
const canvas = document.querySelector('canvas');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
```

Keep in mind that this code will not respond to any subsequent window resizing. For a complete solution, you may want to look into `ResizeObserver`, but this is somewhat out of scope of these examples.

### Connecting the device and canvas

Before you can draw to the canvas, you need to configure the connection between the canvas and the device. At any given time, a canvas can be connected to only one device, although a single device can be configured to render to multiple canvases. This is particularly useful for 3D modeling and CAD applications, where a scene is often displayed from several viewpoints at once.

In `main.js`, we establish this connection using the `webgpu` context. We must also specify the color format for rendering. Typically, each device has a preferred format that offers the best performance, and you can query WebGPU to determine what that format is.

```js
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });
```

There are other settings you can pass during canvas configuration, such as the color space, tone mapping, and alpha mode. The browser uses this information to correctly display the canvas on the screen. We will not use these settings in our examples, since the default configuration already works well for us.

### Exercises

- Use ResizeObserver to resize the canvas when its display size changes.

## Part 3 - Clearing the canvas

All commands, including rendering commands, must be passed to the device in a format it can understand. This is done with a **command encoder**, which records the commands into a **command buffer**. The command buffer is then submitted to the device for execution through the **command queue**.

```js
const commandEncoder = device.createCommandEncoder();
// <here you will encode commands>
const commandBuffer = commandEncoder.finish();
device.queue.submit([commandBuffer]);
```

A command buffer can only be submitted once, as it is invalidated upon execution. If you need to run the same commands multiple times, you have to encode them again, either within the same command buffer or separately.

Every time before rendering, you must first clear the canvas (or, in general, any render target). Clearing the canvas is thus the first operation of a **render pass**.

```js
const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture(),
        loadOp: 'clear',
        clearValue: [1, 1, 0, 1],
        storeOp: 'store',
    }]
});
renderPass.end();
```

In the example above, we instruct the device to clear the canvas at the start of the render pass (`loadOp: 'clear'`) with a yellow color (`clearValue: [1, 1, 0, 1]`), and at the end of the render pass, all rendering results are written to the canvas (`storeOp: 'store'`).

In certain use cases, instead of clearing the values at the beginning of the render pass, you can load the values that are already stored in the texture (`loadOp: 'load'`). You can also choose to discard the results at the end of the render pass (`storeOp: 'discard'`). Typically, you would do this for the depth texture. We will explore these use cases in later examples.

Note that we request the *current* texture from the context. Since the browser may use double or triple buffering, there isn't a single persistent texture associated with the canvas. Instead, the browser provides the next texture available for rendering.

Since the browser may need to swap this texture to present its content on screen, it is only valid within the current event loop. This means you shouldn't perform any asynchronous operations after requesting the texture, as it could be invalidated before your render commands are submitted to the command queue.

### Exercises

- Experiment with different load and store operations. How does the canvas look if you use `discard` and why?
- Try to animate the clear color. You will have to create a new command encoder and encode a new render pass on every frame of the animation.

## Part 4 - First triangle

### Shaders

At this point, everything is set up to draw your first triangle. To render anything on the canvas, you need two programs: the **vertex shader**, which determines the positions of the triangle's vertices on the canvas, and the **fragment shader**, which defines the color of the pixels (more precisely, the fragments) covered by the triangle.

Create a file named `shader.wgsl` where you will write your shader code in WGSL (WebGPU Shading Language). Create two functions, `vertex` and `fragment`:

```wgsl
fn vertex() {}
fn fragment() {}
```

You can name the functions however you like, since we will later explicitly tell WebGPU which ones it should use as the vertex and fragment shaders.

We want our vertex shader to output a position and the fragment shader to output a color, so let's add the return types and return statements:

```wgsl
fn vertex() -> vec4f {
    return vec4f(0, 0, 0, 1);
}

fn fragment() -> vec4f {
    return vec4f(1, 0, 0, 1);
}
```

The code above will compile, but to use the functions as vertex and fragment shaders, we must follow some basic rules:
- The vertex shader must be decorated with the `@vertex` decorator.
- The fragment shader must be decorated with the `@fragment` decorator.
- The vertex shader must write the position of each vertex into the built-in variable `position`.
- The fragment shader must write the color of each fragment into the output image, specified by a `location` index.

Following these rules, the modified shaders look like this:

```wgsl
@vertex
fn vertex() -> @builtin(position) vec4f {
    return vec4f(0, 0, 0, 1);
}

@fragment
fn fragment() -> @location(0) vec4f {
    return vec4f(1, 0, 0, 1);
}
```

For now, we will leave the shaders as they are. Don't worry about the input and output data, we will come back to that later.

You can retrieve the shader code from the server by calling the asynchronous `fetch` from the `main.js` file, and then extract the content of the server's response as text:

```js
const code = await fetch('shader.wgsl').then(response => response.text());
```

You can compile the shaders with the `createShaderModule` function:

```js
const module = device.createShaderModule({ code });
```

Verify that the compilation was successful:

```js
console.log(await module.getCompilationInfo());
```

### Pipeline

The form in which the vertex data is processed by the vertex shader and the format in which the colors are written at the output of the fragment shader is determined by the **pipeline**. The pipeline links both shaders into a cohesive unit and defines the formats of the input and output data, along with the configuration of fixed-function stages of the pipeline such as depth testing, primitive culling, and blending. For performance reasons, it is important to provide this information to the graphics card at pipeline creation.

Create the pipeline after compiling the shader code in `main.js`:

```js
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    layout: 'auto',
});
```

In the example above, we specify the same shader module for both stages of the pipeline. For the fragment shader, we also need to define the format of the **render targets** (the output images). The index 0 in the `@location(0)` decorator refers to this list. Since the vertex shader doesn't take any input data yet, its configuration can remain as is.

The last piece of information needed when creating the pipeline is the pipeline layout. For now, you can set it to `'auto'`, which lets WebGPU determine it automatically from the shader code. We will revisit pipeline layouts later when discussing shader inputs beyond just vertex data.

Creating a pipeline requires significant work from the driver, as it has to thoroughly validate the entire configuration to prevent errors during execution. For that reason, pipelines should always be created in advance rather than right before they're first used.

### Render pass

When encoding the render pass, set the pipeline and issue a draw call for 3 vertices:

```js
renderPass.setPipeline(pipeline);
renderPass.draw(3);
```

If you run the code, you will see a blank canvas. This is because the vertex shader assigns the same position to all vertices. To fix this, we need a way to distinguish between vertices and assign each one a different position. The simplest way to do this is through the built-in variable `vertex_index`, which assigns an increasing index to each vertex. Think of `draw(count)` as a `for` loop with `vertex_index` running from 0 to `count - 1`.

Add `vertex_index` as an input to the vertex shader and use it to return different positions:

```wgsl
@vertex
fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    if (i == 0) {
        return vec4f(-0.5, -0.5, 0, 1);
    } else if ( ... ) {
        ...
    }
}
```

We can simplify the code a bit by using arrays:

```wgsl
const vertexArray = array(
    vec2f(-0.5, -0.5),
    vec2f( 0.5, -0.5),
    vec2f( 0.0,  0.5),
);

@vertex
fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    return vec4f(vertexArray[i], 0, 1);
}
```

The updated code should render a red triangle on the canvas.

### Exercises

- Change the color of the triangle. Try using the built-in variable `position` at the input of the fragment shader to calculate the color based on the fragment's position.
- Modify the vertex data so that the program renders a square. Note that if you split the square in half, it is composed of two triangles with three vertices each. Update the render pass accordingly.
- Change the vertex coordinates so that the square touches the edges of the canvas. What values of x and y achieve this?
- Vary the z coordinate until the square disappears. For what range of values is the square displayed on the canvas?
- Rotate the square by 20 degrees using a rotation matrix. Use the functions `mat4x4f`, `cos`, and `sin`.

## Part 5 - Vertex buffer

In the previous exercise, we stored vertex positions as constants directly in the shader. Of course, this approach is not scalable. In most practical cases, you would usually load a 3D model from a file and upload its data to the GPU. To do this, we will allocate a block of GPU memory, write the vertex positions into it, and then provide that data to the shader in the render pass.

### Shader

First, let's change the vertex shader so that it accepts a vertex position as a parameter:

```wgsl
@vertex
fn vertex(@location(0) position: vec2f) -> @builtin(position) vec4f {
    return vec4f(position, 0, 1);
}
```

The variables that describe each vertex are called **attributes**. Our shader will therefore receive the position attribute at location 0. We will need this number when creating the pipeline.

Note that we have removed the input variable `@builtin(vertex_index) i`. You can also delete the position array since we will move it to `main.js`. We are left with a significantly simpler shader.

### Buffer

Let's store the vertex positions in an array in `main.js`:

```js
const vertexArray = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.0,  0.5,
]);
```

In the next step, we will create a **buffer**, which represents a single GPU memory allocation:

```js
const vertexBuffer = device.createBuffer({
    size: vertexArray.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
```

This is similar to how `malloc` works in C: when creating the buffer, you need to specify its size in bytes. Unlike C, however, the GPU also expects you to declare how the buffer will be used. The `VERTEX` flag indicates that the buffer's data will be read by the vertex shader to provide attribute values, while the `COPY_DST` flag allows you to write data into the buffer.

Now you can issue the write command to the command queue to write the data from `vertexArray` to `vertexBuffer`:

```js
device.queue.writeBuffer(vertexBuffer, 0, vertexArray);
```

In the line above, the number 0 is the offset in bytes from the start of the buffer where the write operation begins.

### Pipeline

Unlike the array we previously defined in the shader, the data in the vertex buffer doesn't inherently reflect the fact that it represents two-dimensional vectors. Furthermore, `Float32Array` is a JavaScript-only construct, and the GPU ultimately sees only a sequence of bytes. In other words, type and structure information was lost when we moved the array from the shader to JavaScript code, so we need to specify this information explicitly when creating the pipeline.

This includes specifying how many buffers you will use, the format of the attributes, their arrangement within the buffers, and which shader locations they correspond to. All this is part of the **vertex buffer layout**:

```js
const vertexBufferLayout = {
    arrayStride: 8,
    attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0,
    }],
};
```

The above layout tells the device that this buffer has one attribute bound to location 0 in the vertex shader. Its data is stored in the buffer as two-dimensional vectors of 32-bit floating-point numbers. The data for the first vertex starts at an offset of 0 bytes from the start of the buffer, while the data for each subsequent vertex is offset by an additional 8 bytes. This layout corresponds to how we actually stored the data within the vertex buffer.

We pass the vertex buffer layout to the device when creating the pipeline:

```js
const pipeline = device.createRenderPipeline({
    vertex: {
        module,
        buffers: [vertexBufferLayout],
    },
    fragment: {
        module,
        targets: [{ format }],
    },
    layout: 'auto',
});
```

### Render pass

In the render pass, we bind the vertex buffer with a call to `setVertexBuffer` before calling `draw`:

```js
renderPass.setVertexBuffer(0, vertexBuffer);
```

The number 0 in the above code refers to the list `buffers` in the pipeline descriptor, not to the attribute location in the shader.

With these modifications, the application should run without errors and render the same triangle, now with externally supplied vertex data.

### Exercises

- Write a function that generates vertex data for a disk with N + 1 vertices (N on the boundary, 1 in the center). You will have to duplicate some vertices.
- Create two shapes and store them in two separate vertex buffers. Draw both of them in the same render pass.

## Part 6 - Index buffer

Let's say you want to draw a square. Since a square consists of 2 triangles, we need 6 vertices, 2 of which are duplicated:

```js
const vertexArray = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.0,  0.5,

     0.0,  0.5,
     0.5, -0.5,
     0.5,  0.5,
]);
```

In the render pass we render 6 vertices:

```js
renderPass.draw(6);
```

With these two changes, the code should render a square. However, we can avoid duplicating vertices by referencing them with indices, similarly to how we used `vertex_index` previously.

Define each vertex only once in the vertex buffer:

```js
const vertexArray = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.0,  0.5,
     0.5,  0.5,
]);
```

You will reference these vertices with the following indices:

```js
const indexArray = new Uint32Array([
    0, 1, 2,
    2, 1, 3,
]);
```

Given how the pipeline is set up, each group of three indices defines a single triangle. The order of triangles affects only the performance (memory access patterns dicatate cache utilization), but the order of indices within each triangle defines its orientation, which is important for culling. In most cases, you don't need to worry about this yourself, and you can rely on your 3D modelling software to export optimized meshes.

In the above code, we are using 32-bit unsigned integers (`Uint32Array`) as indices. Sometimes you can benefit from smaller indices (16-bit or even 8-bit), if you are dealing with smaller meshes. However, that requires some special care when creating the index buffer, as there are alignment and size restrictions that don't come into play when using 32-bit indices.

You create the **index buffer** similarly to how you created the vertex buffer:

```js
const indexBuffer = device.createBuffer({
    size: indexArray.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(indexBuffer, 0, indexArray);
```

You use the `INDEX` flag to inform the device that the buffer will be used as an index buffer.

You will also need to update the render pass by setting the index buffer and providing the data type:

```js
renderPass.setIndexBuffer(indexBuffer, 'uint32');
```

Instead of the `draw` function, you call the `drawIndexed` function and provide the number of *indices* as opposed to the number of *vertices*. To make the code slightly more general, you can read the number of indices from the `indexArray`:

```js
renderPass.drawIndexed(indexArray.length);
```

You should now see a square on the canvas.

In this specific case, where the amount of data is very small, using an index buffer is likely a bit slower than simply drawing 6 vertices due to additional memory accesses and added level of indirection. However, practical 3D models are typically modeled as a more or less regular grid of vertices shared among neighboring triangles, and a single vertex can be reused by 6 or more triangles, making indexing much more efficient. As a result, most practical 3D models and file formats rely on indexing.

### Exercises

- Write a function that generates an indexed mesh of a disk with N + 1 vertices (N on the boundary, 1 in the center).
- Write a function that generates an indexed mesh of a grid of N × N vertices. How much GPU memory does the indexed model use? What about a non-indexed version?

## Part 7 - Transforming the square

### Transformation matrix

Since vertex positions in the vertex shader are represented with 4-dimensional homogeneous vectors, you can easily apply any affine (in fact, projective) transformation with a 4 × 4 matrix. Let's first try out a simple translation matrix hardcoded into `shader.wgsl`, with the translation vector `(0.5, 0.5, 0)`:

```wgsl
let matrix = mat4x4f(
    1, 0, 0, 0.5,
    0, 1, 0, 0.5,
    0, 0, 1, 0,
    0, 0, 0, 1,
);
return matrix * vec4f(position, 0, 1);
```

The square looks transformed, but there is definitely more than just translation at work here. The reason is that matrices in WGSL are stored in column-major order, and matrix constructors follow the same convention. The above code is therefore not a translation matrix, but a perspective projection matrix! Let's fix that:

```wgsl
let matrix = mat4x4f(
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0.5, 0.5, 0, 1,
);
```

The matrix now only appears transposed, and the square has correctly moved up and to the right.

### Uniform buffer

A hardcoded matrix is certainly not the right way to do computer graphics, and to transform the square programmatically, we need a way to pass the matrix from JavaScript to the shader. The matrix is shared by all vertices (and fragments, for that matter), so it behaves somewhat like a constant. However, unlike true constants, its value can be updated between consecutive draw calls, allowing us to create animations. Such variables are called **uniforms**.

In the shader, remove the hardcoded matrix and instead declare an appropriate uniform variable in the global scope:

```wgsl
@group(0) @binding(0) var<uniform> matrix: mat4x4f;
```

Uniforms and other external resources are organized into **bind groups**, and within each bind group, every resource has its own **binding number**. All resources in a group are bound to the shader with a single function call.

Groups are often organized by change frequency. For example, scene parameters rarely change, so they are put in a common bind group. Each material also gets a bind group, and if models are ordered and rendered by material, you can bind each material only once per render pass. Lastly, transformations and other per-model data are put in a separate group that is bound for each draw call and thus changes most frequently.

In the code above, we assigned the matrix to group 0 and gave it a binding number of 0. These numbers will be important when creating the bind group.

Values for uniforms are stored in **uniform buffers**. Let's create a rotation matrix in JavaScript and an appropriately sized uniform buffer to which the matrix will be copied:

```js
const matrix = new Float32Array([
    Math.cos(1), Math.sin(1), 0, 0,
    -Math.sin(1), Math.cos(1), 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);

const uniformBuffer = device.createBuffer({
    size: matrix.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

device.queue.writeBuffer(uniformBuffer, 0, matrix);
```

Note that we used the `UNIFORM` flag to inform the device that this buffer will be used as a uniform buffer.

### Bind group and layout

To bind the buffer to the shader, you need to create a **bind group**. Each bind group has to match a specific **bind group layout**, which defines the types of uniforms and their arrangement within a group. This layout must match the one used when the pipeline was created. Previously, we let the driver create the layout automatically (`layout: 'auto'`), and we can retrieve the layout for a specific group through the function `pipeline.getBindGroupLayout`.

```js
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: uniformBuffer },
    ],
});
```

When the bind group is created, the device checks that its entries match the expected layout. This way, those checks don't have to be done during rendering. Finally, you bind the group to the shader in the render pass:

```js
renderPass.setBindGroup(0, bindGroup);
```

At this point, your code should display a rotated square.

You can also create your own bind group layout by calling `device.createBindGroupLayout`. But why would you do that when you can just let the driver do it for you? There are several reasons:

- Automatically created bind group layouts are unique to that specific pipeline. Even if you create two identical pipelines with the same shaders, their layouts will be considered different when matching bind groups. A bind group created for a pipeline with an automatic layout will therefore only be valid for that pipeline.
- The compiler may eliminate bindings and groups during shader module optimization if it determines they are not accessed from any part of the code. This may result in unexpected errors during bind group creation after commenting out a single line of code in a shader.
- Sometimes the default layout is not what you want. A shader with a `texture_2d<f32>` will result in a layout that requires a filterable texture. However, some textures are not filterable by default and will result in an error when creating the bind group. There is no other way than to manually specify a non-filtering sampler and an unfilterable texture.

### Exercises

- Pass the color for the square as a uniform variable and output it from the fragment shader. You can store the color in the same uniform buffer, a separate uniform buffer in the same bind group, or in a separate bind group.

## Part 8 - Animation

Up until now, our application has rendered the square only once, but for animation, you need to create a loop that will first update the square’s transformation and then render it again with the updated transformation. You will need to put the rendering code (everything between `device.createCommandEncoder` and `device.queue.submit`, inclusively) into a function that will be called multiple times (typically 60 times) per second:

```js
function frame(time) {
    // <rendering code>
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

The function `requestAnimationFrame` tells the browser you want it to call the supplied function before the next repaint. The frequency of such calls will generally match the display refresh rate (typically 60 Hz, but can also be higher). Keep in mind that the browser does not trigger animation frames in background tabs.

Note that the function `frame` in the above code expects a `time` parameter, which is supplied by the browser on every animation frame, and represents the time in milliseconds from the page refresh. We will use it for animation.

If you want your square to slowly rotate, you can calculate a rotation matrix with an angle that depends on `time`. Update the matrix on every frame before rendering:

```js
const c = Math.cos(time / 1000);
const s = Math.sin(time / 1000);
const matrix = new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
]);
device.queue.writeBuffer(uniformBuffer, 0, matrix);
```

### Exercises

- Write an animation that follows a circular path around the center of the screen.

## Part 9 - Textures and samplers

Watching a uniformly colored red square is getting a bit boring. Let's apply a 2D texture to it. The same techniques we will develop in this part can later be applied to 3D models.

**Textures** are 1D, 2D, or 3D arrays of data which can contain multiple values per element to represent things like colors or surface normals. You can also think of textures as multivariate vector-valued functions that can be sampled in shaders and written to by render pass outputs. Most commonly, textures are 2D images that represent surface color. Internally, textures are often stored in GPU memory with a layout optimized for multidimensional access rather than linear access.

### Downloading and decoding the image

First, select an image and save it in the project directory. We chose `brick.png` in our example. The image should not be too large both in terms of resolution and in terms of file size. For most use cases, a 512 × 512 will suffice. Although the resolution can be arbitrary, it's best to stick to powers of 2 and square shapes for memory efficiency.

In the `main.js` file, download the image from the server:

```js
const bitmap = await fetch('brick.png')
    .then(response => response.blob())
    .then(blob => createImageBitmap(blob));
```

In the above code, the image is fetched from the server, extracted from the server's response and then decoded using the `createImageBitmap` function, which instructs the browser to decode the image to an uncompressed form suitable for transfer to the GPU. Both fetching and decoding are potentially time-consuming operations and thus asynchronous.

### Creating the texture

After fetching the image from the server, you need to transfer it to the graphics card. First, you need to create a texture object with the appropriate size and format, while also specifying its intended usage:

```js
const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_DST,
});
```

You can obtain the texture's size directly from the downloaded image through `bitmap.width` and `bitmap.height`.

We chose the `rgba8unorm` format, which assigns four color channels to the texture, each represented by an 8-bit unsigned integer. The `norm` suffix will be important in the shader when we sample the texture, as it maps (i.e., *normalizes*) the selected data type's range (in this case 0–255) to the unit floating-point interval (0–1).

Lastly, we specify that the texture will be used in a shader with the `TEXTURE_BINDING` flag. The other two flags, `RENDER_ATTACHMENT` and `COPY_DST`, are required as we will copy our external image to the texture. You may find it strange that we have to include the `RENDER_ATTACHMENT` flag. This is because the copy process may be implemented behind the scenes in the browser as a render operation.

Next, transfer the image from main memory to the texture in GPU memory:

```js
device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: texture },
    [bitmap.width, bitmap.height]);
```

The three parameters in the above command specify the source, destination, and the size of the region you want to transfer. The configuration objects involved in the command can get rather involved if you need precise control over the source and destination regions, including targeting specific mipmap levels, or over any color conversions the browser might apply during the transfer. In this code, however, we mostly rely on the default settings, which are already optimized for transferring 2D color images. Thus, the origin of both the source and destination default to the upper left corner, we are targeting mipmap level 0 in the texture, and the bitmap image is assumed to be in sRGB color space.

Another command to copy data to a texture is `writeTexture`, which is useful when your data is in the form of an `ArrayBuffer`. The two commands are similar, but you have to explicitly describe the shape of the source image and its layout in the `ArrayBuffer`.

### Sampler

When you sample the texture in the shader, the GPU typically performs a much more involved operation than just reading a single texel from memory. It may take advantage of different mip levels, perform filtering, and use special address modes to handle out-of-range texture coordinates.

A basic **sampler** that makes use of default settings, can be created like this:

```js
const sampler = device.createSampler();
```

If you want to use a different address mode or a filter, you can pass these options like this:

```js
const sampler = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
});
```

This code would create a sampler that repeats the texture indefinitely across the texture space, applies linear interpolation between the texels, and also linearly blends between mipmap levels. Keep in mind that not all of these settings are available for all texture formats. For example, floating-point textures are not filterable or blendable by default.

### Shader connection

In the shader, we add the texture and sampler as external resources by assigning them a group and binding number:

```wgsl
@group(0) @binding(1) var texture: texture_2d<f32>;
@group(0) @binding(2) var textureSampler: sampler;
```

The data type `texture_2d<f32>` reflects the texture's dimension and data type, while samplers only have a single type `sampler` (let's ignore comparison samplers for now).

For simplicity, we just reuse the same group that we've already used for the uniform buffer. In a practical application, you would probably want to separate bindings that belong to the model (uniform buffer) and those that belong to the material (texture and sampler).

Next, include the texture and sampler in the bind group with corresponding binding numbers:

```js
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: uniformBuffer },
        { binding: 1, resource: texture },
        { binding: 2, resource: sampler },
    ],
});
```

The texture binding actually expects a *texture view*, which is a subset of the texture subresources (mipmaps, array layers, etc.), but fortunately WebGPU provides sensible shortcuts for common usage patterns.

In the fragment shader, instead of using a fixed color, sample the color from the texture with the `textureSample` function:

```wgsl
@fragment
fn fragment() -> @location(0) vec4f {
    return textureSample(texture, textureSampler, vec2f(0, 0));
}
```

The function expects the texture to sample from, the sampler to use for this sampling operation, and the **texture coordinates**, which define the sampling position in the texture space.

The texture space is normalized such that the origin (0, 0) is at the top-left corner of the texture, and the bottom-right corner is at the point (1, 1).

In the above code, we just sampled the texture at the top-left corner for every fragment, so we still get a square filled with single color. You can use the built-in `position` variable (which is different from the built-in `position` that was output from the vertex shader) to create something slightly more interesting:

```wgsl
@fragment
fn fragment(@builtin(position) position: vec4f) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, position.xy / 1000);
}
```

The `position` variable stores the fragment's position on the screen, its depth, and perspective divisor.

Later we will provide external texture coordinates to the fragment shader to have more precise control over the mapping.

### Exercises

- Play around with different (fixed) texture coordinates and observe which color is sampled from the texture. Can you notice anything strange happening in the Y direction?
- Transform the built-in `position` variable into polar coordinates and use those as texture coordinates.
- Write a function that creates a colored random noise image in an `ArrayBuffer` and use `writeTexture` to transfer that data to the texture. The size of the texture will be passed as an argument to the function.
- Create two textures and bind them both th+o the shader. In the fragment shader, sample both of them and mix the colors.

## Part 10 - Inter-stage interpolation

The vertex and fragment shader can communicate through special variables called **interpolants** or **inter-stage variables**. Since we are working with a pipeline, this is a one-way communication. Interpolant values are assigned in the vertex shader and read in the fragment shader. Between the stages, the GPU interpolates the values during rasterization depending on the vertex positions.

Since interpolation is such a common operation in computer graphics, it is usually implemented in hardware for greater efficiency. You only need to specify the variables whose values you want to interpolate, and WebGPU does all the hard work for you.

Since functions cannot return multiple values, we need to be a bit clever and modify the shader so that it outputs a **structure** of values:

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4f,
};

@vertex
fn vertex(@location(0) position: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.position = matrix * vec4f(position, 0, 1);
    return output;
}
```

Now you can reuse (abuse?) the same structure for the input of the fragment shader:

```wgsl
@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, input.position.xy / 1000);
}
```

The built-in `position` variable will be used as the output clip position in the vertex shader, and as the fragment position in the fragment shader.

You can now add any member variable to the `VertexOutput` structure and it will act as an interpolant as long as you decorate it with a location. For example, you can interpolate texture coordinates like this:

```wgsl
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@location(0) position: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.position = matrix * vec4f(position, 0, 1);
    output.texcoords = position * 0.5 + 0.5;
    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, input.texcoords);
}
```

The location can be an arbitrary number, but both shaders must use the same number. Interpolants are linked based on their locations, not their names, so you could use a different structure with completely different names for the fragment shader input and it would work as long as there was a corresponding input interpolant for every output interpolant and their types matched.

In the above code, we simply wrote the (transformed) position attribute into the interpolant, which is not flexible at all. In the next part, we will add a new attribute to the vertices.

### Exercises

- In addition to texture coordinates, interpolate a color variable and multiply it with the color sampled from the texture in the fragment shader.

## Part 11 - A new attribute

Adding a new attribute is as trivial as updating the vertex buffer and its layout, and reflecting these changes in the shader.

Let's start with the shader. Add the new attribute as an input variable to the vertex shader:

```wgsl
fn vertex(@location(0) position: vec2f, @location(1) texcoords: vec2f) -> VertexOutput
```

Now you can copy this value to the interpolant:

```wgsl
output.texcoords = texcoords;
```

That's it for the shader! Continue with the vertex buffer and add two values for each vertex:

```js
const vertexArray = new Float32Array([
    -0.5, -0.5, 0, 1,
     0.5, -0.5, 1, 1,
    -0.5,  0.5, 0, 0,
     0.5,  0.5, 1, 0,
]);
```

In the above code, you can see that we have interleaved positions and texture coordinates. This is commonly done to prevent additional memory fetches, since both attributes for a single vertex are probably going to end up in the same cache line. Sometimes it's better not to do this, especially if access patterns for different attributes are different.

Now update the vertex buffer layout. Each vertex is now offset 16 bytes from the last one, so `arrayStride` must be 16. We have two attributes, so add a second descriptor to the `attributes` array. The new attribute is using location 1 (as in the shader), it is offset by 8 bytes from the start of the buffer, and it is a vector of two 32-bit floating-point numbers, so its format is `float32x2`. This is the resulting layout:

```js
const vertexBufferLayout = {
    arrayStride: 16,
    attributes: [{
        format: 'float32x2',
        offset: 0,
        shaderLocation: 0,
    }, {
        format: 'float32x2',
        offset: 8,
        shaderLocation: 1,
    }],
};
```

### Exercises

- Add a color attribute and assign each vertex a different color. You can use floats and simply extend the array just like with texture coordinates. Add a new interpolant to interpolate colors across triangles.
- Using floats for colors is very wasteful. Modify the vertex buffer and its layout from the last exercise to use 8-bit unsigned integers for color components. You will need to create a single `ArrayBuffer` and then create two different views into it (`Float32Array` and `Uint8Array`), but you can also use a single `DataView`. You will probably want the integer values to be normalized before they get to the shader, so use `unorm8x4` as the attribute format.

## Part 12 - Jump in 3D

At this point, almost everything is ready to make the leap into three dimensions. As you may have already guessed, the shaders are already doing operations in 3D with homogeneous coordinates, and the only thing preventing us from displaying proper 3D models in our application is that the vertex positions should also be 3D.

Add the third coordinate to vertex positions:

```js
const vertexArray = new Float32Array([
    -0.5, -0.5, 0,    0, 1,
     0.5, -0.5, 0,    1, 1,
    -0.5,  0.5, 0,    0, 0,
     0.5,  0.5, 0,    1, 0,
]);
```

Update the vertex buffer layout accordingly (use the `float32x3` format), paying attention to offsets and stride:

```js
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
```

Now update the vertex shader, so that the position attribute is of type `vec3f` and the new value is correctly used in the code:

```wgsl
fn vertex(@location(0) position: vec3f, @location(1) texcoords: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.position = matrix * vec4f(position, 1);
    output.texcoords = texcoords;
    return output;
}
```

The resulting code should display the rotating square just as before. To see some depth, you can also make the square spin around the vertical axis by modifying the rotation matrix:

```js
const matrix = new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
]);
```

Surprisingly, the result is probably not what you expected. The application displays only half of the square being squished in the horizontal direction. The square is actually rotating around the vertical axis, but since we have not used a perspective projection, it just appears to be scaled horizontally. You can quickly add some "fake" perspective by adding the following line to the vertex shader:

```wgsl
output.position.w = 1 + output.position.z;
```

This will cause the homogeneous coordinate to depend on the depth, and so the vertices that have a greater `z` coordinate will be squished more during perspective division.

However, half of the square is still missing, and this is due to how WebGPU treats output vertex positions. Your vertex shader outputs positions in **clip space**, and the GPU then applies perspective division to produce **normalized device coordinates (NCD)**. In NDC, everything inside the box with corners `(-1, -1, 0)` and `(1, 1, 1)` is displayed on the screen, and everything else is discarded.

Since our square is spinning around the vertical axis, one half of the square is almost always at z < 0 and thus discarded.

To fix this, we can play around with the output positions, but it is much wiser to construct a proper transformation matrix, which is what we'll do in the next part.

## Part 13 - Proper transformations

Let's write a module for manipulating matrices. In a serious project, you would probably want to use an optimized and full-featured library like [glMatrix](https://glmatrix.net/), but we only need a function for multiplying matrices and a few constructors for most common transformations, such as translations, rotations, and projections.

Create a file named `mat.js` and write the function for multiplying two matrices (keep in mind that we must store the matrices in column-major order), and a convinience function for multiplying any number of them:

```js
export function multiply2(A, B) {
    const C = Array.from({ length: B.length }, () => Array(A[0].length).fill(0));
    for (let j = 0; j < B.length; j++) {
        for (let i = 0; i < A[0].length; i++) {
            for (let k = 0; k < A.length; k++) {
                C[j][i] += A[k][i] * B[j][k];
            }
        }
    }
    return C;
}

export function multiply(...matrices) {
    return matrices.reduce((a, b) => multiply2(a, b));
}
```

Now write a function to write a matrix in a `Float32Array` that can be written to a WebGPU buffer:

```js
export function toF32(m) {
    return new Float32Array(m.flat());
}
```

Now you can write constructor functions for common transformation matrices.

Here's a function that constructs a perspective projection matrix given the vertical field of view, aspect ratio, and the near and far planes:

```js
export function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    return [
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, far / (near - far), -1],
        [0, 0, near * far / (near - far), 0],
    ];
}
```

And here's an even simpler function for translation:

```js
export function translation(x, y, z) {
    return [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [x, y, z, 1],
    ];
}
```

Lastly, here's a function that converts a unit quaternion to a rotation matrix:

```js
export function rotation(x, y, z, w) {
    return [
        [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y), 0],
        [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x), 0],
        [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y), 0],
        [0, 0, 0, 1],
    ];
}
```

This one is more useful with a convenience function that creates a rotation quaternion from a rotation axis and angle:

```js
export function axisAngle([x, y, z], angle) {
    const c = Math.cos(angle / 2);
    const s = Math.sin(angle / 2) / Math.hypot(x, y, z);
    return rotation(x * s, y * s, z * s, c);
}
```

At this point, you can replace the handcrafted matrix in `main.js` with these function from `mat.js` module to simplify the code a bit. First, import the module at the start of `main.js`:

```js
import * as mat from './mat.js';
```

Split the transformation into three matrices, as is common in computer graphics: model, view, and projection. The model matrix is just a rotation matrix around the axis `(0, 1, 0)`:

```js
const modelMatrix = mat.axisAngle([0, 1, 0], t / 1000);
```

The view matrix is the inverse transformation of the camera. We must move the camera back a bit, say 5 units, so the inverse translation is by the vector `(0, 0, -5)`:

```js
const viewMatrix = mat.translation(0, 0, -5);
```

Lastly, construct the projection matrix such that the square will sit between the near and far planes:

```js
const projectionMatrix = mat.perspective(1, canvas.width / canvas.height, 0.1, 10);
```

We set the field of view at 1 radian, which is around 60 degrees. The aspect ratio is calculated from the size of the canvas.

Now you need to multiply the matrices in the correct order and write the result into the uniform buffer:

```js
const matrix = mat.multiply(projectionMatrix, viewMatrix, modelMatrix);
device.queue.writeBuffer(uniformBuffer, 0, mat.toF32(matrix));
```

You should see your square rotating in beautiful perspective projection.

### Exercises

- Write a constructor for a scaling matrix and add it to the model transformation to make the square periodically stretch and contract like pickups in many video games.
- Write a constructor for an orthographic projection matrix and try to interpolate between perspective and orthographic matrices.
- Transformations in video games are often rigid, i.e., composed only of rotations and translations. Write a module to work with rigid transformations and write functions to combine them and retrieve their forward and inverse matrix representations.

## Part 14 - Loading an external 3D model

Now you are almost ready to render any 3D model you like! The application currently displays a hardcoded model, but since you know how to format the vertex buffer and how to adjust its layout, loading a 3D model from an external file should be a breeze.

One of the simplest and most common open file formats for describing 3D models is *Wavefront's OBJ*. It's a text file that, in its most simple form, contains a list of positions, texture coordinates, normals, and faces, separated by newlines.

You can parse attributes like this:

```js
const lines = text.split('\n');
const parseBlock = prefix => lines
    .filter(line => line.startsWith(prefix))
    .map(line => line.slice(prefix.length).trim().split(/\s+/));

const positions = parseBlock('v ').map(line => line.map(Number));
const texcoords = parseBlock('vt ').map(line => line.map(Number));
const normals = parseBlock('vn ').map(line => line.map(Number));
```

Faces, however, are more complicated, since they can reference positions, texture coordinates, and normals with *different* indices separated by forward slashes. Furthermore, faces can be arbitrary polygons, so you have to triangulate them for WebGPU:

```js
const triangulate = f => f.slice(2).flatMap((_, i) => [f[0], f[i + 1], f[i + 2]]);
const faces = parseBlock('f ')
    .map(line => line.map(face => face.split('/').map(Number)))
    .flatMap(triangulate);
```

The last trick is to construct vertices by combining the attributes and to reuse the same vertex when it appears in a face:

```js
const vertices = [];
const indices = [];
const idToIndex = {};

for (const face of faces) {
    const id = face.join('/');
    if (id in idToIndex) {
        indices.push(idToIndex[id]);
    } else {
        idToIndex[id] = vertices.length;
        indices.push(vertices.length);
        vertices.push({
            position: positions[face[0] - 1],
            texcoords: texcoords[face[1] - 1],
            normal: normals[face[2] - 1],
        });
    }
}
```

Note that indices in OBJ start at 1.

Put the code in a `parse` function in a file named `obj.js`.

Now choose your favorite OBJ model and copy it into the project directory. If you don't have one at hand, you can use your favorite 3D modeling software, which likely includes an OBJ exporter, and use it to export a simple model. We will use Blender and export its default cube to `cube.obj`.

In `main.js`, import the OBJ module at the start of the file:

```js
import * as obj from './obj.js';
```

Load and parse the model from `cube.obj`:

```js
const { vertices, indices } = obj.parse(
    await fetch('cube.obj').then(response => response.text()));
```

Now get rid of the existing `vertexArray` and replace it an appropriately sized one and fill it with vertex data according to the vertex buffer layout:

```js
const vertexArray = new Float32Array(vertices.length * 5);
for (let i = 0; i < vertices.length; i++) {
    const { position, texcoords } = vertices[i];
    vertexArray.set(position, i * 5);
    vertexArray.set(texcoords, i * 5 + 3);
}
```

Creating the index array is much simpler:

```js
const indexArray = new Uint32Array(indices);
```

The updated code should load and render the OBJ model. But it likely looks a bit weird, as if WebGPU doesn't know what should be in front ...

### Exercises

- Write a PLY parser. PLY has been created to support arbitrary attributes and to generalize the notions of vertices, faces, and other associated data. The format stores data similarly to how we expect it in WebGPU, so it should be even easier to parse than OBJ.

## Part 15 - Fixing the depth

As you may have noticed, the triangles overlap incorrectly. This is because WebGPU is required to render them in the order they are given in the index buffer. This problem is most commonly fixed with a **depth texture**. The depth texture stores the depth of each pixel, as calculated during rasterization. When a new fragment is produced and its depth is larger than the depth stored in the depth texture, the fragment is discarded. Otherwise, the fragment is stored and the depth texture is updated accordingly. This is a common approach in computer graphics, so these operations are typically hardware-supported.

The fix involves creating an appropriately sized depth texture, enabling and configuring the depth test, and clearing the depth texture before each render pass.

First, create the depth texture that is the same size as the canvas:

```js
const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage:
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.TRANSIENT_ATTACHMENT,
});
```

The above code uses the `depth24plus` format, which stores depth values either as a 24-bit integers or 32-bit floating point numbers, whichever is preferred by the hardware.

We also specified that the texture will be used as a `RENDER_ATTACHMENT`. The `TRANSIENT_ATTACHMENT` flag is a hint to the device, that the contents of the texture will be discarded after rendering, so the implementation can optimize certain operations. You can only use this flag with `loadOp: 'clear'` and `storeOp: 'discard'`.

Next, enable and configure the depth test in the pipeline:

```js
const pipeline = device.createRenderPipeline({
    ...
    depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
    },
    ...
});
```

We are using the intuitive approach, where bigger values represent things further away from the camera, so we set `depthCompare: 'less'`. There are better approaches, though, such as reverse-z.

Lastly, we attach the depth texture in the render pass like this:

```js
const renderPass = commandEncoder.beginRenderPass({
    ...
    depthStencilAttachment: {
        view: depthTexture,
        depthLoadOp: 'clear',
        depthClearValue: 1,
        depthStoreOp: 'discard',
    },
    ...
});
```

And that's it! The 3D model should now be rendered correctly.

### Exercises

- Implement reverse-z depth mapping. You will need to modify the projection matrix, clear depth to 0 instead of 1, and switch the depth compare operation to `greater`. Also make sure that you're using `depth32float` as the texture format, as reverse-z makes no sense with integer formats.
