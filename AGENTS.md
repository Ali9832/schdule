# Release workflow

- Work on the current NOAVA application on main. Never replace it with the legacy NOVA ZIP.
- For every deployable update, increment the version using MAJOR.MINOR.PATCH (Semantic Versioning): patch for compatible fixes, minor for compatible features, major for breaking changes.
- Keep package.json, both root version fields in package-lock.json, the visible app-version label in index.html, and cache names in sw.js and public/sw.js synchronized.
- API version is read from package.json. Keep existing versioned API route names compatible; do not rename API paths as part of a release bump.
- Record changes and outstanding work in CHANGELOG.md under the new version.
- Run npm run build and npm run qa, plus relevant feature tests, before publishing.
- Commit releases with `release: vX.Y.Z - description`, create an annotated `vX.Y.Z` tag, and push main and that exact tag. Never move an existing release tag.
- Use the configured author molibdengit. Do not change global Git identity.
- Report the version, commit, and verified deployment state separately. A successful push does not confirm deployment.

# Production data

- Preserve the user's existing production database records when reorganizing or removing UI sections. Removing a page does not authorize deleting its records, tables, or relationships.
- Local demo and test data must remain separate from production. Never import, seed, sync, or upload local/test records into the production database as part of a push or deployment.
- Keep local stores, test output, credentials, and backups excluded from Git and deployment artifacts.
- Production must read the configured PostgreSQL database for the signed-in user. Keep the existing refusal to use memory/demo storage when production configuration or connectivity fails.
- Before reporting a production deployment as verified, confirm its API reports PostgreSQL storage and verify the signed-in account's existing data is visible. A local memory-mode test does not verify production data.
