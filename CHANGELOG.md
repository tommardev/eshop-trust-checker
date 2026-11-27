# Changelog

## [0.1.5](https://github.com/tommardev/eshop-trust-checker/compare/v0.1.4...v0.1.5) (2026-11-27)


### Features

* verify Node runtime, guard sync-blacklist, and add preview smoke check ([#42](https://github.com/tommardev/eshop-trust-checker/issues/42)) ([f1ef998](https://github.com/tommardev/eshop-trust-checker/commit/f1ef9983bacd7bc52941353e7457b721df335bd9))

## [0.1.4](https://github.com/tommardev/eshop-trust-checker/compare/v0.1.3...v0.1.4) (2026-11-25)


### Features

* add CodeQL workflow, live CI/CodeQL badges, and governance docs ([#40](https://github.com/tommardev/eshop-trust-checker/issues/40)) ([106d9e8](https://github.com/tommardev/eshop-trust-checker/commit/106d9e8ec5c84b852d5697393bdfbcab0658a844))

## [0.1.3](https://github.com/tommardev/eshop-trust-checker/compare/v0.1.2...v0.1.3) (2026-11-25)


### Features

* CI: Add GitHub Actions PR workflow for lint, typecheck, test, and build ([#14](https://github.com/tommardev/eshop-trust-checker/issues/14)) ([#38](https://github.com/tommardev/eshop-trust-checker/issues/38)) ([6d1a7f1](https://github.com/tommardev/eshop-trust-checker/commit/6d1a7f19d7cadb4a26f142d1a2ed1f57e2d7e652))

## [0.1.2](https://github.com/tommardev/eshop-trust-checker/compare/v0.1.1...v0.1.2) (2026-11-24)


### Features

* prepare repository for Public visibility (license, SECURITY.md, community files, metadata, README badges) ([#31](https://github.com/tommardev/eshop-trust-checker/issues/31)) ([#35](https://github.com/tommardev/eshop-trust-checker/issues/35)) ([46bb95d](https://github.com/tommardev/eshop-trust-checker/commit/46bb95d6956d4a7536e2285bc30cbcb10f74a34a))

## [0.1.1](https://github.com/tommardev/eshop-trust-checker/compare/v0.1.0...v0.1.1) (2026-11-24)


### Features

* add pre-1.0 release-please automation and version sync ([#33](https://github.com/tommardev/eshop-trust-checker/issues/33)) ([#34](https://github.com/tommardev/eshop-trust-checker/issues/34)) ([4075bc2](https://github.com/tommardev/eshop-trust-checker/commit/4075bc2f6688b6e02fd1d6ef677e2737315bbf3b))
* **agents:** add universal agents suite and workflow commands ([605e5ee](https://github.com/tommardev/eshop-trust-checker/commit/605e5eea2d3b845ff85a6f93723421dbec070d40))
* align architecture shape, security boundaries, and ui layer with rules ([6e30c18](https://github.com/tommardev/eshop-trust-checker/commit/6e30c1835252146965aed75a5e4e4ca595ec7c9c))
* align Node 22.18+ runtime, multi-file npm test, and validation docs (Closes [#13](https://github.com/tommardev/eshop-trust-checker/issues/13)) ([#28](https://github.com/tommardev/eshop-trust-checker/issues/28)) ([8128390](https://github.com/tommardev/eshop-trust-checker/commit/812839099773476af06a538d692ae9ad5d6ae615))
* **audit:** penalize obsolete phone prefix 8 as unmaintained website indicator ([2e5d850](https://github.com/tommardev/eshop-trust-checker/commit/2e5d850902c7341f380f1dd254acc59ac3c8e295))
* **engine:** add audit scoring engine and orchestration pipeline ([28aee3a](https://github.com/tommardev/eshop-trust-checker/commit/28aee3ab55ebd3c40fa48acd48050472d90fa52b))
* implement JAR Modulo 11 validation and registry lookup ([#2](https://github.com/tommardev/eshop-trust-checker/issues/2)) ([#11](https://github.com/tommardev/eshop-trust-checker/issues/11)) ([56d0641](https://github.com/tommardev/eshop-trust-checker/commit/56d064105dfa300248d466f9cfc0ab54a5894acd))
* implement SSRF guardrails, domain sanitizer, and VVTAT/LB blacklist registry ([#1](https://github.com/tommardev/eshop-trust-checker/issues/1)) ([83390cd](https://github.com/tommardev/eshop-trust-checker/commit/83390cdbf82498fbc8739f96392d9ce144164bb6))
* implement TLS/SSL certificate analyzer and WHOIS/RDAP domain age detector (Closes [#3](https://github.com/tommardev/eshop-trust-checker/issues/3)) ([#12](https://github.com/tommardev/eshop-trust-checker/issues/12)) ([7b8777f](https://github.com/tommardev/eshop-trust-checker/commit/7b8777f0970a9507483b14958619fd71547b5afd))
* **services:** implement VVTAT, WHOIS, scraping, and JAR verification modules ([768006f](https://github.com/tommardev/eshop-trust-checker/commit/768006f6c276c65b04f999110558a081ccb636c1))
* **types:** define core audit data models and seed VVTAT blocked cache ([3e88eff](https://github.com/tommardev/eshop-trust-checker/commit/3e88eff826786fe1c6f2d97cb2eecb524e03d40a))


### Bug Fixes

* **scraper:** support new Lithuanian national phone prefix 0 and update test docs ([adc79b3](https://github.com/tommardev/eshop-trust-checker/commit/adc79b313ba5eded73eccd4b072d937567ebc776))
