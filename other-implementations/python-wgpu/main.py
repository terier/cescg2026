import wgpu
import rendercanvas.auto


adapter = wgpu.gpu.request_adapter_sync()
device = adapter.request_device_sync()

canvas = rendercanvas.auto.RenderCanvas(title="WebGPU")
context = canvas.get_wgpu_context()
texture_format = context.get_preferred_format(device.adapter)
context.configure(device=device, format=texture_format)


with open('shader.wgsl', 'r', encoding='utf-8') as shader_file:
    shader = shader_file.read()
module = device.create_shader_module(code=shader)
pipeline = device.create_render_pipeline(
    layout='auto',
    vertex={
        'module': module
    },
    fragment={
        'module': module,
        'targets': [
            {
                'format': texture_format
            }
        ]
    }
)


def draw_frame():
    command_encoder = device.create_command_encoder()
    output_texture = context.get_current_texture()
    output_view = output_texture.create_view()
    
    render_pass = command_encoder.begin_render_pass(
        color_attachments=[
            {
                "view": output_view,
                "resolve_target": None,
                "clear_value": (1, 0, 0, 1),
                "load_op": wgpu.LoadOp.clear,
                "store_op": wgpu.StoreOp.store,
            }
        ],
    )
    render_pass.set_pipeline(pipeline)
    render_pass.draw(3)
    render_pass.end()
    
    device.queue.submit([command_encoder.finish()])
    
    canvas.request_draw()

canvas.request_draw(draw_frame)
rendercanvas.auto.loop.run()