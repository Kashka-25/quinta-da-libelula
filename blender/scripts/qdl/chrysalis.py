"""The chrysalis: a living vessel of transformation.

A seed of gold light wrapped in seven overlapping petals of iridescent glass,
twisted like a lotus bud, slightly asymmetric, with gold veins. It forms from
the bottom up as the liquid arrives, breathes, glows, cracks with gold, and
opens like a lotus to release the reborn dragonfly. Then its petals melt away
as nectar.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

from .common import CENTER, T, collection, ease_io, f, sec, smooth, srgb, value_node
from .dragonfly import liquid_nodes

PETALS = 7
HEIGHT = 1.05
BOTTOM = CENTER.z - 0.56
OPEN_ANGLE = math.radians(118)


def radius(u):
    s = math.sin(math.pi * max(0.0, min(1.0, u)) ** 0.78)
    return 0.27 * max(0.0, s) ** 0.85 * (1 - 0.12 * u)


def axis_point(u):
    return Vector((CENTER.x + 0.035 * math.sin(math.pi * u * 1.3), CENTER.y + 0.02 * math.sin(math.pi * u), BOTTOM + HEIGHT * u))


def twist(u):
    return 0.95 * u


def surface_point(u, theta, inset=0.0):
    a = theta + twist(u)
    r = radius(u) * (1 - inset)
    return axis_point(u) + Vector((math.cos(a) * r, math.sin(a) * r, 0))


def hinge(k):
    th = k * math.tau / PETALS
    u = 0.1
    return surface_point(u, th - twist(u)), Vector((-math.sin(th), math.cos(th), 0))


def _petal_mesh(k, nu=40, ns=14):
    th = k * math.tau / PETALS
    w = 1.3
    lift = 1 + 0.04 * (k % 2)
    b, _ = hinge(k)
    verts, us, ss = [], [], []
    for i in range(nu):
        u = 0.03 + 0.94 * i / (nu - 1)
        pinch = math.sin(math.pi * u) ** 0.55
        for j in range(ns):
            s = -1 + 2 * j / (ns - 1)
            a = th + twist(u) + s * w / 2 * pinch
            r = radius(u) * lift * (1 - 0.1 * s * s) + 0.02 * math.cos(s * math.pi * 2.5) * pinch + 0.025 * max(0.0, s) * pinch
            p = axis_point(u) + Vector((math.cos(a) * r, math.sin(a) * r, 0))
            verts.append(p - b)
            us.append(u)
            ss.append(s)
    faces = []
    for i in range(nu - 1):
        for j in range(ns - 1):
            a = i * ns + j
            faces.append((a, a + 1, a + ns + 1, a + ns))
    me = bpy.data.meshes.new('Petal_%d' % k)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    for p in me.polygons:
        p.use_smooth = True
    for name, data in (('pu', us), ('ps', ss)):
        at = me.attributes.new(name, 'FLOAT', 'POINT')
        at.data.foreach_set('value', np.array(data, dtype=np.float32))
    return me


def petal_material():
    m = bpy.data.materials.new('Chrysalis_Glass')
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.remove(N['Principled BSDF'])
    out = N['Material Output']
    glow = value_node(nt, 'LiquidGlow', 0.35, (-1300, -900))
    glass = liquid_nodes(nt, x=0, y=-500, glow_value=glow)
    liquid_bsdf = N['Liquid']
    liquid_bsdf.inputs['Transmission Weight'].default_value = 0.85
    liquid_bsdf.inputs['Coat Weight'].default_value = 0.6

    def attr(name, loc):
        a = N.new('ShaderNodeAttribute')
        a.attribute_name = name
        a.location = loc
        return a.outputs['Fac']

    def math_(op, a, b=None, loc=(0, 0)):
        n = N.new('ShaderNodeMath')
        n.operation = op
        n.location = loc
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    pu = attr('pu', (-1200, 300))
    ps = attr('ps', (-1200, 150))
    # gold veins: a midrib and fine ribs that wander like a leaf's
    wob = math_('SINE', math_('MULTIPLY', pu, 13.0, (-1000, 300)), None, (-850, 300))
    ribs = math_('MULTIPLY_ADD', ps, 2.5, (-850, 150))
    N[ribs.node.name].inputs[2].default_value = 0.0
    ribs = math_('ADD', ribs, math_('MULTIPLY', wob, 0.08, (-700, 300)), (-700, 150))
    ribs = math_('FRACT', ribs, None, (-550, 150))
    ribs = math_('ABSOLUTE', math_('SUBTRACT', ribs, 0.5, (-450, 150)), None, (-350, 150))
    vein = N.new('ShaderNodeMapRange')
    vein.location = (-200, 150)
    vein.inputs['From Min'].default_value = 0.0
    vein.inputs['From Max'].default_value = 0.05
    vein.inputs['To Min'].default_value = 1.0
    vein.inputs['To Max'].default_value = 0.0
    L.new(ribs, vein.inputs['Value'])

    # cracks of light: voronoi edges that widen
    tc = N.new('ShaderNodeTexCoord')
    tc.location = (-1200, -50)
    vor = N.new('ShaderNodeTexVoronoi')
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = 7.0
    vor.location = (-1000, -50)
    L.new(tc.outputs['Object'], vor.inputs['Vector'])
    crack_w = value_node(nt, 'CrackWidth', 0.0, (-1000, -250))
    crack = math_('LESS_THAN', vor.outputs['Distance'], crack_w.outputs[0], (-800, -50))

    # a band of luminous energy running up the surface
    band = value_node(nt, 'EnergyBand', -0.5, (-1000, -400))
    eb = math_('ABSOLUTE', math_('SUBTRACT', pu, band.outputs[0], (-800, -400)), None, (-650, -400))
    ebm = N.new('ShaderNodeMapRange')
    ebm.location = (-500, -400)
    ebm.inputs['From Max'].default_value = 0.12
    ebm.inputs['To Min'].default_value = 1.0
    ebm.inputs['To Max'].default_value = 0.0
    L.new(eb, ebm.inputs['Value'])

    vein_k = value_node(nt, 'VeinGlow', 3.0, (-200, 0))
    gold_amt = math_('MULTIPLY', vein.outputs['Result'], vein_k.outputs[0], (0, 150))
    gold_amt = math_('ADD', gold_amt, math_('MULTIPLY', crack, 9.0, (-600, -50)), (150, 100))
    gold_amt = math_('ADD', gold_amt, math_('MULTIPLY', ebm.outputs['Result'], 12.0, (-300, -400)), (300, 50))
    gold = N.new('ShaderNodeEmission')
    gold.location = (450, 50)
    gold.inputs['Color'].default_value = srgb('#ffc76a')
    L.new(gold_amt, gold.inputs['Strength'])
    add = N.new('ShaderNodeAddShader')
    add.location = (650, -200)
    L.new(glass, add.inputs[0])
    L.new(gold.outputs[0], add.inputs[1])

    # reveal from the bottom up, dissolve from the tips at the end
    reveal = value_node(nt, 'Reveal', 0.0, (-500, -650))
    rv = N.new('ShaderNodeMapRange')
    rv.location = (-300, -650)
    rv.interpolation_type = 'SMOOTHSTEP'
    L.new(math_('SUBTRACT', math_('MULTIPLY', reveal.outputs[0], 1.25, (-450, -750)), pu, (-400, -650)), rv.inputs['Value'])
    rv.inputs['From Min'].default_value = 0.0
    rv.inputs['From Max'].default_value = 0.12
    dissolve = value_node(nt, 'Dissolve', 0.0, (-500, -850))
    dv = N.new('ShaderNodeMapRange')
    dv.location = (-300, -850)
    dv.interpolation_type = 'SMOOTHSTEP'
    L.new(math_('SUBTRACT', math_('MULTIPLY', dissolve.outputs[0], 1.3, (-450, -950)), pu, (-400, -850)), dv.inputs['Value'])
    dv.inputs['From Min'].default_value = -0.3
    dv.inputs['From Max'].default_value = 0.0
    dv.inputs['To Min'].default_value = 1.0
    dv.inputs['To Max'].default_value = 0.0
    alpha = math_('MULTIPLY', rv.outputs['Result'], dv.outputs['Result'], (-100, -750))
    tr = N.new('ShaderNodeBsdfTransparent')
    tr.location = (650, -400)
    mix = N.new('ShaderNodeMixShader')
    mix.location = (850, -300)
    L.new(alpha, mix.inputs[0])
    L.new(tr.outputs[0], mix.inputs[1])
    L.new(add.outputs[0], mix.inputs[2])
    L.new(mix.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    m.use_raytrace_refraction = True
    m.use_transparent_shadow = True
    return m


def core_material():
    m = bpy.data.materials.new('Chrysalis_Core')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb('#ffcf7a')
    b.inputs['Emission Color'].default_value = srgb('#ffbe5c')
    b.inputs['Transmission Weight'].default_value = 0.5
    b.inputs['Roughness'].default_value = 0.2
    b.inputs['Alpha'].default_value = 0.0
    m.surface_render_method = 'DITHERED'
    return m


class Chrysalis:
    def __init__(self):
        self.petals = []
        self.root = None
        self.core = None


def build():
    col = collection('Chrysalis')
    ch = Chrysalis()
    root = bpy.data.objects.new('Chrysalis_Root', None)
    root.location = CENTER
    col.objects.link(root)
    ch.root = root
    pm = petal_material()
    for k in range(PETALS):
        me = _petal_mesh(k)
        me.materials.append(pm)
        o = bpy.data.objects.new('Petal_%d' % k, me)
        col.objects.link(o)
        b, axis = hinge(k)
        o.parent = root
        o.matrix_parent_inverse = Matrix.Translation(-CENTER)
        o.location = b
        o.rotation_mode = 'QUATERNION'
        sol = o.modifiers.new('Thickness', 'SOLIDIFY')
        sol.thickness = 0.007
        sol.offset = 0
        ch.petals.append((o, axis))

    # the seed of light inside
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, 0))
    core = bpy.context.object
    core.name = 'Chrysalis_Core'
    for c in core.users_collection:
        c.objects.unlink(core)
    col.objects.link(core)
    core.scale = (0.17, 0.17, 0.4)
    core.parent = root
    core.location = (0.01, 0.0, -0.06)
    core.data.materials.append(core_material())
    for p in core.data.polygons:
        p.use_smooth = True
    ch.core = core

    # a single thread of gold it hangs from
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.0035, depth=3.0, location=(0, 0, 0))
    thread = bpy.context.object
    thread.name = 'Chrysalis_Thread'
    for c in thread.users_collection:
        c.objects.unlink(thread)
    col.objects.link(thread)
    top = axis_point(1.0)
    thread.location = top + Vector((0, 0, 1.5))
    tm = bpy.data.materials.new('Gold_Thread')
    tb = tm.node_tree.nodes['Principled BSDF']
    tb.inputs['Base Color'].default_value = srgb('#e9b45a')
    tb.inputs['Metallic'].default_value = 1.0
    tb.inputs['Roughness'].default_value = 0.2
    tb.inputs['Emission Color'].default_value = srgb('#ffcf7a')
    tb.inputs['Emission Strength'].default_value = 1.5
    thread.data.materials.append(tm)

    # warm light living inside
    ld = bpy.data.lights.new('Chrysalis_Heart', 'POINT')
    ld.color = (1.0, 0.72, 0.4)
    ld.shadow_soft_size = 0.12
    heart = bpy.data.objects.new('Chrysalis_Heart', ld)
    heart.parent = root
    heart.location = (0, 0, -0.05)
    col.objects.link(heart)

    animate(ch, pm, core, ld, thread)
    return ch


def animate(ch, pm, core, light, thread):
    nt = pm.node_tree
    reveal = nt.nodes['Reveal'].outputs[0]
    for fr, v in ((f(T['gather'] + 1.2), 0.0), (f(T['chrysalis'] + 0.2), 1.0)):
        reveal.default_value = v
        reveal.keyframe_insert('default_value', frame=fr)
    crack = nt.nodes['CrackWidth'].outputs[0]
    for fr, v in ((f(T['crack']), 0.0), (f(T['open']), 0.018), (f(T['open'] + 0.8), 0.03)):
        crack.default_value = v
        crack.keyframe_insert('default_value', frame=fr)
    band = nt.nodes['EnergyBand'].outputs[0]
    for fr, v in ((f(T['crack'] + 0.2), -0.3), (f(T['open'] - 0.1), 1.3)):
        band.default_value = v
        band.keyframe_insert('default_value', frame=fr)
    dis = nt.nodes['Dissolve'].outputs[0]
    for fr, v in ((f(T['open'] + 1.4), 0.0), (f(T['unfold'] + 1.6), 1.05)):
        dis.default_value = v
        dis.keyframe_insert('default_value', frame=fr)
    vg = nt.nodes['VeinGlow'].outputs[0]
    for fr, v in ((f(T['gather'] + 1.2), 0.5), (f(T['chrysalis']), 3.0), (f(T['crack']), 5.0), (f(T['open']), 8.0)):
        vg.default_value = v
        vg.keyframe_insert('default_value', frame=fr)

    cb = core.data.materials[0].node_tree.nodes['Principled BSDF']
    t0, t1 = T['gather'] + 1.6, T['unfold'] + 1.4
    for fr in range(f(T['gather']), f(t1) + 1, 2):
        t = sec(fr)
        breath = 0.5 + 0.5 * math.sin(math.tau * (t - T['chrysalis']) / 2.4)
        build = smooth(t0, T['chrysalis'] + 0.6, t)
        peak = smooth(T['crack'], T['open'], t)
        fade = 1 - smooth(T['emerge'], T['unfold'] + 1.2, t)
        e = (1.5 + 3.0 * build + 14 * peak) * (0.75 + 0.25 * breath) * fade
        cb.inputs['Emission Strength'].default_value = e
        cb.inputs['Emission Strength'].keyframe_insert('default_value', frame=fr)
        cb.inputs['Alpha'].default_value = smooth(t0, T['chrysalis'], t) * fade * 0.9
        cb.inputs['Alpha'].keyframe_insert('default_value', frame=fr)
        light.energy = (20 + 60 * build + 400 * peak) * (0.7 + 0.3 * breath) * fade * smooth(t0, T['chrysalis'], t)
        light.keyframe_insert('energy', frame=fr)
        # breathing, and a slow sway as it hangs
        sc = 1 + 0.028 * (breath - 0.5) * build * fade
        ch.root.scale = (sc, sc, 1 + 0.02 * (breath - 0.5) * build * fade)
        ch.root.keyframe_insert('scale', frame=fr)
        ch.root.rotation_euler = (0.0, 0.02 * math.sin(t * 0.7), 0.06 * math.sin(t * 0.45))
        ch.root.keyframe_insert('rotation_euler', frame=fr)

    # the lotus opens: petals swing out from their base, one after another
    for k, (o, axis) in enumerate(ch.petals):
        start = T['open'] + 0.09 * k
        for fr in range(f(T['open'] - 0.1), f(T['unfold'] + 1.8) + 1, 2):
            t = sec(fr)
            u = ease_io((t - start) / 1.9)
            ang = OPEN_ANGLE * u + math.radians(6) * math.sin(math.pi * min(1, u)) * (1 - u)
            o.rotation_quaternion = Quaternion(axis, ang)
            o.keyframe_insert('rotation_quaternion', frame=fr)
        o.rotation_quaternion = Quaternion()
        o.keyframe_insert('rotation_quaternion', frame=f(T['open'] - 0.2))

    for ob, (t_on, t_off) in ((ch.root, (T['gather'] + 1.0, T['end'])),):
        pass
    for ob in [o for o, _ in ch.petals] + [core, thread]:
        ob.hide_render = True
        ob.keyframe_insert('hide_render', frame=1)
        ob.hide_render = False
        ob.keyframe_insert('hide_render', frame=f(T['gather'] + 1.1))
        ob.hide_render = True
        ob.keyframe_insert('hide_render', frame=f(T['unfold'] + 2.0))
    # the thread appears as the liquid draws itself up
    thread.scale = (1, 1, 0.0)
    thread.keyframe_insert('scale', frame=f(T['gather'] + 1.2))
    thread.scale = (1, 1, 1.0)
    thread.keyframe_insert('scale', frame=f(T['chrysalis']))


def petal_tip_world(ch, k, frame):
    """World position of petal k's tip at a frame (for nectar streams)."""
    o, _ = ch.petals[k]
    bpy.context.scene.frame_set(frame)
    b, _ = hinge(k)
    tip_local = surface_point(0.97, k * math.tau / PETALS) - b
    return o.matrix_world @ tip_local
