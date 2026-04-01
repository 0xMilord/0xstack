---
"0xstack": patch
---

Fixed issue When initIntoCurrentDir is true, effectiveDir is set to tempDir (line 103), but by the time the "normalize" step runs, the files have already been moved to targetDir. The effectiveDir variable is never updated. Now fixed on 0.1.4 patch
