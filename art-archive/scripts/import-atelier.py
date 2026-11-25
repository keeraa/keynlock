"""Replay the reviewed Atelier import without network access or ID changes.
Metadata and links: catalog/atelier-import.json. Images: workspace Atelier assets.
Run build-overview.py afterwards; both operations are idempotent.
"""
import json
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parents[1]
workspace = root.parent
catalog = root / 'catalog'
manifest = catalog / 'manifest.json'
plan = json.loads((catalog / 'atelier-import.json').read_text())
dimension_audit = json.loads((catalog / 'atelier-dimensions.json').read_text())
for entry in plan['additions']:
    measurement = dimension_audit['works'][entry['atelierId']]
    if measurement['status'] == 'unresolved':
        entry['physicalSizeM'] = None
    else:
        basis = (entry.get('physicalSizeM') or {}).get('basis', 'unframed')
        entry['physicalSizeM'] = {
            'height':round(measurement['heightCm'] / 100, 7),
            'width':round(measurement['widthCm'] / 100, 7),
            'source':measurement['source'], 'basis':basis,
            'verification':measurement['status'], 'note':measurement['note'],
        }
data = json.loads(manifest.read_text())
by_id = {p['id']:p for p in data['paintings']}
for atelier_id, link in plan['links'].items():
    if link['status'] == 'existing':
        painting = by_id[link['archiveId']]
        painting['atelierIds'] = sorted(set(painting.get('atelierIds', []) + [atelier_id]))

for entry in plan['additions']:
    ident = entry['id']
    preview_path = f'images/{ident}.webp'
    detail_path = f'detail/{ident}.webp'
    with Image.open(workspace / entry['sourceImage']) as original:
        source = ImageOps.exif_transpose(original).convert('RGB')
        # Preserve the full source resolution; do not manufacture HD by upscaling.
        if not (catalog / detail_path).exists() or (catalog / detail_path).stat().st_mtime < (workspace / entry['sourceImage']).stat().st_mtime:
            source.save(catalog / detail_path, quality=94, method=5)
        preview = source.copy()
        preview.thumbnail((512,512), Image.Resampling.LANCZOS)
        if not (catalog / preview_path).exists() or (catalog / preview_path).stat().st_mtime < (workspace / entry['sourceImage']).stat().st_mtime:
            preview.save(catalog / preview_path, quality=86, method=5)
        pw,ph = preview.size
        dw,dh = source.size
    asset_source = entry.get('imageSourceUrl') or 'https://raw.githubusercontent.com/keeraa/keynlock/47c18cc19ac524c45c30a92e6b2d71286fbb377f/' + entry['sourceImage']
    painting = {
        'id':ident,'atelierIds':[entry['atelierId']],
        'title':entry['title'],'titleRu':entry['titleRu'],
        'artist':entry['artist'],'artistRu':entry['artistRu'],'year':entry['year'],
        'museum':'Коллекция ателье · источник в карточке',
        'category':entry['category'],'subject':entry['subject'],'subjectMethod':'curated',
        'score':75,'placement':entry['placement'],
        'physicalSizeM':entry['physicalSizeM'],
        'image':{'path':preview_path,'widthPx':pw,'heightPx':ph,'aspect':round(pw/ph,6),
                 'quality':'offline_preview','fit':'contain','hdUrl':asset_source,
                 'detail':{'path':detail_path,'widthPx':dw,'heightPx':dh,'originalUrl':asset_source}},
        'rights':{'status':'pd_candidate','license':'Из коллекции ателье · лицензия репродукции не проверена',
                  'licenseUrl':asset_source,'review':'pending','basis':'existing_atelier_asset'},
        'sourceUrl':entry['sourceUrl'] or asset_source,
        'importSource':{'collection':'atelier','id':entry['atelierId'],'image':entry['sourceImage']},
    }
    if not entry['sourceImage'].startswith('assets/restoration/'):
        painting['image'].pop('hdUrl',None)
        painting['image']['detail'].pop('originalUrl',None)
    if entry.get('imageSourceUrl'):
        painting['image']['sourceUrl'] = entry['imageSourceUrl']
        painting['importSource']['originalAtelierImage'] = entry['atelierSourceImage']
    if entry.get('imageReview'):
        painting['image']['sizeMatch'] = 'needs_review'
        painting['image']['reviewReason'] = entry['imageReview']
    if ident in by_id:
        # Keep an already allocated atlas cell until the explicit atlas rebuild.
        painting['image']['overviewCell'] = by_id[ident]['image'].get('overviewCell')
        data['paintings'][data['paintings'].index(by_id[ident])] = painting
    else:
        data['paintings'].append(painting)
    by_id[ident] = painting

data['count'] = len(data['paintings'])
manifest.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
(catalog / 'atelier-import.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print(f"Atelier links: {len(plan['links'])}; new works: {len(plan['additions'])}; catalog: {data['count']}")
