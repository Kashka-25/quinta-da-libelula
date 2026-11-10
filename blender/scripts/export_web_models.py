"""Export light, rigged versions of both Meshy dragonflies for the website.

    blender -b -P blender/scripts/export_web_models.py -- [--tris 70000] [--tex 1024]

Writes public/models/dragonfly-original.glb and public/models/dragonfly-reborn.glb:
decimated, with the same auto-rig as the film (wings, abdomen, head) and smaller
WebP textures. The site animates the bones itself, so no animation is exported.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from qdl import dragonfly  # noqa: E402
from qdl.common import BLENDER_DIR, SOURCE  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
TRIS = int(args[args.index('--tris') + 1]) if '--tris' in args else 70000
TEX = int(args[args.index('--tex') + 1]) if '--tex' in args else 1024
OUT = os.path.normpath(os.path.join(BLENDER_DIR, '..', 'public', 'models'))
os.makedirs(OUT, exist_ok=True)

for src, name, out in (('dragonfly_meshy.glb', 'Original', 'dragonfly-original.glb'),
                       ('dragonfly_reborn_meshy.glb', 'Reborn', 'dragonfly-reborn.glb')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(SOURCE, src)
    # count triangles first so the ratio lands near the target
    ob = dragonfly.import_glb(path, 'Dragonfly_' + name, 1.0)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    bpy.data.objects.remove(ob)
    ratio = min(1.0, TRIS / tris)
    ob = dragonfly.import_glb(path, 'Dragonfly_' + name, ratio)
    co, wing, fore, info = dragonfly.analyse(ob)
    rig = dragonfly.build_rig(ob, co, wing, fore, info, 'Dragonfly_' + name)
    # keep only what the web needs: the wing mask travels as a custom attribute
    me = ob.data
    for a in list(me.attributes):
        if a.name in ('span', 'fore', 'melt_order'):
            me.attributes.remove(a)
    me.attributes['wing'].name = '_wing'
    for img in bpy.data.images:
        if img.size[0] > TEX:
            img.scale(TEX, TEX)
    for o in bpy.context.scene.objects:
        o.select_set(o in (ob, rig))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, out),
        export_format='GLB',
        use_selection=True,
        export_skins=True,
        export_animations=False,
        export_attributes=True,
        export_image_format='WEBP',
        export_image_quality=82,
        export_apply=False,
        export_yup=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_generic_quantization=10,
    )
    print('[web] %s: %d -> %d tris, %d KB' % (out, tris, sum(len(p.vertices) - 2 for p in me.polygons), os.path.getsize(os.path.join(OUT, out)) // 1024))
