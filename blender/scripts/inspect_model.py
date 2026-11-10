# Inspect the Meshy dragonfly: parts, bounds, materials. Renders two look-dev stills.
# blender -b -P blender/scripts/inspect_model.py -- <out_dir> [glb name in source/]
import bpy, bmesh, sys, os, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out = args[0] if args else '.'
name = args[1] if len(args) > 1 else 'dragonfly_meshy'
here = os.path.dirname(os.path.abspath(__file__))
glb = os.path.join(here, '..', 'source', name + '.glb')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
print('OBJ', ob.name, 'loc', tuple(ob.location), 'rot', tuple(ob.rotation_euler), 'dims', tuple(ob.dimensions))
me = ob.data
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
# connected components
seen = set(); parts = []
for v in bm.verts:
    if v.index in seen: continue
    stack = [v]; comp = []
    seen.add(v.index)
    while stack:
        a = stack.pop(); comp.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index); stack.append(b)
    xs = [c.co.x for c in comp]; ys = [c.co.y for c in comp]; zs = [c.co.z for c in comp]
    parts.append((len(comp), (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))))
parts.sort(reverse=True)
print('PARTS', len(parts))
for p in parts[:15]:
    print('  n=%d x[%.3f,%.3f] y[%.3f,%.3f] z[%.3f,%.3f]' % (p[0], *p[1], *p[2], *p[3]))
for m in me.materials:
    print('MAT', m.name, [n.bl_idname for n in m.node_tree.nodes])
for img in bpy.data.images:
    print('IMG', img.name, img.size[:])
# look-dev render
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 960, 540
world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.03, 0.025, 1)
for loc, e in (((2, -3, 3), 800), ((-3, -1, 1), 300), ((0, 3, 2), 500)):
    l = bpy.data.objects.new('L', bpy.data.lights.new('L', 'AREA')); l.data.energy = e; l.data.size = 3
    l.location = loc; sc.collection.objects.link(l)
    d = Vector((0, 0, 0)) - Vector(loc); l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.objects.new('C', bpy.data.cameras.new('C')); sc.collection.objects.link(cam); sc.camera = cam
for view, loc in (('front', (0, -3.2, 0)), ('persp', (1.8, -2.2, 1.2)), ('top', (0, -0.01, 3.2))):
    cam.location = loc
    d = Vector((0, 0, 0)) - Vector(loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(out, 'inspect-%s-%s.png' % (name, view))
    bpy.ops.render.render(write_still=True)
