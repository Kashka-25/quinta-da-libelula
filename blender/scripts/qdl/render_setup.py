"""Render settings, tuned for a laptop with integrated graphics."""
import bpy

from .common import FPS, T, f

PRESETS = {
    # name: (width, height, eevee samples, volumetric tile size)
    'draft': (960, 540, 8, 16),
    'preview': (1280, 720, 16, 8),
    'final': (1920, 1080, 32, 8),
    'portrait': (1080, 1920, 32, 8),
}


def apply(preset='preview'):
    sc = bpy.context.scene
    w, h, samples, tile = PRESETS[preset]
    r = sc.render
    r.engine = 'BLENDER_EEVEE'
    r.resolution_x, r.resolution_y = w, h
    r.resolution_percentage = 100
    r.fps = FPS
    sc.frame_start = 1
    sc.frame_end = f(T['end'])
    e = sc.eevee
    e.taa_render_samples = samples
    e.use_raytracing = True
    e.volumetric_tile_size = str(tile)
    e.volumetric_samples = 48
    e.volumetric_end = 40
    e.use_volumetric_shadows = True
    e.use_shadows = True
    e.shadow_pool_size = '1024'
    e.clamp_surface_indirect = 10
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    r.image_settings.file_format = 'JPEG'
    r.image_settings.quality = 92
    r.use_motion_blur = False
    if preset == 'portrait':
        sc.camera.data.sensor_fit = 'HORIZONTAL'
