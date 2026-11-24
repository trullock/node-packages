# node-packages

## Publishing

Bump the version in a package's `package.json` and push to `main`: `.github/workflows/publish.yml` tests and publishes every package whose version is newer than the one on npm. No token or 2FA code is needed, as npm trusts the workflow. If a release needs a new version of another of these packages, publish that one first.

Each package needs setting up once, after its first version has been published by hand:

```
npm trust github @trullock/<name> --repo trullock/node-packages --file publish.yml --allow-publish
```

npm drops this if nothing is published within 2 days, so do it just before releasing the package. If it was set up too late and the publish failed, rerun the workflow.
