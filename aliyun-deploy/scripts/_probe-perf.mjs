import { esaCall, siteId } from "./_esa-api.mjs";
const actions = [
  "GetSitePreferenceSetting",
  "ListHttpRequestHeaderModificationRules",
  "ListSiteCustomLogs",
  "GetSiteSettingHttp",
  "GetSiteFeatureSwitch",
  "ListExpressionPaths",
  "ListSettings",
  "DescribeSite",
  "GetSiteHttpsSetting",
  "GetSiteHttp2Settings",
  "GetSiteHttp3Settings",
  "GetOriginPool",
  "ListOriginRules",
  "GetSiteOriginConfig",
  "GetSiteCustomCipherSuite",
  "GetSiteCacheRulesSetting",
];
for (const a of actions) {
  const r = await esaCall("GET", a, { SiteId: siteId() });
  console.log(a.padEnd(40), "→", r.status, r.body.Code ?? "ok");
  if (r.status === 200 && JSON.stringify(r.body).length < 1500) {
    console.log("  ", JSON.stringify(r.body).slice(0, 500));
  }
}
