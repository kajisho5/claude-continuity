// Custom skills: upload a folder through the Skills API, use it in a chat (container + code execution),
// toggle it off and delete it.
const { launch, onboard, ask, openSettings, until, text, assert } = require("../lib.cjs");
const { skillDir } = require("../fixtures/generate.cjs");

module.exports = async function skills(ctx) {
  const { app, w } = await launch(ctx);
  await onboard(w);
  await app.evaluate(({ dialog }, dir) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dir] }); }, skillDir());
  await openSettings(w, "スキル"); await w.waitForSelector(".skill-list");
  await w.click(".upload-folder"); await w.waitForSelector(".skill-list li b");
  assert.equal(await text(w.locator(".skills-notice")), "「weekly-report」をアップロードして、オンにしました。");
  assert.deepEqual(await w.locator(".skill-list li b").allTextContents(), ["weekly-report"]);
  assert.equal(await w.locator(".skill-list input").isChecked(), true);
  const files = ctx.mock.log.find(l => l.startsWith("skill files "));
  assert.equal(files, 'skill files ["weekly-report/SKILL.md","weekly-report/build.py"]', "the folder is uploaded with its files");

  await w.keyboard.press("Escape"); await w.click(".new-chat"); await ask(w, "週報を作って");
  const container = ctx.mock.log.find(l => l.startsWith("container "));
  assert.ok(container, "the request carries a container");
  assert.match(container, /"type":"custom","skill_id":"skill_\d+"/);
  assert.match(container, /tools \[.*"code_execution".*\]/);

  await openSettings(w, "スキル"); await w.waitForSelector(".skill-list li b");
  const before = (await w.evaluate(() => window.continuity.loadPrefs())).enabledSkills;
  assert.equal(before.length, 1);
  await w.locator(".skill-list input").click();
  const after = await until(() => w.evaluate(() => window.continuity.loadPrefs()), p => p.enabledSkills.length === 0, { message: "toggle off saves prefs" });
  assert.deepEqual(after.enabledSkills, []);
  assert.equal(await w.locator(".skill-list input").isChecked(), false);

  w.on("dialog", d => d.accept());
  await w.click(".skill-list .icon-btn"); await w.waitForSelector(".skill-list li.empty");
  assert.deepEqual(await w.locator(".skill-list li").allTextContents(), ["まだスキルはありません。"]);
  assert.ok(ctx.mock.log.some(l => /^DELETE \/v1\/skills\/skill_\d+\?/.test(l)), "the skill is deleted through the API");
};
