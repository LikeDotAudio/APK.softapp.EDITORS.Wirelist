# Smoke test — EDITORS.Wirelist

Is `EDITORS.Wirelist` deployed? Written by `.apk.scripts/smoke.py` from the module's own shape; what each check means is in that script's header.

← [Wiki home](../README.md)

**✅ PASS** — 3/3 checks, since 2026-11-12 00:25 EST

| Check | Target | Result | Detail |
|---|---|---|---|
| pushed | [APK.softapp.EDITORS.Wirelist](https://github.com/LikeDotAudio/APK.softapp.EDITORS.Wirelist.git) | ✅ | HEAD is on origin |
| web | [index.html](https://apk.audio/APK%3ASoftapps/EDITORS/EDITORS.Wirelist/index.html) | ✅ | HTTP 200 |
| app | `OS/Cable Wirelist` → `PODS/POD.THIN/Softapps/EDITORS/EDITORS.Wirelist/index.html` | ✅ | present |

Re-run: `python3 .apk.scripts/smoke.py PODS/POD.THIN/Softapps/EDITORS/EDITORS.Wirelist`

<!-- smoke:sig 54414b016f27 since 2026-11-12 00:25 EST -->
