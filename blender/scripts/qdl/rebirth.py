"""Act VI, the rebirth: the evolved dragonfly rises from the opened chrysalis as
a luminous silhouette, unfolds its four wings while gold runs out along the
veins, hovers, and flies toward us and past, trailing botanical light."""
import math
import random

import bpy
import numpy as np
from mathutils import Quaternion, Vector

from .common import CENTER, FPS, T, basis_quat, collection, ease_io, f, lerp, sec, smooth, srgb
from .dragonfly import ABD_BONES, WING_BONES, arm_space_rot
from .performance import WingBeat, catmull, key_object, key_pose, upright_quat, wing_rot

HOVER = CENTER + Vector((0, 0, 0.16))
FLIGHT = [
    (T['flight'] - 0.4, HOVER),
    (T['flight'] + 0.5, HOVER + Vector((0.45, 0.3, 0.3))),
    (T['flight'] + 1.2, Vector((0.3, -1.0, 2.45))),
    (T['wave'] + 0.1, Vector((-0.15, -2.9, 2.85))),
    (T['wave'] + 0.8, Vector((-0.4, -5.0, 3.4))),
]


def transform(t):
    """World location, rotation and scale of the reborn dragonfly."""
    rise = ease_io((t - T['emerge']) / 2.4)
    p = (CENTER + Vector((0, 0, -0.14))).lerp(HOVER, rise)
    s = lerp(0.42, 1.0, ease_io((t - T['emerge']) / 2.6))
    hov = smooth(T['unfold'] + 0.8, T['reborn_hover'], t)
    p += Vector((0.04 * math.sin(1.2 * t), 0.025 * math.sin(0.8 * t + 2), 0.04 * math.sin(1.6 * t))) * hov
    q = upright_quat()
    if t > FLIGHT[0][0]:
        fp = catmull(FLIGHT, t)
        w = smooth(FLIGHT[0][0], FLIGHT[1][0], t)
        p = p.lerp(fp, w)
        v = catmull(FLIGHT, t + 0.05) - catmull(FLIGHT, t - 0.05)
        if v.length > 1e-4:
            head = v.normalized()
            head.z += 0.25
            q_fly = basis_quat(head, Vector((0, 0, 1)))
            lat = (catmull(FLIGHT, t + 0.1) - 2 * catmull(FLIGHT, t) + catmull(FLIGHT, t - 0.1)).x
            q_fly = q_fly @ Quaternion((0, 0, 1), max(-0.6, min(0.6, -lat * 5)))
            # it flies, but keeps its open wings turned toward us
            q = q.slerp(q_fly, 0.5 * smooth(T['flight'], T['flight'] + 1.2, t))
    return p, q, s


def animate(mesh, rig):
    col = mesh.users_collection[0]
    beat = WingBeat(7)
    dt = 1 / FPS
    start, end = f(T['emerge'] - 0.1), f(T['end'])
    for fr in range(start, end + 1):
        t = sec(fr)
        p, q, s = transform(t)
        key_object(rig, fr, p, q)
        rig.scale = (s, s, s)
        rig.keyframe_insert('scale', frame=fr)
        # wings: wrapped close around the body, then unfolding, fore before hind
        wq = {}
        freq = lerp(0.0, 3.2, smooth(T['unfold'] + 1.6, T['reborn_hover'] + 0.3, t))
        freq = lerp(freq, 5.4, smooth(T['flight'], T['flight'] + 0.8, t))
        amp = lerp(0.0, math.radians(24), smooth(T['unfold'] + 1.6, T['reborn_hover'] + 0.3, t))
        amp = lerp(amp, math.radians(34), smooth(T['flight'], T['flight'] + 0.8, t))
        beat.step(freq, dt)
        for b in WING_BONES:
            hind = b.startswith('wing_H')
            u = ease_io((t - T['unfold'] - (0.25 if hind else 0.0)) / 1.7)
            # a gentle overshoot as each wing reaches open, like a breath out
            u += 0.06 * math.sin(math.pi * min(1, u)) * smooth(0.6, 1.0, u)
            folded = 1 - u
            wq[b] = wing_rot(rig, b, beat.angle(b, amp) + math.radians(8) * math.sin(math.pi * u),
                             fold_back=folded * math.radians(72 if hind else 64),
                             fold_in=folded * math.radians(58 if hind else 52))
        abd = {}
        for i, b in enumerate(ABD_BONES):
            sway = math.sin(t * 1.5 - i * 0.6) * math.radians(3)
            abd[b] = (arm_space_rot(rig, b, (0, 1, 0), sway), 1.0)
        key_pose(rig, fr, wq, abd)

    nt = mesh.data.materials[0].node_tree
    sil = nt.nodes['Silhouette'].outputs[0]
    for fr, v in ((f(T['emerge'] - 0.1), 1.0), (f(T['unfold'] - 0.2), 0.85), (f(T['unfold'] + 0.9), 0.0)):
        sil.default_value = v
        sil.keyframe_insert('default_value', frame=fr)
    band = nt.nodes['VeinBand'].outputs[0]
    for fr, v in ((f(T['unfold'] + 0.3), -0.2), (f(T['unfold'] + 2.3), 1.25), (f(T['reborn_hover'] + 0.6), 1.25),
                  (f(T['reborn_hover'] + 0.61), -0.2), (f(T['flight'] + 1.4), 1.25)):
        band.default_value = v
        band.keyframe_insert('default_value', frame=fr)
    glow = nt.nodes['Glow'].outputs[0]
    for fr, v in ((f(T['emerge']), 1.2), (f(T['reborn_hover']), 0.55), (f(T['wave']), 0.9)):
        glow.default_value = v
        glow.keyframe_insert('default_value', frame=fr)

    for ob in (mesh,):
        ob.hide_render = True
        ob.keyframe_insert('hide_render', frame=1)
        ob.hide_render = False
        ob.keyframe_insert('hide_render', frame=start)

    _aura(rig, col)
    _trail(mesh, col)
    _warm_light(col)
    return transform


def _aura(rig, col):
    """A soft golden halo behind the body, always facing the lens."""
    me = bpy.data.meshes.new('Aura')
    s = 1.4
    me.from_pydata([(-s, 0, -s), (s, 0, -s), (s, 0, s), (-s, 0, s)], [], [(0, 1, 2, 3)])
    me.uv_layers.new()
    ob = bpy.data.objects.new('Reborn_Aura', me)
    col.objects.link(ob)
    ob.parent = rig
    ob.location = (0, 0.12, 0.05)
    m = bpy.data.materials.new('Aura_Gold')
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    N.remove(N['Principled BSDF'])
    tc = N.new('ShaderNodeTexCoord')
    grad = N.new('ShaderNodeTexGradient')
    grad.gradient_type = 'SPHERICAL'
    mp = N.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (0.5, 0.5, 0)
    mp.inputs['Scale'].default_value = (2, 2, 1)
    sub = N.new('ShaderNodeVectorMath')
    sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = (0.5, 0.5, 0)
    L.new(tc.outputs['UV'], sub.inputs[0])
    sc = N.new('ShaderNodeVectorMath')
    sc.operation = 'SCALE'
    sc.inputs['Scale'].default_value = 2.0
    L.new(sub.outputs[0], sc.inputs[0])
    L.new(sc.outputs[0], grad.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    L.new(grad.outputs['Fac'], ramp.inputs[0])
    pw = N.new('ShaderNodeMath')
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 2.2
    L.new(ramp.outputs[0], pw.inputs[0])
    em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb('#ffcf8a')
    strength = N.new('ShaderNodeValue')
    strength.name = 'AuraStrength'
    mul = N.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    L.new(pw.outputs[0], mul.inputs[0])
    L.new(strength.outputs[0], mul.inputs[1])
    tr = N.new('ShaderNodeBsdfTransparent')
    add = N.new('ShaderNodeAddShader')
    L.new(tr.outputs[0], add.inputs[0])
    L.new(em.outputs[0], add.inputs[1])
    L.new(mul.outputs[0], em.inputs['Strength'])
    L.new(add.outputs[0], N['Material Output'].inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    me.materials.append(m)
    o = strength.outputs[0]
    for fr, v in ((f(T['emerge']), 0.0), (f(T['unfold']), 2.2), (f(T['reborn_hover']), 1.2), (f(T['wave']), 1.8)):
        o.default_value = v
        o.keyframe_insert('default_value', frame=fr)
    con = ob.constraints.new('TRACK_TO')
    con.target = bpy.context.scene.camera
    con.track_axis = 'TRACK_NEGATIVE_Y'
    con.up_axis = 'UP_Z'
    return ob


def _trail(mesh, col):
    """Luminous botanical particles shed from the wings: points recorded along the
    real wing positions, then aged and drifted in Geometry Nodes."""
    rnd = random.Random(4)
    wing = np.empty(len(mesh.data.vertices), dtype=np.float32)
    mesh.data.attributes['span'].data.foreach_get('value', wing)
    tips = np.nonzero(wing > 0.55)[0]
    pick = [int(tips[rnd.randrange(len(tips))]) for _ in range(400)]
    pts, births, vels = [], [], []
    sc = bpy.context.scene
    for fr in range(f(T['unfold'] + 1.0), f(T['wave'] + 0.8), 2):
        sc.frame_set(fr)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = mesh.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world.copy()
        n = 8 if sec(fr) < T['flight'] else 16
        for _ in range(n):
            vi = pick[rnd.randrange(len(pick))]
            pts.append(tuple(mw @ me.vertices[vi].co))
            births.append(sec(fr) + rnd.uniform(0, 2 / FPS))
            vels.append((rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), rnd.uniform(-0.18, 0.04)))
        ev.to_mesh_clear()
    me = bpy.data.meshes.new('TrailPoints')
    me.from_pydata(pts, [], [])
    b = me.attributes.new('birth', 'FLOAT', 'POINT')
    b.data.foreach_set('value', np.array(births, dtype=np.float32))
    v = me.attributes.new('vel', 'FLOAT_VECTOR', 'POINT')
    v.data.foreach_set('vector', np.array(vels, dtype=np.float32).ravel())
    ob = bpy.data.objects.new('Reborn_Trail', me)
    col.objects.link(ob)

    m = bpy.data.materials.new('Trail_Light')
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb('#ffd9a0')
    em.inputs['Strength'].default_value = 9.0
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])

    ng = bpy.data.node_groups.new('QDL_Trail', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    t = N.new('GeometryNodeInputSceneTime')
    bn = N.new('GeometryNodeInputNamedAttribute')
    bn.data_type = 'FLOAT'
    bn.inputs['Name'].default_value = 'birth'
    vn = N.new('GeometryNodeInputNamedAttribute')
    vn.data_type = 'FLOAT_VECTOR'
    vn.inputs['Name'].default_value = 'vel'
    age = N.new('ShaderNodeMath')
    age.operation = 'SUBTRACT'
    L.new(t.outputs['Seconds'], age.inputs[0])
    L.new(bn.outputs['Attribute'], age.inputs[1])
    life = 1.8
    lt0 = N.new('ShaderNodeMath')
    lt0.operation = 'LESS_THAN'
    lt0.inputs[1].default_value = 0.0
    L.new(age.outputs[0], lt0.inputs[0])
    gt = N.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = life
    L.new(age.outputs[0], gt.inputs[0])
    dead = N.new('FunctionNodeBooleanMath')
    dead.operation = 'OR'
    L.new(lt0.outputs[0], dead.inputs[0])
    L.new(gt.outputs[0], dead.inputs[1])
    dele = N.new('GeometryNodeDeleteGeometry')
    L.new(gi.outputs[0], dele.inputs['Geometry'])
    L.new(dead.outputs[0], dele.inputs['Selection'])
    off = N.new('ShaderNodeVectorMath')
    off.operation = 'SCALE'
    L.new(vn.outputs['Attribute'], off.inputs[0])
    L.new(age.outputs[0], off.inputs['Scale'])
    setp = N.new('GeometryNodeSetPosition')
    L.new(dele.outputs[0], setp.inputs['Geometry'])
    L.new(off.outputs[0], setp.inputs['Offset'])
    norm = N.new('ShaderNodeMath')
    norm.operation = 'DIVIDE'
    norm.inputs[1].default_value = life
    L.new(age.outputs[0], norm.inputs[0])
    pi = N.new('ShaderNodeMath')
    pi.operation = 'MULTIPLY'
    pi.inputs[1].default_value = math.pi
    L.new(norm.outputs[0], pi.inputs[0])
    sn = N.new('ShaderNodeMath')
    sn.operation = 'SINE'
    L.new(pi.outputs[0], sn.inputs[0])
    ico = N.new('GeometryNodeMeshIcoSphere')
    ico.inputs['Radius'].default_value = 0.009
    ico.inputs['Subdivisions'].default_value = 1
    inst = N.new('GeometryNodeInstanceOnPoints')
    L.new(setp.outputs[0], inst.inputs['Points'])
    L.new(ico.outputs['Mesh'], inst.inputs['Instance'])
    L.new(sn.outputs[0], inst.inputs['Scale'])
    smat = N.new('GeometryNodeSetMaterial')
    smat.inputs['Material'].default_value = m
    L.new(inst.outputs[0], smat.inputs['Geometry'])
    L.new(smat.outputs[0], go.inputs[0])
    mod = ob.modifiers.new('Trail', 'NODES')
    mod.node_group = ng
    print('[rebirth] trail points', len(pts))


def _warm_light(col):
    ld = bpy.data.lights.new('Rebirth_Warmth', 'AREA')
    ld.color = (1.0, 0.78, 0.55)
    ld.size = 3
    ob = bpy.data.objects.new('Rebirth_Warmth', ld)
    ob.location = (1.2, -2.6, 3.0)
    ob.rotation_euler = (CENTER - ob.location).to_track_quat('-Z', 'Y').to_euler()
    col.objects.link(ob)
    for fr, v in ((f(T['crack']), 0.0), (f(T['unfold']), 260.0), (f(T['end']), 420.0)):
        ld.energy = v
        ld.keyframe_insert('energy', frame=fr)
