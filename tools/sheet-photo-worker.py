#!/usr/bin/env python3
"""Watch Firestore sheetImports and recognise queued photos with Gemini.
Does NOT write to days/* — only fills draft for the in-app 核對 screen.
"""
import json, os, time, base64, re, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone, timedelta

TAIPEI = timezone(timedelta(hours=8))
PROJECT = 'paitai-system'
TOKEN_PATH = Path('/home/box/.config/configstore/firebase-tools.json')
LOG = Path('/tmp/sheet-photo-worker.log')
STATE = Path('/tmp/sheet-photo-worker-state.json')

PROMPT = '''你是夜店／酒店傳統「排檯表」讀表專家。請只根據照片辨識，輸出純 JSON（不要 markdown 圍欄）。
規則：藍勾 V=藍；紅勾 V=紅；紅圈中間 4 或紅勾中間 4=私檯；紅圈勾=訂番。
「正」=人數5，「止」或未寫完的正=人數4，「一」=1。不確定請標 uncertain。
每個小姐格子請「先讀編號、再讀中文名字」，兩者分開輸出，不要合併成一個字串，也不要用名字去改編號。
- id：格子上的小姐編號（主鍵）。看不清就留空，並設 id_uncertain=true。不要猜編號。
- paper_name：照片上寫的中文名字原文（OCR 原樣，含潦草或錯字）。不要改成你認為的正確藝名，也不要因為名字不像而改 id。
- 編號清楚但名字看不清：id 照填，paper_name 留空。
包廂號碼照實抄（例如 101 不要改成別的房）。
只列出有記號的格子；若某一番只有包廂與時間、沒有小姐記號，仍要列出該番。
後端會用編號對名冊填正式名字，再用 paper_name 交叉核對；你不必對名冊、不必校正名字。
輸出：
{"day":"YYYY-MM-DD 或空","columns":[{"id":"93","paper_name":"依琳"}],
 "sessions":[{"seq":1,"room":"105","guests":1,"guests_raw":"一","time":"20:15","ended":false,
   "marks":[{"id":"57","paper_name":"冰冰","type":"藍","uncertain":false,"id_uncertain":false,"note":""}],"uncertain":[]}],
 "notes":[]}
'''

def log(msg):
    line = datetime.now(TAIPEI).strftime('%Y-%m-%d %H:%M:%S %Z ') + str(msg)
    with LOG.open('a') as f:
        f.write(line + '\n')
    print(line, flush=True)

def token():
    t = json.loads(TOKEN_PATH.read_text())['tokens']['access_token']
    return t

def req(method, url, payload=None, access=None):
    data = None if payload is None else json.dumps(payload).encode()
    headers = {'Authorization': 'Bearer ' + (access or token()), 'Content-Type': 'application/json'}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
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
    return {k: dec(v) for k, v in (doc.get('fields') or {}).items()}

def list_imports():
    st, data = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports?pageSize=50')
    if st != 200:
        log('list fail %s %s' % (st, (data.get('error') or data)))
        return []
    out = []
    for doc in data.get('documents') or []:
        rec = doc_fields(doc)
        rec['id'] = doc['name'].split('/')[-1]
        out.append(rec)
    return out

def load_photo_data(imp_id, photo_id, meta):
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

def data_url_to_b64(data_url):
    if not data_url:
        return None, None
    m = re.match(r'data:([^;]+);base64,(.*)$', data_url, re.S)
    if m:
        return m.group(1), m.group(2)
    return 'image/jpeg', data_url

def gemini_recognize(data_url):
    key = os.environ.get('GEMINI_API_KEY') or ''
    if not key:
        raise RuntimeError('no GEMINI_API_KEY')
    mime, b64 = data_url_to_b64(data_url)
    if not b64:
        raise RuntimeError('empty photo')
    # cap very large payloads
    if len(b64) > 4_000_000:
        raise RuntimeError('photo too large for vision')
    body = {
        'contents': [{'parts': [
            {'text': PROMPT},
            {'inline_data': {'mime_type': mime or 'image/jpeg', 'data': b64}}
        ]}],
        'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 8192}
    }
    last = None
    for model in ('gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'):
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}'
        r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                data = json.loads(resp.read().decode())
            parts = ((data.get('candidates') or [{}])[0].get('content') or {}).get('parts') or []
            text = ''.join(p.get('text', '') for p in parts)
            if text.strip():
                return text, model
            last = 'empty'
        except Exception as e:
            last = str(e)
            continue
    raise RuntimeError('gemini failed: ' + str(last)[:200])

def parse_time(s):
    s = str(s or '').strip().replace('：', ':').replace('=', ':').replace('.', ':')
    if re.match(r'^\d{3,4}$', s):
        s = s.zfill(4)
        return [int(s[:2]), int(s[2:])]
    m = re.match(r'^(\d{1,2}):(\d{2})$', s)
    if m:
        return [int(m.group(1)), int(m.group(2))]
    return None

def load_roster(day):
    """id -> official name from config/roster, else the day's girls list."""
    out = {}
    try:
        st, doc = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/config/roster')
        if st == 200:
            raw = doc_fields(doc).get('names')
            if isinstance(raw, str):
                try: raw = json.loads(raw)
                except Exception: raw = {}
            if isinstance(raw, dict):
                for gid, name in raw.items():
                    if gid and name:
                        out[str(gid)] = str(name)
                        out[str(gid).zfill(2)] = str(name)
    except Exception as e:
        log('roster-config load fail ' + str(e)[:120])
    try:
        st, doc = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/days/{day or ""}')
        if st != 200:
            return out
        raw = doc_fields(doc).get('girls')
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = []
        for g in raw or []:
            if not isinstance(g, dict):
                continue
            gid = str(g.get('id') or '')
            name = str(g.get('name') or '')
            if gid:
                # "96 天兒" -> 天兒；config/roster 已有的正式名不覆寫
                nick = name.replace(gid, '', 1).strip() or name
                key = gid.zfill(2) if gid.isdigit() else gid
                if key not in out:
                    out[gid] = nick
                    out[key] = nick
    except Exception as e:
        log('roster load fail ' + str(e)[:120])
    return out

def norm_name(s):
    s = re.sub(r'\s+', '', str(s or '').strip())
    s = re.sub(r'^\d+號?', '', s)
    return s

def names_agree(ocr, official):
    a, b = norm_name(ocr), norm_name(official)
    if not a or not b:
        return None
    return a == b

def roster_lookup(roster, gid):
    gid = str(gid or '').strip()
    if not gid:
        return '', ''
    key = gid.zfill(2) if gid.isdigit() else gid
    official = roster.get(key) or roster.get(gid) or roster.get(gid.lstrip('0') or gid) or ''
    return key if gid.isdigit() else gid, official

def name_index(roster):
    idx = {}
    seen = set()
    for gid, name in (roster or {}).items():
        if not str(gid).isdigit():
            continue
        key = str(gid).zfill(2)
        if key in seen:
            continue
        seen.add(key)
        nm = norm_name(name)
        if nm:
            idx.setdefault(nm, []).append(key)
    return idx

def apply_roster_names(draft, roster):
    """Number is the primary key. OCR name is only a cross-check.
    Agree (or no OCR name) -> keep official name, no yellow.
    Disagree, or number missing/unreadable (name fallback) -> yellow for 核對.
    """
    roster = roster or {}
    idx = name_index(roster)
    tbd = list(draft.get('tbd') or [])
    unk = list(draft.get('unk') or [])
    for m in draft.get('marks') or []:
        while len(m) < 7:
            m.append('')
        raw_id = str(m[1] or '').strip()
        ocr = m[5] or ''
        gid, official = roster_lookup(roster, raw_id)
        def note(extra):
            m[4] = (str(m[4] or '') + '；' + extra).strip('；') if m[4] else extra
        def yellow(extra, also_unk=None):
            try:
                m[3] = min(float(m[3] if m[3] not in ('', None) else 1), 0.45)
            except Exception:
                m[3] = 0.45
            note(extra)
            tbd.append('序%s %s' % (m[0], extra))
            if also_unk:
                unk.append(also_unk)

        if gid and official:
            m[1] = gid
            m[6] = official
            agree = names_agree(ocr, official)
            if agree is False:
                # e.g. 57 冰冰 → 名單:寶貝
                yellow('%s %s → 名單:%s' % (gid, ocr, official))
            # agree or no paper name: auto-accept (leave conf as-is unless already low for mark type)
        elif gid and not official:
            m[1] = gid
            m[6] = ''
            yellow('號碼 %s 不在名冊%s' % (gid, ('（紙本寫「%s」）' % ocr) if ocr else ''),
                   also_unk='序%s 小姐「%s」不在名冊（核對時可改）' % (m[0], gid))
        else:
            # number missing / unreadable: fallback match by OCR name; always yellow
            key = norm_name(ocr)
            cands = list(idx.get(key) or [])
            if len(cands) == 1:
                gid = cands[0]
                official = roster.get(gid) or roster.get(gid.lstrip('0') or gid) or ''
                m[1] = gid
                m[6] = official
                yellow('號碼看不清，依名字「%s」對上 %s %s，請核對' % (ocr, gid, official or ''))
            elif len(cands) > 1:
                yellow('號碼看不清，名字「%s」對到多個號碼 %s' % (ocr or '?', '、'.join(cands)))
            else:
                yellow('號碼看不清%s' % (('，名字「%s」對不上名冊' % ocr) if ocr else ''),
                       also_unk='序%s 號碼看不清' % m[0] + (('（紙本寫「%s」）' % ocr) if ocr else ''))
    draft['tbd'] = tbd
    draft['unk'] = unk
    return draft

def _close_truncated_json(s):
    """Best-effort close for a truncated or slightly broken JSON object."""
    stack = []
    in_str = False
    esc = False
    for c in s:
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c in '{[':
            stack.append('}' if c == '{' else ']')
        elif c in '}]' and stack and stack[-1] == c:
            stack.pop()
    if in_str:
        s = s + '"'
    s = re.sub(r',\s*"[^"\\]*$', '', s)  # dangling incomplete key
    s = re.sub(r':\s*$', ': null', s)
    s = re.sub(r',\s*$', '', s)
    # recount stack after cleanup
    stack = []
    in_str = False
    esc = False
    for c in s:
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c in '{[':
            stack.append('}' if c == '{' else ']')
        elif c in '}]' and stack and stack[-1] == c:
            stack.pop()
    if in_str:
        s += '"'
    return s + ''.join(reversed(stack))

def parse_ai_json(raw_text):
    text = (raw_text or '').strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```\s*$', '', text)
    chunks = [text]
    m = re.search(r'\{.*\}', text, re.S)
    if m and m.group(0) != text:
        chunks.append(m.group(0))
    last = None
    variants = []
    for chunk in chunks:
        variants.append(chunk)
        trimmed = re.sub(r',\s*([}\]])', r'\1', chunk)
        variants.append(trimmed)
        # missing commas between adjacent values
        variants.append(re.sub(
            r'([}\]"0-9]|true|false|null)\s+(?=["{\[\-tfn])',
            r'\1,', trimmed))
        variants.append(_close_truncated_json(trimmed))
        variants.append(re.sub(r',\s*([}\]])', r'\1', _close_truncated_json(trimmed)))
    seen = set()
    for v in variants:
        if v in seen:
            continue
        seen.add(v)
        try:
            return json.loads(v)
        except Exception as e:
            last = e
            continue
    if last:
        raise last
    return {}

def to_draft(raw_text, day_hint):
    text = (raw_text or '').strip()
    try:
        obj = parse_ai_json(text)
    except Exception:
        obj = {}
    day = obj.get('day') or day_hint or ''
    if day and not re.match(r'\d{4}-\d{2}-\d{2}', str(day)):
        day = day_hint or ''
    rows, marks, tbd, bad = {}, [], [], []
    for s in obj.get('sessions') or []:
        seq = str(s.get('seq') or '')
        if not seq:
            continue
        tm = parse_time(s.get('time'))
        room = str(s.get('room') or '?')
        guests = s.get('guests')
        conf = 0.4 if (s.get('guests_uncertain') or (s.get('uncertain')) or not tm or room == '?') else 1
        note = '；'.join(s.get('uncertain') or [])
        if s.get('guests_raw'):
            note = (note + ' 人數「%s」' % s.get('guests_raw')).strip()
        rows[seq] = {
            'seq': seq, 'room': room, 'tm': tm, 'guests': guests if isinstance(guests, int) else None,
            'ended': bool(s.get('ended')), 'orderStaff': s.get('orderStaff') or '', 'note': note,
            'conf': conf, 'src': 'photo-ai'
        }
        if conf < 0.7:
            tbd.append('序%s 待確認 %s' % (seq, note))
        for mk in s.get('marks') or []:
            raw_id = str(mk.get('id') or '').strip()
            gid = raw_id.zfill(2) if raw_id.isdigit() else raw_id
            typ = mk.get('type') or ''
            if typ not in ('紅', '藍', '私檯', '訂番'):
                bad.append('序%s 記號 %s' % (seq, typ))
                continue
            paper = mk.get('paper_name') or mk.get('name') or ''
            id_unc = bool(mk.get('id_uncertain') or not gid)
            low = 0.45 if (mk.get('uncertain') or id_unc) else 1
            marks.append([seq, gid, typ, low, mk.get('note') or '', paper, ''])
            if mk.get('uncertain'):
                tbd.append('序%s 小姐 %s 記號待確認' % (seq, gid or paper or '?'))
    girl = len(marks)
    priv = sum(1 for m in marks if m[2] == '私檯')
    ordn = sum(1 for m in marks if m[2] == '訂番')
    return {
        'day': day,
        'rows': rows,
        'marks': marks,
        'tbd': tbd,
        'bad': bad,
        'unk': [],
        'totals': {'sessions': len(rows), 'girlTai': girl, 'priv': priv, 'ord': ordn}
    }, obj

def enc_value(v):
    if v is None:
        return {'nullValue': None}
    if isinstance(v, bool):
        return {'booleanValue': v}
    if isinstance(v, int) and not isinstance(v, bool):
        return {'integerValue': str(v)}
    if isinstance(v, float):
        return {'doubleValue': v}
    if isinstance(v, str):
        return {'stringValue': v}
    # store complex as JSON string to stay in size
    return {'stringValue': json.dumps(v, ensure_ascii=False)}

def write_result(imp_id, status, draft=None, error='', model=''):
    # Firestore update: status, draftJson, error, recognizedAt, model
    fields = {
        'status': enc_value(status),
        'recognizedAt': enc_value(int(time.time() * 1000)),
        'error': enc_value(error or ''),
        'model': enc_value(model or ''),
        'draftJson': enc_value(draft or {}),
    }
    # also try draft as map is huge; client will read draftJson or draft
    # Client applyDraft expects rec.draft — put draft as string field 'draftJson' AND a parsed field if small
    js = json.dumps(draft or {}, ensure_ascii=False)
    if len(js) < 900000:
        fields['draft'] = {'stringValue': js}  # client must JSON.parse if string
    mask = '&'.join('updateMask.fieldPaths=' + k for k in fields)
    url = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports/{imp_id}?{mask}'
    st, res = req('PATCH', url, {'fields': fields})
    return st, res.get('updateTime') or res

def process(imp):
    imp_id = imp['id']
    log('process %s day=%s status=%s' % (imp_id, imp.get('day'), imp.get('status')))
    st, listing = req('GET', f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/sheetImports/{imp_id}/photos?pageSize=20')
    photos = listing.get('documents') or []
    if st != 200 or not photos:
        write_result(imp_id, '辨識失敗', error='沒有找到已上傳的照片資料')
        log('no photos')
        return
    # use first photo
    pdoc = photos[0]
    pid = pdoc['name'].split('/')[-1]
    meta = doc_fields(pdoc)
    data = load_photo_data(imp_id, pid, meta)
    if not data:
        write_result(imp_id, '辨識失敗', error='照片資料不完整（可能上傳中斷），請再傳一次')
        log('empty data')
        return
    text, model = gemini_recognize(data)
    draft, raw = to_draft(text, imp.get('day'))
    draft = apply_roster_names(draft, load_roster(draft.get('day') or imp.get('day')))
    tot = draft.get('totals') or {}
    log('recognized model=%s sessions=%s girlTai=%s' % (model, tot.get('sessions'), tot.get('girlTai')))
    write_result(imp_id, '已辨識，待核對', draft=draft, model=model)

def load_state():
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            return {'done': []}
    return {'done': []}

def main_loop():
    log('worker start')
    state = load_state()
    done = set(state.get('done') or [])
    while True:
        try:
            for imp in list_imports():
                if imp.get('status') != 'queued':
                    continue
                if imp['id'] in done:
                    continue
                try:
                    process(imp)
                    done.add(imp['id'])
                    STATE.write_text(json.dumps({'done': list(done)}))
                except Exception as e:
                    log('process error %s %s' % (imp.get('id'), str(e)[:200]))
                    try:
                        write_result(imp['id'], '辨識失敗', error=str(e)[:200])
                    except Exception:
                        pass
                    done.add(imp['id'])
        except Exception as e:
            log('loop error ' + str(e)[:200])
        time.sleep(15)

if __name__ == '__main__':
    main_loop()
