"""Shared timeline, paths and helpers for the dragonfly transformation film.

Blender is +Z up. The Meshy dragonflies are modelled flat, seen from above:
head toward +Z, wings along X, back (dorsal side) facing -Y. The film keeps
that "emblem" pose for the hover, so the camera looks along +Y.
"""
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER_DIR = os.path.normpath(os.path.join(HERE, '..', '..'))
SOURCE = os.path.join(BLENDER_DIR, 'source')
RENDERS = os.path.join(BLENDER_DIR, 'renders')
BLEND_PATH = os.path.join(BLENDER_DIR, 'dragonfly_transformation.blend')

FPS = 24

# The story, in seconds. Everything keys off these, so timing can be tuned here.
T = {
    'arrive': 0.0,  # Act I: darkness, light, the dragonfly flies in
    'hover': 3.6,  # it rears up and hovers in front of us
    'surrender': 4.6,  # Act II: wings slow, shimmer, fold; body ripples
    'melt': 7.4,  # Act III: molten glass, drips and threads
    'melt_end': 12.6,
    'gather': 12.4,  # Act IV: the liquid spirals up into a chrysalis
    'chrysalis': 15.0,  # chrysalis complete, breathing, glowing
    'crack': 17.0,  # Act VI: golden cracks
    'open': 18.4,  # the bud opens like a lotus
    'emerge': 19.0,  # luminous silhouette rises
    'unfold': 20.4,  # new wings unfold, gold runs along the veins
    'reborn_hover': 22.4,
    'flight': 23.6,  # graceful flight toward and past us
    'wave': 25.0,  # Act V: liquid light wave fills the screen
    'ivory': 26.3,  # the screen settles to the site's ivory
    'end': 27.0,
}

CENTER = Vector((0.0, 0.0, 1.6))  # where the dragonfly hovers and the chrysalis hangs


def f(sec):
    """Seconds to frame number (frame 1 = 0 s)."""
    return int(round(sec * FPS)) + 1


def sec(frame):
    return (frame - 1) / FPS


def smooth(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def ease_io(t):
    t = max(0.0, min(1.0, t))
    return 4 * t * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 3) / 2


def lerp(a, b, t):
    return a + (b - a) * t


def srgb(hexstr, a=1.0):
    """'#rrggbb' to linear RGBA for shader sockets."""
    h = hexstr.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, a)


def collection(name, parent=None):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    par = parent or bpy.context.scene.collection
    if col.name not in par.children:
        par.children.link(col)
    return col


def link(obj, col):
    for c in obj.users_collection:
        c.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def look_rot(src, dst, up='Y'):
    d = Vector(dst) - Vector(src)
    return d.to_track_quat('-Z', up).to_euler()


def basis_quat(head, dorsal):
    """Rotation taking model axes (head=+Z, dorsal=-Y) to the given world directions."""
    z = Vector(head).normalized()
    y = -Vector(dorsal)
    y = (y - z * y.dot(z)).normalized()
    x = y.cross(z).normalized()
    m = Matrix((x, y, z)).transposed()
    return m.to_quaternion()


# ---------- keyframes in bulk ----------

def _channelbag(id_data):
    from bpy_extras import anim_utils
    ad = id_data.animation_data
    return anim_utils.animdata_get_channelbag_for_assigned_slot(ad)


def bake_fcurve(id_data, data_path, index, frames, values, seed_struct=None, seed_prop=None, interp='LINEAR'):
    """Write many keys at once. The first key is inserted the normal way so the
    action, slot and F-curve exist; the rest are bulk-filled."""
    owner = seed_struct if seed_struct is not None else id_data
    prop = seed_prop if seed_prop is not None else data_path
    owner.keyframe_insert(prop, index=index, frame=frames[0])
    cb = _channelbag(id_data)
    fc = cb.fcurves.find(data_path, index=max(index, 0))
    fc.keyframe_points.clear()
    fc.keyframe_points.add(len(frames))
    co = []
    for fr, v in zip(frames, values):
        co += [fr, v]
    fc.keyframe_points.foreach_set('co', co)
    fc.keyframe_points.foreach_set('interpolation', [bpy.types.Keyframe.bl_rna.properties['interpolation'].enum_items[interp].value] * len(frames))
    fc.update()
    return fc


def key_value(socket_owner, frames_values, prop='default_value', interp=None):
    """Keyframe a property at (frame, value) pairs (few keys, normal API)."""
    for fr, v in frames_values:
        setattr(socket_owner, prop, v)
        socket_owner.keyframe_insert(prop, frame=fr)


def value_node(nt, name, value, location=(0, 0)):
    n = nt.nodes.new('ShaderNodeValue')
    n.name = n.label = name
    n.outputs[0].default_value = value
    n.location = location
    return n


def gn_socket_id(ng, name):
    return ng.interface.items_tree[name].identifier


def modifier_input(mod, ng, name):
    """Blender 5.x: Geometry Nodes inputs live at mod.properties.inputs.<Socket_N>.value."""
    return getattr(mod.properties.inputs, gn_socket_id(ng, name))


def key_modifier_input(obj, mod, ng, name, frames_values):
    item = modifier_input(mod, ng, name)
    for fr, v in frames_values:
        item.value = v
        item.keyframe_insert('value', frame=fr)
