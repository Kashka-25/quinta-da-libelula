"""Render chosen moments (seconds) or a frame range from the saved film.

    blender -b blender/dragonfly_transformation.blend -P blender/scripts/render_frames.py -- --preset draft --at 2 3.8 6
    blender -b blender/dragonfly_transformation.blend -P blender/scripts/render_frames.py -- --preset final --range 1 648 --out <dir>
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from qdl import render_setup  # noqa: E402
from qdl.common import RENDERS, f  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default=None, n=1):
    if name not in args:
        return default
    i = args.index(name)
    return args[i + 1:i + 1 + n] if n > 1 else args[i + 1]


preset = opt('--preset', 'draft')
out = opt('--out', os.path.join(RENDERS, preset))
os.makedirs(out, exist_ok=True)
render_setup.apply(preset)
sc = bpy.context.scene

frames = []
if '--at' in args:
    i = args.index('--at') + 1
    while i < len(args) and not args[i].startswith('--'):
        frames.append(f(float(args[i])))
        i += 1
elif '--range' in args:
    a, b = opt('--range', n=2)
    frames = list(range(int(a), int(b) + 1))

for fr in frames:
    path = os.path.join(out, 'f%04d.jpg' % fr)
    if '--resume' in args and os.path.exists(path):
        continue
    t0 = time.time()
    sc.frame_set(fr)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('[render] frame %d in %.1fs' % (fr, time.time() - t0), flush=True)
