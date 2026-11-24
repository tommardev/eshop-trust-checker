# Changelog

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
