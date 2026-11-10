"""Build the whole Quinta da Libélula dragonfly film from the two Meshy models.

    blender -b -P blender/scripts/build_scene.py -- [--decimate 0.25] [--no-save]

Safe to re-run: starts from an empty file every time and saves
blender/dragonfly_transformation.blend.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from qdl import cinema, env, render_setup  # noqa: E402
from qdl.common import BLEND_PATH, CENTER, SOURCE, T, f, smooth  # noqa: E402
from qdl import dragonfly, performance  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ratio = float(args[args.index('--decimate') + 1]) if '--decimate' in args else 0.25
stage = args[args.index('--stage') + 1] if '--stage' in args else 'all'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.name = 'Dragonfly_Transformation'

env.build()

orig, orig_rig, _ = dragonfly.prepare(os.path.join(SOURCE, 'dragonfly_meshy.glb'), 'Dragonfly_Original', ratio, 'original')
melt_mod = dragonfly.add_melt(orig)
performance.animate_original(orig_rig, orig, melt_mod, melt_mod.node_group)

liquid_mat = dragonfly.liquid_material()
reborn_transform = None

if stage in ('all', 'liquid', 'reborn'):
    from qdl import chrysalis, liquid
    chrys = chrysalis.build()
    liquid.build(orig, liquid_mat, chrys)

if stage in ('all', 'reborn'):
    from qdl import rebirth
    reborn, reborn_rig, _ = dragonfly.prepare(os.path.join(SOURCE, 'dragonfly_reborn_meshy.glb'), 'Dragonfly_Reborn', ratio, 'reborn')
    reborn_transform = rebirth.animate(reborn, reborn_rig)


def subject(t):
    if t < T['melt']:
        return performance.original_transform(t)[0]
    if t < T['emerge'] or reborn_transform is None:
        return CENTER.copy()
    return reborn_transform(t)[0]


cam = cinema.camera(subject)
if stage == 'all':
    cinema.liquid_wave(liquid_mat)
    cinema.ivory_settle(cam)

render_setup.apply('preview')
sc.frame_set(1)
if '--no-save' not in args:
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH, compress=True)
    print('[build] saved', BLEND_PATH)
