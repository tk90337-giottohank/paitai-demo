#!/usr/bin/env python3
"""Evaluate sheet-photo recognition against previously proofread data.
Uses GEMINI_API_KEY from the environment (never printed). Same prompt +
to_draft / apply_roster_names as the worker / browser pipeline.
"""
import csv, io, json, os, re, sys, time, urllib.request, urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# Import worker under its filename
import importlib.util
WP = Path(__file__).resolve().parent / 'sheet-photo-worker.py'
spec = importlib.util.spec_from_file_location('sheet_photo_worker', WP)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
PROMPT, to_draft, apply_roster_names = mod.PROMPT, mod.to_draft, mod.apply_roster_names

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path('/workspace/hostess-club-system')
OUT = ROOT / 'import' / '2026-11-24-autoocr'
MODEL = 'gemini-flash-latest'

def compress(path, max_side=1600, quality=70):
    path = Path(path)
    if Image is None:
        data = path.read_bytes()
        import base64
        b64 = base64.b64encode(data).decode()
        return 'image/jpeg' if path.suffix.lower() in ('.jpg','.jpeg') else 'image/png', b64, len(data)
    im = Image.open(path)
    if im.mode not in ('RGB','L'):
        im = im.convert('RGB')
    elif im.mode == 'L':
        im = im.convert('RGB')
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    q = quality
    while True:
        buf.seek(0); buf.truncate(0)
        im.save(buf, format='JPEG', quality=q, optimize=True)
        if buf.tell() <= 900_000 or q <= 40:
            break
        q -= 10
    import base64
    raw = buf.getvalue()
    return 'image/jpeg', base64.b64encode(raw).decode(), len(raw)

def gemini(images, day_hint):
    key = os.environ.get('GEMINI_API_KEY') or ''
    if not key:
        raise SystemExit('GEMINI_API_KEY missing (not printed)')
    parts = [{'text': PROMPT + ('\n營業日提示：%s' % day_hint if day_hint else '') +
              '\n若有多張照片，請依序拼成同一張排檯表（由左到右、由上到下，或第 1、2、3… 張接續的番）。'}]
    for mime, b64, _n in images:
        parts.append({'inline_data': {'mime_type': mime, 'data': b64}})
    body = {
        'contents': [{'parts': parts}],
        'generationConfig': {
            'temperature': 0.1,
            'maxOutputTokens': 65536,
            'responseMimeType': 'application/json',
            'responseSchema': {
                'type': 'OBJECT',
                'properties': {
                    'day': {'type': 'STRING'},
                    'columns': {'type': 'ARRAY', 'items': {
                        'type': 'OBJECT',
                        'properties': {
                            'id': {'type': 'STRING'},
                            'paper_name': {'type': 'STRING'},
                        }
                    }},
                    'sessions': {'type': 'ARRAY', 'items': {
                        'type': 'OBJECT',
                        'properties': {
                            'seq': {'type': 'INTEGER'},
                            'room': {'type': 'STRING'},
                            'guests': {'type': 'INTEGER'},
                            'guests_raw': {'type': 'STRING'},
                            'time': {'type': 'STRING'},
                            'ended': {'type': 'BOOLEAN'},
                            'marks': {'type': 'ARRAY', 'items': {
                                'type': 'OBJECT',
                                'properties': {
                                    'id': {'type': 'STRING'},
                                    'paper_name': {'type': 'STRING'},
                                    'type': {'type': 'STRING', 'enum': ['紅', '藍', '私檯', '訂番']},
                                    'uncertain': {'type': 'BOOLEAN'},
                                    'id_uncertain': {'type': 'BOOLEAN'},
                                    'note': {'type': 'STRING'},
                                }
                            }},
                            'uncertain': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                            'guests_uncertain': {'type': 'BOOLEAN'},
                            'orderStaff': {'type': 'STRING'},
                        }
                    }},
                    'notes': {'type': 'ARRAY', 'items': {'type': 'STRING'}},
                }
            },
        }
    }
    last = None
    for model in (MODEL, 'gemini-3.5-flash', 'gemini-3.8-flash'):
        url = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s' % (model, key)
        r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r, timeout=180) as resp:
                data = json.loads(resp.read().decode())
            parts_out = ((data.get('candidates') or [{}])[0].get('content') or {}).get('parts') or []
            text = ''.join(p.get('text', '') for p in parts_out)
            if text.strip():
                return text, model
            last = 'empty'
        except urllib.error.HTTPError as e:
            last = 'HTTP %s' % e.code
            # do not include body (might echo key)
            continue
        except Exception as e:
            last = type(e).__name__
            continue
    raise RuntimeError('gemini failed: ' + str(last))

def zid(x):
    s = str(x or '').strip()
    return s.zfill(2) if s.isdigit() else s

def load_roster():
    roster = {}
    # 11/14 roster.json
    p = ROOT / 'import' / '2026-11-15-sheet' / 'roster.json'
    if p.exists():
        raw = json.loads(p.read_text())
        for k, v in (raw.items() if isinstance(raw, dict) else []):
            if k and v:
                roster[str(k)] = str(v)
                if str(k).isdigit():
                    roster[str(k).zfill(2)] = str(v)
    # 11/13 marks official names
    m = ROOT / 'import' / '2026-11-13' / 'marks.csv'
    if m.exists():
        with m.open(newline='', encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                gid = zid(row.get('號碼') or row.get('id'))
                name = (row.get('系統名字') or '').strip()
                if gid and name and gid not in roster:
                    roster[gid] = name
    return roster

def truth_1113():
    sessions = {}
    marks = []
    with (ROOT/'import/2026-11-13/sessions.csv').open(newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            seq = str(row['番']).strip()
            guests = row.get('人數') or ''
            try:
                g = int(guests)
            except Exception:
                g = None
            sessions[seq] = {
                'seq': seq, 'room': (row.get('包廂') or '').strip(),
                'time': (row.get('進場時間') or '').strip(),
                'guests': g, 'ended': (row.get('結束') or '').strip().upper() in ('Y','是','1','TRUE')
            }
    with (ROOT/'import/2026-11-13/marks.csv').open(newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            if (row.get('匯入') or '是').strip() in ('否','N','0'):
                continue
            marks.append({
                'seq': str(row['番']).strip(),
                'id': zid(row.get('號碼')),
                'type': (row.get('記號') or '').strip(),
                'paper': (row.get('紙本名字') or '').strip(),
                'sys': (row.get('系統名字') or '').strip(),
            })
    return '2026-11-13', sessions, marks

def truth_1114():
    p = json.loads((ROOT/'import/2026-11-15-sheet/final-sessions.json').read_text())
    sessions, marks = {}, []
    for s in (p.get('existing_1_to_4') or []) + (p.get('new_5_to_21') or []):
        seq = str(s.get('seq'))
        sessions[seq] = {
            'seq': seq, 'room': str(s.get('room') or ''),
            'time': str(s.get('time') or ''),
            'guests': s.get('guests') if isinstance(s.get('guests'), int) else None,
            'ended': bool(s['ended']) if 'ended' in s else False,
        }
        for mk in s.get('marks') or []:
            if isinstance(mk, (list, tuple)):
                marks.append({'seq': seq, 'id': zid(mk[0]), 'type': str(mk[1] if len(mk)>1 else '')})
            elif isinstance(mk, dict):
                marks.append({'seq': seq, 'id': zid(mk.get('id')), 'type': str(mk.get('type') or '')})
    return '2026-11-14', sessions, marks

def hm(tm):
    if not tm: return ''
    if isinstance(tm, (list, tuple)) and len(tm)>=2:
        return '%02d:%02d' % (int(tm[0]), int(tm[1]))
    return str(tm)

def score(draft, sessions, marks):
    pred_s = draft.get('rows') or {}
    pred_m = draft.get('marks') or []
    # sessions
    sk = set(sessions)
    pk = set(pred_s)
    sess_extra = sorted(pk-sk)
    sess_miss = sorted(sk-pk)
    room_ok = time_ok = guests_ok = ended_ok = 0
    compared = 0
    details = []
    for seq in sorted(sk, key=lambda x: int(x) if x.isdigit() else 0):
        if seq not in pred_s:
            details.append({'seq': seq, 'issue': 'missing session'})
            continue
        compared += 1
        a, b = sessions[seq], pred_s[seq]
        if str(a['room']) == str(b.get('room') or ''):
            room_ok += 1
        else:
            details.append({'seq': seq, 'room': [a['room'], b.get('room')]})
        if a['time'] == hm(b.get('tm')):
            time_ok += 1
        else:
            details.append({'seq': seq, 'time': [a['time'], hm(b.get('tm'))]})
        bg = b.get('guests')
        if a['guests'] is None or bg is None:
            # blank / 待補: treat None==None as ok; if truth None and pred has number, mismatch
            if a['guests'] == bg:
                guests_ok += 1
            else:
                details.append({'seq': seq, 'guests': [a['guests'], bg]})
        elif a['guests'] == bg:
            guests_ok += 1
        else:
            details.append({'seq': seq, 'guests': [a['guests'], bg]})
        if bool(a['ended']) == bool(b.get('ended')):
            ended_ok += 1
        else:
            details.append({'seq': seq, 'ended': [a['ended'], b.get('ended')]})
    # marks as (seq,id,type)
    truth_set = set((m['seq'], zid(m['id']), m['type']) for m in marks if m.get('id') and m.get('type'))
    pred_set = set((str(m[0]), zid(m[1]), str(m[2])) for m in pred_m if m[1] and m[2] in ('紅','藍','私檯','訂番'))
    mark_ok = truth_set & pred_set
    mark_miss = truth_set - pred_set
    mark_extra = pred_set - truth_set
    yellow = sum(1 for m in pred_m if (m[3] is not None and float(m[3] or 1) < 0.7))
    n_s = max(1, len(sessions))
    n_m = max(1, len(truth_set))
    return {
        'sessions_truth': len(sessions),
        'sessions_pred': len(pred_s),
        'sessions_missing': sess_miss,
        'sessions_extra': sess_extra,
        'room_acc': round(room_ok / n_s, 3),
        'time_acc': round(time_ok / n_s, 3),
        'guests_acc': round(guests_ok / n_s, 3),
        'ended_acc': round(ended_ok / n_s, 3),
        'room_ok': room_ok, 'time_ok': time_ok, 'guests_ok': guests_ok, 'ended_ok': ended_ok,
        'marks_truth': len(truth_set),
        'marks_pred': len(pred_set),
        'marks_matched': len(mark_ok),
        'marks_acc': round(len(mark_ok) / n_m, 3),
        'marks_missing': sorted(list(mark_miss))[:30],
        'marks_extra': sorted(list(mark_extra))[:30],
        'marks_missing_n': len(mark_miss),
        'marks_extra_n': len(mark_extra),
        'yellow_boxes': yellow,
        'tbd_n': len(draft.get('tbd') or []),
        'session_field_details': details[:40],
    }

def run_case(name, day, photos, truth_s, truth_m, roster):
    print('CASE', name, 'photos', len(photos), flush=True)
    imgs = [compress(p) for p in photos]
    print(' compressed', [n for _m,_b,n in imgs], flush=True)
    t0 = time.time()
    text, model = gemini(imgs, day)
    elapsed = round(time.time() - t0, 1)
    raw_path = OUT / ('eval-%s-raw.txt' % name)
    raw_path.write_text(text or '', encoding='utf-8')
    draft, raw = to_draft(text, day)
    if not (raw or {}).get('sessions'):
        print('  first parse empty/invalid (raw chars %s); retry once' % len(text or ''), flush=True)
        text2, model = gemini(imgs, day)
        elapsed = round(time.time() - t0, 1)
        raw_path.write_text((text2 or '') + '\n\n--- first attempt ---\n' + (text or ''), encoding='utf-8')
        draft, raw = to_draft(text2, day)
        text = text2
    if not (raw or {}).get('sessions'):
        print('  warning: no sessions parsed; raw chars', len(text or ''), flush=True)
    draft = apply_roster_names(draft, roster)
    sc = score(draft, truth_s, truth_m)
    sc.update({'name': name, 'day': day, 'model': model, 'seconds': elapsed, 'photoCount': len(photos)})
    outp = OUT / ('eval-%s.json' % name)
    outp.write_text(json.dumps({'score': sc, 'draft_totals': draft.get('totals'), 'tbd': (draft.get('tbd') or [])[:20], 'raw_sessions': len((raw or {}).get('sessions') or [])}, ensure_ascii=False, indent=2))
    print(' ', json.dumps({k: sc[k] for k in sc if k not in ('session_field_details','marks_missing','marks_extra')}, ensure_ascii=False), flush=True)
    return sc, draft, raw, model

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    roster = load_roster()
    print('roster size', len({k for k in roster if k.isdigit() and len(k)==2}))
    results = []
    d, s, m = truth_1113()
    photos = [
        ROOT/'import/2026-11-13/cells_A.jpg',
        ROOT/'import/2026-11-13/cells_B.jpg',
        ROOT/'import/2026-11-13/cells_C.jpg',
    ]
    sc, *_ = run_case('2026-11-13', d, photos, s, m, roster)
    results.append(sc)
    d, s, m = truth_1114()
    photos = sorted((ROOT/'import/2026-11-15-sheet/src').glob('p*.jpg'))
    sc, *_ = run_case('2026-11-14', d, photos, s, m, roster)
    results.append(sc)
    summary = {'at': time.strftime('%Y-%m-%d %H:%M:%S'), 'zone': 'Asia/Taipei', 'model_pref': MODEL, 'cases': results}
    (OUT/'accuracy-report.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print('SUMMARY written', OUT/'accuracy-report.json')

if __name__ == '__main__':
    main()
