"""A Portuguese forest clearing at the edge of night and morning: trunks, ferns,
a canopy that breaks the sun into shafts, mist, and drifting pollen."""
import math
import random

import bmesh
import bpy
from mathutils import Vector

from .common import CENTER, T, collection, f, link, srgb


def _mat(name):
    m = bpy.data.materials.new(name)
    return m, m.node_tree


def world():
    sc = bpy.context.scene
    w = bpy.data.worlds.new('QDL_World')
    sc.world = w
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Color'].default_value = srgb('#0b1612')
    nt.links.new(bg.outputs[0], out.inputs['Surface'])
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = srgb('#c9d6c4')
    vol.inputs['Anisotropy'].default_value = 0.55
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    # dawn: the forest emerges from darkness, then warms for the rebirth
    s = bg.inputs['Strength']
    for fr, v in ((f(0), 0.02), (f(2.6), 0.35), (f(T['chrysalis']), 0.3), (f(T['reborn_hover']), 0.55), (f(T['end']), 0.7)):
        s.default_value = v
        s.keyframe_insert('default_value', frame=fr)
    d = vol.inputs['Density']
    for fr, v in ((f(0), 0.0), (f(1.8), 0.032), (f(T['end']), 0.026)):
        d.default_value = v
        d.keyframe_insert('default_value', frame=fr)


def sun():
    col = collection('Lighting')
    sd = bpy.data.lights.new('Sun_Morning', 'SUN')
    sd.color = (1.0, 0.8, 0.55)
    sd.angle = math.radians(1.5)
    o = bpy.data.objects.new('Sun_Morning', sd)
    o.rotation_euler = (math.radians(38), math.radians(-14), math.radians(160))
    col.objects.link(o)
    for fr, v in ((f(0), 0.0), (f(0.8), 0.0), (f(3.0), 4.5), (f(T['crack']), 3.4), (f(T['reborn_hover']), 6.0), (f(T['end']), 7.0)):
        sd.energy = v
        sd.keyframe_insert('energy', frame=fr)

    # key and rims that make the iridescence sing
    def area(name, loc, energy, color, size):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = 'DISK'
        ld.energy = energy
        ld.color = color
        ld.size = size
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        d = CENTER - Vector(loc)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        col.objects.link(ob)
        return ld

    key = area('Key_Warm', (2.4, -3.2, 3.6), 220, (1.0, 0.86, 0.68), 2.0)
    rim = area('Rim_Teal', (-2.6, 2.6, 2.6), 260, (0.55, 0.85, 0.9), 2.5)
    under = area('Fill_Violet', (-1.8, -2.4, 0.4), 70, (0.75, 0.62, 1.0), 2.0)
    for ld in (key, rim, under):
        e = ld.energy
        for fr, v in ((f(0), 0.0), (f(1.0), e * 0.15), (f(3.2), e)):
            ld.energy = v
            ld.keyframe_insert('energy', frame=fr)


def _bark():
    m, nt = _mat('Bark')
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 3.0
    tex.inputs['Detail'].default_value = 8
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (6, 6, 0.6)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = srgb('#0c120d')
    ramp.color_ramp.elements[1].color = srgb('#3a3a2c')
    nt.links.new(tex.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.9
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    nt.links.new(tex.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs[0], b.inputs['Normal'])
    return m


def _foliage(name, hexcol, translucency=0.35):
    m, nt = _mat(name)
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(hexcol)
    b.inputs['Roughness'].default_value = 0.55
    b.inputs['Subsurface Weight'].default_value = translucency
    b.inputs['Subsurface Radius'].default_value = (0.2, 0.4, 0.1)
    return m


def trunks(rnd):
    col = collection('Forest')
    bark = _bark()
    spots = []
    for _ in range(22):
        for _try in range(20):
            x = rnd.uniform(-9, 9)
            y = rnd.uniform(2.5, 16)
            # keep the clearing behind the dragonfly open
            if abs(x) < 1.6 + y * 0.12 and y < 9:
                continue
            spots.append((x, y))
            break
    for i, (x, y) in enumerate(spots):
        r = rnd.uniform(0.12, 0.32) * (1 + y / 20)
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=r, depth=14, location=(x, y, 7))
        o = bpy.context.object
        o.name = 'Trunk_%02d' % i
        o.rotation_euler = (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.06, 0.06), 0)
        o.data.materials.append(bark)
        link(o, col)


def canopy(rnd):
    """A leafy roof with gaps; the sun pours through as volumetric shafts."""
    col = collection('Forest')
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, 7.5))
    o = bpy.context.object
    o.name = 'Canopy'
    m, nt = _mat('Canopy_Leaves')
    m.surface_render_method = 'DITHERED'
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb('#16261a')
    noise = nt.nodes.new('ShaderNodeTexVoronoi')
    noise.inputs['Scale'].default_value = 9
    n2 = nt.nodes.new('ShaderNodeTexNoise')
    n2.inputs['Scale'].default_value = 1.4
    mix = nt.nodes.new('ShaderNodeMath')
    mix.operation = 'ADD'
    nt.links.new(noise.outputs['Distance'], mix.inputs[0])
    nt.links.new(n2.outputs['Fac'], mix.inputs[1])
    cut = nt.nodes.new('ShaderNodeMath')
    cut.operation = 'GREATER_THAN'
    cut.inputs[1].default_value = 0.78
    nt.links.new(mix.outputs[0], cut.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1
    nt.links.new(cut.outputs[0], inv.inputs[1])
    nt.links.new(inv.outputs[0], b.inputs['Alpha'])
    o.data.materials.append(m)
    o.visible_camera = False
    link(o, col)


def ground():
    col = collection('Forest')
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 10, 0))
    o = bpy.context.object
    o.name = 'Ground'
    m, nt = _mat('Moss')
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 0.8
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = srgb('#0b140d')
    ramp.color_ramp.elements[1].color = srgb('#2b3a22')
    nt.links.new(tex.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.95
    o.data.materials.append(m)
    link(o, col)

    # a far, softly glowing dawn behind the trees
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 26, 5))
    sky = bpy.context.object
    sky.name = 'Dawn_Backdrop'
    sky.scale = (60, 18, 1)
    sky.rotation_euler = (math.radians(90), 0, 0)
    m2, nt2 = _mat('Dawn_Glow')
    nt2.nodes.remove(nt2.nodes['Principled BSDF'])
    em = nt2.nodes.new('ShaderNodeEmission')
    grad = nt2.nodes.new('ShaderNodeTexGradient')
    tc = nt2.nodes.new('ShaderNodeTexCoord')
    dist = nt2.nodes.new('ShaderNodeVectorMath')
    dist.operation = 'DISTANCE'
    dist.inputs[1].default_value = (0.5, 0.3, 0.5)
    nt2.links.new(tc.outputs['Generated'], dist.inputs[0])
    ramp = nt2.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = srgb('#d9a46a')
    ramp.color_ramp.elements[1].color = srgb('#0e1a1c')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[1].position = 0.22
    nt2.links.new(dist.outputs['Value'], ramp.inputs[0])
    nt2.links.new(ramp.outputs[0], em.inputs['Color'])
    s = em.inputs['Strength']
    for fr, v in ((f(0), 0.0), (f(2.4), 0.22), (f(T['reborn_hover']), 0.55), (f(T['end']), 0.8)):
        s.default_value = v
        s.keyframe_insert('default_value', frame=fr)
    nt2.links.new(em.outputs[0], nt2.nodes['Material Output'].inputs['Surface'])
    sky.data.materials.append(m2)
    link(sky, col)
    del grad


def _fern_mesh(name, rnd, length=1.6):
    bm = bmesh.new()
    bend = rnd.uniform(0.25, 0.55)

    def spine(u):
        return Vector((0, math.sin(u * 1.4) * length * 0.25 * bend, u * length - (u * u) * length * 0.25 * bend))

    n = 40
    for i in range(1, n):
        u = i / n
        p = spine(u)
        tang = (spine(min(1, u + 0.01)) - p).normalized()
        side = Vector((1, 0, 0))
        ll = length * 0.22 * math.sin(math.pi * min(1, u * 1.2)) * (1 - u * 0.5)
        for s in (-1, 1):
            tip = p + side * s * ll + tang * ll * 0.35 + Vector((0, 0, -ll * 0.15))
            w = ll * 0.07
            a = bm.verts.new(p)
            b = bm.verts.new(p + side * s * ll * 0.5 + tang * (w + ll * 0.15))
            c = bm.verts.new(tip)
            d = bm.verts.new(p + side * s * ll * 0.5 + tang * (-w + ll * 0.1))
            bm.faces.new((a, b, c, d))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def ferns(rnd):
    col = collection('Forest')
    dark = _foliage('Fern_Dark', '#16281a')
    lit = _foliage('Fern_Lit', '#34482a', 0.5)
    meshes = [_fern_mesh('FernMesh_%d' % i, rnd) for i in range(5)]
    for me in meshes:
        me.materials.append(dark)
    places = []
    # foreground corners, out of focus, framing the shot
    for x, y, s in ((-2.3, -2.2, 1.2), (-1.9, -1.4, 1.0), (2.4, -2.0, 1.3), (2.0, -1.2, 0.9), (-2.8, -0.6, 1.4), (2.9, -0.4, 1.3)):
        places.append((x, y, s))
    for _ in range(60):
        x = rnd.uniform(-8, 8)
        y = rnd.uniform(0.8, 12)
        if abs(x) < 1.2 and y < 4:
            continue
        places.append((x, y, rnd.uniform(0.7, 1.5)))
    for i, (x, y, s) in enumerate(places):
        for k in range(rnd.randint(3, 6)):
            o = bpy.data.objects.new('Fern_%03d_%d' % (i, k), meshes[rnd.randrange(len(meshes))])
            o.location = (x + rnd.uniform(-0.15, 0.15), y + rnd.uniform(-0.15, 0.15), 0)
            o.rotation_euler = (rnd.uniform(-0.9, -0.3), 0, rnd.uniform(0, math.tau))
            o.scale = (s, s, s)
            col.objects.link(o)
            if rnd.random() < 0.25:
                o.material_slots[0].link = 'OBJECT'
                o.material_slots[0].material = lit


def pollen():
    """Points that drift and twinkle, driven by time in Geometry Nodes (no simulation)."""
    col = collection('Atmosphere')
    me = bpy.data.meshes.new('PollenVolume')
    o = bpy.data.objects.new('Pollen', me)
    col.objects.link(o)
    rnd = random.Random(11)
    verts = [(rnd.uniform(-4, 4), rnd.uniform(-2.5, 6), rnd.uniform(0.2, 4.5)) for _ in range(240)]
    me.from_pydata(verts, [], [])
    seed = me.attributes.new('seed', 'FLOAT', 'POINT')
    seed.data.foreach_set('value', [rnd.random() for _ in verts])

    m = bpy.data.materials.new('Pollen_Glow')
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb('#ffd48e')
    for fr, v in ((f(0), 0.0), (f(2.5), 5.0), (f(T['reborn_hover']), 8.0)):
        em.inputs['Strength'].default_value = v
        em.inputs['Strength'].keyframe_insert('default_value', frame=fr)
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])

    ng = bpy.data.node_groups.new('QDL_Drift', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N = ng.nodes
    L = ng.links
    gi = N.new('NodeGroupInput')
    go = N.new('NodeGroupOutput')
    t = N.new('GeometryNodeInputSceneTime')
    pos = N.new('GeometryNodeInputPosition')
    sd = N.new('GeometryNodeInputNamedAttribute')
    sd.data_type = 'FLOAT'
    sd.inputs['Name'].default_value = 'seed'
    noise = N.new('ShaderNodeTexNoise')
    noise.noise_dimensions = '4D'
    noise.inputs['Scale'].default_value = 0.6
    tscale = N.new('ShaderNodeMath')
    tscale.operation = 'MULTIPLY'
    tscale.inputs[1].default_value = 0.08
    L.new(t.outputs['Seconds'], tscale.inputs[0])
    L.new(pos.outputs[0], noise.inputs['Vector'])
    L.new(tscale.outputs[0], noise.inputs['W'])
    centre = N.new('ShaderNodeVectorMath')
    centre.operation = 'SUBTRACT'
    centre.inputs[1].default_value = (0.5, 0.5, 0.5)
    L.new(noise.outputs['Color'], centre.inputs[0])
    amp = N.new('ShaderNodeVectorMath')
    amp.operation = 'SCALE'
    amp.inputs['Scale'].default_value = 0.9
    L.new(centre.outputs[0], amp.inputs[0])
    rise = N.new('ShaderNodeCombineXYZ')
    rmul = N.new('ShaderNodeMath')
    rmul.operation = 'MULTIPLY'
    rmul.inputs[1].default_value = 0.035
    L.new(t.outputs['Seconds'], rmul.inputs[0])
    L.new(rmul.outputs[0], rise.inputs['Z'])
    add = N.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    L.new(amp.outputs[0], add.inputs[0])
    L.new(rise.outputs[0], add.inputs[1])
    setp = N.new('GeometryNodeSetPosition')
    L.new(gi.outputs[0], setp.inputs['Geometry'])
    L.new(add.outputs[0], setp.inputs['Offset'])
    ico = N.new('GeometryNodeMeshIcoSphere')
    ico.inputs['Radius'].default_value = 0.0055
    ico.inputs['Subdivisions'].default_value = 1
    # twinkle: scale breathes per point
    tw = N.new('ShaderNodeMath')
    tw.operation = 'MULTIPLY_ADD'
    tw.inputs[1].default_value = 40.0
    L.new(sd.outputs['Attribute'], tw.inputs[0])
    L.new(t.outputs['Seconds'], tw.inputs[2])
    sn = N.new('ShaderNodeMath')
    sn.operation = 'SINE'
    L.new(tw.outputs[0], sn.inputs[0])
    sc = N.new('ShaderNodeMapRange')
    sc.inputs['From Min'].default_value = -1
    sc.inputs['To Min'].default_value = 0.35
    sc.inputs['To Max'].default_value = 1.4
    L.new(sn.outputs[0], sc.inputs['Value'])
    inst = N.new('GeometryNodeInstanceOnPoints')
    L.new(setp.outputs[0], inst.inputs['Points'])
    L.new(ico.outputs['Mesh'], inst.inputs['Instance'])
    L.new(sc.outputs['Result'], inst.inputs['Scale'])
    smat = N.new('GeometryNodeSetMaterial')
    smat.inputs['Material'].default_value = m
    L.new(inst.outputs[0], smat.inputs['Geometry'])
    L.new(smat.outputs[0], go.inputs[0])
    mod = o.modifiers.new('Drift', 'NODES')
    mod.node_group = ng


def build(seed=5):
    rnd = random.Random(seed)
    world()
    sun()
    ground()
    trunks(rnd)
    canopy(rnd)
    ferns(rnd)
    pollen()
