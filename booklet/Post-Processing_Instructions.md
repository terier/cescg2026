# An Introduction to Post-Processing with WebGPU

Now that we know how to render a scene to a canvas via the WebGPU API, we can try some more advanced rendering techniques. Here, we will create a simple blur effect over our rendered scene. While this is a rather specific and basic use of post-processing, it demonstrates how to use different render passes, texture management, and shaders to build a post-processing pipeline. With some shader magic and clever texture binding, much more complex and useful effects can be achieved. Let's dive in!

## 1. Getting started

We will start with the code from task 15. We should be able to render a rotating cube to the canvas and see it in our browser.

## 2. The battle plan

We should consider how our programme will flow. Our goal is to display a blurred scene (in this case, a rotating cube on a yellow background). Currently, we render our scene directly to the canvas, but to perform post-processing, we need to insert a few extra steps into our rendering procedure.

The scene should be rendered to a texture, which we then blur. Because we cannot just read from and write to the same texture simultaneously, we should store the blurred result in another texture. We will perform our blur in two passes: first along the X axis, then along the Y axis, to save performance. Finally, we will write the result to the canvas.

To recap, we will need three textures:
1. One to draw the scene on.
2. One to store the result of the horizontal blur.
3. One that is bound to the canvas and will store the result of the vertical blur.

We will use the same format for all three textures, so we can have a single pipeline for our blur effect. This means all our textures will use the format of the canvas texture. That format may not be filterable, so our samplers can only use the 'nearest' option for filtering. Sometimes this is sufficient, but if linear filtering is necessary, we would need to choose appropriate formats for our textures and have a separate final pipeline and render pass to render to our canvas texture. Also note that in the shader, we will assume that the colour components are floats, which may be format-dependent as well.

We will also need a new shader for blurring, and the corresponding render pipeline. To use textures in shaders, we must create bind groups. We will add two new render passes to match our list of texture operations above.

Let's get started.

## 3. Creating the shader

We will write the shader first to determine what we actually need to provide to it in our CPU code. Our goal here is not to create a sophisticated, high-quality blurring effect, but to understand how the sausage is made. Therefore, we will simply read the texture at the current pixel and average its value with those of its _n_ neighbours. This should give us a decent blur and remain relatively simple. For a more advanced effect, you can implement a Gaussian blur or another approach later.

Our shader will assign colour to fragments of triangles. Since we want to colour the pixels of our view, we will create a rectangle (composed of two triangles) that covers our view, and draw the input texture onto it.

Let's add our vertex shader boilerplate. Create a new WGSL file and fill it with the code below.

```wgsl
struct VertexOutput {
    @builtin(position) clipPosition: vec4f,
    @location(1) texcoords: vec2f,
};

@vertex
fn vertex(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = vec4f(0.0);
    output.texcoords = vec2f(0.0);
    return output;
}
```

This should look familiar. First, we define our vertex output, consisting of a vertex clip position and its corresponding texture coordinate. Then we create the main function, where we set all outputs to zero for now.

Now let us add the fragment shader boilerplate.

```wgsl
@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return vec4f(0.0, 0.0, 1.0, 1.0);
}
```

There is nothing notable here either. If this shader were to run, all fragments would be coloured blue.

Now, let us consider what we actually need to cover our entire view. We could define vertices on the CPU, copy them to a vertex buffer, and read from that, but for this workshop, we will simplify. We will hardcode our vertices and coordinates in the shader.

The code below should be placed at the top of the file.

```wgsl
const SCREEN_VERTICES = array(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0)
);
const SCREEN_TEXCOORDS = array(
    vec2f(0.0, 0.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0),
    vec2f(1.0, 1.0),
    vec2f(0.0, 1.0),
    vec2f(1.0, 0.0)
);
```

These arrays hardcode the vertex positions and UV coordinates of two triangles spanning the whole screen. Positions are written in normalised device coordinates, with the Z coordinate omitted as it is always the same.

Now, let us update our vertex shader to process these vertices. Our built-in `vertexIndex` parameter provides the index of the draw invocation. In this case, we will request six draws, resulting in indices from 0 to 5. We can index our arrays using `vertexIndex` as follows:

```wgsl
@vertex
fn vertex(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.clipPosition = vec4f(SCREEN_VERTICES[vertexIndex], 0.0, 1.0);
    output.texcoords = SCREEN_TEXCOORDS[vertexIndex];
    return output;
}
```

## 4. Creating the pipeline

Let us extend our code in the `main.ts` file to construct the required pipeline.

Fetch the shader code from the file and construct a shader module. Then create a pipeline with vertex and fragment entries, and an 'auto' layout. As noted earlier, all our textures will have the same format, so whichever we write to, it will always use the canvas texture format. We can obtain it via `context.getCurrentTexture().format`.

The following code should be placed after the scene initialisation, but before the render loop.

```ts
const code = await fetch('blur_shader.wgsl').then(response => response.text());
const module = device.createShaderModule({ code });
const blurPipeline = device.createRenderPipeline({
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
```

## 5. Adding textures

One of our three textures already exists: the one we retrieve from our context using the `getCurrentTexture` method. When we draw to this texture, we draw directly to the canvas, so this will be our final texture. Since we do not need to read from it at any point, we will not create any bind groups for it. We simply keep in mind that this is our final texture.

Now for the remaining textures: let us create them after our blur pipeline. Due to a lack of imagination, in these instructions the textures are named `intermediateTexture1` and `intermediateTexture2`. We use the same size and format as our canvas texture. Since we will render to them and also read from them in the shader as bindings, their usage flags should be `GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING`.

```ts
const intermediateTexture1 = device.createTexture({
    size: [context.canvas.width, context.canvas.height],
    format: context.getCurrentTexture().format,
    usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
});
const intermediateTexture2 = device.createTexture({
    size: [context.canvas.width, context.canvas.height],
    format: context.getCurrentTexture().format,
    usage:
 GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
});
```

We will eventually render to these textures, so we need texture views. You may have noticed that when rendering to the canvas texture, we create the texture view each time we execute the render pass, because this is a new texture each frame. Our intermediate textures are persistent, so there is no need to burden the garbage collector by creating a new view each frame. We can create them here, after creating the textures.

```ts
const intermediateTextureView1 = intermediateTexture1.createView();
const intermediateTextureView2 = intermediateTexture2.createView();
```

Also, create the sampler:

```ts
const samplerNoFilter = device.createSampler({
    minFilter: 'nearest',
    magFilter: 'nearest'
});
```

## 6. Update render passes

Let us fix rendering. We would like to perform a sanity check as soon as possible, so let us just make the first render pass (the one that renders our rotating cube) draw to one of the intermediate textures, and create a second render pass that draws to the canvas.

Add the following after the existing render pass, but before submitting the command buffer to the queue:

```ts
const blurRenderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: [0, 0, 0, 1],
        storeOp: 'store',
    }]
});
blurRenderPass.setPipeline(blurPipeline);
blurRenderPass.draw(6);
blurRenderPass.end();
```

Also, modify the first render pass and **change the colour attachment to the first intermediate texture view**.

## First Checkpoint

If we view our web page, we should see the screen coloured blue, as encoded in our blur fragment shader.

## 7. Copying the intermediate texture

Let us fix our blue screen by drawing our rotating cube onto the canvas texture instead. In our new shader, we will read the texture and draw its colour.

Extend the new shader with a bind group that holds our texture and its sampler:

```wgsl
@group(0) @binding(0)
var texture: texture_2d<f32>;
@group(0) @binding(1)
var textureSampler: sampler;
```

Then change our fragment shader to sample the texture at the appropriate texture coordinates:
```wgsl
@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    return textureSample(texture, textureSampler, input.texcoords);
}
```

We will create binding groups with our textures and samplers:

```ts
const intermediateBindGroup1 = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: intermediateTexture1 },
        { binding: 1, resource: samplerNoFilter }
    ]
});
const intermediateBindGroup2 = device.createBindGroup({
    layout: blurPipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: intermediateTexture2 },
        { binding: 1, resource: samplerNoFilter }
    ]
});
```

Finally, set the bind group at the render pass:

```ts
blurRenderPass.setBindGroup(0, intermediateBindGroup1);
```

## Second Checkpoint

In our browser, we should now see the spinning cube once more.

## 8. The blur

For each pixel in our render of the scene, we will take its neighbourhood and average it. First, we will do this horizontally. Later, we will add another render pass to blur vertically.

Let us update our shader to sample the pixels. To keep things simple, we will hardcode the size of the neighbourhood for now. Here, we set it to 11, with 5 pixels on each side of the current one.

Since coordinates are relative (from 0 to 1), we need to determine a relative pixel size. The function `textureDimensions(texture)` returns the dimensions of the provided texture, so we can determine the relative pixel size from that. We will use a for-loop to increment our texture coordinates. We compute pixel displacement in each iteration by masking out the dimension we are not blurring (in this case, the Y axis), and multiplying the relative pixel size by the absolute pixel displacement.

```wgsl
@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    const kernelSize = 11;
    const kernelHalfSize = (kernelSize / 2);
    const kernelLeftmostIndex = kernelHalfSize - kernelSize + 1;
    const kernelRightmostIndex = kernelHalfSize;

    let dims = textureDimensions(texture);
    let pixelSize = 1.0 / vec2f(dims);

    let mask = vec2f(1.0, 0.0);

    var sum = vec4f(0);
    for (var i = kernelLeftmostIndex; i <= kernelRightmostIndex; i++) {
        let pixelDisplacement = pixelSize * f32(i) * mask;
        let textureCoordinates = pixelDisplacement + input.texcoords;
        sum += textureSample(texture, textureSampler, textureCoordinates);
    }
    sum /= f32(kernelSize);
    return sum;
}
```

## Third Checkpoint

We should now see the image blurred along the horizontal axis.

## Optional Task #1

We have blurred the image only along one axis. To complete the effect, add another render pass that applies a vertical blur. Follow the subtasks below.

1. Create another render pass. Our shader is the same, so we do not need to create a new pipeline. Use the second intermediate texture to write the first blur pass to it, then set its bind group in the second render pass. The result should be similar to before, but the horizontal blur is applied twice.
2. In the shader, create a new uniform to store the mask that we previously hardcoded in the `mask` variable. Place it in a new group.
3. In the main code, create two uniform buffers. One will store the vector `[1.0, 0.0]`, and the other `[0.0, 1.0]`. You can write the buffers once during the setup stage; there is no need to update them every frame.
4. For the uniform buffers, create corresponding bind groups.
5. In each of the two blur render passes, set the appropriate bind group.

You should now achieve a 2D blur effect!

## Optional Task #2

One way to create stronger blurring is to use a larger kernel. This can drastically reduce the performance of the shader. Instead, we can blur the image with a smaller kernel multiple times to achieve the same effect.

In the main code, place the blurring render passes inside a for-loop. You will need to consider how to switch texture views and bind groups accordingly. You do not need to create any new textures; three should be sufficient.

## Optional Task #3

Currently, the kernel size in our shader is static. Change the shader and the main code so that the kernel size is passed as a uniform to the shader.

Note that you will likely need to change the `textureSample` function for sampling neighbouring pixels to `textureSampleLevel`, because the loop may no longer belong to the uniform control flow. In this case, most function parameters remain the same, but you should add another parameter at the end to specify the texture level at which you are sampling. Set this parameter to 0.
