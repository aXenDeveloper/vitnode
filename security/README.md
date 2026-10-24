# Security updates

`security-updates.json` is the maintained list of security updates for the packages VitNode publishes. The **Publish security updates** workflow validates it on every pull request and, once it lands on `canary`, copies it into the public update manifest on the `update-manifest` branch - the one every VitNode installation reads once a day.

How to write an entry, how ranges match prereleases, and how to announce a vulnerability without a fix: https://vitnode.com/docs/dev/updates/security-updates

Only real security updates belong here. Examples live in the documentation.
