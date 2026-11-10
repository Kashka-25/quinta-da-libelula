"""Camera, focus, the liquid-light wave and the final settle to the site's ivory."""
import math

import bpy
from mathutils import Vector

from .common import CENTER, T, collection, f, lerp, sec, smooth, srgb, value_node
from .performance import catmull

# (time, camera position, look-at, focal length)
SHOTS = [
    (0.0, Vector((0.6, -5.8, 2.15)), Vector((1.6, 5.0, 2.5)), 38),
    (2.2, Vector((0.35, -5.0, 2.0)), Vector((0.7, 2.0, 1.9)), 42),
    (3.8, Vector((0.0, -4.4, 1.86)), CENTER + Vector((0, 0, 0.02)), 50),
    (T['melt'], Vector((0.0, -3.55, 1.8)), CENTER + Vector((0, 0, -0.02)), 60),
    (T['melt'] + 3.0, Vector((0.12, -3.9, 1.62)), CENTER + Vector((0, 0, -0.32)), 52),
    (T['gather'] + 1.4, Vector((0.3, -4.5, 1.5)), CENTER + Vector((0, 0, -0.2)), 46),
    (T['chrysalis'], Vector((-0.22, -3.9, 1.66)), CENTER, 52),
    (T['crack'], Vector((-0.08, -3.55, 1.66)), CENTER, 58),
    (T['emerge'], Vector((0.0, -3.9, 1.7)), CENTER + Vector((0, 0, 0.12)), 52),
    (T['reborn_hover'], Vector((0.0, -4.3, 1.78)), CENTER + Vector((0, 0, 0.2)), 46),
    (T['flight'] + 0.9, Vector((0.0, -4.6, 1.74)), CENTER + Vector((0.15, -0.6, 0.6)), 40),
    (T['wave'], Vector((0.0, -4.7, 1.8)), CENTER + Vector((0, 0, 0.35)), 38),
    (T['end'], Vector((0.0, -4.4, 1.8)), CENTER + Vector((0, 0, 0.2)), 34),
]


def _interp(t, idx):
    pts = [(s[0], s[idx] if isinstance(s[idx], Vector) else Vector((s[idx], 0, 0))) for s in SHOTS]
    v = catmull(pts, t)
    return v if isinstance(SHOTS[0][idx], Vector) else v.x


def camera(subject):
    """subject(t) -> Vector: what the lens focuses on."""
    sc = bpy.context.scene
    col = collection('Camera')
    cd = bpy.data.cameras.new('Lens')
    cam = bpy.data.objects.new('Camera', cd)
    col.objects.link(cam)
    sc.camera = cam
    cd.sensor_width = 36
    cd.clip_start = 0.05
    cd.clip_end = 80
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 2.4
    aim = bpy.data.objects.new('Camera_Aim', None)
    focus = bpy.data.objects.new('Camera_Focus', None)
    col.objects.link(aim)
    col.objects.link(focus)
    cd.dof.focus_object = focus
    con = cam.constraints.new('TRACK_TO')
    con.target = aim
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    end = f(T['end'])
    for fr in range(1, end + 1):
        t = sec(fr)
        # a whisper of handheld breathing, never a shake
        breath = Vector((0.006 * math.sin(t * 0.9), 0.0, 0.005 * math.sin(t * 1.3 + 1)))
        cam.location = _interp(t, 1) + breath
        cam.keyframe_insert('location', frame=fr)
        aim.location = _interp(t, 2)
        aim.keyframe_insert('location', frame=fr)
        cd.lens = _interp(t, 3)
        cd.keyframe_insert('lens', frame=fr)
        focus.location = subject(t)
        focus.keyframe_insert('location', frame=fr)
    # aperture: wide and dreamy, a touch deeper while the liquid flows
    # the scene is built at about 20x life size, so tiny f-stops give a true macro depth of field
    for fr, v in ((1, 0.8), (f(T['melt']), 1.0), (f(T['gather']), 1.3), (f(T['chrysalis']), 0.9), (f(T['wave']), 0.6)):
        cd.dof.aperture_fstop = v
        cd.dof.keyframe_insert('aperture_fstop', frame=fr)
    return cam


def ivory_settle(cam):
    """A card in front of the lens that brightens to the website's ivory (#f6f1e6)."""
    me = bpy.data.meshes.new('IvoryCard')
    s = 2.0
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    card = bpy.data.objects.new('Ivory_Settle', me)
    collection('Camera').objects.link(card)
    card.parent = cam
    card.location = (0, 0, -0.12)
    m = bpy.data.materials.new('Ivory')
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb('#ffe6c2')
    em.inputs['Strength'].default_value = 2.6  # AgX dims emission; this lands near #f6f1e6
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    a = value_node(nt, 'Opacity', 0.0)
    nt.links.new(a.outputs[0], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    me.materials.append(m)
    o = a.outputs[0]
    for fr, v in ((f(T['ivory'] - 0.3), 0.0), (f(T['ivory'] + 0.4), 0.85), (f(T['end'] - 0.15), 1.0)):
        o.default_value = v
        o.keyframe_insert('default_value', frame=fr)
    return card


def bubble_material():
    """A membrane of liquid light: clear in the middle, rainbow thin film and a gold glow at the rim."""
    m = bpy.data.materials.new('Light_Membrane')
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = N['Principled BSDF']
    b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    b.inputs['Roughness'].default_value = 0.0
    b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['IOR'].default_value = 1.12
    b.inputs['Thin Film IOR'].default_value = 1.33
    nz = N.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = 3.0
    film = N.new('ShaderNodeMapRange')
    film.inputs['To Min'].default_value = 250
    film.inputs['To Max'].default_value = 950
    L.new(nz.outputs['Fac'], film.inputs['Value'])
    L.new(film.outputs['Result'], b.inputs['Thin Film Thickness'])
    lw = N.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.25
    rim = N.new('ShaderNodeMath')
    rim.operation = 'MULTIPLY'
    rim.inputs[1].default_value = 6.0
    L.new(lw.outputs['Facing'], rim.inputs[0])
    b.inputs['Emission Color'].default_value = srgb('#ffcf8a')
    L.new(rim.outputs[0], b.inputs['Emission Strength'])
    alpha = N.new('ShaderNodeMath')
    alpha.operation = 'MULTIPLY_ADD'
    alpha.inputs[1].default_value = 0.7
    alpha.inputs[2].default_value = 0.2
    L.new(lw.outputs['Facing'], alpha.inputs[0])
    L.new(alpha.outputs[0], b.inputs['Alpha'])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    return m


def liquid_wave(liquid_mat):
    """Act V: the reborn dragonfly releases its light. A bubble of liquid glass
    blooms out of its wake, rolls toward the lens and swallows us whole."""
    col = collection('Awakening')
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0, location=(0, 0, 0))
    o = bpy.context.object
    o.name = 'Light_Bloom'
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.materials.append(bubble_material())
    ng = bpy.data.node_groups.new('QDL_Bloom', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    pos = N.new('GeometryNodeInputPosition')
    nrm = N.new('GeometryNodeInputNormal')
    t = N.new('GeometryNodeInputSceneTime')
    nz = N.new('ShaderNodeTexNoise')
    nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 1.6
    L.new(pos.outputs[0], nz.inputs['Vector'])
    L.new(t.outputs['Seconds'], nz.inputs['W'])
    amt = N.new('ShaderNodeMath')
    amt.operation = 'MULTIPLY_ADD'
    amt.inputs[1].default_value = 0.5
    amt.inputs[2].default_value = -0.25
    L.new(nz.outputs['Fac'], amt.inputs[0])
    off = N.new('ShaderNodeVectorMath')
    off.operation = 'SCALE'
    L.new(nrm.outputs[0], off.inputs[0])
    L.new(amt.outputs[0], off.inputs['Scale'])
    setp = N.new('GeometryNodeSetPosition')
    L.new(gi.outputs[0], setp.inputs['Geometry'])
    L.new(off.outputs[0], setp.inputs['Offset'])
    L.new(setp.outputs[0], go.inputs[0])
    o.modifiers.new('Bloom', 'NODES').node_group = ng
    origin = CENTER + Vector((0, 0, 0.2))
    o.location = origin
    for fr, r in ((f(T['wave'] - 0.6), 0.02), (f(T['wave'] + 0.3), 1.0), (f(T['wave'] + 1.0), 3.2), (f(T['ivory'] + 0.2), 5.5), (f(T['end']), 7.5)):
        o.scale = (r, r, r * 0.92)
        o.keyframe_insert('scale', frame=fr)
    o.hide_render = True
    o.keyframe_insert('hide_render', frame=1)
    o.hide_render = False
    o.keyframe_insert('hide_render', frame=f(T['wave'] - 0.5))
    # a golden light born at its heart
    ld = bpy.data.lights.new('Bloom_Heart', 'POINT')
    ld.color = (1.0, 0.85, 0.6)
    heart = bpy.data.objects.new('Bloom_Heart', ld)
    heart.location = origin
    col.objects.link(heart)
    for fr, v in ((f(T['wave'] - 0.5), 0.0), (f(T['wave'] + 0.6), 900.0), (f(T['ivory']), 2500.0)):
        ld.energy = v
        ld.keyframe_insert('energy', frame=fr)
    return o
