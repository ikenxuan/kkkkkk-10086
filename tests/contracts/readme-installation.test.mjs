import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readme = readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n')

test('README documents installable build branches and source development', () => {
  assert.match(readme, /## 安装插件/)
  assert.match(
    readme,
    /git clone --depth=1 --branch preview https:\/\/github\.com\/ikenxuan\/kkkkkk-10086\.git \.\/plugins\/kkkkkk-10086/
  )
  // 稳定线是 `master`，不是 `release`：远端只有 dev/docs/master/preview 四条分支，
  // release-and-push-build.yml 的 publish_branch 也是 master。原来这两条写 `release`
  // 是分支改名前的遗留，README 早已改对，只有断言没跟上。
  assert.match(
    readme,
    /git clone --depth=1 --branch master https:\/\/github\.com\/ikenxuan\/kkkkkk-10086\.git \.\/plugins\/kkkkkk-10086/
  )
  // 分支对应关系在 README 里是表格（`| dev | preview |`），不是同一行里的散文描述。
  assert.match(readme, /`dev`[^\n]*`preview`/)
  assert.match(readme, /`dev`[^\n]*`master`/)
  assert.match(readme, /## 开发说明/)
  assert.match(readme, /pnpm check/)
  assert.doesNotMatch(readme, /git diff --exit-code -- lib/)
})
