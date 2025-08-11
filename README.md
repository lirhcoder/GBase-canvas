# FloorMap AI - Intelligent Floor Plan Annotation Platform

基于Segment Anything Model (SAM)的智能商场楼层平面图标注平台，支持自动店铺检测、真实轮廓提取和JSON数据导出。

## 🚀 功能特性

### 核心功能
- **🎯 精确分割**: 使用Meta SAM模型进行像素级精确分割
- **🏪 自动识别**: 一键识别商场内所有店铺
- **📐 真实轮廓**: 支持非矩形形状的真实边界检测
- **💾 数据导出**: 完整的JSON格式数据导出
- **🎨 现代UI**: 基于React 18 + TypeScript的现代化界面

### 交互模式
- **Point模式**: 点击精确标注
- **Box模式**: 矩形框选标注
- **Polygon模式**: 多边形自定义标注
- **AI辅助模式**: 智能分析和建议

### 快捷键支持
- `Shift + A`: 自动检测所有店铺
- `Ctrl + E`: 导出JSON数据
- `Ctrl + X`: 清除所有标注

## 🏗️ 技术架构

### 后端 (Python Flask)
- **SAM API服务器**: `sam_api_server.py`
- **模型集成**: Meta Segment Anything Model
- **图像处理**: OpenCV, PIL
- **API端点**: RESTful API设计

### 前端 (React + TypeScript)
- **框架**: React 18, TypeScript, Vite
- **状态管理**: Zustand
- **Canvas渲染**: Konva.js
- **动画**: Framer Motion
- **图标**: Lucide React
- **样式**: Tailwind CSS

## 📦 安装运行

### 环境要求
- Python 3.8+
- Node.js 16+
- npm/yarn

### 后端设置
```bash
# 安装Python依赖
pip install flask flask-cors opencv-python numpy pillow segment-anything

# 下载SAM模型文件 (需要放在根目录)
# sam_vit_b_01ec64.pth - ViT-B SAM model

# 启动SAM API服务器
python sam_api_server.py
```

### 前端设置
```bash
# 进入前端目录
cd next_gen_frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 访问应用
- **前端界面**: http://localhost:3000
- **SAM API**: http://localhost:5000
- **API健康检查**: http://localhost:5000/api/health

## 🎮 使用指南

### 基本操作
1. **手动标注**: 选择工具模式，在地图上点击或框选
2. **自动检测**: 点击绿色闪电按钮自动识别所有店铺
3. **查看详情**: 点击标注查看店铺信息和置信度
4. **导出数据**: 点击紫色下载按钮导出JSON数据

### 店铺数据
当前支持识别 **13个店铺**:
- **レディスファッション**: シルパイ シルスチュアート, アンドクチュール, ラグナムーン, アルページュストーリー, ココディール リュクス, ノエラ, ヴィルセレクション, マーキュリー デュオ, エメ エクレ
- **インテリア・生活雑貨**: フランフラン (2店)
- **ファッション雑貨**: ダイアナ, ピーチ・ジョン

## 🚧 开发路线图

- [x] SAM模型集成
- [x] 基础标注功能
- [x] 自动店铺识别
- [x] JSON数据导出
- [x] 真实轮廓提取
- [ ] 批量图片处理
- [ ] 用户账户系统
- [ ] 云存储集成
- [ ] 移动端适配

## 📝 更新日志

### v2.0.0 (2025-08-11)
- ✨ 新增自动检测模式，一键识别所有店铺
- ✨ 添加JSON导出功能，完整数据结构导出
- 🔧 改进多边形提取算法，支持真实轮廓
- 🎨 优化UI界面，添加快捷键支持
- 📊 扩展店铺识别范围至13个店铺

### v1.0.0 (2025-08-10)
- 🎉 基础SAM集成和标注功能
- 🎯 手动点击和框选标注
- 🏪 基础店铺名称识别
- 🎨 现代化React界面

## 📄 许可证

本项目采用 MIT 许可证。

## 🙏 致谢

- Meta AI 的 Segment Anything Model
- React 和相关开源社区
- 所有贡献者和测试用户

---

**FloorMap AI** - 让楼层平面图标注变得智能和高效 🚀