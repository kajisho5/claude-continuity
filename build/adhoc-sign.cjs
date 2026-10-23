// Apple Silicon refuses to run apps without a valid signature, and packaging invalidates the one Electron ships with.
// When no Developer ID certificate is configured (CSC_LINK), sign the app ad hoc so it at least launches after the
// user allows it in Gatekeeper. With a certificate, electron-builder signs (and re-signs over this) as usual.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin" || process.env.CSC_LINK) return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
};
