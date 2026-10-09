# Radiology Report Copilot repository instructions

## Project identity

The repository directory and package name are `radiology_report_copilot`. Use **Radiology Report Copilot** as the display name in documentation and the app. The current app supports canine and feline echocardiography reports using Korean clinical templates.

## Default language

English is the default language. Use English for documentation, development communication, code comments, and new interface text unless the user explicitly requests another language. Preserve the language and wording of supplied clinical report templates and reference data unless the user requests their translation or modification.

## Reference assets

Treat `assets_for_reference/` and all of its contents as read-only. These files are provided solely as references for developing the program. Preserve the original files: do not edit, overwrite, rename, move, or delete them. Save any derived or modified files outside this directory.

## Persistent UI preferences

Apply these preferences to future features and changes without requiring the user to repeat them. Explicit later user instructions take precedence. Use these as defaults within the requested scope, not as a reason to redesign unrelated parts of the app.

- Keep the editor compact. Prioritize measurement inputs, selectable findings, and the report preview over explanatory text. Avoid large cards or always-visible paragraphs used only for instructions or reference information.
- Put exam instructions, draft behavior explanations, and reference details in compact information tooltips. For DR, abdominal ultrasound, CT, MRI, and fluoroscopy, use a short exam title with an information icon instead of a full instruction card.
- Across all tabs, show available reference ranges first in tooltips, followed by instructions and draft behavior explanations.
- Follow the existing echocardiography measurement-input style: a short label, unit, and input box. Show reference ranges when the user hovers over the input or its label, or focuses the input to type. Keep the tooltip available while typing. Reference text must not consume layout space when hidden.
- Reuse existing tooltip styling and behavior. Support keyboard focus, associate inputs with their reference text using accessible descriptions, and allow Escape to dismiss tooltips. Information-icon tooltips must also be accessible by focus or click.
- Arrange short options, such as DR study regions, side by side in compact rows that wrap on narrow screens. Do not use one full-width row per short option when several fit comfortably together.

## Exam and measurement behavior

- Show the Patient information box and body-weight (BW) input only for echocardiography. Other exams must ignore retained BW values for validation and exported filenames. Preserve the echo weight when switching exams; restore its normal validation when returning to echo.
- Keep the existing Dog/Cat and New patient controls available independently of the echo-only Patient information box.
- Use the report's existing species setting automatically for measurement fields and reference ranges. Do not add a second species selector or require a breed selection to use standard dog ranges.
- DR must provide editable VHS and VLAS inputs for dogs, and VHS and VHW inputs for cats, in vertebral units (`v`). Inputs and direct report edits must synchronize both ways, including clearing values. Preserve findings, units, and separate species/exam drafts. If a report slot is missing or ambiguous, disable its input with a brief explanation instead of overwriting prose.
- Keep the supplied DR ranges below available in hover/focus tooltips, rather than an always-visible reference list. Lead with the active measurement's range. Dog VHS breed ranges are supplementary tooltip references; they do not replace the general dog range automatically.

| Species | Measurement | Supplied normal range |
| --- | --- | --- |
| Dog | VHS (vertebral heart scale) | 8.7-10.7v |
| Dog | ICS (intercostal space) | 2.5-3.5 |
| Dog | VLAS (vertebral left atrial score) | < 2.3v |
| Dog | CTR (Cardio-thoracic ratio) | 0.5-0.66 |
| Cat | VHS (vertebral heart score) | 6.8-8.1v |
| Cat | ICS (intercostal space) | 2-2.5 |
| Cat | VHW (vertebral heart width) | 2.9-4.1v |

Supplementary dog VHS references, preserving the supplied breed wording: Shi-tzu 8.3-10.7v; Pomeranian 9.6-11.4v; Poodle 9.1-11.1v.
