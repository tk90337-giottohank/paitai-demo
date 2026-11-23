#!/usr/bin/env python3
"""Idempotent sync: copy new 傳統排檯表 imports (photos + JSON) from Firestore
sheetImports / importArchive to Google Drive folder 排檯表匯入備份.

Does NOT use Firebase Storage. Photos already live in Firestore (sheetImports
photos / chunks), same as the app upload path.

This script stages files locally and (optionally) marks Firestore docs synced
after an agent uploads them with the Google Drive connector.

Routine (every 30 minutes is enough) should:

  1. python3 /workspace/hostess-club-system/tools/sync-sheet-backups-to-drive.py --stage
  2. Read import/drive-sync-staging/manifest.json
  3. For each item, ensure Drive folders:
       排檯表匯入備份/{day}/{importId}/
     (root folder id: 1XL0KHJmZayusz01y4K7jixEYeY2mhf7e)
     and upload each file in item.files with UploadFile
     (connection: user-Google-drive, destination.folderId = that day's import folder).
  4. python3 ... --mark-synced

Idempotent: skips sheetImports already tagged driveSynced=true (and items
already listed as synced in the local state file). Safe to re-run.

Does not print access tokens or API keys.
"""
from __future__ import annotations
import argparse, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error, base64
from pathlib import Path
from datetime import datetime, timezone, timedelta

TAIPEI = timezone(timedelta(hours=8))
PROJECT = 'paitai-system'
DRIVE_FOLDER_ID = '1XL0KHJmZayusz01y4K7jixEYeY2mhf7e'
DRIVE_FOLDER_NAME = '排檯表匯入備份'
DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/' + DRIVE_FOLDER_ID
TOKEN_PATH = Path('/home/box/.config/configstore/firebase-tools.json')
ROOT = Path('/workspace/hostess-club-system')
STAGING = ROOT / 'import' / 'drive-sync-staging'
STATE = ROOT / 'import' / 'drive-sync-state.json'
MANIFEST = STAGING / 'manifest.json'

def log(msg):
    print(datetime.now(TAIPEI).strftime('%Y-%m-%d %H:%M:%S %Z ') + str(msg), flush=True)

def token():
    t = json.loads(TOKEN_PATH.read_text())['tokens']['access_token']
    return t

def req(method, url, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
        except Exception:
            err = {'error': {'message': body[:300]}}
        return e.code, err

def dec(v):
    if v is None: return None
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'booleanValue' in v: return v['booleanValue']
    if 'timestampValue' in v: return v['timestampValue']
    if 'nullValue' in v: return None
    if 'mapValue' in v: return {k: dec(x) for k, x in (v['mapValue'].get('fields') or {}).items()}
    if 'arrayValue' in v: return [dec(x) for x in (v['arrayValue'].get('values') or [])]
    return v

def doc_fields(doc):
    rec = {k: dec(v) for k, v in (doc.get('fields') or {}).items()}
    rec['id'] = doc['name'].split('/')[-1]
    return rec

def list_col(col, page_size=100):
    out, token_page = [], None
    while True:
        url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{col}?pageSize={page_size}'
        if token_page:
            url += '&pageToken=' + urllib.parse.quote(token_page)
        st, data = req('GET', url)
        if st != 200:
            log('list %s fail %s %s' % (col, st, (data.get('error') or {}) .get('message', data) if isinstance(data, dict) else data))
            break
        for d in data.get('documents') or []:
            out.append(doc_fields(d))
        token_page = data.get('nextPageToken')
        if not token_page:
            break
    return out

def load_state():
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            return {'synced': {}}
    return {'synced': {}}

def save_state(st):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    st['updatedAtTaipei'] = datetime.now(TAIPEI).strftime('%Y-%m-%d %H:%M:%S')
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2))

def data_url_to_bytes(data_url):
    if not data_url:
        return None, None
    m = re.match(r'data:([^;]+);base64,(.*)$', str(data_url), re.S)
    if m:
        mime, b64 = m.group(1), m.group(2)
        ext = 'png' if 'png' in mime else 'webp' if 'webp' in mime else 'jpg'
        return base64.b64decode(b64), ext
    try:
        return base64.b64decode(str(data_url)), 'jpg'
    except Exception:
        return None, None

def load_photo(imp_id, photo_id, meta):
    if meta.get('data'):
        return meta['data']
    n = int(meta.get('chunkCount') or 0)
    parts = []
    for i in range(n):
        st, doc = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports/{imp_id}/chunks/{photo_id}-{i}')
        if st != 200:
            return ''
        parts.append(doc_fields(doc).get('data') or '')
    return ''.join(parts)

def already_synced(state, kind, _id, rec):
    if rec.get('driveSynced') is True:
        return True
    key = kind + ':' + _id
    return key in (state.get('synced') or {})

def stage():
    state = load_state()
    STAGING.mkdir(parents=True, exist_ok=True)
    items = []
    imports = list_col('sheetImports')
    archives = list_col('importArchive')
    arch_by_q = {}
    for a in archives:
        q = str(a.get('queueId') or '')
        if q:
            arch_by_q.setdefault(q, []).append(a)

    for rec in imports:
        iid = rec['id']
        if already_synced(state, 'sheetImports', iid, rec):
            continue
        day = rec.get('day') or 'unknown'
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(day)):
            day = 'unknown'
        dest = STAGING / day / iid
        dest.mkdir(parents=True, exist_ok=True)
        files = []
        st, listing = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports/{iid}/photos?pageSize=20')
        photos = listing.get('documents') or [] if st == 200 else []
        for i, pdoc in enumerate(photos):
            pid = pdoc['name'].split('/')[-1]
            meta = doc_fields(pdoc)
            data = load_photo(iid, pid, meta)
            raw, ext = data_url_to_bytes(data)
            if not raw:
                continue
            name = 'photo-%s.%s' % (pid or i, ext)
            (dest / name).write_bytes(raw)
            files.append({'name': name, 'path': str(dest / name), 'bytes': len(raw)})
        meta_path = dest / 'meta.json'
        safe = {k: rec.get(k) for k in (
            'id','day','status','byName','createdAt','source','photoCount','sessions','marks',
            'note','files','model','aiRaw','recognizedAt','archiveId','error'
        )}
        # keep draft / ai for 校對, but drop huge data URLs if any slipped in
        draft = rec.get('draft') or rec.get('draftJson')
        if isinstance(draft, str):
            try:
                draft = json.loads(draft)
            except Exception:
                pass
        safe['draft'] = draft
        safe['archives'] = []
        for a in arch_by_q.get(iid, []):
            safe['archives'].append({k: a.get(k) for k in (
                'id','day','at','atTaipei','byName','byRole','sessions','marks','aiModel','aiRaw','raw','saved','diffs','status','reviewNote'
            )})
            ap = dest / ('importArchive-%s.json' % a['id'])
            ap.write_text(json.dumps(safe['archives'][-1], ensure_ascii=False, indent=2))
            files.append({'name': ap.name, 'path': str(ap), 'bytes': ap.stat().st_size})
        meta_path.write_text(json.dumps(safe, ensure_ascii=False, indent=2))
        files.append({'name': 'meta.json', 'path': str(meta_path), 'bytes': meta_path.stat().st_size})
        items.append({
            'kind': 'sheetImports',
            'id': iid,
            'day': day,
            'folderName': '%s/%s' % (day, iid),
            'driveRootId': DRIVE_FOLDER_ID,
            'driveRootName': DRIVE_FOLDER_NAME,
            'driveRootUrl': DRIVE_FOLDER_URL,
            'dir': str(dest),
            'files': files,
            'photoCount': rec.get('photoCount') or len([f for f in files if f['name'].startswith('photo-')]),
        })
        log('staged %s day=%s files=%s' % (iid, day, len(files)))

    manifest = {
        'atTaipei': datetime.now(TAIPEI).strftime('%Y-%m-%d %H:%M:%S'),
        'zone': 'Asia/Taipei',
        'driveRootId': DRIVE_FOLDER_ID,
        'driveRootName': DRIVE_FOLDER_NAME,
        'driveRootUrl': DRIVE_FOLDER_URL,
        'count': len(items),
        'items': items,
        'instruction': 'Create Drive subfolders 排檯表匯入備份/{day}/{id} if needed, upload each files[].path, then run this script with --mark-synced.'
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    log('manifest %s items=%s' % (MANIFEST, len(items)))
    return manifest

def mark_synced(marks_file=None):
    state = load_state()
    path = Path(marks_file) if marks_file else MANIFEST
    if not path.exists():
        log('no manifest to mark')
        return 0
    man = json.loads(path.read_text())
    n = 0
    now = int(time.time() * 1000)
    for it in man.get('items') or []:
        iid = it.get('id')
        if not iid:
            continue
        url = it.get('driveUrl') or ''
        # If the routine filled driveUrl / driveFolderId on the item, store it
        fields = {
            'driveSynced': {'booleanValue': True},
            'driveSyncedAt': {'integerValue': str(now)},
            'driveUrl': {'stringValue': url or (DRIVE_FOLDER_URL + '/' + it.get('folderName', ''))},
        }
        if it.get('driveFolderId'):
            fields['driveFolderId'] = {'stringValue': it['driveFolderId']}
        mask = '&'.join('updateMask.fieldPaths=' + k for k in fields)
        st, res = req('PATCH',
            f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports/{iid}?{mask}',
            {'fields': fields})
        if st in (200, 201):
            state.setdefault('synced', {})['sheetImports:' + iid] = {
                'at': now, 'day': it.get('day'), 'driveUrl': fields['driveUrl']['stringValue']
            }
            n += 1
            log('marked synced %s' % iid)
        else:
            log('mark fail %s %s %s' % (iid, st, (res.get('error') or {}).get('message', '') if isinstance(res, dict) else ''))
    save_state(state)
    log('marked %s item(s)' % n)
    return n

def main():
    ap = argparse.ArgumentParser(description='Stage / mark 排檯表匯入備份 Drive sync')
    ap.add_argument('--stage', action='store_true', help='Download unsynced imports to staging and write manifest.json')
    ap.add_argument('--mark-synced', action='store_true', help='Mark items in the manifest as driveSynced in Firestore')
    ap.add_argument('--marks-file', help='Optional manifest path for --mark-synced')
    args = ap.parse_args()
    if not args.stage and not args.mark_synced:
        args.stage = True
    if args.stage:
        man = stage()
        print('DRIVE_ROOT=' + DRIVE_FOLDER_URL)
        print('STAGED=%s' % man['count'])
        print('MANIFEST=' + str(MANIFEST))
    if args.mark_synced:
        mark_synced(args.marks_file)

if __name__ == '__main__':
    main()
