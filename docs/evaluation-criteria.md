# Clinical evaluation criteria

The offline evaluation panel covers five cardiac evaluation sections. `evaluations.js` contains the evaluator; it receives numeric values from the existing report parser and returns results with supporting criteria and limitations. It does not insert diagnoses into the report.

## Measurement mapping

| Source | App input | Handling |
| --- | --- | --- |
| LA/AO | LA/Ao | Same dimensionless ratio |
| LVIDDN | LVDd and actual weight | LVDd in cm / weight^0.294; classification uses the unrounded result, with the app's supported canine weight range |
| RJarea/LAarea | LA jet / LA ratio | Percentage; source inequalities remain unresolved |
| E peak | E peak velocity | m/s |
| E/E′ | E/Em | Assumes the corresponding tissue Doppler measurement; shown explicitly |
| E/IVRT | E/IVRT | Uses the entered ratio; no inferred conversion |
| PA/AO | MPA/Ao | Same ratio for the PA enlargement indicator |
| RPAD | RPAD index | Percentage |
| LAA | LA appendage peak velocity | Source <25 cm/s becomes <0.25 m/s |
| LA max | LA diameter max. | mm in the app, divided by 10 for the SEC table's cm values as clarified by the user |

Blank, unavailable, nonfinite, negative, and nonnumeric measurements remain missing. Zero is accepted for LA FS and jet area. Percentages above 100 are withheld. Other zero measurements are treated as unavailable. A missing measurement never means an absent clinical sign.

## MMVD severity

Dogs only. The source lists Stage B2 criteria LA/AO ≥1.6, LVIDDN ≥1.7, VHS >10.5, VLAS ≥3. The app evaluates the first two and identifies the unavailable radiographic criteria. Clinical stage is not assigned without clinical and diagnostic context.

| Parameter | Mild | Moderate | Severe |
| --- | --- | --- | --- |
| RJarea/LAarea (%) | `30` | `30-70%` | `70%` |
| E peak (m/s) | <1 | 1–1.2 | >1.2 |
| IVRT (ms) | >45 | >45 | <45 |
| E/IVRT | <2 | 2–2.5 | >2.5 |
| E/E′ | <6 | 6–9.1 | >9.1 |

RJarea mild/severe entries lack inequality signs, so no grade is inferred. IVRT is not collected in the canine template and its mild/moderate bands overlap. Other parameters receive separate grades; the source provides no aggregation rule. Numeric ranges written with a dash include their endpoints.

LA pressure indicators remain separate: E >1.25 m/s, E/E′ >12, IVRT <45 ms, E/IVRT >2.5. The missing canine IVRT input is identified.

## PH probability

Dogs only. The source's PH section supplies probability, not a pressure severity grade. TR is interpreted against the count of affected anatomical sites:

| TR peak (m/s) | 0 sites | 1 site | 2 sites | 3 sites |
| --- | --- | --- | --- | --- |
| ≤3.0 | Low | Low | Intermediate | High |
| >3.0–3.4 | Intermediate | Intermediate | High | High |
| >3.4 | Intermediate | High | High | High |

Exactly 3.0 uses the source's explicit ≤3.0 row. Blank TR does not mean “not measurable.”

MPA/Ao >1.0 and RPAD <30% support **one** PA site even if both are positive. Ventricular and RA/CaVC sites remain unknown. Negative numeric PA checks cannot exclude other PA signs. The evaluator enumerates the possible site counts and returns a single probability only when all possible counts give the same result. Otherwise it shows the possible probabilities.

The source's `AT:ET(<30)` lacks an explicit scale. The app's AcT/ET field has no unit convention, so this criterion is displayed but withheld. Other uncollected source signs include PR velocity, RV outflow AT, notching, ventricular changes, RA enlargement, and CaVC enlargement. The source excludes LV underfilling as an indicator in dogs with group 2 PH.

The earlier user-supplied RPAD severity tooltip is retained independently, including its intentional mild/normal overlap. It does not replace this document's anatomical-site probability method.

## HCM severity

Cats only. The source says `HCM Stage B2(ACVIM) : Width > 4.0v, LA/AO > 1.5, LA diameter > 15mm`. Per the user's clarification, `Width > 4.0v` is ignored and omitted from the evaluation. The two LA criteria are evaluated strictly. HCM diagnosis or clinical stage is not assigned from LA measurements alone.

SEC possibility indicators LA FS <20% and LAA <25 cm/s are evaluated independently. They do not determine observed SEC status.

## Diastolic dysfunction

| Pattern | E/A | IVRT (ms) | E/E′ |
| --- | --- | --- | --- |
| Normal | 1–1.3 | 34–52 | <10 |
| Normal filling pressure (Stage 1a) | <1 | >60 | <10 |
| Elevated LV filling pressure | <1 | >60 | >10 |
| Pseudonormal diastole (Stage 2) | =1 | 37–60 | >10 |
| Restrictive diastole (Stage 3) | >2 | <37 | >10 |

All three criteria must match one column. Missing inputs, discordant patterns, and gaps (including E/E′ =10) are not forced into a stage. The feline template has all three measurements. The canine template has E/Em but lacks E/A and IVRT, so its pattern remains incomplete. The source table itself does not state a species or acquisition conditions; the panel notes this limitation.

## Cats with or without SEC

| Source variable | SEC+ | SEC− |
| --- | --- | --- |
| LA max (cm, user-confirmed unit) | 2.4 (1.3–3.1) | 1.9 (1.3–3.2) |
| LA FS % | 10 (0–37) | 20 (1–45) |

The table is descriptive group data, not a diagnostic rule. LA FS and LA max are compared against both reported ranges, including overlap and endpoints. Even membership in only one range is not interpreted as SEC status. The user confirmed that the source's LA max `mm` label should be cm. The app converts LA diameter from mm to cm for this comparison and displays both units; the original document remains unchanged. No significance level, p-value, or individual probability is invented.

## Clinical interpretation cross-check

The user-supplied document remains the implementation source. These primary consensus publications were consulted to check the distinction between echo criteria and clinical staging, PH anatomical-site probability, and SEC risk versus observed findings:

- [ACVIM MMVD consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC6524084/)
- [ACVIM canine PH consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC7097566/)
- [ACVIM feline cardiomyopathy consensus](https://pmc.ncbi.nlm.nih.gov/articles/PMC7255676/)

The app does not substitute external numerical cutoffs for ambiguous source entries.
