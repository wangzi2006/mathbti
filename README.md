# MathBTI

无厘头数学人格测试。回答 28 道题，沿七个共同坐标累积分数，再与 37 个数学对象的预设坐标比较；距离最近的对象就是测试结果。

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

- `content/questions.md`：题目、选项和七维坐标增量
- `content/results.md`：37 种结果的人物小传
- `content/prototypes.json`：结果对象的目标坐标
- `content/definitions.json`：结果页使用的 LaTeX 定义与简短解释

修改后重新运行 `node scripts/build-content.mjs`，它会生成浏览器直接读取的 `site-data.js`。

## 判定方式

每个答案为七个坐标增加或减少分数。完成后，各轴按题库可达到的最小值和最大值线性归一化到 0–100，再计算与全部目标坐标的欧氏距离。若出现完全并列，则随机选择一个结果。

## 发布

网站不需要后端，可以直接托管在 GitHub Pages。
