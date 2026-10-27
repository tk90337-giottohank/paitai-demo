# Firebase 主控台步驟（v12 上線前，請老闆／管理者操作）
1. **發布規則**：Firestore Database → 規則 → 貼上 `firestore.rules` 全文 → 發布。
2. **授權網域**：Authentication → 設定 → 授權網域 → 新增 `tk90337-giottohank.github.io`（localhost 預設已有）。
3. **登入方式**：Authentication → 登入方式 → 「電子郵件/密碼」已啟用即可（不要開「電子郵件連結」）。
4. **建議**：Authentication → 設定 → 使用者動作 → 關閉「建立帳號（註冊）」(Enable create/sign-up) 。⚠ 但「首次啟用老闆」與「老闆建立帳號」都是用網頁端建立帳號，所以請在 **老闆帳號與所有人員帳號建好之後** 再考慮關閉；關閉後新增人員要先暫時打開。即使不關閉，沒有 users 角色資料的帳號在規則下什麼都讀不到。
5. **索引**：不需要建立複合索引（只用到單一欄位排序 wineLog.t，自動索引即可）。
6. **API 金鑰限制（建議）**：Google Cloud Console → API 和服務 → 憑證 → 該 Browser key → 網站限制加入 `https://tk90337-giottohank.github.io/*`。
7. 完成後打開 https://tk90337-giottohank.github.io/paitai-demo/v12/ → 「首次啟用：建立老闆帳號」→ 底部橘色條「把這台裝置的資料上傳到雲端」（請在目前使用 v11 的那台櫃台電腦上做，才能把現有資料帶上去；注意 v12 網址與 v11 同網域，所以讀得到同一份本機資料）。
