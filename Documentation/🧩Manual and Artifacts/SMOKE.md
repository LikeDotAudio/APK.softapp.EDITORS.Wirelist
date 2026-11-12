# Smoke test — EDITORS.Wirelist

Is `EDITORS.Wirelist` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**❌ FAIL** — 2/3 checks, since 2026-11-12 00:16 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.Wirelist](https://github.com/LikeDotAudio/APK.softapp.EDITORS.Wirelist.git) | ❌ | 1 commit(s) not pushed |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.Wirelist/index.html) | ✅ | HTTP 200 |
| app | `OS/Cable Wirelist` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.Wirelist/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.Wirelist`

<!-- smoke:sig aaf60291574c since 2026-11-12 00:16 EST -->
