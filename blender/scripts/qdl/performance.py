"""Choreography: flight, hover, wingbeats, surrender (original) and emergence,
unfolding, hover and flight (reborn). Motion is computed per frame in Python
from smooth functions and baked as keys, so it is exactly repeatable."""
import math
import random

import bpy
from mathutils import Quaternion, Vector

from .common import CENTER, FPS, T, basis_quat, ease_io, f, lerp, sec, smooth
from .dragonfly import ABD_BONES, WING_BONES, arm_space_rot

UPRIGHT_TILT = math.radians(10)  # head leans back a little so the camera, slightly above, sees the back


def upright_quat(tilt=UPRIGHT_TILT):
    head = Vector((0, math.sin(tilt), math.cos(tilt)))
    dorsal = Vector((0, -math.cos(tilt), math.sin(tilt)))
    return basis_quat(head, dorsal)


def catmull(points, t):
    """points: [(time, Vector)], evaluate a centripetal-ish Catmull-Rom by time."""
    ts = [p[0] for p in points]
    if t <= ts[0]:
        return points[0][1].copy()
    if t >= ts[-1]:
        return points[-1][1].copy()
    i = max(k for k in range(len(ts) - 1) if ts[k] <= t)
    p0 = points[max(0, i - 1)][1]
    p1, p2 = points[i][1], points[i + 1][1]
    p3 = points[min(len(points) - 1, i + 2)][1]
    u = (t - ts[i]) / (ts[i + 1] - ts[i])
    u2, u3 = u * u, u * u * u
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)


class WingBeat:
    """Four wings, each with its own phase; hind wings lead the fore wings by a quarter beat."""

    def __init__(self, seed):
        r = random.Random(seed)
        self.phase = {b: (0.0 if b.startswith('wing_H') else -math.pi / 2) + r.uniform(-0.2, 0.2) for b in WING_BONES}
        self.jit = {b: r.uniform(0.94, 1.06) for b in WING_BONES}

    def step(self, freq, dt):
        for b in WING_BONES:
            self.phase[b] += math.tau * freq * self.jit[b] * dt

    def angle(self, b, amp):
        return math.sin(self.phase[b]) * amp


def key_pose(rig, frame, wing_quats, abd=None):
    for b, q in wing_quats.items():
        pb = rig.pose.bones[b]
        pb.rotation_quaternion = q
        pb.keyframe_insert('rotation_quaternion', frame=frame)
    if abd:
        for b, (q, s) in abd.items():
            pb = rig.pose.bones[b]
            pb.rotation_quaternion = q
            pb.scale = (1, s, 1)
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            pb.keyframe_insert('scale', frame=frame)


def key_object(ob, frame, loc, quat):
    ob.rotation_mode = 'QUATERNION'
    ob.location = loc
    ob.rotation_quaternion = quat
    ob.keyframe_insert('location', frame=frame)
    ob.keyframe_insert('rotation_quaternion', frame=frame)


def wing_rot(rig, b, flap, fold_back=0.0, fold_in=0.0):
    """flap: rotation about the body axis (tips toward / away from the back).
    fold_back: sweep tips toward the tail. fold_in: curl tips over the back."""
    side = -1 if b.endswith('.L') else 1
    q = arm_space_rot(rig, b, (0, 0, 1), side * flap - side * fold_in)
    q2 = arm_space_rot(rig, b, (0, 1, 0), side * fold_back)
    return q2 @ q


# ------------------------------------------------------------------ original

ARRIVAL = [
    (0.0, Vector((3.4, 12.0, 3.4))),
    (1.2, Vector((2.2, 7.4, 2.7))),
    (2.3, Vector((0.9, 3.2, 2.0))),
    (3.1, Vector((0.18, 0.9, 1.7))),
    (3.6, Vector((0.0, 0.2, 1.62))),
    (4.2, Vector((0.0, 0.0, 1.6))),
]


def original_transform(t):
    """World location and rotation of the original dragonfly at time t (seconds)."""
    p = catmull(ARRIVAL, t)
    # hover wander, calming to almost nothing as it surrenders
    calm = 1 - 0.85 * smooth(T['surrender'], T['melt'], t)
    hov = smooth(3.2, 4.4, t) * calm
    p += Vector((0.05 * math.sin(1.3 * t), 0.03 * math.sin(0.9 * t + 1), 0.045 * math.sin(1.7 * t + 2))) * hov
    v = catmull(ARRIVAL, t + 0.05) - catmull(ARRIVAL, t - 0.05)
    if v.length < 1e-4:
        v = Vector((0, -1, 0))
    head = v.normalized()
    head.z += 0.15
    q_fly = basis_quat(head, Vector((0, 0, 1)))
    # bank into the curve
    lat = (catmull(ARRIVAL, t + 0.1) - 2 * catmull(ARRIVAL, t) + catmull(ARRIVAL, t - 0.1)).x
    q_fly = q_fly @ Quaternion((0, 0, 1), max(-0.5, min(0.5, -lat * 6)))
    s = smooth(2.5, 3.95, t)
    q = q_fly.slerp(upright_quat(), s)
    wob = Quaternion((1, 0, 0), 0.03 * math.sin(2.1 * t) * hov) @ Quaternion((0, 0, 1), 0.04 * math.sin(1.4 * t + 0.5) * hov)
    return p, q @ wob


def animate_original(rig, mesh, melt_mod, ng):
    from .common import key_modifier_input
    beat = WingBeat(1)
    end = f(T['melt'] + 1.5)
    dt = 1 / FPS
    for fr in range(1, end + 1):
        t = sec(fr)
        loc, quat = original_transform(t)
        key_object(rig, fr, loc, quat)
        # wingbeat: brisk in flight, slower in the hover, stilling in surrender
        freq = lerp(5.2, 3.4, smooth(2.6, 3.8, t))
        freq = lerp(freq, 0.25, smooth(T['surrender'] + 0.2, T['surrender'] + 1.6, t))
        amp = lerp(math.radians(34), math.radians(22), smooth(2.6, 3.8, t))
        amp *= 1 - smooth(T['surrender'] + 0.4, T['surrender'] + 1.8, t)
        beat.step(freq, dt)
        fold = ease_io((t - (T['surrender'] + 1.2)) / 1.9)
        wq = {}
        for b in WING_BONES:
            hind = b.startswith('wing_H')
            wq[b] = wing_rot(rig, b, beat.angle(b, amp),
                             fold_back=fold * math.radians(48 if hind else 34),
                             fold_in=fold * math.radians(30 if hind else 38))
        # abdomen softens and lengthens; a slow undulation runs down it
        soft = smooth(T['surrender'] + 0.8, T['melt'] + 0.8, t)
        abd = {}
        for i, b in enumerate(ABD_BONES):
            sway = math.sin(t * 1.8 - i * 0.7) * math.radians(4) * (0.3 + soft)
            abd[b] = (arm_space_rot(rig, b, (0, 1, 0), sway), 1 + 0.2 * soft)
        key_pose(rig, fr, wq, abd)

    key_modifier_input(mesh, melt_mod, ng, 'Ripple', [
        (f(T['surrender']), 0.0), (f(T['surrender'] + 1.5), 0.6), (f(T['melt']), 1.0), (f(T['melt_end']), 1.4)])
    key_modifier_input(mesh, melt_mod, ng, 'Melt', [
        (f(T['melt']), 0.0), (f(T['melt_end']), 1.32)])

    m = mesh.data.materials[0]
    nt = m.node_tree
    glow = nt.nodes['Glow'].outputs[0]
    for fr, v in ((f(0), 0.0), (f(3.0), 0.18), (f(T['surrender']), 0.25), (f(T['melt']), 1.3), (f(T['melt'] + 2.5), 2.2)):
        glow.default_value = v
        glow.keyframe_insert('default_value', frame=fr)
    shift = nt.nodes['FilmShift'].outputs[0]
    for fr, v in ((f(T['surrender']), 0.0), (f(T['melt']), 260.0), (f(T['melt'] + 2.0), 420.0)):
        shift.default_value = v
        shift.keyframe_insert('default_value', frame=fr)

    for ob in (mesh,):
        for fr, hide in ((1, False), (f(T['melt_end'] + 0.3), True)):
            ob.hide_render = hide
            ob.hide_viewport = False
            ob.keyframe_insert('hide_render', frame=fr)


def original_vertex_world(mesh, frame, indices):
    """Evaluated world positions of some vertices at a frame (for the liquid to be born from)."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world.copy()
    out = [mw @ me.vertices[i].co for i in indices]
    melt_attr = me.attributes.get('melt')
    melt = [melt_attr.data[i].value for i in indices] if melt_attr else [0.0] * len(indices)
    ev.to_mesh_clear()
    return out, melt
