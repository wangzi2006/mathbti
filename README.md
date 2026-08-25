# MathBTI

无厘头数学人格测试。回答 30 道题，沿五个共同坐标累积分数，再与 38 个数学对象的预设坐标比较；距离最近的对象就是测试结果。连续跳过 7 题，或累计跳过 12 题时，会进入专门结果。

本项目纯属娱乐，不提供任何有效的人格分析。

## 本地预览

先生成网站数据：

```powershell
node scripts/build-content.mjs
```

再启动任意静态文件服务器，例如：

```powershell
python -m http.server 4173
```

访问 `http://127.0.0.1:4173/`。

## 修改内容

- `content/questions.md`：题目、选项和五维坐标增量
- `content/results.md`：38 种结果的人物小传
- `content/prototypes.json`：结果对象的目标坐标
- `content/definitions.json`：结果页使用的 LaTeX 定义与简短解释

修改后重新运行 `node scripts/build-content.mjs`，它会生成浏览器直接读取的 `site-data.js`。

## 判定方式

每个答案为五个坐标增加或减少分数，权重可以是小数。完成后，每个维度以 0 为中心，负方向按该玩家已回答题目的可达最小值归一化到 -1～0，正方向按可达最大值归一化到 0～1，再计算与普通结果目标坐标的欧氏距离。结果页使用温和的非线性折算将内部坐标显示为 0～100%，但结果匹配仍使用未经折算的内部坐标。若出现完全并列，则随机选择一个结果。被跳过的题不参与坐标计算。

## 发布

网站不需要后端，可以直接托管在 GitHub Pages。

## update

```powershell
cd "E:\Ceva\Important\4-college\6-entertain\7-github\mathbti\mathbti"
git pull --ff-only origin main

# 此处手动修改 content 中的文件

node scripts/build-content.mjs
git add content site-data.js
git commit -m "Update MathBTI content"
git push origin main
```

如果 `git push` 提示远端有新修改，不要强制推送。运行：

```powershell
git pull --rebase origin main
git push origin main
```

