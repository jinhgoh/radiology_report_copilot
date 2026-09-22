# Radiology Report Copilot

Repository directory and package name: `radiology_report_copilot`.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)

A local web app for writing canine and feline echocardiography reports. Dogs use weight-based M-mode reference ranges; cats use fixed reference ranges at all weights.

English is the default language for project documentation, development communication, and new interface text. The current clinical report templates are in Korean and preserve the supplied template structure.

## Run the app

On Windows, double-click `run.bat`, or open `index.html` in a browser. No installation, login, or internet connection is required.

If Node.js and npm are installed, you can also start a local server from the project directory. There are no external dependencies, so `npm install` is unnecessary.

```sh
npm start
```

Open http://127.0.0.1:4173 in your browser. The server accepts connections only on the local address. Press `Ctrl+C` in the terminal to stop it.

## Use the app

1. Select the patient species (dog or cat) and enter the weight in kg. Cats accept any weight greater than zero.
2. Enter values in the B-mode, M-mode, and Doppler measurement inputs, or edit them directly in `Report preview`. Each species shows all measurements from its template, with units. LVIDDN is read-only and calculated automatically. Edit findings, diagnoses, and the author in the preview. Changing the weight updates template reference ranges while preserving your notes. Enter M-mode measurements in cm.
3. Select a sentence from a `Findings` dropdown on the left to append it to the matching assessment section. You can add several sentences in sequence; identical sentences are not added twice to the same section. Edit or remove inserted sentences in the preview. If you change or delete a section heading, restore the original heading before inserting more findings into that section.
4. Copy the report or save it as a UTF-8 TXT file.
5. Select `New patient` to start another report. Refreshing the page or closing the window discards entered data.

Positive findings from the sample are not filled in by default. The default author is GJH and can be edited in the report. Enter diagnoses and FS manually.

Switching species keeps a separate draft for each species in memory, preventing findings and measurements from carrying over between species. `New patient` clears both drafts and retains the currently selected species.

The feline template uses the supplied reference ranges unchanged: IVSd 0.3–0.6, LVDd 1.08–2.14, LVPWd 0.26–0.60, IVSs 0.4–0.9, LVDs 0.4–1.12, and LVPWs 0.43–0.98 (cm). Feline B-mode left ventricular wall thickness and LA diameter use mm. The template also supports LA FS, SEC findings, E/A, IVRT (ms), and aortic outflow and LA appendage velocities (m/s). LVIDDN appears only in canine reports.

## Reference data and calculations

- `assets_for_reference/Canine_Mmode_Refer.docx` supplies six M-mode ranges for each of 87 weight rows (0.5–40 kg). At 8.6 kg, all reference ranges match the supplied sample.
- For weights absent from the table, the app selects the nearest row. Ties use the lower weight. Both the actual and reference weights are displayed. The app does not interpolate or extrapolate, and export is disabled outside the supported range.
- Reference ranges preserve the original strings. Negative values, malformed decimals, and nonstandard precision are flagged as requiring a source check instead of being used as ranges. Currently flagged entries are LVDd/LVDs at 0.5 kg, IVSd/LVDs at 0.9 kg, and IVSd at 31.4 kg. Original values are available in the expandable reference section. These checks validate formatting; they do not establish clinical validity for every value in the source table.
- LVIDDN uses the formula `B1/B2^0.294` from Sheet1!B3 in `assets_for_reference/LVIDDN_calculator.xlsx`, with the actual patient weight and the report's LVDd value. It updates to three decimal places when you leave the editor or change the weight. If the weight or LVDd is invalid, the result remains blank. Keep the LVDd and LVIDDN labels to retain this automation. Reference-range updates apply to lines that retain the M-mode labels and parenthesis format; deleted lines are not restored.
- The app does not generate automatic diagnoses from the supplied 2024 report-criteria document. Enter DX and DDX manually.

Entered data is neither sent to a server nor saved in browser storage. All original reference files remain read-only. Check the displayed reference weight before exporting a report. Exported text retains the supplied template structure.

## Development and validation

The app uses HTML, CSS, and JavaScript without external dependencies.

- `npm test`: checks sample reference ranges, weight-selection boundaries, data structure, source-error handling, report output, and finding insertion.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/extract-reference.ps1`: reads the source DOCX and regenerates only `reference-data.js`. Reference files are not modified.

## Project structure

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Repository instructions and default language |
| `index.html` | Patient controls and report editor |
| `style.css` | Interface styles |
| `app.js` | Interface input, species-specific drafts, copying, and TXT export |
| `core.js` | Reference-range selection, report generation, and LVIDDN calculation |
| `reference-data.js` | Canine M-mode reference ranges extracted from the source table |
| `server.js` | Optional local web server |
| `run.bat` | Windows launcher using the default browser |
| `tests/` | Core logic and finding-insertion tests |
| `scripts/extract-reference.ps1` | Reference-range extraction from the source DOCX |

`assets_for_reference/` contains read-only source materials and is listed in `.gitignore`. The app runs using the included `reference-data.js`, so the original materials are not required at runtime. Regenerating reference ranges requires the source DOCX. Do not edit, overwrite, rename, move, or delete original files. Save derived files outside this directory.

Measurement inputs synchronize with template lines without replacing notes. Keep labels and units intact; a deleted, nonnumeric, or duplicated measurement line disables its input until restored. Measurements are available in memory by stable field key as numeric values (`null` for blank or unavailable values), alongside the original entered precision. No additional clinical calculations are applied.
