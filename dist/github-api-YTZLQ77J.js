import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/github-api.ts
init_esm_shims();
import https from "https";
async function fetchRemoteSha(input) {
  const get = input.httpsGet ?? defaultHttpsGet;
  const url = `https://api.github.com/repos/${input.owner}/${input.repo}/branches/${input.branch}`;
  const headers = {
    "User-Agent": input.userAgent ?? "teamagent-updater",
    "Accept": "application/vnd.github+json"
  };
  try {
    const res = await get(url, headers);
    if (res.statusCode !== 200) return null;
    const obj = JSON.parse(res.body);
    return obj.commit?.sha ?? null;
  } catch {
    return null;
  }
}
var defaultHttpsGet = (url, headers) => new Promise((resolve, reject) => {
  const req = https.get(url, { headers, timeout: 1e4 }, (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => resolve({
      statusCode: res.statusCode ?? 0,
      body: Buffer.concat(chunks).toString("utf-8")
    }));
    res.on("error", reject);
  });
  req.on("timeout", () => {
    req.destroy(new Error("timeout"));
  });
  req.on("error", reject);
});
export {
  fetchRemoteSha
};
