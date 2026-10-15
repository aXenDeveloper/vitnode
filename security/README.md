# Security advisories

`advisories.json` is the maintained list of security advisories for the packages VitNode publishes. The **Publish security advisories** workflow validates it on every pull request and, once it lands on `canary`, copies it into the public update manifest on the `update-manifest` branch - the one every VitNode installation reads once a day.

How to write an entry, how ranges match prereleases, and how to announce a vulnerability without a fix: https://vitnode.com/docs/dev/updates/security-advisories

Only real advisories belong here. Examples live in the documentation.
