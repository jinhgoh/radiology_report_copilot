# Radiology Report Copilot

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
<img width="1391" height="1022" alt="image" src="https://github.com/user-attachments/assets/800b7e52-9f3e-4f93-8d1e-d3b7e280ca11" />

A local web app for writing canine and feline echocardiography, abdominal ultrasound, DR (digital radiography), CT, MRI, and fluoroscopy reports. In echocardiography mode, dogs use weight-based M-mode reference ranges; cats use fixed reference ranges at all weights.

Choose **DR**, **CT**, **MRI**, or **Fluoroscopy** at the top to start an editable English template. Each includes study region, clinical history, comparison, modality-specific technique prompts, findings, impressions / differential diagnoses, recommendations, and author. These sections start blank for manual entry. Weight is optional; cardiac controls and calculations apply only to echocardiography. Copy report and Save TXT export the active draft, with filenames such as `ct_dog.txt` or `mri_cat_4kg.txt`. Each report type and species keeps its own in-memory draft; New patient clears every draft. Reopen the app to load updated report modes.

Choose **Abdominal ultrasound** at the top to start the supplied Korean abdominal template. Edit the six organ sections, diagnoses, and author in Report preview, then use Copy report or Save TXT. Weight is optional and cardiac measurements, findings, references, and evaluations are hidden in this mode. Report type and species each keep separate in-memory drafts; switching restores your edits. New patient clears all drafts. Abdominal downloads use `abdominal_ultrasound_<species>[_<weight>kg].txt`.

The Clinical evaluation panel below the measurements evaluates available MMVD criteria and parameter grades, PH probability, HCM criteria, diastolic patterns, and feline SEC group comparisons. Results update with measurements, direct report edits, weight, and species. Expand each result to review supporting criteria, missing inputs, and source ambiguities. Evaluation does not overwrite report findings or diagnoses. See [evaluation criteria and measurement mappings](docs/evaluation-criteria.md) for the exact rules and limitations. Keep `evaluations.js` with the app's other JavaScript files.

English is the default language for project documentation, development communication, and new interface text. The supplied echocardiography and abdominal ultrasound templates remain in Korean; the new DR, CT, MRI, and fluoroscopy templates are in English.

## Run the app

On Windows, double-click `run.bat` or `RadiologyReportCopilot.exe`. The app opens in its own desktop window with an embedded Microsoft Edge WebView2 browser, like LLM Choir. There are no browser tabs or address bar. `Save TXT` opens a Windows save dialog.

Use the `Always on top` checkbox below the measurements at the bottom of the left column to keep the app over other windows. Uncheck it to return to normal window behavior. It starts unchecked each time you open the app and is available in the desktop app only. The executable and window use a teal radiology icon with a stylized ribcage and heart.

The `About` button beside this checkbox opens creator and copyright information: created by Jinhyong Goh; copyright © 2026 Jinhyong Goh, all rights reserved. Commercial use of this program is prohibited without prior written consent from Jinhyong Goh. Close the popup using its `Close` button or the Escape key.

`run.bat` builds the executable on first use if it is missing. This uses Windows' .NET Framework C# compiler; no Node.js or npm is needed. Microsoft Edge WebView2 Runtime must be installed. The app works offline and needs no login. Close the window to exit; closing it discards the current draft.

Keep the executable, the three WebView2 DLLs, and the HTML/CSS/JavaScript files together in a writable folder. You can create a desktop shortcut to the executable. Its separate browser profile is stored in `.webview2/` beside the executable and is excluded from Git; report drafts are not saved. Opening `index.html` directly still works in a regular browser tab.

If Node.js and npm are installed, you can also start a local server from the project directory. There are no external dependencies, so `npm install` is unnecessary.

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser. The server accepts connections only on the local address. Press `Ctrl+C` in the terminal to stop it.

## Use the app

1. Select the patient species (dog or cat) and enter the weight in kg. Cats accept any weight greater than zero.
2. Enter values in the B-mode, M-mode, and Doppler measurement inputs, or edit them directly in `Report preview`. Each species shows all measurements from its template, with units. LVIDDN is read-only and calculated automatically. Edit findings, diagnoses, and the author in the preview. Changing the weight updates template reference ranges while preserving your notes. Choose mm (default) or cm for M-mode measurement inputs. Switching units converts M-mode inputs, report measurements, and reference ranges together; FS remains in %. LVIDDN is calculated using the equivalent value in cm.
3. Open a `Findings` section on the left, or use `Expand all` / `Collapse all` to show or hide all sentence lists. Check sentences to add them to the matching assessment section; uncheck them to remove matching sentences. Checkboxes reflect exact sentences in the preview, including manual edits, and identical sentences are not added twice. Edited sentences are preserved when they no longer match a checkbox sentence. If you change or delete a section heading, restore the original heading before changing findings in that section.
4. Copy the report or save it as a UTF-8 TXT file.
5. Select `New patient` to start another report. Refreshing the page or closing the window discards entered data.

Positive findings from the sample are not filled in by default. The default author is GJH and can be edited in the report. Enter diagnoses and FS manually.

Switching species keeps a separate draft for each species in memory, preventing findings and measurements from carrying over between species. `New patient` clears both drafts and retains the currently selected species.

The feline template uses the supplied reference ranges unchanged: IVSd 0.3–0.6, LVDd 1.08–2.14, LVPWd 0.26–0.60, IVSs 0.4–0.9, LVDs 0.4–1.12, and LVPWs 0.43–0.98 (cm). Feline B-mode left ventricular wall thickness and LA diameter use mm. The template also supports LA FS, SEC findings, E/A, IVRT (ms), and aortic outflow and LA appendage velocities (m/s). LVIDDN appears only in canine reports.

The feline LA FS tooltip shows the supplied ranges: Healthy 15.9-36.1%, HCM(asym) 7.4-29.0%, and HCM(chf) 6.4-26.6%. Labels follow the user's supplied interpretation: low at ≤15.9%, ambiguous at >15.9–29.0%, and normal at >29.0%. The shared 15.9% boundary follows the user's final “15.9 or below” rule. These overlapping group ranges do not establish a diagnosis; the tooltip notes that values above 36.1% exceed the supplied Healthy range. Blank and nonpositive values remain unclassified.

## Reference data and calculations

- `assets_for_reference/Canine_Mmode_Refer.docx` supplies six M-mode ranges for each of 87 weight rows (0.5–40 kg). At 8.6 kg, all reference ranges match the supplied sample.
- For weights absent from the table, the app selects the nearest row. Ties use the lower weight. Both the actual and reference weights are displayed. The app does not interpolate or extrapolate, and export is disabled outside the supported range.
- Reference ranges preserve the original strings. Negative values, malformed decimals, and nonstandard precision are flagged as requiring a source check instead of being used as ranges. Currently flagged entries are LVDd/LVDs at 0.5 kg, IVSd/LVDs at 0.9 kg, and IVSd at 31.4 kg. Original values are available in the expandable reference section. These checks validate formatting; they do not establish clinical validity for every value in the source table.
- LVIDDN uses the formula `B1/B2^0.294` from Sheet1!B3 in `assets_for_reference/LVIDDN_calculator.xlsx`, with the actual patient weight and the report's LVDd value. It updates to three decimal places when you leave the editor or change the weight. If the weight or LVDd is invalid, the result remains blank. Keep the LVDd and LVIDDN labels to retain this automation. Reference-range updates apply to lines that retain the M-mode labels and parenthesis format; deleted lines are not restored.
- The app does not generate automatic diagnoses from the supplied 2024 report-criteria document. Enter DX and DDX manually.

Entered data is neither sent to a server nor saved in browser storage. All original reference files remain read-only. Check the displayed reference weight before exporting a report. Exported text retains the supplied template structure.

## Development and validation

The report editor uses HTML, CSS, and JavaScript without external JavaScript dependencies. The Windows desktop host uses C# WinForms and the WebView2 SDK DLLs, copied from the existing LLM Choir app (SDK version 1.0.4022.49). The desktop app does not depend on the LLM Choir directory at runtime.

- `build.bat`: compiles the Windows x64 desktop executable. If the existing executable is in use, the build is staged as `RadiologyReportCopilot.next.exe`. Save your report, close all app windows, then use `run.bat` to apply it. HTML/CSS/JavaScript changes only require reopening the app.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-icon.ps1`: packages `assets/app-icon.png` into the multi-resolution Windows icon. Rebuild the executable after changing the icon.
- `powershell -NoProfile -STA -ExecutionPolicy Bypass -File scripts/test-desktop.ps1`: checks the compiled Always on top toggle and icon resource without opening or changing a report.
- `npm test`: checks sample reference ranges, weight-selection boundaries, data structure, source-error handling, report output, and finding insertion.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-reference.ps1`: reads the source DOCX and regenerates only `reference-data.js`. Reference files are not modified.

## Project structure

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Repository instructions and default language |
| `index.html` | Patient controls and report editor |
| `style.css` | Interface styles |
| `app.js` | Interface input, species-specific drafts, copying, and TXT export |
| `desktop-controls.js` | Window control messaging and About popup |
| `core.js` | Reference-range selection, report generation, and LVIDDN calculation |
| `reference-data.js` | Canine M-mode reference ranges extracted from the source table |
| `server.js` | Optional local web server |
| `run.bat` | Windows launcher for the standalone app window |
| `build.bat` | Compiles the Windows desktop executable |
| `DesktopApp.cs` | Native app window, embedded WebView2 browser, and TXT save dialog |
| `app.manifest` | Windows compatibility and DPI awareness |
| `RadiologyReportCopilot.ico` | Radiology icon embedded in the executable and used as the favicon |
| `assets/app-icon.png` | Original generated icon artwork; provenance and prompt in `assets/README.md` |
| `Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll` | WebView2 SDK dependencies; keep beside the executable |
| `tests/` | Core logic and finding-insertion tests |
| `scripts/extract-reference.ps1` | Reference-range extraction from the source DOCX |

`assets_for_reference/` contains read-only source materials and is listed in `.gitignore`. The app runs using the included `reference-data.js`, so the original materials are not required at runtime. Regenerating reference ranges requires the source DOCX. Do not edit, overwrite, rename, move, or delete original files. Save derived files outside this directory.

Measurement inputs synchronize with template lines without replacing notes. Keep labels and units intact; a deleted, nonnumeric, or duplicated measurement line disables its input until restored. Measurements are available in memory by stable field key as numeric values (`null` for blank or unavailable values), alongside the original entered precision.

The six M-mode dimensions show blue below their reference range, black within it (including both endpoints), and red above it, with low/normal/high labels. Hover or keyboard-focus a label to see its range in the selected mm/cm unit. Canine ranges follow the selected reference weight; feline ranges are fixed. Colors update when measurements, report values, weight, species, or units change. Blank, nonpositive, unavailable, and source-error values remain unclassified. FS and calculated LVIDDN have no supplied ranges and remain uncolored.

Canine MPA/Ao uses the supplied normal cutoff of ≤1.0. Values >1.0 appear red with a high label; the tooltip preserves `normal≤1.0 | 1.0초과시 PH의심지표+` and explains PH as pulmonary hypertension and the elevated value as an indicator of suspected PH. Blank and nonpositive values remain unclassified.

Canine RPAD index inputs use %. The supplied ranges are normal ≥30%, severe PH <22%, moderate PH strictly between 23% and 27%, and mild PH strictly between 35% and 55%. The tooltip preserves the original wording. Because the supplied mild and normal ranges overlap, values strictly between 35% and 55% remain unclassified. Gaps (22–23% and 27–<30%) also remain unclassified. Unique severe and moderate values use the below-normal color; severe values retain the bold, underlined styling. Blank and nonpositive values remain unclassified.

Hover over or keyboard-focus LA/Ao to see the supplied species-specific ranges and clinical notes. Labels and values are blue below normal, black within normal, and red above normal. Severe values also make the label, grade, and input bold and underlined. The compact grade appears between the label and input, preserving two measurements per row. Dog grades are normal below 1.3, mild from 1.3 to below 1.7, moderate from 1.7 to below 2.4, and severe from 2.4. The supplied note about suspected heart failure above 1.9 is shown in the tooltip. Cats are normal below 1.5; values at or above 1.5 display red with a high label, without assigning an unsupplied severity grade. No lower normal LA/Ao cutoff was supplied, so positive values below the upper cutoff remain normal. The feline tooltip also preserves the supplied LA-size note. Blank, unavailable, and nonpositive values are unclassified. These cues update from measurement inputs and direct report edits. Additional supplied ranges can be added to `measurementReferences` in `core.js`.
