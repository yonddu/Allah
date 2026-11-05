# Character asset target

For this project's 3–4GB Android /30fps /32-person room target, provide a dressed character at **12,000 triangles total**, counting the body, face, hair, clothing, shoes and head covering together. This is an authoring budget, not a measured device-FPS guarantee. Check triangulated/exported counts;12,000 quads would normally export to about24,000 triangles.

- Preferred format: GLB with embedded textures, in metres, Y-up, feet at ground level, about1.7–1.85m tall.
- Neutral T-pose with fingers separated. Preserve any existing skeleton/skin weights; an unrigged T-pose source can also be supplied for rigging work.
- Prefer separate body and clothing meshes using the same skeleton if clothing must be interchangeable. Clothing should not include baked-in floating hands or missing backs. Female clothing must include a head covering.
- PBR base color and normal maps at1K; an optional2K face/source texture is welcome. Include roughness/metalness/AO maps when available. Use opaque materials and avoid many transparent hair layers.
- Aim for2–3 materials per dressed character. Surface embroidery and small folds should primarily use texture/normal detail; spend geometry on silhouette, face and hands.
- Detailed model target12k triangles; project authoring will derive about3–4k nearby-visitor LOD and600–1,000 distant-visitor LOD. Do not render32 full-detail12k models simultaneously by default.

Background reference budgets: Kaaba main landmark about8–12k triangles; Taj Mahal main body/dome about30–50k; a reusable column/arch piece about500–1,500. Courtyard tiles and rugs need very little geometry. These are scene-specific budgets, not generic Three.js limits.
