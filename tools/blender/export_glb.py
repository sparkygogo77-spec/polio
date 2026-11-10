"""Export a pass .blend, with its current Scene slider values, to one .glb the Builder's Models view opens.

Run hidden, in background Blender (5.2), under the PC-wide heavy lock:

    node tools/blender/export-glb.mjs <pass.blend> [-- set=nose=0.4 take=<collection>]   (takes the lock, runs hidden)
    blender.exe -b <pass.blend> --python tools/blender/export_glb.py -- out=<path.glb> [set=nose=0.4] [visible=1] [groups=1] [take=<collection>] [draco=0]

- out=      where the .glb goes (default: next to the pass, same name, .glb). Never anywhere else in constructs/.
- set=k=v   override a Scene slider (scene["k"]) before export; repeat for more. The drivers it feeds are settled first.
- visible=  1 (default): only what is visible in the viewport (the take on show); 0: every object.
- groups=   1 (default): Blender's collections become named groups, so the viewer can frame one take; 0: flat.
- take=     export only this collection (a take or a shelf), by its name.
- draco=    1: Draco mesh compression (smaller, the viewer decodes it); default 0 so any glTF viewer opens it.

Prints one line `GLB_DONE {"out":..., "bytes":..., "seconds":..., "objects":..., "sliders":{...}}` for scripts to read.
The .blend itself is never saved: the slider changes live only in this background run.
"""
import json
import os
import sys
import time

import bpy


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = {"set": {}}
    for a in argv:
        k, _, v = a.partition("=")
        if k == "set":
            sk, _, sv = v.partition("=")
            out["set"][sk] = sv
        else:
            out[k] = v
    return out


def num(v):
    try:
        return int(v)
    except ValueError:
        try:
            return float(v)
        except ValueError:
            return v


def sliders(scene):
    """The pass's Scene sliders: the custom properties on the scene that hold a number."""
    got = {}
    for k in scene.keys():
        if k.startswith("_") or k in ("cycles", "cycles_curves"):
            continue
        v = scene[k]
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            got[k] = v
    return got


def main():
    a = args()
    t0 = time.time()
    blend = bpy.data.filepath
    out = a.get("out") or os.path.splitext(blend)[0] + ".glb"
    out = os.path.abspath(out)
    scene = bpy.context.scene

    for k, v in a["set"].items():
        scene[k] = num(v)
    # Drivers fed by the sliders settle on a frame change; then the depsgraph carries them into the export.
    scene.frame_set(scene.frame_current)
    bpy.context.view_layer.update()

    visible = a.get("visible", "1") != "0"
    objects = [o for o in scene.objects if (o.visible_get() if visible else True) and o.type in {"MESH", "CURVE", "SURFACE", "META", "FONT", "EMPTY", "ARMATURE", "CURVES", "POINTCLOUD"}]

    os.makedirs(os.path.dirname(out), exist_ok=True)
    kw = dict(
        filepath=out,
        export_format="GLB",
        use_visible=visible,
        export_apply=True,  # modifiers (and geometry nodes) as they stand with the current sliders
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,  # custom properties ride along as glTF extras
        export_hierarchy_full_collections=a.get("groups", "1") != "0",
        export_draco_mesh_compression_enable=a.get("draco", "0") == "1",
    )
    if a.get("take"):
        if a["take"] not in bpy.data.collections:
            raise SystemExit("No collection named " + repr(a["take"]) + "; there are: " + ", ".join(c.name for c in bpy.data.collections)[:2000])
        kw["collection"] = a["take"]
        kw["use_visible"] = False
    # Draco crashed Blender 5.2.2 on pass 952 (access violation in the encoder, 2026-11-09): try it, never by default.
    # Options differ a little between Blender versions: drop any this build does not know.
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = {k: v for k, v in kw.items() if k in props}
    bpy.ops.export_scene.gltf(**kw)

    info = {
        "out": out,
        "bytes": os.path.getsize(out),
        "seconds": round(time.time() - t0, 2),
        "objects": len(objects),
        "sliders": sliders(scene),
        "blender": bpy.app.version_string,
    }
    print("GLB_DONE " + json.dumps(info))


main()
