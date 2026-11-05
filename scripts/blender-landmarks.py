"""Mobile landmark authoring in Blender 4.x; no external models or network access.

blender -b -t 2 --python scripts/blender-landmarks.py -- --output public/blender-landmarks

World coordinates below follow the app's metres / Y-up convention.  Baked mesh
coordinates convert to Blender Z-up; glTF export converts them back to app space.
This is an inspired architectural reconstruction, not an exact building survey.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
HIGH = False
MATERIALS = {}
GENERATED = {}


def xyz(p):
    return (p[0], -p[2], p[1])


def reset():
    global MATERIALS, GENERATED
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.preferences.addon_enable(module='io_scene_gltf2')
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    MATERIALS = {}
    GENERATED = {}


def image_map(name, kind='stone', size=512):
    if name in GENERATED:
        return GENERATED[name]
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    pixels = [0.0] * (size * size * 4)
    for y in range(size):
        for x in range(size):
            if kind == 'cloth':
                nx = .19 * math.sin(x * math.tau / 6) + .025 * math.sin(y * .71 + x * .11)
                ny = .14 * math.sin(y * math.tau / 7)
            else:
                nx = .035 * math.sin(x * .81 + y * .37) + .014 * math.sin(x * .11)
                ny = .032 * math.sin(y * .77 - x * .21)
            nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            n = (y * size + x) * 4
            pixels[n:n + 4] = [nx * .5 + .5, ny * .5 + .5, nz * .5 + .5, 1.0]
    image.pixels.foreach_set(pixels)
    image.update()
    image.file_format = 'PNG'
    image.pack()
    GENERATED[name] = image
    return image


def material(name, color, roughness=.7, metallic=0.0, texture=None, normal=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, 1)
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if texture:
        path = ROOT / 'public/assets/textures' / ('high' if HIGH else 'low') / (texture + '.png')
        if path.is_file():
            node = m.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = bpy.data.images.load(str(path), check_existing=True)
            # Multiply the source image by the chosen physical tint. glTF supports
            # baseColorFactor + baseColorTexture, but Blender's exporter does not
            # export arbitrary multiply nodes, so use the texture directly here.
            m.node_tree.links.new(node.outputs['Color'], shader.inputs['Base Color'])
    if normal:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image_map(name + '_baked_normal', normal)
        nm = m.node_tree.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = .3 if normal == 'cloth' else .18
        m.node_tree.links.new(tex.outputs['Color'], nm.inputs['Color'])
        m.node_tree.links.new(nm.outputs['Normal'], shader.inputs['Normal'])
    MATERIALS[name] = m
    return m


def uv_project(obj, metres=4):
    mesh = obj.data
    uv = mesh.uv_layers.get('UVMap') or mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        axis = max(range(3), key=lambda k: abs(face.normal[k]))
        for index in face.loop_indices:
            p = mesh.vertices[mesh.loops[index].vertex_index].co
            if axis == 2:
                value = (p.x / metres, p.y / metres)
            elif axis == 0:
                value = (p.y / metres, p.z / metres)
            else:
                value = (p.x / metres, p.z / metres)
            uv.data[index].uv = value


def mesh(name, verts, faces, mat, smooth=False, uvs=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = smooth
    uv_project(obj)
    if uvs:
        layer = data.uv_layers.active
        for face in data.polygons:
            for n in face.loop_indices:
                layer.data[n].uv = uvs[data.loops[n].vertex_index]
    return obj


def apply_modifiers(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, p, size, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    # Blender4.0 requires Auto Smooth for harden_normals / weighted normals.
    # Blender4.1+ removes this property, so keep the authoring portable.
    if hasattr(obj.data, 'use_auto_smooth'):
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = math.radians(60)
    if bevel > 0:
        mod = obj.modifiers.new('Real edge bevel', 'BEVEL')
        mod.width = min(bevel, min(size) * .22)
        mod.segments = 2 if HIGH else 1
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        weighted = obj.modifiers.new('Weighted stone normals', 'WEIGHTED_NORMAL')
        weighted.keep_sharp = True
    apply_modifiers(obj)
    uv_project(obj)
    return obj


def lathe(name, x, z, profile, mat, segments=None):
    segments = segments or (64 if HIGH else 40)
    verts = []
    for radius, y in profile:
        for n in range(segments):
            angle = n * math.tau / segments
            verts.append((x + math.sin(angle) * max(.001, radius), y, z + math.cos(angle) * max(.001, radius)))
    faces = []
    for row in range(len(profile) - 1):
        for n in range(segments):
            k = (n + 1) % segments
            faces.append((row * segments + n, row * segments + k, (row + 1) * segments + k, (row + 1) * segments + n))
    faces.extend([tuple(range(segments - 1, -1, -1)), tuple((len(profile) - 1) * segments + n for n in range(segments))])
    return mesh(name, verts, faces, mat, smooth=True)


def cylinder(name, x, y, z, radius, height, mat, segments=None):
    return lathe(name, x, z, [(radius, y - height / 2), (radius, y + height / 2)], mat, segments or (20 if HIGH else 12))


def face_point(center, angle, u, y, d=0):
    c, s = math.cos(angle), math.sin(angle)
    return (center[0] + u * c + d * s, center[1] + y, center[2] - u * s + d * c)


def face_box(name, center, angle, u, y, width, height, depth, mat, d=0, bevel=.015):
    obj = box(name, (0, 0, 0), (width, height, depth), mat, bevel)
    obj.location = xyz(face_point(center, angle, u, y, d))
    obj.rotation_euler.z = angle
    # Blender's object matrix transforms custom normals correctly when joined.
    # Geometric brocade uses a complete atlas height rather than a tiny crop.
    if 'brocade' in mat.name.lower():
        layer = obj.data.uv_layers.active
        for loop in obj.data.loops:
            v = obj.data.vertices[loop.vertex_index].co
            layer.data[loop.index].uv = ((v.x / width + .5) * 2, v.z / height + .5)

    return obj


def bezier(a, b, c, d, n):
    points = []
    for k in range(n + 1):
        t = k / n
        q = 1 - t
        points.append((q ** 3 * a[0] + 3 * q * q * t * b[0] + 3 * q * t * t * c[0] + t ** 3 * d[0], q ** 3 * a[1] + 3 * q * q * t * b[1] + 3 * q * t * t * c[1] + t ** 3 * d[1]))
    return points


def arch_roof(width, height):
    n = 16 if HIGH else 10
    left = bezier((-width / 2, height * .51), (-width / 2, height * .78), (-width * .20, height * .94), (0, height), n)
    return left + [(-x, y) for x, y in left[-2::-1]]


def arch_boundary(width, height):
    roof = arch_roof(width, height)
    return [(-width / 2, 0), (width / 2, 0)] + roof[::-1]


def extruded_polygon(name, center, angle, points, depth, mat, d=0):
    verts = [face_point(center, angle, x, y, d) for x, y in points] + [face_point(center, angle, x, y, d - depth) for x, y in points]
    n = len(points)
    faces = [tuple(range(n)), tuple(range(n * 2 - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return mesh(name, verts, faces, mat)


def arch_ring(name, center, angle, width, height, thickness, depth, mat, d=0):
    outer = arch_boundary(width + thickness * 2, height + thickness)
    inner = arch_boundary(width, height)
    n = len(inner)
    verts = []
    for z in [d, d - depth]:
        verts.extend(face_point(center, angle, x, y, z) for x, y in outer)
        verts.extend(face_point(center, angle, x, y, z) for x, y in inner)
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.extend([(i, j, n + j, n + i), (2 * n + i, 3 * n + i, 3 * n + j, 2 * n + j), (i, 2 * n + i, 2 * n + j, j), (n + i, n + j, 3 * n + j, 3 * n + i)])
    return mesh(name, verts, faces, mat)


def bay(name, center, angle, outer_width, outer_height, width, height, depth, stone, reveal, shade, inlay):
    # Real open front, deep reveal, and a separate shaded wall at the back.
    roof = arch_roof(width, height)
    left_width = (outer_width - width) / 2
    for side in [-1, 1]:
        face_box(name + '_pier', center, angle, side * (width / 2 + left_width / 2), outer_height / 2, left_width, outer_height, depth, stone, -depth / 2, .025)
    for i in range(len(roof) - 1):
        a, b = roof[i], roof[i + 1]
        extruded_polygon(name + '_spandrel', center, angle, [a, b, (b[0], outer_height), (a[0], outer_height)], depth, stone)
    boundary = arch_boundary(width, height)
    n = len(boundary)
    verts = [face_point(center, angle, x, y, -.015) for x, y in boundary] + [face_point(center, angle, x, y, -depth + .025) for x, y in boundary]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    mesh(name + '_deep_reveal', verts, faces, reveal)
    mesh(name + '_shadow_back', [face_point(center, angle, x, y, -depth + .01) for x, y in boundary], [tuple(range(n))], shade)
    arch_ring(name + '_raised_moulding', center, angle, width, height, .26 if width > 9 else .18, .24, stone, .10)
    arch_ring(name + '_pietra_outline', center, angle, width + .72, height + .36, .065, .035, inlay, .14)


def smooth_profile(points, samples=2):
    # Catmull-Rom profile yields an onion silhouette rather than angular cones.
    result = []
    for i in range(len(points) - 1):
        p0 = points[max(0, i - 1)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(len(points) - 1, i + 2)]
        for k in range(samples):
            t = k / samples
            value = []
            for j in range(2):
                value.append(.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3))
            result.append((max(.001, value[0]), value[1]))
    result.append(points[-1])
    return result


def onion(name, x, y, z, radius, height, stone, metal, main=False):
    raw = [(.82, 0), (.84, .10), (.98, .30), (1, .46), (.89, .66), (.66, .86), (.34, 1.02), (.09, 1.13), (.015, 1.18)]
    profile = smooth_profile([(r * radius, y + h * height) for r, h in raw], 3 if HIGH else 2)
    lathe(name + '_onion', x, z, profile, stone, (80 if HIGH else 48) if main else (36 if HIGH else 24))
    # Clearly layered drum/cornice interfaces and a tapered metal finial.
    lathe(name + '_base_roll', x, z, [(radius * .79, y - .13), (radius * .84, y), (radius * .85, y + .12)], stone, 64 if HIGH else 40)
    top = y + height * 1.18
    lathe(name + '_finial', x, z, [(.16, top), (.14, top + .65), (.08, top + 1.20), (.035, top + 2.0), (.001, top + 2.35)], metal, 12)
    lathe(name + '_finial_bead', x, z, [(.06, top + .62), (.22, top + .75), (.27, top + .89), (.19, top + 1.02), (.04, top + 1.10)], metal, 12)


def kaaba():
    cloth = material('Kiswa silk with woven normal', (.022, .027, .025), .83, texture='kaaba-cloth', normal='cloth')
    gold = material('Raised warm-gold embroidery', (.59, .39, .12), .37, .78)
    band = material('Geometric gold brocade, no sacred lettering', (.68, .50, .22), .54, .25, 'kaaba-band')
    door = material('Gold door and framing', (.80, .57, .20), .30, .88)
    stone = material('Warm stone socle', (.56, .55, .49), .78, texture='plaster', normal='stone')
    shade = material('Door recessed panels', (.18, .12, .045), .56, .65)
    box('Chamfered socle', (0, .17, -18), (13, .34, 14), stone, .08)
    box('Rounded dark core', (0, 6.72, -18), (11.42, 12.86, 12.02), cloth, .08)
    box('Top cloth cap', (0, 13.12, -18), (11.60, .06, 12.20), cloth, .025)
    faces = [((0, .32, -11.9), 0, 11.6), ((5.8, .32, -18), math.pi / 2, 12.2), ((0, .32, -24.1), math.pi, 11.6), ((-5.8, .32, -18), -math.pi / 2, 12.2)]
    cols, rows = (36, 26) if HIGH else (24, 18)
    for side, (center, angle, width) in enumerate(faces):
        verts, uvs, polygons = [], [], []
        for j in range(rows + 1):
            v = j / rows
            y = v * 12.83
            for i in range(cols + 1):
                u = i / cols
                # Fold displacement is subtle, static and tapers at the belt/top.
                folds = (.034 * math.sin(u * math.tau * 9.5 + side * .8) + .013 * math.sin(u * math.tau * 17 + v * .7)) * (.20 + .80 * (1 - v))
                folds *= math.sin(math.pi * u) ** .3
                verts.append(face_point(center, angle, (u - .5) * width, y, folds))
                uvs.append((u * 3.5, v * 4))
        for j in range(rows):
            for i in range(cols):
                a = j * (cols + 1) + i
                polygons.append((a, a + 1, a + cols + 2, a + cols + 1))
        mesh('Volumetric cloth folds ' + str(side), verts, polygons, cloth, True, uvs)
        # Thin physical edges catch the daylight; texture carries fine stitching.
        for y in [9.31, 10.30]:
            face_box('Brocade raised border', center, angle, 0, y, width + .02, .045, .05, gold, .075, .008)
        face_box('Brocade belt', center, angle, 0, 9.805, width + .025, .95, .055, band, .072, .008)
        for k in range(6):
            u = (k - 2.5) * (width / 6)
            # Actual embossed medallions, deliberately geometric rather than fake text.
            n = 12
            vv, ff = [], []
            for r in [.30, .257]:
                for n1 in range(n):
                    a = n1 * math.tau / n
                    vv.append(face_point(center, angle, u + math.cos(a) * r, 9.805 + math.sin(a) * r, .112))
            for n1 in range(n):
                n2 = (n1 + 1) % n
                ff.append((n1, n2, n + n2, n + n1))
            mesh('Belt relief medallion', vv, ff, gold)
        for y in [7.75]:
            for u in [-width * .32, width * .32]:
                face_box('Lower brocade pendant', center, angle, u, y, 1.12, 1.12, .055, band, .072, .01)
    # Door on the visible/front face, with raised framing, inset panels and knobs.
    center = (2.3, 2.16, -11.79)
    face_box('Door dark inset', center, 0, 0, 1.75, 1.87, 3.60, .10, shade, .025, .04)
    for x in [-.94, .94]:
        face_box('Door frame', center, 0, x, 1.77, .17, 3.83, .18, door, .13, .025)
    for y in [-.10, 3.65]:
        face_box('Door lintel', center, 0, 0, y, 2.05, .18, .20, door, .15, .025)
    face_box('Door central stile', center, 0, 0, 1.77, .105, 3.62, .17, door, .14, .018)
    for x in [-.46, .46]:
        for y in [.37, 1.25, 2.13, 3.01]:
            face_box('Raised gilt panel border', center, 0, x, y, .73, .69, .12, door, .12, .05)
            face_box('Recessed gilt panel field', center, 0, x, y, .53, .49, .05, gold, .19, .03)
            cylinder('Gilt panel roundel', center[0] + x, center[1] + y, center[2] + .26, .065, .08, door, 8)
    return 12000 if not HIGH else 60000


def taj():
    stone = material('Ivory marble with baked micro-normal', (.78, .78, .73), .50, texture='marble', normal='stone')
    reveal = material('Recess marble ambient shade', (.40, .43, .40), .75)
    shade = material('Deep portal backs', (.13, .19, .18), .89)
    inlay = material('Dark jade stone inlay', (.14, .23, .21), .52)
    rose = material('Pietra dura warm stone', (.47, .30, .22), .68)
    metal = material('Aged finial brass', (.51, .39, .18), .41, .75)
    # Set the core behind a 3.8-metre deep open facade. These are real cavities.
    box('Main marble core', (0, 12.2, -54.0), (41.6, 22.0, 27), stone, .11)
    bay('Central monumental iwan', (0, 1.2, -36.48), 0, 18, 22, 12.8, 18.3, 3.85, stone, reveal, shade, inlay)
    for side in [-1, 1]:
        for y in [1.35, 12.0]:
            bay('Two-storey flank iwan', (side * 16.0, y, -36.46), 0, 14, 10.35, 7.1, 8.4, 3.85, stone, reveal, shade, inlay)
        bay('Side monumental iwan', (side * 23.0, 1.2, -52), side * math.pi / 2, 29.7, 21.8, 10, 16.0, 2.1, stone, reveal, shade, inlay)
    # Restrained physical inlays, cornices and pilasters make the silhouette legible.
    for y, w, depth, h in [(1.38, 47.0, 32.3, .35), (22.95, 47.0, 32.6, .32), (23.28, 48.0, 33.3, .30), (23.60, 47.2, 32.8, .20)]:
        box('Stepped marble cornice', (0, y, -52), (w, h, depth), stone, .035)
    for y in [2.0, 22.45]:
        face_box('Continuous pietra band', (0, 0, -36.10), 0, 0, y, 46.4, .10, .035, inlay, 0, .004)
    for x in [-22.85, -9.15, 9.15, 22.85]:
        cylinder('Facade pilaster', x, 12.4, -36.05, .30, 23.0, stone, 12)
        for y in [1.5, 12.0, 23.0]:
            cylinder('Pilaster moulding', x, y, -36.05, .42, .20, stone, 12)
    # Small floral stone motifs on each flank are volumetric but batched by material.
    for x in [-20, -12, 12, 20]:
        for y in [10.7, 21.3]:
            for n in range(6):
                a = n * math.tau / 6
                face_box('Pietra petal', (x, y, -36.0), 0, math.cos(a) * .24, math.sin(a) * .24, .10, .28, .025, rose, .025, .016)
    lathe('Main drum carved profiles', 0, -52, [(8.9, 23.6), (9.35, 23.8), (9.38, 24.1), (9.10, 24.3), (9.10, 28.45), (9.50, 28.55), (9.50, 28.77)], stone, 64 if HIGH else 40)
    for y in [24.6, 27.95]:
        lathe('Drum fine inlay ring', 0, -52, [(9.112, y), (9.112, y + .055)], inlay, 64 if HIGH else 40)
    onion('Main onion dome', 0, 28.8, -52, 11, 12, stone, metal, True)
    for x in [-17, 17]:
        for z in [-41, -63]:
            cylinder('Chhatri base drum', x, 24.9, z, 3.1, 2.25, stone, 24)
            for n in range(8):
                a = n * math.tau / 8
                cylinder('Chhatri slim column', x + math.sin(a) * 2.42, 27.5, z + math.cos(a) * 2.42, .14, 3.0, stone, 8)
            lathe('Chhatri projecting eave', x, z, [(3.0, 28.75), (3.45, 28.83), (3.55, 29.0), (3.25, 29.12)], stone, 28 if HIGH else 20)
            onion('Chhatri dome', x, 29.12, z, 3.2, 3.0, stone, metal)
    return 35000 if not HIGH else 60000


def join_by_material():
    grouped = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            grouped.setdefault(obj.data.materials[0].name, []).append(obj)
    result = []
    for name, objects in grouped.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        obj = bpy.context.object
        obj.name = name
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.data.calc_loop_triangles()
        result.append(obj)
    return result


def build(model, tier, output):
    global HIGH
    HIGH = tier == 'high'
    reset()
    limit = kaaba() if model == 'mecca' else taj()
    objects = join_by_material()
    triangles = sum(len(obj.data.loop_triangles) for obj in objects)
    if triangles > limit:
        raise RuntimeError(f'{model}-{tier}: {triangles} triangles exceeds {limit}')
    if len(objects) > 6:
        raise RuntimeError(f'{model}-{tier}: {len(objects)} materials exceeds six draws')
    output.mkdir(parents=True, exist_ok=True)
    path = output / f'{model}-{tier}.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_normals=True, export_texcoords=True, export_materials='EXPORT', export_cameras=False, export_lights=False, export_animations=False, export_extras=True, export_image_format='AUTO')
    data = {'model': model, 'tier': tier, 'triangles': triangles, 'drawCalls': len(objects), 'bytes': path.stat().st_size, 'file': path.name, 'authoring': 'Blender ' + bpy.app.version_string}
    print('NOOR_ASSET ' + json.dumps(data), flush=True)
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='public/blender-landmarks')
    parser.add_argument('--model', choices=['mecca', 'taj', 'all'], default='all')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    output = Path(args.output).resolve()
    stats = [build(model, tier, output) for model in (['mecca', 'taj'] if args.model == 'all' else [args.model]) for tier in ['low', 'high']]
    (output / 'manifest.json').write_text(json.dumps({'generator': 'Noor Blender landmark authoring', 'models': stats}, indent=2))


if __name__ == '__main__':
    main()
