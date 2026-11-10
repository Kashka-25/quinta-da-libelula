"""Molten iridescent glass: drips, threads, a spiral into the chrysalis, and nectar.

One metaball object, so every blob, thread and drop flows into its neighbours
with real surface tension. Motion is a small hand-written simulation (gravity,
heavy viscosity, threads that stretch and snap, a spiral vortex), baked to keys.
Elements rest at radius 0 when they are not in use.
"""
import math
import random

import bpy
import numpy as np
from mathutils import Vector

from . import chrysalis as chry
from .common import CENTER, FPS, T, bake_fcurve, collection, ease_io, f, lerp, sec, smooth
from .performance import original_vertex_world

G = -2.4  # heavy, slow, like glass rather than water
DRAG = 1.6
PARK = Vector((0, 40, -20))


class Element:
    def __init__(self, n_frames):
        self.co = np.tile(np.array(PARK, dtype=np.float32), (n_frames, 1))
        self.r = np.zeros(n_frames, dtype=np.float32)


def _sample_sources(mesh, rng, n=2600):
    """Track a few thousand vertices of the melting dragonfly through the melt."""
    me = mesh.data
    order = np.empty(len(me.vertices), dtype=np.float32)
    me.attributes['melt_order'].data.foreach_get('value', order)
    wing = np.empty(len(me.vertices), dtype=np.float32)
    me.attributes['wing'].data.foreach_get('value', wing)
    idx = rng.choice(len(me.vertices), size=n, replace=False)
    frames = list(range(f(T['melt']), f(T['melt_end'] + 0.4) + 1, 3))
    track = np.zeros((len(frames), n, 3), dtype=np.float32)
    melt = np.zeros((len(frames), n), dtype=np.float32)
    for k, fr in enumerate(frames):
        pos, m = original_vertex_world(mesh, fr, idx.tolist())
        track[k] = np.array([tuple(p) for p in pos])
        melt[k] = m
    return idx, frames, track, melt, wing[idx]


def _at(frames, track, j, frame):
    """Interpolate a tracked vertex's world position at any frame."""
    fr = np.clip(frame, frames[0], frames[-1])
    k = np.searchsorted(frames, fr, side='right') - 1
    k = min(k, len(frames) - 2)
    u = (fr - frames[k]) / (frames[k + 1] - frames[k])
    return Vector(track[k, j] * (1 - u) + track[k + 1, j] * u)


def build(mesh, material, chrysalis=None):
    rng = np.random.default_rng(21)
    rnd = random.Random(21)
    sc = bpy.context.scene
    F0 = f(T['melt'])
    F1 = f(T['end'])
    nF = F1 + 1
    elems = []

    def new_el():
        e = Element(nF)
        elems.append(e)
        return e

    idx, frames, track, melt, wingness = _sample_sources(mesh, rng)
    frames = np.array(frames)

    # when each tracked vertex starts to flow (melt crosses 0.32)
    birth = np.full(len(idx), np.inf)
    for j in range(len(idx)):
        hit = np.nonzero(melt[:, j] > 0.32)[0]
        if len(hit):
            birth[j] = frames[hit[0]]
    usable = np.nonzero(np.isfinite(birth))[0]
    rng.shuffle(usable)

    # chrysalis surface targets for the gathering
    def target(i, n):
        u = 0.08 + 0.84 * ((i * 0.618) % 1.0)
        th = (i * 2.399) % math.tau
        return chry.surface_point(u, th, inset=0.15)

    gather_start = T['gather']
    pool = CENTER + Vector((0, 0, -0.74))  # where the molten glass collects before it rises

    # ---- parcels: blobs born from the melting body that drip, some with threads
    n_parcels = 190
    for p in range(n_parcels):
        j = int(usable[p % len(usable)])
        fb = int(birth[j]) + rnd.randint(0, 6)
        hold = rnd.uniform(0.25, 1.1) * FPS
        fr_release = int(fb + hold)
        threaded = p % 4 == 0
        r_max = rnd.uniform(0.07, 0.12) * (0.8 if wingness[j] > 0.5 else 1.1)
        head = new_el()
        tail = [new_el() for _ in range(6)] if threaded else []
        pos = None
        vel = Vector((0, 0, 0))
        anchor_release = None
        snap_len = rnd.uniform(0.28, 0.6)
        snapped_at = None
        g_start = max(gather_start + rnd.uniform(0.0, 1.3), sec(fr_release) + 0.4)
        tgt = target(p, n_parcels)
        g_dur = rnd.uniform(1.7, 2.5)
        turns = rnd.uniform(1.2, 1.9)
        g_from = None
        cohesive = p % 5 != 0
        pool_i = pool + Vector((rnd.gauss(0, 0.06), rnd.gauss(0, 0.04), rnd.gauss(0, 0.09)))
        for fr in range(fb, F1 + 1):
            t = sec(fr)
            dt = 1 / FPS
            if t < g_start:
                anchor = _at(frames, track, j, fr)
                if fr < fr_release:
                    # swelling on the surface, carried by the melt
                    pos = anchor.copy()
                    rr = r_max * smooth(fb, fr_release, fr)
                else:
                    # let go: heavy fall and viscous drag. Most of the glass is held
                    # by surface tension into one hanging, slowly turning mass;
                    # a few drops break free and fall away.
                    vel.z += G * dt
                    if cohesive:
                        swirl = Vector((-(pos.y - pool.y), pos.x - pool.x, 0)) * 0.9
                        vel += ((pool_i - pos) * 7.0 + swirl) * dt
                        vel *= math.exp(-2.6 * dt)
                        r_max = min(r_max * 1.004, 0.15)
                    else:
                        vel *= math.exp(-DRAG * dt)
                    vel.x += math.sin(t * 2.0 + p) * 0.04 * dt
                    pos = pos + vel * dt
                    if pos.z < 0.12:
                        pos.z = 0.12
                        vel.z = 0
                    rr = r_max
                head.co[fr] = pos
                head.r[fr] = rr
                if tail:
                    stretch = (pos - anchor).length
                    if snapped_at is None and fr >= fr_release and stretch > snap_len:
                        snapped_at = fr
                        anchor_release = anchor.copy()
                    for k, el in enumerate(tail):
                        a = (k + 1) / (len(tail) + 1)
                        if snapped_at is None:
                            # the neck: thick at the source, thinnest just above the drop
                            el.co[fr] = anchor.lerp(pos, a)
                            el.r[fr] = rr * (0.62 - 0.38 * math.sin(math.pi * a * 0.85)) * min(1, stretch / 0.08 + 0.3)
                        else:
                            # after the snap: the upper half springs back, the lower half falls into the drop
                            age = (fr - snapped_at) / FPS
                            k_up = a < 0.5
                            src = anchor if k_up else pos
                            el.co[fr] = (anchor_release.lerp(pos, a)).lerp(src, min(1, age * 3.5))
                            el.r[fr] = rr * 0.35 * max(0.0, 1 - age * 2.5)
            else:
                # the gathering: a rising spiral around the chrysalis axis
                if g_from is None:
                    if pos is None:
                        pos = _at(frames, track, j, fr)
                    g_from = pos.copy()
                    rel = g_from - CENTER
                    r0, th0, h0 = math.hypot(rel.x, rel.y), math.atan2(rel.y, rel.x), g_from.z
                    relt = tgt - CENTER
                    r1, th1, h1 = math.hypot(relt.x, relt.y), math.atan2(relt.y, relt.x), tgt.z
                    while th1 < th0 + turns * math.tau:
                        th1 += math.tau
                u = ease_io((t - g_start) / g_dur)
                rr_ = lerp(r0, r1, u) + 0.35 * math.sin(math.pi * u)
                th = lerp(th0, th1, u)
                h = lerp(h0, h1, u)
                head.co[fr] = CENTER + Vector((math.cos(th) * rr_, math.sin(th) * rr_, h - CENTER.z))
                # as the glass of the chrysalis forms, the blobs sink into it
                absorb = smooth(T['chrysalis'] - 1.0, T['chrysalis'] + 0.4, t)
                head.r[fr] = r_max * (0.8 + 0.2 * math.sin(math.pi * u)) * (1 - absorb)
                for el in tail:
                    el.r[fr] = 0.0
                if absorb >= 1:
                    break

    # ---- drips from the chrysalis's lower tip while it breathes
    tip = chry.axis_point(0.0) + Vector((0, 0, 0.02))
    t_cycle = T['chrysalis'] - 0.4
    while t_cycle < T['emerge'] + 0.5:
        head = new_el()
        neck = [new_el() for _ in range(5)]
        grow = rnd.uniform(0.9, 1.3)
        r_max = rnd.uniform(0.05, 0.075)
        pos, vel = tip.copy(), Vector((0, 0, 0))
        snapped = None
        for fr in range(f(t_cycle), f(min(T['end'], t_cycle + 4.0)) + 1):
            t = sec(fr)
            age = t - t_cycle
            if age < grow:
                pos = tip + Vector((0, 0, -0.08 * (age / grow) ** 2))
                rr = r_max * smooth(0, grow, age)
            else:
                vel.z += G * 0.8 / FPS
                vel *= math.exp(-DRAG / FPS)
                pos = pos + vel / FPS
                rr = r_max
            head.co[fr], head.r[fr] = pos, rr
            stretch = (pos - tip).length
            if snapped is None and stretch > 0.32:
                snapped = fr
            for k, el in enumerate(neck):
                a = (k + 1) / (len(neck) + 1)
                if snapped is None:
                    el.co[fr] = tip.lerp(pos, a)
                    el.r[fr] = rr * (0.6 - 0.35 * math.sin(math.pi * a))
                else:
                    sa = (fr - snapped) / FPS
                    el.co[fr] = tip.lerp(pos, a).lerp(tip if a < 0.5 else pos, min(1, sa * 4))
                    el.r[fr] = rr * 0.3 * max(0, 1 - sa * 3)
            if pos.z < 0.1:
                head.r[fr] = 0
                break
        t_cycle += rnd.uniform(1.0, 1.5)

    # ---- nectar: streams pouring from the opening petals as they melt away
    if chrysalis is not None:
        tips = {}
        for fr in range(f(T['open'] + 0.4), f(T['unfold'] + 1.8) + 1, 2):
            for k in range(chry.PETALS):
                tips[(k, fr)] = chry.petal_tip_world(chrysalis, k, fr)
        for n in range(84):
            k = n % chry.PETALS
            t_b = T['open'] + 0.5 + (n // chry.PETALS) * 0.22 + rnd.uniform(0, 0.1)
            fb = f(t_b)
            fb += fb % 2
            if (k, fb) not in tips:
                continue
            el = new_el()
            pos = tips[(k, fb)] + Vector((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), 0))
            vel = Vector((0, 0, -0.1))
            r_max = rnd.uniform(0.035, 0.06)
            for fr in range(fb, min(F1, fb + 3 * FPS) + 1):
                vel.z += G / FPS
                vel *= math.exp(-DRAG * 0.7 / FPS)
                pos = pos + vel / FPS
                el.co[fr] = pos
                el.r[fr] = r_max * smooth(fb, fb + 6, fr) * (1 if pos.z > 0.2 else 0)

    # ---- write the metaball
    mb = bpy.data.metaballs.new('Liquid_Glass')
    mb.resolution = 0.03
    mb.render_resolution = 0.011
    mb.threshold = 0.6
    ob = bpy.data.objects.new('Liquid_Glass', mb)
    collection('Liquid').objects.link(ob)
    mb.materials.append(material)
    for e in elems:
        el = mb.elements.new()
        el.co = PARK
        el.radius = 0.0
        el.stiffness = 2.0
    print('[liquid] %d metaball elements' % len(elems))

    for i, e in enumerate(elems):
        active = np.nonzero(e.r > 0)[0]
        if len(active) == 0:
            continue
        a, b = max(F0, active[0] - 1), min(F1, active[-1] + 1)
        frames_k = list(range(a, b + 1))
        el = mb.elements[i]
        for c in range(3):
            bake_fcurve(mb, 'elements[%d].co' % i, c, frames_k, [float(e.co[fr][c]) if e.r[fr] > 0 else float(PARK[c]) for fr in frames_k],
                        seed_struct=el, seed_prop='co')
        bake_fcurve(mb, 'elements[%d].radius' % i, -1, frames_k, [float(e.r[fr]) for fr in frames_k], seed_struct=el, seed_prop='radius')
    return ob
