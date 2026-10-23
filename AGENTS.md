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
