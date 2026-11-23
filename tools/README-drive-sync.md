# 排檯表匯入備份：Drive 同步 routine

不使用 Firebase Storage。主備份在 Firestore `sheetImports`（photos／chunks）。本腳本把尚未同步的匯入（照片 + JSON）暫存後上傳到 Google Drive 資料夾「排檯表匯入備份」。

- 資料夾 id：`1XL0KHJmZayusz01y4K7jixEYeY2mhf7e`
- 連結：https://drive.google.com/drive/folders/1XL0KHJmZayusz01y4K7jixEYeY2mhf7e
- 腳本：`/workspace/hostess-club-system/tools/sync-sheet-backups-to-drive.py`
- 暫存：`/workspace/hostess-club-system/import/drive-sync-staging/`
- 狀態：`/workspace/hostess-club-system/import/drive-sync-state.json`

## 建議頻率

**每 30 分鐘**跑一次（店長上傳後通常數分鐘內就會進 Firestore；30 分鐘足夠，且不會壓到額度）。

## Routine 步驟（務必依序）

1. 暫存尚未同步的匯入：

```bash
python3 /workspace/hostess-club-system/tools/sync-sheet-backups-to-drive.py --stage
```

2. 讀 `import/drive-sync-staging/manifest.json`。若沒有新項目就結束。
3. 對 manifest 裡每一筆，在 Drive 建立（若尚無）：

   `排檯表匯入備份/{day}/{importId}/`

   根資料夾 id 固定為 `1XL0KHJmZayusz01y4K7jixEYeY2mhf7e`。把該筆 `files` 以 Google Drive 連接器 `UploadFile`（connection: `user-Google-drive`）上傳到那個 import 子資料夾（`destination.folderId`）。

4. 上傳成功後標記已同步（寫入 Firestore `driveSynced=true`，並更新本地 state）：

```bash
python3 /workspace/hostess-club-system/tools/sync-sheet-backups-to-drive.py --mark-synced
```

腳本幂等：已標記 `driveSynced=true` 的 `sheetImports` 會跳過，可重複執行。不要印出 access token 或 API key。
