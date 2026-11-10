"""Encode a rendered frame sequence into web video with Blender's own FFmpeg.

    blender -b --factory-startup -P blender/scripts/encode_video.py -- <frames_dir> <out_file> <width> <height> [quality]

out_file ending .mp4 -> H.264, .webm -> VP9. quality: HIGH | MEDIUM | LOW (default MEDIUM).
The frames are already colour-managed, so the encode uses the Standard view (no second grade).
"""
import os
import sys

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
frames_dir, out_file, width, height = args[0], args[1], int(args[2]), int(args[3])
quality = args[4] if len(args) > 4 else 'MEDIUM'
files = sorted(f for f in os.listdir(frames_dir) if f.lower().endswith(('.jpg', '.png')))
if not files:
    sys.exit('no frames in ' + frames_dir)

sc = bpy.context.scene
sc.render.fps = 24
sc.render.resolution_x, sc.render.resolution_y = width, height
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
se = sc.sequence_editor_create()
strip = se.strips.new_image('film', os.path.join(frames_dir, files[0]), channel=1, frame_start=1, fit_method='FIT')
for name in files[1:]:
    strip.elements.append(name)
sc.frame_start = 1
sc.frame_end = len(files)

ims = sc.render.image_settings
ims.media_type = 'VIDEO'
ims.file_format = 'FFMPEG'
ff = sc.render.ffmpeg
webm = out_file.lower().endswith('.webm')
ff.format = 'WEBM' if webm else 'MPEG4'
ff.codec = 'WEBM' if webm else 'H264'
ff.constant_rate_factor = quality
ff.ffmpeg_preset = 'BEST'
ff.gopsize = 24  # a keyframe every second keeps seeking and skipping light
ff.use_max_b_frames = False
ff.audio_codec = 'NONE'
sc.render.use_sequencer = True
sc.render.use_compositing = False
sc.render.filepath = out_file
bpy.ops.render.render(animation=True)
print('[encode] wrote', out_file, os.path.getsize(out_file) // 1024, 'KB')
