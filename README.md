# 项目介绍

项目由Gemini生成，主要解决多个家庭一起出行账务混乱不易拆分的问题。

传统多家庭出行，为了账目便于拆分，多半会让一个家庭先出资，或者留好所有小票最终花费大量人力结算。本项目可让您快速免费得到一个网站，可以通过手机或电脑访问，使用流程：

1. 使用您的常用设备打开网站（数据会保留在本地，如果感觉手机方便，那就一直用手机录入。如果需要跨设备同步，请使用站点里的备份和恢复功能，数据会以json文件进行流转）
2. 默认会创建一个账本，默认是印尼汇率（因为本项目是为了满足我们巴厘岛旅行做出的项目）。点击右上角设置图标，选好目的地，设置好每个家庭的名字和人数，保存设置

<img width="793" height="768" alt="image" src="https://github.com/user-attachments/assets/189e1016-d02f-48f9-b002-d7023d605147" />

3. 右下角加号，添加账单即可，网站会实时显示账单以及结算方案
<img width="1858" height="825" alt="image" src="https://github.com/user-attachments/assets/7a857f67-2148-4c53-aab1-74a5c956ab5a" />

4. 结算方案可导出为 pdf 或 markdown 格式文档，方便与他人核对账单

# Demo站

本站可放心使用，所有数据将会保留在本地，不涉及任何隐私数据上传到服务器端。

https://travel-finance-helper.netlify.app/

# 国内使用方式

本地使用请查看最下面一部分：`Run Locally`。在线部署推荐netlify，如下：

1. fork本项目
2. 进入 [https://www.netlify.com/](https://www.netlify.com/)，注册账号并链接github（可直接使用github账号登陆）
3. 导入gitlab项目，按照步骤完成自动化部署。
<img width="240" height="133" alt="image" src="https://github.com/user-attachments/assets/f8219ce3-c4e5-4416-ae9a-f7fa94f0f2b6" />


由Google AI Studio生成

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f66ae813-3846-4cf5-ac8f-3eef171417c9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

