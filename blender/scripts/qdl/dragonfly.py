"""Meshy dragonflies made animation-ready.

Meshy gives one textured mesh split into ~1,000 loose islands, with no rig.
We keep its look untouched and add:
- per-vertex attributes from the rest shape: `wing` (0 body .. 1 wing),
  `span` (0 at the root .. 1 at the wing tip), `melt_order` (when each part melts)
- an auto-built armature: root, thorax, head, a five-bone abdomen, four wings
- a material upgrade: translucent wings, thin-film iridescence, a glow control
  and (for the original) a blend into molten glass driven by the melt
- `QDL_Melt`, a Geometry Nodes deformer: ripples, drooping, liquid flow
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

from .common import collection, link, srgb, value_node

WING_BONES = ('wing_F.L', 'wing_F.R', 'wing_H.L', 'wing_H.R')
ABD_BONES = tuple('abd_%d' % i for i in range(1, 6))


# ---------------------------------------------------------------- import

def import_glb(path, name, ratio):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    ob = [o for o in new if o.type == 'MESH'][0]
    for o in new:
        if o is not ob:
            bpy.data.objects.remove(o)
    ob.name = name
    ob.data.name = name + '_Mesh'
    ob.parent = None
    ob.matrix_world = Matrix.Identity(4)
    if ratio < 1:
        dec = ob.modifiers.new('Decimate', 'DECIMATE')
        dec.ratio = ratio
        dec.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in ob.data.polygons:
        p.use_smooth = True
    mat = ob.data.materials[0]
    mat.name = name + '_Skin'
    return ob


# ---------------------------------------------------------------- analysis

def _split_fore_hind(ax, z, wing_mask):
    """Per-|x| bin, split wing vertices into fore (upper) and hind (lower) by 2-means on z."""
    bins = np.linspace(0.22, 0.95, 15)
    xs, splits = [], []
    for a, b in zip(bins[:-1], bins[1:]):
        sel = wing_mask & (ax >= a) & (ax < b)
        zz = z[sel]
        if len(zz) < 50:
            continue
        lo, hi = np.percentile(zz, 15), np.percentile(zz, 85)
        for _ in range(12):
            mid = (lo + hi) / 2
            lo, hi = zz[zz < mid].mean(), zz[zz >= mid].mean()
        xs.append((a + b) / 2)
        splits.append((lo + hi) / 2)
    return np.array(xs), np.array(splits)


def analyse(ob):
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    x, z = co[:, 0], co[:, 2]
    ax = np.abs(x)
    wing = np.clip((ax - 0.1) / 0.1, 0, 1)
    wing = wing * wing * (3 - 2 * wing)
    span = np.clip((ax - 0.06) / 0.89, 0, 1)
    xs, splits = _split_fore_hind(ax, z, ax > 0.2)
    split_at = np.interp(ax, xs, splits)
    fore = (z > split_at).astype(float)

    body = ax < 0.06
    zmin = float(z[body].min())
    zmax = float(z[ax < 0.08].max())
    root_band = (ax > 0.1) & (ax < 0.2)
    z_fore = float(z[root_band & (fore > 0.5)].mean())
    z_hind = float(z[root_band & (fore < 0.5)].mean())
    tip_band = ax > 0.8
    z_fore_tip = float(z[tip_band & (fore > 0.5)].mean())
    z_hind_tip = float(z[tip_band & (fore < 0.5)].mean())

    rng = np.random.default_rng(3)
    jitter = rng.normal(0, 0.02, n)
    body_order = 0.38 + 0.6 * (z - zmin) / (zmax - zmin)
    wing_order = 0.02 + 0.42 * (1 - span)
    melt_order = np.where(wing > 0.5, wing_order, body_order) + jitter

    for name, data in (('wing', wing), ('span', span), ('fore', fore), ('melt_order', melt_order)):
        a = me.attributes.get(name) or me.attributes.new(name, 'FLOAT', 'POINT')
        a.data.foreach_set('value', data.astype(np.float32))
    info = dict(zmin=zmin, zmax=zmax, z_fore=z_fore, z_hind=z_hind, z_fore_tip=z_fore_tip, z_hind_tip=z_hind_tip,
                half_span=float(ax.max()))
    print('[dragonfly] %s verts=%d info=%s' % (ob.name, n, {k: round(v, 3) for k, v in info.items()}))
    return co, wing, fore, info


# ---------------------------------------------------------------- rig

def build_rig(ob, co, wing, fore, info, name):
    arm = bpy.data.armatures.new(name + '_Armature')
    rig = bpy.data.objects.new(name + '_Rig', arm)
    for c in ob.users_collection:
        c.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    zf, zh = info['z_fore'], info['z_hind']
    z_thx_lo = zh - 0.06
    z_head = zf + 0.07

    def bone(n, h, t, parent=None):
        b = eb.new(n)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0
        if parent:
            b.parent = eb[parent]
        return b

    bone('root', (0, 0, z_thx_lo), (0, 0, z_thx_lo + 0.05))
    bone('thorax', (0, 0, z_thx_lo), (0, 0, z_head), 'root')
    bone('head', (0, 0, z_head), (0, 0, info['zmax']), 'thorax')
    zs = np.linspace(z_thx_lo, info['zmin'], len(ABD_BONES) + 1)
    prev = 'thorax'
    for i, n in enumerate(ABD_BONES):
        bone(n, (0, 0, zs[i]), (0, 0, zs[i + 1]), prev)
        eb[n].use_connect = i > 0
        prev = n
    for side, sx in (('L', -1), ('R', 1)):
        bone('wing_F.' + side, (sx * 0.05, 0, zf), (sx * 0.92, 0, info['z_fore_tip']), 'thorax')
        bone('wing_H.' + side, (sx * 0.05, 0, zh), (sx * 0.9, 0, info['z_hind_tip']), 'thorax')
    bpy.ops.object.mode_set(mode='OBJECT')

    # weights
    groups = {b.name: ob.vertex_groups.new(name=b.name) for b in arm.bones if b.name != 'root'}
    x, z = co[:, 0], co[:, 2]
    body_w = 1 - wing
    for i in range(len(co)):
        w = float(wing[i])
        if w > 0:
            side = 'L' if x[i] < 0 else 'R'
            groups[('wing_F.' if fore[i] > 0.5 else 'wing_H.') + side].add([i], w, 'REPLACE')
        bw = float(body_w[i])
        if bw <= 0:
            continue
        zi = z[i]
        if zi >= z_head:
            groups['head'].add([i], bw, 'REPLACE')
        elif zi >= z_thx_lo:
            groups['thorax'].add([i], bw, 'REPLACE')
        else:
            u = (z_thx_lo - zi) / (z_thx_lo - info['zmin']) * len(ABD_BONES)
            k = min(len(ABD_BONES) - 1, int(u))
            frac = u - k
            groups[ABD_BONES[k]].add([i], bw * (1 - frac * 0.5), 'REPLACE')
            if frac > 0.5 and k + 1 < len(ABD_BONES):
                groups[ABD_BONES[k + 1]].add([i], bw * (frac - 0.5), 'REPLACE')
            elif frac < 0.5 and k > 0:
                groups[ABD_BONES[k - 1]].add([i], bw * (0.5 - frac), 'REPLACE')
            elif k == 0 and frac < 0.5:
                groups['thorax'].add([i], bw * (0.5 - frac), 'REPLACE')
    mod = ob.modifiers.new('Rig', 'ARMATURE')
    mod.object = rig
    ob.parent = rig
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return rig


def arm_space_rot(rig, bone_name, axis, angle):
    """Quaternion for a pose bone that rotates by `angle` about `axis` given in armature space."""
    R = rig.data.bones[bone_name].matrix_local.to_3x3()
    q = Quaternion(Vector(axis).normalized(), angle)
    m = R.inverted() @ q.to_matrix() @ R
    return m.to_quaternion()


# ---------------------------------------------------------------- materials

LIQUID_STOPS = (
    (0.0, '#2fd3c6'),  # iridescent turquoise
    (0.2, '#0e6f74'),  # deep teal
    (0.42, '#7b4fd6'),  # violet
    (0.6, '#d65aa8'),  # soft magenta
    (0.8, '#f0a040'),  # amber
    (1.0, '#ffd27a'),  # liquid gold
)


def liquid_nodes(nt, x=0, y=-600, glow_value=None):
    """Molten glass mixed with nectar. Returns the BSDF output socket."""
    N, L = nt.nodes, nt.links
    tc = N.new('ShaderNodeTexCoord')
    tc.location = (x - 900, y)
    noise = N.new('ShaderNodeTexNoise')
    noise.location = (x - 700, y)
    noise.inputs['Scale'].default_value = 5.0
    noise.inputs['Detail'].default_value = 4
    noise.inputs['Distortion'].default_value = 2.0
    L.new(tc.outputs['Object'], noise.inputs['Vector'])
    spread = N.new('ShaderNodeMapRange')
    spread.location = (x - 600, y + 120)
    spread.inputs['From Min'].default_value = 0.32
    spread.inputs['From Max'].default_value = 0.68
    L.new(noise.outputs['Fac'], spread.inputs['Value'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.location = (x - 480, y)
    cr = ramp.color_ramp
    cr.elements[0].position, cr.elements[0].color = LIQUID_STOPS[0][0], srgb(LIQUID_STOPS[0][1])
    cr.elements[1].position, cr.elements[1].color = LIQUID_STOPS[-1][0], srgb(LIQUID_STOPS[-1][1])
    for p, c in LIQUID_STOPS[1:-1]:
        e = cr.elements.new(p)
        e.color = srgb(c)
    L.new(spread.outputs['Result'], ramp.inputs[0])
    b = N.new('ShaderNodeBsdfPrincipled')
    b.name = 'Liquid'
    b.location = (x - 200, y)
    pale = N.new('ShaderNodeMix')
    pale.data_type = 'RGBA'
    pale.location = (x - 330, y + 150)
    pale.inputs['Factor'].default_value = 0.0
    L.new(ramp.outputs[0], pale.inputs['A'])
    pale.inputs['B'].default_value = (1, 1, 1, 1)
    L.new(pale.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Metallic'].default_value = 0.0
    b.inputs['Roughness'].default_value = 0.025
    b.inputs['IOR'].default_value = 1.47
    b.inputs['Transmission Weight'].default_value = 0.5
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = 0.03
    film = N.new('ShaderNodeMapRange')
    film.location = (x - 480, y - 260)
    film.inputs['To Min'].default_value = 250
    film.inputs['To Max'].default_value = 900
    L.new(noise.outputs['Fac'], film.inputs['Value'])
    L.new(film.outputs['Result'], b.inputs['Thin Film Thickness'])
    b.inputs['Thin Film IOR'].default_value = 1.5
    # glowing internal highlights: strongest where we look straight into the glass
    lw = N.new('ShaderNodeLayerWeight')
    lw.location = (x - 700, y - 420)
    lw.inputs['Blend'].default_value = 0.4
    inv = N.new('ShaderNodeMath')
    inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.6
    inv.location = (x - 480, y - 420)
    L.new(lw.outputs['Facing'], inv.inputs[1])
    strength = N.new('ShaderNodeMath')
    strength.operation = 'MULTIPLY'
    strength.location = (x - 300, y - 420)
    L.new(inv.outputs[0], strength.inputs[0])
    if glow_value is not None:
        L.new(glow_value.outputs[0], strength.inputs[1])
    else:
        strength.inputs[1].default_value = 0.3
    nectar = N.new('ShaderNodeMix')
    nectar.data_type = 'RGBA'
    nectar.location = (x - 330, y - 600)
    nectar.inputs['Factor'].default_value = 0.3
    L.new(ramp.outputs[0], nectar.inputs['A'])
    nectar.inputs['B'].default_value = srgb('#ffc76a')
    L.new(nectar.outputs['Result'], b.inputs['Emission Color'])
    L.new(strength.outputs[0], b.inputs['Emission Strength'])
    return b.outputs[0]


def liquid_material(name='Liquid_Nectar', glow=0.8):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    gv = value_node(nt, 'LiquidGlow', glow, (-1200, -900))
    m.thickness_mode = 'SPHERE'
    out = liquid_nodes(nt, glow_value=gv)
    nt.links.new(out, nt.nodes['Material Output'].inputs['Surface'])
    m.use_raytrace_refraction = True
    m.surface_render_method = 'DITHERED'
    return m


def _attr(nt, name, loc):
    a = nt.nodes.new('ShaderNodeAttribute')
    a.attribute_name = name
    a.location = loc
    return a


def _math(nt, op, a=None, b=None, loc=(0, 0), clamp=False):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    n.location = loc
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def upgrade_skin(ob, kind):
    """Keep Meshy's textures; add translucency, thin film, glow, and the melt or rebirth controls."""
    m = ob.data.materials[0]
    nt = m.node_tree
    N, L = nt.nodes, nt.links
    b = next(n for n in N if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    out = next(n for n in N if n.bl_idname == 'ShaderNodeOutputMaterial')
    tex = b.inputs['Base Color'].links[0].from_node if b.inputs['Base Color'].links else None
    base = tex.outputs['Color'] if tex else None

    wing = _attr(nt, 'wing', (-900, 500)).outputs['Fac']
    span = _attr(nt, 'span', (-900, 650)).outputs['Fac']
    glow = value_node(nt, 'Glow', 0.0, (-900, 800))
    film_shift = value_node(nt, 'FilmShift', 0.0, (-900, 950))

    # thin-film iridescence, drifting across the surface
    tc = N.new('ShaderNodeTexCoord')
    tc.location = (-1300, 300)
    nz = N.new('ShaderNodeTexNoise')
    nz.location = (-1100, 300)
    nz.inputs['Scale'].default_value = 7.0
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    film = N.new('ShaderNodeMapRange')
    film.location = (-900, 300)
    film.inputs['To Min'].default_value = 260
    film.inputs['To Max'].default_value = 560
    L.new(nz.outputs['Fac'], film.inputs['Value'])
    thick = _math(nt, 'ADD', film.outputs['Result'], film_shift.outputs[0], (-700, 300))
    L.new(thick, b.inputs['Thin Film Thickness'])
    b.inputs['Thin Film IOR'].default_value = 1.42

    # glow: the texture's own colours lit from within, more on the wings
    if base is not None:
        L.new(base, b.inputs['Emission Color'])
    wing_glow = _math(nt, 'MULTIPLY_ADD', wing, 0.9, (-700, 700))
    nt.nodes[wing_glow.node.name].inputs[2].default_value = 0.35
    em = _math(nt, 'MULTIPLY', wing_glow, glow.outputs[0], (-500, 700))
    L.new(em, b.inputs['Emission Strength'])

    # translucent wings
    wing_alpha = _math(nt, 'MULTIPLY_ADD', wing, -0.42 if kind == 'original' else -0.3, (-700, 500))
    nt.nodes[wing_alpha.node.name].inputs[2].default_value = 1.0
    b.inputs['Alpha'].default_value = 1.0
    if b.inputs['Alpha'].links:
        L.remove(b.inputs['Alpha'].links[0])

    surface = b.outputs[0]
    alpha = wing_alpha

    if kind == 'original':
        melt = _attr(nt, 'melt', (-900, -200)).outputs['Fac']
        to_glass = N.new('ShaderNodeMapRange')
        to_glass.location = (-500, -200)
        to_glass.inputs['From Min'].default_value = 0.1
        to_glass.inputs['From Max'].default_value = 0.55
        to_glass.interpolation_type = 'SMOOTHSTEP'
        L.new(melt, to_glass.inputs['Value'])
        lg = value_node(nt, 'LiquidGlow', 0.8, (-1200, -900))
        liquid = liquid_nodes(nt, x=0, y=-700, glow_value=lg)
        mix = N.new('ShaderNodeMixShader')
        mix.location = (300, 0)
        L.new(to_glass.outputs['Result'], mix.inputs[0])
        L.new(surface, mix.inputs[1])
        L.new(liquid, mix.inputs[2])
        surface = mix.outputs[0]
        fade = N.new('ShaderNodeMapRange')
        fade.location = (-500, -380)
        fade.inputs['From Min'].default_value = 0.55
        fade.inputs['From Max'].default_value = 0.85
        fade.inputs['To Min'].default_value = 1.0
        fade.inputs['To Max'].default_value = 0.0
        L.new(melt, fade.inputs['Value'])
        alpha = _math(nt, 'MULTIPLY', wing_alpha, fade.outputs['Result'], (-300, 400))
    else:
        # rebirth: a luminous silhouette that resolves into the jewel, and gold
        # running out along the veins as the wings unfold
        sil = value_node(nt, 'Silhouette', 0.0, (-900, -200))
        band = value_node(nt, 'VeinBand', -0.2, (-900, -350))
        gold = N.new('ShaderNodeEmission')
        gold.location = (100, -250)
        gold.inputs['Color'].default_value = srgb('#ffc76a')
        gold.inputs['Strength'].default_value = 14.0
        mix = N.new('ShaderNodeMixShader')
        mix.location = (300, 0)
        L.new(sil.outputs[0], mix.inputs[0])
        L.new(surface, mix.inputs[1])
        L.new(gold.outputs[0], mix.inputs[2])
        d = _math(nt, 'SUBTRACT', span, band.outputs[0], (-700, -350))
        d = _math(nt, 'ABSOLUTE', d, None, (-550, -350))
        mask = N.new('ShaderNodeMapRange')
        mask.location = (-400, -350)
        mask.inputs['From Min'].default_value = 0.0
        mask.inputs['From Max'].default_value = 0.12
        mask.inputs['To Min'].default_value = 1.0
        mask.inputs['To Max'].default_value = 0.0
        L.new(d, mask.inputs['Value'])
        lum = N.new('ShaderNodeRGBToBW')
        lum.location = (-700, -500)
        if base is not None:
            L.new(base, lum.inputs[0])
        veins = _math(nt, 'MULTIPLY', mask.outputs['Result'], lum.outputs[0], (-250, -350))
        veins = _math(nt, 'MULTIPLY', veins, wing, (-100, -350))
        veins = _math(nt, 'MULTIPLY', veins, 22.0, (50, -350))
        vein_em = N.new('ShaderNodeEmission')
        vein_em.location = (200, -420)
        vein_em.inputs['Color'].default_value = srgb('#ffd27a')
        L.new(veins, vein_em.inputs['Strength'])
        add = N.new('ShaderNodeAddShader')
        add.location = (450, -100)
        L.new(mix.outputs[0], add.inputs[0])
        L.new(vein_em.outputs[0], add.inputs[1])
        surface = add.outputs[0]

    transp = N.new('ShaderNodeBsdfTransparent')
    transp.location = (450, 200)
    final = N.new('ShaderNodeMixShader')
    final.location = (650, 100)
    L.new(alpha, final.inputs[0])
    L.new(transp.outputs[0], final.inputs[1])
    L.new(surface, final.inputs[2])
    L.new(final.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'DITHERED'
    m.use_transparent_shadow = True
    return m


# ---------------------------------------------------------------- melt deformer

def melt_group():
    ng = bpy.data.node_groups.get('QDL_Melt')
    if ng:
        return ng
    ng = bpy.data.node_groups.new('QDL_Melt', 'GeometryNodeTree')
    I = ng.interface
    I.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    I.new_socket('Melt', in_out='INPUT', socket_type='NodeSocketFloat')
    I.new_socket('Ripple', in_out='INPUT', socket_type='NodeSocketFloat')
    I.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi, go = N.new('NodeGroupInput'), N.new('NodeGroupOutput')
    pos = N.new('GeometryNodeInputPosition')
    nrm = N.new('GeometryNodeInputNormal')
    t = N.new('GeometryNodeInputSceneTime')
    order = N.new('GeometryNodeInputNamedAttribute')
    order.data_type = 'FLOAT'
    order.inputs['Name'].default_value = 'melt_order'

    def math(op, a, b, clamp=False):
        n = N.new('ShaderNodeMath')
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            elif v is not None:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    def vmath(op, a, b=None, scale=None):
        n = N.new('ShaderNodeVectorMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, tuple):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        if scale is not None:
            if isinstance(scale, (int, float)):
                n.inputs['Scale'].default_value = scale
            else:
                L.new(scale, n.inputs['Scale'])
        return n.outputs[0]

    # melt front with a ragged, organic edge
    jn = N.new('ShaderNodeTexNoise')
    jn.inputs['Scale'].default_value = 5.0
    L.new(pos.outputs[0], jn.inputs['Vector'])
    jitter = math('MULTIPLY', math('SUBTRACT', jn.outputs['Fac'], 0.5), 0.16)
    m = math('SUBTRACT', gi.outputs['Melt'], order.outputs['Attribute'])
    m = math('ADD', m, jitter)
    m = math('DIVIDE', m, 0.24, clamp=True)
    m2 = math('MULTIPLY', m, m)

    # flowing 4D noise for ripples and liquid swirl
    fl = N.new('ShaderNodeTexNoise')
    fl.noise_dimensions = '4D'
    fl.inputs['Scale'].default_value = 6.0
    fl.inputs['Detail'].default_value = 3
    L.new(pos.outputs[0], fl.inputs['Vector'])
    L.new(math('MULTIPLY', t.outputs['Seconds'], 0.6), fl.inputs['W'])
    ripple = vmath('SCALE', nrm.outputs[0], None, math('MULTIPLY', math('SUBTRACT', fl.outputs['Fac'], 0.5), math('MULTIPLY', gi.outputs['Ripple'], 0.035)))
    swirl = vmath('SCALE', vmath('SUBTRACT', fl.outputs['Color'], (0.5, 0.5, 0.5)), None, math('MULTIPLY', m, 0.1))

    # droop: heavy like glass, accelerating as it lets go
    droop = math('ADD', math('MULTIPLY', m2, 0.1), math('MULTIPLY', math('MULTIPLY', m2, m), 0.16))
    sep = N.new('ShaderNodeSeparateXYZ')
    L.new(pos.outputs[0], sep.inputs[0])
    comb = N.new('ShaderNodeCombineXYZ')
    L.new(math('MULTIPLY', math('MULTIPLY', sep.outputs['X'], m), -0.15), comb.inputs['X'])
    L.new(math('MULTIPLY', droop, -1.0), comb.inputs['Z'])

    off = vmath('ADD', vmath('ADD', ripple, swirl), comb.outputs[0])
    setp = N.new('GeometryNodeSetPosition')
    L.new(gi.outputs['Geometry'], setp.inputs['Geometry'])
    L.new(off, setp.inputs['Offset'])
    store = N.new('GeometryNodeStoreNamedAttribute')
    store.data_type = 'FLOAT'
    store.domain = 'POINT'
    store.inputs['Name'].default_value = 'melt'
    L.new(setp.outputs[0], store.inputs['Geometry'])
    L.new(m, store.inputs['Value'])
    L.new(store.outputs[0], go.inputs[0])
    return ng


def add_melt(ob):
    mod = ob.modifiers.new('Melt', 'NODES')
    mod.node_group = melt_group()
    return mod


def prepare(path, name, ratio, kind):
    col = collection('Dragonfly_' + kind.title())
    ob = import_glb(path, name, ratio)
    link(ob, col)
    co, wing, fore, info = analyse(ob)
    rig = build_rig(ob, co, wing, fore, info, name)
    upgrade_skin(ob, kind)
    return ob, rig, info
