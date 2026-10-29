"""Read-only structural inspection; never deserialize model pickle payloads or print secrets."""
from pathlib import Path
import ast
import csv
import hashlib
import json
import pickletools
import struct
import sys
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'accessbridge---multimodal-assistive-communication-&-environment-awareness'
sys.path.insert(0, str(APP))
sys.dont_write_bytecode = True
from ml.preprocessing.cleaner import LandmarkCleaner
from ml.features.extractor import FeatureExtractor

report = {'scope': 'Structural inspection, array checks, pure preprocessing probes; no model inference, video decode, or cloud requests.'}
assets = []
for p in [ROOT / '3477026897357566765.vrm', APP / 'public/models/avatar.vrm']:
    b = p.read_bytes()
    n = struct.unpack_from('<I', b, 12)[0]
    gltf = json.loads(b[20:20+n])
    vrm = gltf['extensions']['VRM']
    assets.append({'path': str(p), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest(),
                   'vrm_version': vrm['specVersion'], 'bone_names': [x['bone'] for x in vrm['humanoid']['humanBones']],
                   'mesh_count': len(gltf.get('meshes', [])), 'skin_count': len(gltf.get('skins', [])),
                   'animation_count': len(gltf.get('animations', [])),
                   'expression_names': [x['name'] for x in vrm['blendShapeMaster']['blendShapeGroups']]})
report['avatars'] = assets
report['arrays'] = []
for p in sorted((APP / 'data/processed').glob('*.npy')):
    a = np.load(p, allow_pickle=False)
    item = {'name': p.name, 'shape': list(a.shape), 'dtype': str(a.dtype), 'all_finite': bool(np.isfinite(a).all())}
    if 'labels' in p.name:
        v, c = np.unique(a, return_counts=True)
        item['class_counts'] = dict(zip(v.astype(str), c.tolist()))
    report['arrays'].append(item)
with (APP / 'data/manifests/include_greetings_manifest.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
report['manifest'] = {'rows': len(rows), 'columns': list(rows[0]),
                      'missing_video_paths': sum(not Path(r['video_path']).exists() for r in rows),
                      'unique_stored_hashes': len({r['sha256'] for r in rows}),
                      'note': 'Stored manifest hashes counted; full video hashes not recomputed.'}
report['video_folders'] = {p.name: len(list(p.glob('*.MOV'))) + len(list(p.glob('*.mov'))) for p in (ROOT/'Greetings_1of2/Greetings').iterdir() if p.is_dir()}
# Windows glob is case-insensitive; use suffix filtering for the actual counts.
report['video_folders'] = {p.name: sum(f.suffix.lower() in {'.mov','.mp4','.avi'} for f in p.iterdir() if f.is_file()) for p in (ROOT/'Greetings_1of2/Greetings').iterdir() if p.is_dir()}
report['checkpoint_structure'] = []
for p in sorted((APP/'artifacts/models').glob('*.pth')):
    with zipfile.ZipFile(p) as z:
        names = z.namelist()
        pk = next(n for n in names if n.endswith('data.pkl'))
        strings = [arg for op,arg,pos in pickletools.genops(z.read(pk)) if op.name in {'BINUNICODE','SHORT_BINUNICODE','UNICODE'}]
        layers = sorted({s.split('transformer_encoder.layers.')[1].split('.')[0] for s in strings if 'transformer_encoder.layers.' in s})
        report['checkpoint_structure'].append({'file': p.name, 'bytes': p.stat().st_size, 'tensor_storage_files': sum('/data/' in n for n in names), 'transformer_layer_indices': layers})
inventory = []
skip = {'node_modules', 'dist', 'venv', '.venv', '__pycache__', '.git'}
for p in sorted(APP.rglob('*')):
    if not p.is_file() or skip.intersection(p.relative_to(APP).parts) or p.name.startswith('.env'):
        continue
    if p.suffix.lower() not in {'.ts','.tsx','.js','.py','.json','.md','.yaml','.yml','.toml','.ipynb','.html','.css','.bat','.sh','.txt','.gltf'}:
        continue
    if p.name in {'package-lock.json'}:
        continue
    t = p.read_text(encoding='utf-8-sig', errors='replace')
    item = {'path': p.relative_to(APP).as_posix(), 'lines': len(t.splitlines()), 'bytes': p.stat().st_size}
    if p.suffix == '.py':
        try:
            tree = ast.parse(t)
            item['symbols'] = [n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
            item['syntax_valid'] = True
        except SyntaxError:
            item['syntax_valid'] = False
    if p.suffix == '.ipynb':
        notebook = json.loads(t)
        item['cells'] = [{'type': c['cell_type'], 'lines': len(c.get('source', [])), 'executed': c.get('execution_count') is not None} for c in notebook['cells']]
    inventory.append(item)
report['source_inventory'] = inventory
cleaner = LandmarkCleaner(target_length=32, max_gap=3)
seq = np.array([[0.], [100.], [100.], [100.], [100.], [100.], [6.]], dtype=np.float32)
mask = np.array([True, False, False, False, False, False, True])
cleaned, _ = cleaner.interpolate_short_gaps(seq, mask)
rh, lh, scale = cleaner.normalize_frame_coordinates(np.zeros((21,3)), np.zeros((21,3)), np.array([[.3,.4,0],[.7,.4,0],[.2,.6,0],[.8,.6,0]]))
report['preprocessing_probes'] = {'gap_limit': 3, 'gap_length_tested': 5, 'long_gap_was_modified': bool(np.any(cleaned[1:6] != seq[1:6])), 'normalized_missing_hand_has_nonzero_values': bool(np.any(rh != 0)), 'feature_dimension': int(FeatureExtractor().extract_tabular_features(np.zeros((32,138))).size)}
report['archives'] = []
for p in ROOT.glob('*.zip'):
    with zipfile.ZipFile(p) as z:
        report['archives'].append({'file': p.name, 'bytes': p.stat().st_size, 'entries': len(z.infolist()), 'video_entries': sum(Path(i.filename).suffix.lower() in {'.mov','.mp4','.avi'} for i in z.infolist())})
target = Path(__file__).with_name('evidence.json')
target.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'report': str(target), 'source_files_indexed': len(inventory), 'avatars_identical': assets[0]['sha256']==assets[1]['sha256'], 'humanoid_bones': len(assets[0]['bone_names']), 'manifest': report['manifest'], 'preprocessing_probes': report['preprocessing_probes'], 'checkpoint_structure': report['checkpoint_structure']}, indent=2))
